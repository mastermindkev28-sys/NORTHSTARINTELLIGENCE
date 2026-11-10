/**
 * DEMO DATASET: fictional geographies with illustrative values. Not real statistics.
 *
 * Every observation carries source class "demo" and every area isDemo = true, so the UI always labels it. The dataset
 * is deterministic (seeded hash, no randomness) and deliberately includes the situations the engine must handle:
 * missing crime data, partial reporting coverage, inherited metro-level data, an "inexpensive but exposed" market,
 * local rent control, a pending regulatory change, and two vintages so monitoring has something to compare.
 */
import { METRICS, getMetric } from './metrics';
import { sourceRef } from './sources';
import type { RegulatoryFactorRow } from './regulatory';
import { levelIndex, round, type GeoArea, type GeoLevel, type MetricObservation } from './types';

type Values = Partial<Record<string, number>>;

interface DemoMetro {
  code: string;
  name: string;
  state: string;
  population: number;
  /** Current-vintage values. */
  v: Values;
  /** Change from prior vintage to current, in metric units (prior = current − delta). */
  d?: Values;
  /** Metrics deliberately absent for this metro. */
  missing?: string[];
  reportingCoverage?: number;
  zipNames: string[];
}

interface DemoState { code: string; name: string; abbr: string; insurance: number; insurancePrior: number }

export const DEMO_STATES: DemoState[] = [
  { code: 'demo-s1', name: 'Avalon', abbr: 'AV', insurance: 62, insurancePrior: 66 },
  { code: 'demo-s2', name: 'Brightwater', abbr: 'BW', insurance: 78, insurancePrior: 78 },
  { code: 'demo-s3', name: 'Cedar Plains', abbr: 'CP', insurance: 48, insurancePrior: 58 },
  { code: 'demo-s4', name: 'Dunmore', abbr: 'DM', insurance: 31, insurancePrior: 40 },
];

const base = (o: Values): Values => o;

