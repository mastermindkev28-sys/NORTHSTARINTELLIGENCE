import { ALL_US_TIME_ZONES, STATE_TIME_ZONES, localTime } from "./timezones";

export interface ContactWindow {
  /** Inclusive start, minutes after local midnight. */
  startMinute: number;
  /** Exclusive end, minutes after local midnight. */
  endMinute: number;
  /** Weekdays (0=Sun) on which contact is prohibited entirely. */
  prohibitedWeekdays?: number[];
  citation: string;
}

/** Federal TCPA/TSR rule: no telephone solicitation before 8 a.m. or after 9 p.m. called-party local time. */
export const FEDERAL_WINDOW: ContactWindow = {
  startMinute: 8 * 60,
  endMinute: 21 * 60,
  citation: "47 CFR 64.1200(c)(1); 16 CFR 310.4(c)",
};

/**
 * Northstar platform policy: 08:00–20:00 everywhere. Stricter than federal law, matching the FL/OK/MD mini-TCPAs,
 * because a number's area code, the property, and the owner's mailing address can each pull in a stricter state.
 * Source: docs/research/messaging-compliance-research.md §9.4. Counsel-reviewed policy data; tighten only.
 */
export const PLATFORM_DEFAULT_WINDOW: ContactWindow = {
  startMinute: 8 * 60,
  endMinute: 20 * 60,
  citation: "Northstar policy (strictest common state window)",
};

export const STATE_WINDOWS: Readonly<Record<string, ContactWindow>> = {
  FL: { startMinute: 8 * 60, endMinute: 20 * 60, citation: "Fla. Stat. § 501.616(6)" },
  OK: {
    startMinute: 8 * 60,
    endMinute: 20 * 60,
    citation: "15 O.S. § 775C.1 et seq. (verify statute text)",
  },
  MD: { startMinute: 8 * 60, endMinute: 20 * 60, citation: "Md. Code Com. Law § 14-4502(c)" },
  // Reported 9 a.m. start — unverified; applied conservatively until counsel confirms.
  CT: { startMinute: 9 * 60, endMinute: 20 * 60, citation: "Connecticut (reported; verify)" },
};

/** States whose statutes presume an in-state area code means an in-state resident (FL, OK, MD), plus CT for conservative windows. */
export const AREA_CODE_STATES: Readonly<Record<string, string>> = Object.fromEntries([
  ...[
    "239",
    "305",
    "321",
    "324",
    "352",
    "386",
    "407",
    "448",
    "561",
    "645",
    "656",
    "689",
    "727",
    "728",
    "754",
    "772",
    "786",
    "813",
    "850",
    "863",
    "904",
    "941",
    "954",
  ].map((a) => [a, "FL"]),
  ...["405", "539", "572", "580", "918"].map((a) => [a, "OK"]),
  ...["227", "240", "301", "410", "443", "667"].map((a) => [a, "MD"]),
  ...["203", "475", "860", "959"].map((a) => [a, "CT"]),
]);

export function areaCodeState(e164: string | null | undefined): string | null {
  const m = e164?.match(/^\+1(\d{3})\d{7}$/);
  return m ? (AREA_CODE_STATES[m[1] as string] ?? null) : null;
}

export interface RecipientLocation {
  /** Every state plausibly tied to the recipient: property, mailing address, known location. */
  states?: readonly string[] | null;
  /** Deprecated single-state form; merged into `states`. */
  state?: string | null;
  /** Explicit IANA zone if known with certainty. */
  timeZone?: string | null;
  /** Used for the area-code residency presumption. */
  phoneE164?: string | null;
}

export function applicableStates(loc: RecipientLocation): string[] {
  const s = new Set<string>();
  for (const st of loc.states ?? []) if (st) s.add(st.toUpperCase());
  if (loc.state) s.add(loc.state.toUpperCase());
  const ac = areaCodeState(loc.phoneE164);
  if (ac) s.add(ac);
  return [...s];
}

export function isLocationKnown(loc: RecipientLocation): boolean {
  return !!loc.timeZone || applicableStates(loc).some((s) => STATE_TIME_ZONES[s] !== undefined);
}

/** Latest start and earliest end across the platform default, every applicable state, and organization policy. */
export function applicableWindow(
  loc: RecipientLocation | string | null | undefined,
  orgOverride?: Partial<ContactWindow>,
): ContactWindow {
  const location: RecipientLocation = typeof loc === "string" ? { state: loc } : (loc ?? {});
  const windows = [
    PLATFORM_DEFAULT_WINDOW,
    ...applicableStates(location)
      .map((s) => STATE_WINDOWS[s])
      .filter((w): w is ContactWindow => !!w),
  ];
  if (orgOverride)
    windows.push({
      startMinute: orgOverride.startMinute ?? 0,
      endMinute: orgOverride.endMinute ?? 24 * 60,
      prohibitedWeekdays: orgOverride.prohibitedWeekdays,
      citation: "organization policy",
    });
  return {
    startMinute: Math.max(...windows.map((w) => w.startMinute)),
    endMinute: Math.min(...windows.map((w) => w.endMinute)),
    prohibitedWeekdays: [...new Set(windows.flatMap((w) => w.prohibitedWeekdays ?? []))],
    citation: [...new Set(windows.map((w) => w.citation))].join("; "),
  };
}

export function candidateZones(loc: RecipientLocation): readonly string[] {
  if (loc.timeZone) return [loc.timeZone];
  const zones = new Set<string>();
  for (const s of applicableStates(loc)) for (const z of STATE_TIME_ZONES[s] ?? []) zones.add(z);
  return zones.size ? [...zones] : ALL_US_TIME_ZONES;
}

/** True only if `at` is inside the window in EVERY candidate zone (most-restrictive interpretation). */
export function isWithinContactWindow(
  at: Date,
  loc: RecipientLocation,
  orgOverride?: Partial<ContactWindow>,
): boolean {
  const window = applicableWindow(loc, orgOverride);
  return candidateZones(loc).every((zone) => {
    const t = localTime(at, zone);
    if (window.prohibitedWeekdays?.includes(t.weekday)) return false;
    const minute = t.hour * 60 + t.minute;
    return minute >= window.startMinute && minute < window.endMinute;
  });
}

/** Earliest instant ≥ `from` (5-minute resolution, up to 8 days ahead) when contact is permitted. */
export function nextContactWindowStart(
  from: Date,
  loc: RecipientLocation,
  orgOverride?: Partial<ContactWindow>,
): Date | null {
  const step = 5 * 60_000;
  let t = new Date(Math.ceil(from.getTime() / step) * step);
  const limit = from.getTime() + 8 * 86_400_000;
  while (t.getTime() <= limit) {
    if (isWithinContactWindow(t, loc, orgOverride)) return t;
    t = new Date(t.getTime() + step);
  }
  return null;
}
