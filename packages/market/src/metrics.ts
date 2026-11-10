/**
 * Metric catalog: the allow-list of variables the Market Score may use.
 *
 * Each metric declares its category, direction, normalization reference range, unit, freshness window, and the
 * official source it is designed for. Anything not in this catalog is rejected by the scoring engine, which is
 * how the fair-housing exclusion list is enforced structurally rather than by convention
 * (see `assertPermittedMetricKey` and test/guardrails.test.ts).
 *
 * Reference ranges are [worst, best] in the metric's own unit. A value at `worst` normalizes to 0, at `best`
 * to 100, linearly in between and clamped. They are starting hypotheses (methodology v0.1) and are versioned with
 * METHODOLOGY_VERSION so a score is always reproducible.
 */
import { MarketInputError, type CategoryKey, type GeoLevel } from './types';

export type MetricUnit = 'pct' | 'ratio' | 'usd' | 'usd_per_sqft' | 'days' | 'per_1k' | 'per_100k' | 'index' | 'count';

export interface MetricDefinition {
  key: string;
  label: string;
  category: CategoryKey;
  /** [worst, best]. If worst > best, lower values are better. */
  reference: readonly [number, number];
  unit: MetricUnit;
  /** Default weight within its category (relative; normalized at scoring time). */
  weight: number;
  /** Observation older than this (from period end to asOf) starts losing confidence. */
  freshnessDays: number;
  /** Catalog source ids this metric is designed to be fed from. */
  sources: readonly string[];
  /** Finest level the designed sources publish at. Finer areas inherit from a parent with reduced confidence. */
  finestLevel: GeoLevel;
  description: string;
}

const Y = 365;

