/**
 * Address and parcel-number normalization for matching. Deterministic and conservative: it
 * standardizes case, punctuation, USPS street suffixes, directionals, and unit designators, but never
 * guesses missing components.
 */
import type { NormalizedAddress, RawAddress } from './types';

const SUFFIXES: Record<string, string> = {
  ALLEY: 'ALY', AVENUE: 'AVE', AV: 'AVE', BOULEVARD: 'BLVD', BLV: 'BLVD', CIRCLE: 'CIR', COURT: 'CT', DRIVE: 'DR',
  DRV: 'DR', EXPRESSWAY: 'EXPY', HIGHWAY: 'HWY', LANE: 'LN', PARKWAY: 'PKWY', PIKE: 'PIKE', PLACE: 'PL',
  PLAZA: 'PLZ', ROAD: 'RD', SQUARE: 'SQ', STREET: 'ST', STR: 'ST', TERRACE: 'TER', TRAIL: 'TRL', WAY: 'WAY',
};
const DIRECTIONALS: Record<string, string> = {
  NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W', NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW',
};
const UNIT_WORDS = new Set(['APT', 'APARTMENT', 'UNIT', 'STE', 'SUITE', 'FL', 'FLOOR', 'RM', 'ROOM', '#']);
const STATES = new Set(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split(' '),
);

function tokens(s: string): string[] {
  return s
    .toUpperCase()
    .replace(/[.,]/g, ' ')
    .replace(/#\s*/g, ' # ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Split "123 Main St Apt 4" into street tokens and unit. */
function splitUnit(parts: string[]): { street: string[]; unit: string | null } {
  const idx = parts.findIndex((p, i) => i > 0 && UNIT_WORDS.has(p));
  if (idx === -1) return { street: parts, unit: null };
  const unit = parts.slice(idx + 1).join(' ');
  return { street: parts.slice(0, idx), unit: unit || null };
}

export function normalizeStreet(line1: string): { street: string; unit: string | null } {
  const { street, unit } = splitUnit(tokens(line1));
  const out = street.map((t, i) => {
    if (i === 0) return t.replace(/^0+(?=\d)/, '');
    if (DIRECTIONALS[t]) return DIRECTIONALS[t]!;
    if (i === street.length - 1 && SUFFIXES[t]) return SUFFIXES[t]!;
    return t;
  });
  return { street: out.join(' '), unit };
}

export function normalizePostalCode(v: string | undefined | null): string | null {
  if (!v) return null;
  const m = /^\s*(\d{5})(?:-?\d{4})?\s*$/.exec(v);
  return m ? m[1]! : null;
}

export function normalizeState(v: string | undefined | null): string | null {
  if (!v) return null;
  const s = v.trim().toUpperCase();
  return STATES.has(s) ? s : null;
}

export function normalizeAddress(raw: RawAddress): NormalizedAddress | null {
  if (!raw.line1 || !raw.line1.trim()) return null;
  const { street, unit: parsedUnit } = normalizeStreet(raw.line1);
  if (!street) return null;
  const explicitUnit = raw.unit ? tokens(raw.unit).filter((t) => !UNIT_WORDS.has(t)).join(' ') || null : null;
  const unit = explicitUnit ?? parsedUnit;
  const postalCode = normalizePostalCode(raw.postalCode);
  const city = raw.city?.trim() ? raw.city.trim().toUpperCase().replace(/\s+/g, ' ') : null;
  return {
    line1: street,
    unit,
    city,
    state: normalizeState(raw.state),
    postalCode,
    key: `${street}|${unit ?? ''}|${postalCode ?? ''}`,
  };
}

/**
 * Normalize a parcel number for comparison within one county. Only separators and whitespace are
 * removed and case is uppercased; leading zeros are kept because some counties treat them as
 * significant. APNs are only comparable within the same county (`countyFips`).
 */
export function normalizeApn(apn: string | undefined | null): string | null {
  if (!apn) return null;
  const v = apn.toUpperCase().replace(/[\s\-./]/g, '');
  return v.length > 0 ? v : null;
}

/** Normalize a party name for comparison: uppercase, strip punctuation and common entity suffixes. */
export function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,'"]/g, '')
    .replace(/\b(LLC|L L C|INC|CORP|CORPORATION|CO|LTD|LP|LLP|TRUST|TR|TRUSTEE|ET AL|ETAL|ESTATE OF|EST)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaro-Winkler similarity in [0, 1]. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return a.length === 0 ? 0 : 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aM = new Array<boolean>(a.length).fill(false);
  const bM = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - range);
    const hi = Math.min(i + range + 1, b.length);
    for (let j = lo; j < hi; j++) {
      if (bM[j] || a[i] !== b[j]) continue;
      aM[i] = bM[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}
