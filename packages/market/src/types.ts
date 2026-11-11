/**
 * Shared types for Northstar Market Intelligence.
 *
 * Design rules (see docs/MARKET_INTELLIGENCE_ENGINE.md):
 *  1. Every function is pure and deterministic. The valuation date (`asOf`) is always an input; nothing reads the clock.
 *  2. Every observation carries its source, reporting period, retrieval time, and the geographic level it was measured at.
 *  3. Only metrics in the catalog can be scored. The catalog contains no protected characteristics or proxies for them,
 *     and a guard test enforces that structurally.
 *  4. Missing data lowers confidence; it never raises a score.
 *  5. Risk flags are reported alongside scores and are never folded away inside them.
 */

export const METHODOLOGY_VERSION = 'market-score/0.1.0';

/** Geographic levels, coarse to fine. "property" is handled by the undervaluation module, not area scoring. */
export const GEO_LEVELS = ['state', 'metro', 'city', 'zip', 'neighborhood'] as const;
export type GeoLevel = (typeof GEO_LEVELS)[number];

export const GEO_LEVEL_LABELS: Record<GeoLevel, string> = {
  state: 'State',
  metro: 'Metro area',
  city: 'City',
  zip: 'ZIP code',
  neighborhood: 'Neighborhood',
};

export interface GeoArea {
  /** Stable key, e.g. "state:42", "metro:37980", "zip:19134". Demo areas use a "demo-" code prefix. */
  key: string;
  level: GeoLevel;
  /** Official code at its level: state FIPS, CBSA code, Census place GEOID, ZCTA, or a local neighborhood id. */
  code: string;
  name: string;
  /** Parent key (state for a metro, metro for a ZIP, ...). */
  parentKey: string | null;
  stateCode: string | null;
  countyFips?: string | null;
  zcta?: string | null;
  population?: number | null;
  centroid?: { lat: number; lon: number } | null;
  isDemo: boolean;
}

/** How trustworthy a source class is in principle. Applied as the base of variable confidence. */
export const SOURCE_CLASSES = ['official', 'licensed', 'third_party', 'user', 'demo'] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

export interface SourceRef {
  /** Catalog id, e.g. "census_acs5", "bls_laus". See sources.ts. */
  id: string;
  name: string;
  class: SourceClass;
  url?: string;
}

/** One value of one metric for one area and reporting period. */
export interface MetricObservation {
  metric: string;
  value: number;
  /** Human period label, e.g. "2024", "2025-Q2", "2025-06", "2019-2023 (ACS 5-yr)". */
  period: string;
  /** ISO date the reporting period ends. Freshness is measured from here. */
  periodEnd: string;
  source: SourceRef;
  /** ISO timestamp Northstar retrieved the value. */
  retrievedAt: string;
  /** Level the value was measured at. If coarser than the area being scored, it was inherited from a parent. */
  measuredAt: GeoLevel;
  /** Forecasts are shown but excluded from scoring by default. */
  isProjection?: boolean;
  /** Share of the area's population covered by the reporting agencies (public-safety data), 0..1. */
  reportingCoverage?: number;
  note?: string;
}

export interface Citation {
  title: string;
  /** Statute, regulation, ordinance, or court rule section, e.g. "68 P.S. § 250.501". */
  section?: string;
  url?: string;
}

export type FlagSeverity = 'info' | 'caution' | 'critical';

export interface RiskFlag {
  code: string;
  severity: FlagSeverity;
  category: CategoryKey | 'data_quality';
  title: string;
  detail: string;
  evidence?: { metric?: string; value?: number | string; threshold?: number | string };
}

export const CATEGORY_KEYS = [
  'growth',
  'affordability',
  'regulatory',
  'rental_economics',
  'public_safety',
  'environmental_risk',
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export class MarketInputError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'MarketInputError';
    this.field = field;
  }
}

const DAY_MS = 86_400_000;

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a)) throw new MarketInputError('date', `invalid ISO date "${fromIso}"`);
  if (!Number.isFinite(b)) throw new MarketInputError('date', `invalid ISO date "${toIso}"`);
  return Math.floor((b - a) / DAY_MS);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function round(v: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round((v + Number.EPSILON) * f) / f;
}

export function levelIndex(level: GeoLevel): number {
  return GEO_LEVELS.indexOf(level);
}