export const DEMO_METROS: DemoMetro[] = [
  {
    code: 'demo-m11', name: 'Harbor City', state: 'demo-s1', population: 2_400_000, zipNames: ['Harborfront', 'Old Quarter', 'Eastbank', 'Marina Heights'],
    v: base({ population_growth_5y_pct: 4.1, household_growth_5y_pct: 5.2, net_migration_per_1k: 1.5, employment_growth_1y_pct: 1.8, unemployment_rate_pct: 3.9, wage_growth_1y_pct: 4.4, industry_diversification: 0.91, permits_per_1k_households: 6.5, hpi_change_5y_pct: 38, price_to_income_ratio: 6.4, median_price_per_sqft: 365, sale_to_list_ratio: 1.01, price_reduction_share_pct: 14, median_days_on_market: 24, below_comp_sale_share_pct: 4, price_to_rent_ratio: 21, rent_growth_1y_pct: 3.8, rental_vacancy_rate_pct: 4.1, fmr_to_market_rent_ratio: 0.88, effective_property_tax_rate_pct: 1.1, violent_crime_per_100k: 520, property_crime_per_100k: 2900, violent_crime_trend_3y_pct: -6, fema_nri_risk_score: 74, flood_zone_share_pct: 12, wildfire_risk_score: 12, extreme_heat_days: 6 }),
    d: { median_price_per_sqft: 14, rent_growth_1y_pct: -0.4, flood_zone_share_pct: 2 },
  },
  {
    code: 'demo-m12', name: 'Ironwood', state: 'demo-s1', population: 410_000, zipNames: ['Foundry Row', 'Millgate', 'North Ironwood', 'Riverside Flats'],
    v: base({ population_growth_5y_pct: -1.6, household_growth_5y_pct: 0.4, net_migration_per_1k: -3.5, employment_growth_1y_pct: 0.3, unemployment_rate_pct: 6.8, wage_growth_1y_pct: 3.1, industry_diversification: 0.74, permits_per_1k_households: 1.2, hpi_change_5y_pct: 29, price_to_income_ratio: 2.6, median_price_per_sqft: 82, sale_to_list_ratio: 0.95, price_reduction_share_pct: 31, median_days_on_market: 58, below_comp_sale_share_pct: 17, price_to_rent_ratio: 8.6, rent_growth_1y_pct: 2.1, rental_vacancy_rate_pct: 9.6, fmr_to_market_rent_ratio: 1.12, effective_property_tax_rate_pct: 2.6, violent_crime_per_100k: 1050, property_crime_per_100k: 4300, violent_crime_trend_3y_pct: 12, fema_nri_risk_score: 33, flood_zone_share_pct: 3, wildfire_risk_score: 4, extreme_heat_days: 4 }),
    d: { unemployment_rate_pct: 0.9, violent_crime_trend_3y_pct: 8, population_growth_5y_pct: -0.8 },
  },
  {
    code: 'demo-m21', name: 'Lakeview Falls', state: 'demo-s2', population: 690_000, zipNames: ['Falls Center', 'Westlake', 'Orchard Park', 'Canal District'],
    v: base({ population_growth_5y_pct: 6.2, household_growth_5y_pct: 7.4, net_migration_per_1k: 7.8, employment_growth_1y_pct: 2.6, unemployment_rate_pct: 3.4, wage_growth_1y_pct: 5.1, industry_diversification: 0.88, permits_per_1k_households: 8.1, hpi_change_5y_pct: 34, price_to_income_ratio: 3.5, median_price_per_sqft: 148, sale_to_list_ratio: 0.98, price_reduction_share_pct: 21, median_days_on_market: 29, below_comp_sale_share_pct: 9, price_to_rent_ratio: 11.8, rent_growth_1y_pct: 4.6, rental_vacancy_rate_pct: 5.2, fmr_to_market_rent_ratio: 1.02, effective_property_tax_rate_pct: 1.3, violent_crime_per_100k: 360, property_crime_per_100k: 2100, violent_crime_trend_3y_pct: -9, fema_nri_risk_score: 28, flood_zone_share_pct: 2.5, wildfire_risk_score: 6, extreme_heat_days: 9 }),
    d: { employment_growth_1y_pct: 0.7, rent_growth_1y_pct: 1.1, median_price_per_sqft: 9 },
  },
  {
    code: 'demo-m22', name: 'Millbrook', state: 'demo-s2', population: 180_000, zipNames: ['Millbrook Center', 'Stonebridge', 'Elm Hollow', 'South Millbrook'],
    v: base({ population_growth_5y_pct: 2.4, household_growth_5y_pct: 3.6, net_migration_per_1k: 2.2, employment_growth_1y_pct: 1.4, unemployment_rate_pct: 4.2, wage_growth_1y_pct: 3.9, industry_diversification: 0.79, permits_per_1k_households: 4.1, hpi_change_5y_pct: 31, price_to_income_ratio: 3.1, median_price_per_sqft: 121, sale_to_list_ratio: 0.97, price_reduction_share_pct: 24, median_days_on_market: 41, below_comp_sale_share_pct: 11, price_to_rent_ratio: 10.4, rent_growth_1y_pct: 3.2, rental_vacancy_rate_pct: 6.1, fmr_to_market_rent_ratio: 1.06, effective_property_tax_rate_pct: 1.5, fema_nri_risk_score: 22, flood_zone_share_pct: 4, wildfire_risk_score: 5, extreme_heat_days: 7 }),
    missing: ['violent_crime_per_100k', 'property_crime_per_100k', 'violent_crime_trend_3y_pct'],
  },
  {
    code: 'demo-m31', name: 'Northgate', state: 'demo-s3', population: 1_600_000, zipNames: ['Northgate Core', 'Mesa Vista', 'Copper Ridge', 'Sunfield'],
    v: base({ population_growth_5y_pct: 9.4, household_growth_5y_pct: 10.8, net_migration_per_1k: 13.1, employment_growth_1y_pct: 3.3, unemployment_rate_pct: 3.7, wage_growth_1y_pct: 4.8, industry_diversification: 0.86, permits_per_1k_households: 11.4, hpi_change_5y_pct: 52, price_to_income_ratio: 5.1, median_price_per_sqft: 228, sale_to_list_ratio: 0.97, price_reduction_share_pct: 33, median_days_on_market: 47, below_comp_sale_share_pct: 7, price_to_rent_ratio: 17.2, rent_growth_1y_pct: -0.8, rental_vacancy_rate_pct: 8.2, fmr_to_market_rent_ratio: 0.97, effective_property_tax_rate_pct: 0.8, violent_crime_per_100k: 430, property_crime_per_100k: 2700, violent_crime_trend_3y_pct: 2, fema_nri_risk_score: 61, flood_zone_share_pct: 3, wildfire_risk_score: 71, extreme_heat_days: 48 }),
    d: { rent_growth_1y_pct: -3.1, rental_vacancy_rate_pct: 1.9, price_reduction_share_pct: 9, wildfire_risk_score: 4 },
    reportingCoverage: 0.72,
  },
  {
    code: 'demo-m32', name: 'Pinecrest', state: 'demo-s3', population: 260_000, zipNames: ['University Hill', 'Pinecrest Commons', 'Aspen Glen', 'Rail Yards'],
    v: base({ population_growth_5y_pct: 3.8, household_growth_5y_pct: 4.9, net_migration_per_1k: 3.4, employment_growth_1y_pct: 1.9, unemployment_rate_pct: 3.2, wage_growth_1y_pct: 4.2, industry_diversification: 0.71, permits_per_1k_households: 5.6, hpi_change_5y_pct: 36, price_to_income_ratio: 4.4, median_price_per_sqft: 196, sale_to_list_ratio: 0.99, price_reduction_share_pct: 17, median_days_on_market: 27, below_comp_sale_share_pct: 5, price_to_rent_ratio: 14.6, rent_growth_1y_pct: 3.4, rental_vacancy_rate_pct: 4.4, fmr_to_market_rent_ratio: 0.95, effective_property_tax_rate_pct: 0.9, violent_crime_per_100k: 280, property_crime_per_100k: 2300, violent_crime_trend_3y_pct: -4, fema_nri_risk_score: 38, flood_zone_share_pct: 2, wildfire_risk_score: 44, extreme_heat_days: 22 }),
  },
  {
    code: 'demo-m41', name: 'Redstone', state: 'demo-s4', population: 520_000, zipNames: ['Bayou Point', 'Redstone Center', 'Delta Gardens', 'Levee Heights'],
    v: base({ population_growth_5y_pct: 1.1, household_growth_5y_pct: 2.3, net_migration_per_1k: -0.6, employment_growth_1y_pct: 1.0, unemployment_rate_pct: 4.9, wage_growth_1y_pct: 3.5, industry_diversification: 0.69, permits_per_1k_households: 3.2, hpi_change_5y_pct: 22, price_to_income_ratio: 2.8, median_price_per_sqft: 96, sale_to_list_ratio: 0.95, price_reduction_share_pct: 34, median_days_on_market: 66, below_comp_sale_share_pct: 15, price_to_rent_ratio: 9.1, rent_growth_1y_pct: 2.4, rental_vacancy_rate_pct: 8.8, fmr_to_market_rent_ratio: 1.08, effective_property_tax_rate_pct: 0.9, violent_crime_per_100k: 690, property_crime_per_100k: 3600, violent_crime_trend_3y_pct: -3, fema_nri_risk_score: 88, flood_zone_share_pct: 24, wildfire_risk_score: 3, extreme_heat_days: 41 }),
    d: { flood_zone_share_pct: 6, fema_nri_risk_score: 5 },
  },
  {
    code: 'demo-m42', name: 'Silver Bay', state: 'demo-s4', population: 340_000, zipNames: ['Silver Bay North', 'Lighthouse', 'Cannery Row', 'Bayview Terrace'],
    v: base({ population_growth_5y_pct: 4.6, household_growth_5y_pct: 5.8, net_migration_per_1k: 5.2, employment_growth_1y_pct: 2.2, unemployment_rate_pct: 3.8, wage_growth_1y_pct: 4.5, industry_diversification: 0.83, permits_per_1k_households: 6.9, hpi_change_5y_pct: 30, price_to_income_ratio: 3.3, median_price_per_sqft: 132, sale_to_list_ratio: 0.97, price_reduction_share_pct: 23, median_days_on_market: 33, below_comp_sale_share_pct: 10, price_to_rent_ratio: 10.9, rent_growth_1y_pct: 3.9, rental_vacancy_rate_pct: 5.6, fmr_to_market_rent_ratio: 1.04, effective_property_tax_rate_pct: 1.0, violent_crime_per_100k: 410, property_crime_per_100k: 2500, violent_crime_trend_3y_pct: -11, fema_nri_risk_score: 46, flood_zone_share_pct: 6, wildfire_risk_score: 4, extreme_heat_days: 19 }),
    d: { employment_growth_1y_pct: 0.5, violent_crime_trend_3y_pct: -5 },
  },
];