export const METRICS: readonly MetricDefinition[] = [
  // ------------------------------------------------------------------ Growth fundamentals
  { key: 'population_growth_5y_pct', label: 'Population growth (5 yr)', category: 'growth', reference: [-4, 10], unit: 'pct', weight: 2, freshnessDays: 2 * Y, sources: ['census_pep', 'census_acs5'], finestLevel: 'zip', description: 'Percent change in resident population over five years. An input, not a proxy for appreciation.' },
  { key: 'household_growth_5y_pct', label: 'Household growth (5 yr)', category: 'growth', reference: [-3, 10], unit: 'pct', weight: 1.5, freshnessDays: 2 * Y, sources: ['census_acs5'], finestLevel: 'zip', description: 'Percent change in occupied households over five years (household formation).' },
  { key: 'net_migration_per_1k', label: 'Net domestic migration', category: 'growth', reference: [-10, 15], unit: 'per_1k', weight: 1, freshnessDays: 2 * Y, sources: ['census_pep'], finestLevel: 'metro', description: 'Net domestic migrants per 1,000 residents, latest annual vintage.' },
  { key: 'employment_growth_1y_pct', label: 'Employment growth (1 yr)', category: 'growth', reference: [-2, 4], unit: 'pct', weight: 2, freshnessDays: 180, sources: ['bls_laus', 'bls_ces'], finestLevel: 'metro', description: 'Year-over-year change in employed residents.' },
  { key: 'unemployment_rate_pct', label: 'Unemployment rate', category: 'growth', reference: [9, 2.5], unit: 'pct', weight: 1, freshnessDays: 180, sources: ['bls_laus'], finestLevel: 'metro', description: 'Unemployment rate, not seasonally adjusted, latest month.' },
  { key: 'wage_growth_1y_pct', label: 'Wage growth (1 yr)', category: 'growth', reference: [0, 7], unit: 'pct', weight: 1, freshnessDays: Y, sources: ['bls_qcew'], finestLevel: 'metro', description: 'Year-over-year change in average weekly wage.' },
  { key: 'industry_diversification', label: 'Industry diversification', category: 'growth', reference: [0.6, 0.95], unit: 'index', weight: 1, freshnessDays: Y, sources: ['bls_qcew'], finestLevel: 'metro', description: '1 − Herfindahl index of employment shares across supersectors. Higher is more diversified.' },
  { key: 'permits_per_1k_households', label: 'Building permits per 1k households', category: 'growth', reference: [0, 12], unit: 'per_1k', weight: 1, freshnessDays: Y, sources: ['census_bps'], finestLevel: 'city', description: 'New residential units permitted per 1,000 households, trailing 12 months. Signals development and future supply.' },
  { key: 'hpi_change_5y_pct', label: 'House price change (5 yr)', category: 'growth', reference: [0, 55], unit: 'pct', weight: 1, freshnessDays: Y, sources: ['fhfa_hpi'], finestLevel: 'zip', description: 'FHFA repeat-sales index change over five years. ZIP5 values are annual and developmental.' },

  // ------------------------------------------------------------------ Affordability and undervaluation
  { key: 'price_to_income_ratio', label: 'Price-to-income ratio', category: 'affordability', reference: [7, 2.5], unit: 'ratio', weight: 2, freshnessDays: Y, sources: ['census_acs5', 'licensed_sales'], finestLevel: 'zip', description: 'Median sale price ÷ median household income.' },
  { key: 'median_price_per_sqft', label: 'Median price per sq ft', category: 'affordability', reference: [400, 70], unit: 'usd_per_sqft', weight: 1, freshnessDays: 120, sources: ['licensed_sales'], finestLevel: 'zip', description: 'Median closed-sale price per square foot, trailing 6 months.' },
  { key: 'sale_to_list_ratio', label: 'Sale-to-list ratio', category: 'affordability', reference: [1.04, 0.94], unit: 'ratio', weight: 1, freshnessDays: 120, sources: ['licensed_listings'], finestLevel: 'zip', description: 'Median closed price ÷ final list price. Lower means more negotiating room for buyers.' },
  { key: 'price_reduction_share_pct', label: 'Listings with price cuts', category: 'affordability', reference: [5, 40], unit: 'pct', weight: 1, freshnessDays: 90, sources: ['licensed_listings'], finestLevel: 'zip', description: 'Share of active listings with at least one price reduction.' },
  { key: 'median_days_on_market', label: 'Median days on market', category: 'affordability', reference: [120, 15], unit: 'days', weight: 1, freshnessDays: 90, sources: ['licensed_listings'], finestLevel: 'zip', description: 'Liquidity: median days from listing to contract. Lower means faster resale.' },
  { key: 'below_comp_sale_share_pct', label: 'Sales below comp-supported value', category: 'affordability', reference: [0, 25], unit: 'pct', weight: 1, freshnessDays: 180, sources: ['licensed_sales', 'northstar_comps'], finestLevel: 'zip', description: 'Share of recent arm\'s-length sales that closed ≥ 10% below an adjusted ≥ 3-comp value. Aggregated from property-level evidence.' },

  // ------------------------------------------------------------------ Landlord regulatory climate
  { key: 'landlord_regulatory_index', label: 'Landlord Regulatory Index', category: 'regulatory', reference: [0, 100], unit: 'index', weight: 1, freshnessDays: Y, sources: ['northstar_lri'], finestLevel: 'city', description: 'Weighted mean of individually cited regulatory factors (see Landlord Regulatory Index). Factor weights are user-adjustable.' },

  // ------------------------------------------------------------------ Rental investment economics
  { key: 'price_to_rent_ratio', label: 'Price-to-rent ratio', category: 'rental_economics', reference: [22, 8], unit: 'ratio', weight: 2, freshnessDays: Y, sources: ['census_acs5', 'licensed_rents'], finestLevel: 'zip', description: 'Median sale price ÷ annual median rent. Lower means more rent per dollar of price.' },
  { key: 'rent_growth_1y_pct', label: 'Rent growth (1 yr)', category: 'rental_economics', reference: [-2, 6], unit: 'pct', weight: 1, freshnessDays: 180, sources: ['licensed_rents'], finestLevel: 'zip', description: 'Year-over-year change in median asking rent.' },
  { key: 'rental_vacancy_rate_pct', label: 'Rental vacancy rate', category: 'rental_economics', reference: [12, 3], unit: 'pct', weight: 1, freshnessDays: Y, sources: ['census_acs5', 'census_hvs'], finestLevel: 'zip', description: 'Vacant-for-rent units ÷ rental stock.' },
  { key: 'fmr_to_market_rent_ratio', label: 'HUD FMR vs market rent (2BR)', category: 'rental_economics', reference: [0.8, 1.15], unit: 'ratio', weight: 0.5, freshnessDays: Y, sources: ['hud_fmr'], finestLevel: 'zip', description: 'HUD Fair Market Rent (or SAFMR) ÷ median market rent. A benchmark only: PHA payment standards and approved rents vary.' },
  { key: 'effective_property_tax_rate_pct', label: 'Effective property tax rate', category: 'rental_economics', reference: [2.8, 0.4], unit: 'pct', weight: 1, freshnessDays: 2 * Y, sources: ['census_acs5'], finestLevel: 'zip', description: 'Median real estate taxes paid ÷ median home value. An operating-cost measure; assessed value is never used as market value.' },

  // ------------------------------------------------------------------ Public safety (aggregate only)
  { key: 'violent_crime_per_100k', label: 'Violent crime rate', category: 'public_safety', reference: [1200, 150], unit: 'per_100k', weight: 2, freshnessDays: 2 * Y, sources: ['local_police_open_data', 'fbi_cde'], finestLevel: 'zip', description: 'Reported violent offenses per 100,000 residents, latest full year. Aggregate area statistic; never attributed to an individual property.' },
  { key: 'property_crime_per_100k', label: 'Property crime rate', category: 'public_safety', reference: [5000, 1000], unit: 'per_100k', weight: 1.5, freshnessDays: 2 * Y, sources: ['local_police_open_data', 'fbi_cde'], finestLevel: 'zip', description: 'Reported property offenses per 100,000 residents, latest full year.' },
  { key: 'violent_crime_trend_3y_pct', label: 'Violent crime trend (3 yr)', category: 'public_safety', reference: [25, -20], unit: 'pct', weight: 1, freshnessDays: 2 * Y, sources: ['local_police_open_data', 'fbi_cde'], finestLevel: 'zip', description: 'Percent change in the violent crime rate over three years. Negative is improving.' },

  // ------------------------------------------------------------------ Property and environmental risk
  { key: 'fema_nri_risk_score', label: 'FEMA National Risk Index', category: 'environmental_risk', reference: [90, 10], unit: 'index', weight: 2, freshnessDays: 3 * Y, sources: ['fema_nri'], finestLevel: 'zip', description: 'Composite natural-hazard risk score (0–100, national percentile). County and tract native; ZIP values are area-weighted from tracts.' },
  { key: 'flood_zone_share_pct', label: 'Parcels in flood hazard area', category: 'environmental_risk', reference: [25, 0], unit: 'pct', weight: 1.5, freshnessDays: 3 * Y, sources: ['fema_nfhl'], finestLevel: 'zip', description: 'Share of residential parcels intersecting a FEMA Special Flood Hazard Area.' },
  { key: 'wildfire_risk_score', label: 'Wildfire risk', category: 'environmental_risk', reference: [90, 0], unit: 'index', weight: 1, freshnessDays: 3 * Y, sources: ['fema_nri'], finestLevel: 'zip', description: 'NRI wildfire hazard score (0–100).' },
  { key: 'extreme_heat_days', label: 'Extreme heat days', category: 'environmental_risk', reference: [60, 0], unit: 'days', weight: 0.5, freshnessDays: 3 * Y, sources: ['noaa_climate'], finestLevel: 'metro', description: 'Average days per year above 95°F.' },
  { key: 'insurance_availability_index', label: 'Insurance availability', category: 'environmental_risk', reference: [0, 100], unit: 'index', weight: 1, freshnessDays: Y, sources: ['state_insurance_filings'], finestLevel: 'state', description: 'Composite of carrier participation, non-renewal rates and residual-market share. Source not yet wired; not a quote.' },
];

const BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

export function getMetric(key: string): MetricDefinition {
  const m = BY_KEY.get(key);
  if (!m) throw new MarketInputError('metric', `"${key}" is not in the metric catalog`);
  return m;
}

export function hasMetric(key: string): boolean {
  return BY_KEY.has(key);
}

export function metricsInCategory(category: CategoryKey): MetricDefinition[] {
  return METRICS.filter((m) => m.category === category);
}

/** Map a raw value onto 0..100 using the metric's reference range (direction-aware, clamped). */
export function normalizeAbsolute(def: MetricDefinition, value: number): number {
  const [worst, best] = def.reference;
  const t = (value - worst) / (best - worst);
  return Math.min(100, Math.max(0, t * 100));
}

// ---------------------------------------------------------------------------------------------
// Fair housing guardrail
// ---------------------------------------------------------------------------------------------

/**
 * Patterns for protected characteristics under the Fair Housing Act and common state additions, and for fields that
 * closely track them. A metric key matching any of these can never enter the catalog or a score.
 * Counsel should review the allow-list before launch (docs/MARKET_INTELLIGENCE_ENGINE.md §Guardrails).
 */
export const PROHIBITED_METRIC_PATTERNS: readonly RegExp[] = [
  /race|racial|ethnic|hispanic|latino|white|black|asian|minority|nonwhite/i,
  /national_?origin|foreign_?born|immigra|citizenship|language|english_?proficien|ancestry/i,
  /religio|church|mosque|synagogue|temple/i,
  /\bsex\b|gender|female|male_|_male|lgbt|sexual/i,
  /familial|children|kids|school_?age|single_?parent|household_?type|married/i,
  /disab|handicap|ssi_|medicaid/i,
  /age_?(of|median)|median_?age|elderly|senior|over_?65|under_?18/i,
  /school_?demograph|school_?composition|voucher_?holder|tenant_?screen|source_?of_?income/i,
];

export function isProhibitedMetricKey(key: string): boolean {
  return PROHIBITED_METRIC_PATTERNS.some((p) => p.test(key));
}

export function assertPermittedMetricKey(key: string): void {
  if (isProhibitedMetricKey(key)) {
    throw new MarketInputError('metric', `"${key}" matches a protected characteristic or proxy and can never be scored`);
  }
  getMetric(key);
}
