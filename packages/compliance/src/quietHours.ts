import { ALL_US_TIME_ZONES, STATE_TIME_ZONES, localTime } from "./timezones.js";

export interface ContactWindow {
  /** Inclusive start, minutes after local midnight. */
  startMinute: number;
  /** Exclusive end, minutes after local midnight. */
  endMinute: number;
  /** Weekdays (0=Sun) on which contact is prohibited entirely. */
  prohibitedWeekdays?: number[];
  citation: string;
}

/**
 * Federal TCPA rule (47 CFR 64.1200(c)(1)): no telephone solicitations before 8:00 a.m. or after 9:00 p.m. called-party local time.
 * State overrides below are STRICTER rules the platform enforces. This table is data, reviewed by counsel; see
 * docs/SECURITY_AND_COMPLIANCE.md and docs/research/messaging-compliance-research.md. Organizations may tighten (never loosen) windows.
 */
export const FEDERAL_WINDOW: ContactWindow = { startMinute: 8 * 60, endMinute: 21 * 60, citation: "47 CFR 64.1200(c)(1)" };

export const STATE_WINDOWS: Readonly<Record<string, ContactWindow>> = {
  FL: { startMinute: 8 * 60, endMinute: 20 * 60, citation: "Fla. Stat. § 501.059 (Florida Telephone Solicitation Act)" },
  OK: { startMinute: 8 * 60, endMinute: 20 * 60, citation: "Okla. Stat. tit. 15 § 775C.1 et seq. (Oklahoma Telephone Solicitation Act)" },
};

export interface RecipientLocation {
  state?: string | null;
  /** Explicit IANA zone if known with certainty (e.g., from verified address geocoding). */
  timeZone?: string | null;
}

export function applicableWindow(state: string | null | undefined, orgOverride?: Partial<ContactWindow>): ContactWindow {
  const base = (state && STATE_WINDOWS[state.toUpperCase()]) || FEDERAL_WINDOW;
  if (!orgOverride) return base;
  // Organization overrides can only narrow the window.
  return {
    startMinute: Math.max(base.startMinute, orgOverride.startMinute ?? base.startMinute),
    endMinute: Math.min(base.endMinute, orgOverride.endMinute ?? base.endMinute),
    prohibitedWeekdays: [...new Set([...(base.prohibitedWeekdays ?? []), ...(orgOverride.prohibitedWeekdays ?? [])])],
    citation: `${base.citation}; organization policy`,
  };
}

export function candidateZones(loc: RecipientLocation): readonly string[] {
  if (loc.timeZone) return [loc.timeZone];
  const zones = loc.state ? STATE_TIME_ZONES[loc.state.toUpperCase()] : undefined;
  return zones ?? ALL_US_TIME_ZONES;
}

/** True only if `at` is inside the window in EVERY candidate zone (most-restrictive interpretation). */
export function isWithinContactWindow(at: Date, loc: RecipientLocation, orgOverride?: Partial<ContactWindow>): boolean {
  const window = applicableWindow(loc.state, orgOverride);
  return candidateZones(loc).every((zone) => {
    const t = localTime(at, zone);
    if (window.prohibitedWeekdays?.includes(t.weekday)) return false;
    const minute = t.hour * 60 + t.minute;
    return minute >= window.startMinute && minute < window.endMinute;
  });
}

/** Earliest instant ≥ `from` (5-minute resolution, up to 8 days ahead) when contact is permitted. */
export function nextContactWindowStart(from: Date, loc: RecipientLocation, orgOverride?: Partial<ContactWindow>): Date | null {
  const step = 5 * 60_000;
  let t = new Date(Math.ceil(from.getTime() / step) * step);
  const limit = from.getTime() + 8 * 86_400_000;
  while (t.getTime() <= limit) {
    if (isWithinContactWindow(t, loc, orgOverride)) return t;
    t = new Date(t.getTime() + step);
  }
  return null;
}