/** Deterministic hash → [-1, 1]. */
function jitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** Period end per metric cadence, for current (0) or prior (1) vintage. */
function periodFor(metric: string, vintage: 0 | 1): { period: string; periodEnd: string } {
  const def = getMetric(metric);
  const y = 2026 - vintage;
  if (def.freshnessDays <= 120) return { period: `${y}-09`, periodEnd: `${y}-09-30` };
  if (def.freshnessDays <= 180) return { period: `${y}-08`, periodEnd: `${y}-08-31` };
  if (def.freshnessDays <= 365) return { period: `${y - 1}`, periodEnd: `${y - 1}-12-31` };
  return { period: `${y - 6}–${y - 2} (5-yr)`, periodEnd: `${y - 2}-12-31` };
}

const ZIP_SPREAD: Partial<Record<string, number>> = { median_price_per_sqft: 0.35, price_to_income_ratio: 0.25, price_to_rent_ratio: 0.2, violent_crime_per_100k: 0.45, property_crime_per_100k: 0.3, flood_zone_share_pct: 0.8, below_comp_sale_share_pct: 0.4, median_days_on_market: 0.3, rental_vacancy_rate_pct: 0.3, fema_nri_risk_score: 0.15, population_growth_5y_pct: 0.5, household_growth_5y_pct: 0.4 };

