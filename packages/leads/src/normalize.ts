import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { AddressInput } from "./schema.js";

export interface NormalizedPhone {
  e164: string;
  /** "mobile" | "fixed_line" | "fixed_line_or_mobile" | "voip" | "unknown" — from numbering-plan metadata, not carrier lookup. */
  lineType: string;
  valid: boolean;
}

export function normalizePhone(raw: string, defaultCountry: "US" = "US"): NormalizedPhone | null {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.length < 7) return null;
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed) return null;
  const type = parsed.getType();
  return {
    e164: parsed.number,
    lineType: type ? type.toLowerCase() : "unknown",
    valid: parsed.isValid(),
  };
}

export function normalizeEmail(raw: string | undefined): string | null {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  // Pragmatic RFC 5322 subset; deliverability is verified separately by the email provider.
  return /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) ? email : null;
}

export function normalizeName(raw: string | undefined): string | null {
  if (!raw) return null;
  const n = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!n) return null;
  return n
    .toLowerCase()
    .split(" ")
    .map((w) => w.split("-").map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : p)).join("-"))
    .join(" ");
}

// USPS Publication 28 common suffix and directional abbreviations (subset covering the vast majority of addresses).
const SUFFIX: Record<string, string> = {
  street: "ST", st: "ST", str: "ST", avenue: "AVE", ave: "AVE", av: "AVE", boulevard: "BLVD", blvd: "BLVD",
  road: "RD", rd: "RD", drive: "DR", dr: "DR", lane: "LN", ln: "LN", court: "CT", ct: "CT", circle: "CIR", cir: "CIR",
  place: "PL", pl: "PL", terrace: "TER", ter: "TER", parkway: "PKWY", pkwy: "PKWY", highway: "HWY", hwy: "HWY",
  way: "WAY", trail: "TRL", trl: "TRL", square: "SQ", sq: "SQ", point: "PT", pt: "PT", crossing: "XING", xing: "XING",
  cove: "CV", cv: "CV", loop: "LOOP", run: "RUN", pike: "PIKE", alley: "ALY", aly: "ALY",
};
const DIRECTIONAL: Record<string, string> = {
  north: "N", n: "N", south: "S", s: "S", east: "E", e: "E", west: "W", w: "W",
  northeast: "NE", ne: "NE", northwest: "NW", nw: "NW", southeast: "SE", se: "SE", southwest: "SW", sw: "SW",
};
const UNIT: Record<string, string> = { apartment: "APT", apt: "APT", unit: "UNIT", suite: "STE", ste: "STE", "#": "UNIT", number: "UNIT", no: "UNIT", lot: "LOT", building: "BLDG", bldg: "BLDG" };

export interface NormalizedAddress {
  line1: string;
  unit: string | null;
  city: string;
  state: string;
  zip5: string;
  /** Deterministic match key: "123 N MAIN ST|APT 4|SPRINGFIELD|IL|62701". */
  key: string;
}

export function normalizeStreet(line: string): { street: string; unit: string | null } {
  let s = line.normalize("NFKC").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  let unit: string | null = null;
  const unitMatch = s.match(/\s(?:(apartment|apt|unit|suite|ste|lot|building|bldg|number|no)\s*|#\s*)([a-z0-9-]+)$/);
  if (unitMatch) {
    const label = unitMatch[1] ? UNIT[unitMatch[1]] ?? "UNIT" : "UNIT";
    unit = `${label} ${unitMatch[2]!.toUpperCase()}`;
    s = s.slice(0, unitMatch.index).trim();
  }
  const tokens = s.split(" ");
  const out = tokens.map((t, i) => {
    if (DIRECTIONAL[t] && (i === 1 || i === tokens.length - 1)) return DIRECTIONAL[t];
    if (i === tokens.length - 1 && SUFFIX[t]) return SUFFIX[t];
    if (i === tokens.length - 2 && SUFFIX[t] && DIRECTIONAL[tokens[tokens.length - 1] as string]) return SUFFIX[t];
    return t.toUpperCase();
  });
  return { street: out.join(" "), unit };
}

export function normalizeAddress(a: AddressInput): NormalizedAddress {
  const { street, unit: parsedUnit } = normalizeStreet(a.line1);
  let unit = parsedUnit;
  if (a.line2) {
    const fromLine2 = normalizeStreet(`x ${a.line2}`).unit ?? a.line2.toUpperCase().replace(/\s+/g, " ").trim();
    unit = fromLine2 || unit;
  }
  const city = a.city.normalize("NFKC").replace(/\s+/g, " ").trim().toUpperCase();
  const state = a.state.trim().toUpperCase();
  const zip5 = a.zip.slice(0, 5);
  return { line1: street, unit, city, state, zip5, key: [street, unit ?? "", city, state, zip5].join("|") };
}
