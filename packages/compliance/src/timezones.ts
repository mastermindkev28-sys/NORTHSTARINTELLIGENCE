/**
 * US state → IANA time zones that cover any part of the state. Multi-zone states list every zone so quiet-hour
 * checks can apply the most restrictive window when the exact zone is unknown.
 */
export const STATE_TIME_ZONES: Readonly<Record<string, readonly string[]>> = {
  AL: ["America/Chicago"], AK: ["America/Anchorage", "America/Adak"], AZ: ["America/Phoenix", "America/Denver"],
  AR: ["America/Chicago"], CA: ["America/Los_Angeles"], CO: ["America/Denver"], CT: ["America/New_York"],
  DE: ["America/New_York"], DC: ["America/New_York"], FL: ["America/New_York", "America/Chicago"],
  GA: ["America/New_York"], HI: ["Pacific/Honolulu"], ID: ["America/Boise", "America/Los_Angeles"],
  IL: ["America/Chicago"], IN: ["America/Indiana/Indianapolis", "America/Chicago"], IA: ["America/Chicago"],
  KS: ["America/Chicago", "America/Denver"], KY: ["America/New_York", "America/Chicago"], LA: ["America/Chicago"],
  ME: ["America/New_York"], MD: ["America/New_York"], MA: ["America/New_York"], MI: ["America/Detroit", "America/Chicago"],
  MN: ["America/Chicago"], MS: ["America/Chicago"], MO: ["America/Chicago"], MT: ["America/Denver"],
  NE: ["America/Chicago", "America/Denver"], NV: ["America/Los_Angeles"], NH: ["America/New_York"], NJ: ["America/New_York"],
  NM: ["America/Denver"], NY: ["America/New_York"], NC: ["America/New_York"], ND: ["America/Chicago", "America/Denver"],
  OH: ["America/New_York"], OK: ["America/Chicago"], OR: ["America/Los_Angeles", "America/Boise"], PA: ["America/New_York"],
  RI: ["America/New_York"], SC: ["America/New_York"], SD: ["America/Chicago", "America/Denver"],
  TN: ["America/Chicago", "America/New_York"], TX: ["America/Chicago", "America/Denver"], UT: ["America/Denver"],
  VT: ["America/New_York"], VA: ["America/New_York"], WA: ["America/Los_Angeles"], WV: ["America/New_York"],
  WI: ["America/Chicago"], WY: ["America/Denver"], PR: ["America/Puerto_Rico"],
};

export const ALL_US_TIME_ZONES: readonly string[] = [...new Set(Object.values(STATE_TIME_ZONES).flat())];

export interface LocalTime {
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** YYYY-MM-DD in the local zone. */
  date: string;
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map<string, Intl.DateTimeFormat>();

export function localTime(at: Date, timeZone: string): LocalTime {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" });
    formatters.set(timeZone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(at).map((p) => [p.type, p.value]));
  return { hour: Number(parts.hour), minute: Number(parts.minute), weekday: WEEKDAY[parts.weekday as string] ?? 0, date: `${parts.year}-${parts.month}-${parts.day}` };
}