function decimals(metric: string) {
  const u = getMetric(metric).unit;
  return u === 'ratio' || u === 'index' ? 2 : u === 'usd_per_sqft' || u === 'per_100k' || u === 'days' ? 0 : 1;
}

const RETRIEVED = ['2026-10-15T00:00:00Z', '2025-10-15T00:00:00Z'] as const;

function obs(metric: string, value: number, vintage: 0 | 1, measuredAt: GeoLevel, coverage?: number): MetricObservation {
  return { metric, value: round(value, decimals(metric)), ...periodFor(metric, vintage), source: sourceRef('demo'), retrievedAt: RETRIEVED[vintage], measuredAt, ...(coverage !== undefined && getMetric(metric).category === 'public_safety' ? { reportingCoverage: coverage } : {}) };
}

export interface DemoDataset {
  areas: GeoArea[];
  observations: Map<string, MetricObservation[]>;
  regulatory: RegulatoryFactorRow[];
}

function build(): DemoDataset {
  const areas: GeoArea[] = [];
  const observations = new Map<string, MetricObservation[]>();
  const push = (k: string, o: MetricObservation) => (observations.get(k) ?? observations.set(k, []).get(k)!).push(o);

  for (const s of DEMO_STATES) {
    const metros = DEMO_METROS.filter((m) => m.state === s.code);
    const stateKey = `state:${s.code}`;
    areas.push({ key: stateKey, level: 'state', code: s.code, name: `${s.name} (Demo)`, parentKey: null, stateCode: s.abbr, population: metros.reduce((a, m) => a + m.population, 0) * 1.6, isDemo: true });
    push(stateKey, obs('insurance_availability_index', s.insurance, 0, 'state'));
    push(stateKey, obs('insurance_availability_index', s.insurancePrior, 1, 'state'));
    for (const def of METRICS) {
      if (def.key === 'insurance_availability_index' || def.key === 'landlord_regulatory_index') continue;
      const present = metros.filter((m) => m.v[def.key] !== undefined && !m.missing?.includes(def.key));
      if (!present.length) continue;
      const totalPop = present.reduce((a, m) => a + m.population, 0);
      for (const vint of [0, 1] as const) {
        const val = present.reduce((a, m) => a + (m.v[def.key]! - (vint ? (m.d?.[def.key] ?? 0) : 0)) * m.population, 0) / totalPop;
        push(stateKey, obs(def.key, val, vint, 'state', Math.min(...present.map((m) => m.reportingCoverage ?? 0.97))));
      }
    }
    for (const m of metros) {
      const metroKey = `metro:${m.code}`;
      areas.push({ key: metroKey, level: 'metro', code: m.code, name: `${m.name}, ${s.abbr}`, parentKey: stateKey, stateCode: s.abbr, population: m.population, isDemo: true });
      push(metroKey, obs('insurance_availability_index', s.insurance, 0, 'state'));
      push(metroKey, obs('insurance_availability_index', s.insurancePrior, 1, 'state'));
      m.zipNames.forEach((zn, zi) => {
        const zipCode = `${m.code.replace('demo-m', 'D')}${String(zi + 1).padStart(2, '0')}`;
        const zipKey = `zip:demo-${zipCode}`;
        areas.push({ key: zipKey, level: 'zip', code: `demo-${zipCode}`, name: `${zn} (${zipCode})`, parentKey: metroKey, stateCode: s.abbr, zcta: null, population: Math.round((m.population / 4) * (1 + 0.4 * jitter(zipKey))), isDemo: true });
        push(zipKey, obs('insurance_availability_index', s.insurance, 0, 'state'));
        push(zipKey, obs('insurance_availability_index', s.insurancePrior, 1, 'state'));
      });
      for (const def of METRICS) {
        const val = m.v[def.key];
        if (val === undefined || m.missing?.includes(def.key)) continue;
        for (const vint of [0, 1] as const) {
          const v = val - (vint ? (m.d?.[def.key] ?? 0) : 0);
          push(metroKey, obs(def.key, v, vint, 'metro', m.reportingCoverage ?? 0.97));
          m.zipNames.forEach((_, zi) => {
            const zipKey = `zip:demo-${m.code.replace('demo-m', 'D')}${String(zi + 1).padStart(2, '0')}`;
            if (levelIndex(def.finestLevel) < levelIndex('zip')) {
              push(zipKey, obs(def.key, v, vint, 'metro', m.reportingCoverage ?? 0.97));
            } else {
              const spread = ZIP_SPREAD[def.key] ?? 0.1;
              const zv = v + Math.abs(v || 1) * spread * jitter(`${zipKey}:${def.key}`);
              push(zipKey, obs(def.key, def.unit === 'pct' && def.key.includes('share') ? Math.max(0, zv) : zv, vint, 'zip', m.reportingCoverage ?? 0.97));
            }
          });
        }
      }
      // A labeled projection, to show that forecasts are displayed but never scored.
      if (m.v.population_growth_5y_pct !== undefined) push(metroKey, { ...obs('population_growth_5y_pct', m.v.population_growth_5y_pct * 1.05, 0, 'metro'), period: '2026–2031 projection', periodEnd: '2031-06-30', isProjection: true, note: 'Demo projection; excluded from scoring.' });
    }
  }
  return { areas, observations, regulatory: demoRegulatoryRows() };
}

function demoRegulatoryRows(): RegulatoryFactorRow[] {
  const cite = (j: string) => ({ title: `Demo statute, ${j}`, section: 'Illustrative only' });
  const rows: RegulatoryFactorRow[] = [];
  const add = (key: string, name: string, level: 'state' | 'city', vals: Record<string, string | number | boolean | null>, effectiveDate: string | null = null) => {
    for (const [factor, value] of Object.entries(vals)) rows.push({ jurisdictionKey: key, jurisdictionName: name, jurisdictionLevel: level, factor, value, citation: cite(name), effectiveDate, retrievedAt: '2026-10-15T00:00:00Z', verification: 'demo' });
  };
  // Avalon: tenant-protective state.
  add('state:demo-s1', 'Avalon (Demo)', 'state', { nonpayment_notice_days: 14, eviction_timeline_days: 95, pre_filing_diversion_required: false, just_cause_required: false, rent_regulation: 'statewide_cap', rent_increase_notice_days: 60, security_deposit_cap_months: 1, deposit_return_days: 21, termination_notice_days: 60, entry_notice_hours: 24, rental_registration_required: true, rental_license_required: false, periodic_inspection_required: false, lead_certification_required: true });
  add('metro:demo-m11', 'Harbor City (Demo)', 'city', { rent_regulation: 'local_control', just_cause_required: true, rental_license_required: true, periodic_inspection_required: true });
  // Brightwater: landlord-flexible, preempts local rent control.
  add('state:demo-s2', 'Brightwater (Demo)', 'state', { nonpayment_notice_days: 5, eviction_timeline_days: 35, pre_filing_diversion_required: false, just_cause_required: false, rent_regulation: 'preempted', rent_increase_notice_days: 30, security_deposit_cap_months: null, deposit_return_days: 30, termination_notice_days: 30, entry_notice_hours: 24, rental_registration_required: false, rental_license_required: false, periodic_inspection_required: false, lead_certification_required: false });
  add('metro:demo-m22', 'Millbrook (Demo)', 'city', { rental_registration_required: true });
  // Cedar Plains: fast process, preempted; a pending local inspection program.
  add('state:demo-s3', 'Cedar Plains (Demo)', 'state', { nonpayment_notice_days: 3, eviction_timeline_days: 28, pre_filing_diversion_required: false, just_cause_required: false, rent_regulation: 'preempted', rent_increase_notice_days: 30, security_deposit_cap_months: null, deposit_return_days: 30, termination_notice_days: 30, entry_notice_hours: 0, rental_registration_required: false, rental_license_required: false, periodic_inspection_required: false, lead_certification_required: false });
  add('metro:demo-m32', 'Pinecrest (Demo)', 'city', { periodic_inspection_required: true, rental_registration_required: true }, '2027-03-01');
  // Dunmore: moderate; only partial coverage (no timeline data) to exercise confidence handling.
  add('state:demo-s4', 'Dunmore (Demo)', 'state', { nonpayment_notice_days: 7, rent_regulation: 'none', just_cause_required: false, security_deposit_cap_months: 2, rent_increase_notice_days: 30, deposit_return_days: 30, termination_notice_days: 30, rental_license_required: false });
  return rows;
}

let cached: DemoDataset | null = null;
export function demoDataset(): DemoDataset {
  return (cached ??= build());
}
