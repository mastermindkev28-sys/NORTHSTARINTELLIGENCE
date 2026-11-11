import { sourceRef, type GeoArea, type MetricObservation, type GeoLevel } from '../src/index';

export const AS_OF = '2026-11-10';

export const zip = (key = 'zip:t1', isDemo = false): GeoArea => ({ key, level: 'zip', code: key.split(':')[1]!, name: `Test ${key}`, parentKey: 'metro:t', stateCode: 'TS', isDemo });
export const metro = (key = 'metro:t'): GeoArea => ({ key, level: 'metro', code: 't', name: 'Test Metro', parentKey: null, stateCode: 'TS', isDemo: false });

export function o(metric: string, value: number, extra: Partial<MetricObservation> = {}): MetricObservation {
  return { metric, value, period: '2026', periodEnd: '2026-09-30', source: sourceRef('census_acs5'), retrievedAt: '2026-10-01T00:00:00Z', measuredAt: 'zip' as GeoLevel, ...extra };
}

/** A complete, strong observation set (every catalog metric except the regulatory index). */
export function fullSet(overrides: Record<string, number> = {}, extra: Partial<MetricObservation> = {}): MetricObservation[] {
  const v: Record<string, number> = {
    population_growth_5y_pct: 6, household_growth_5y_pct: 6, net_migration_per_1k: 6, employment_growth_1y_pct: 2.5, unemployment_rate_pct: 3.5, wage_growth_1y_pct: 4.5, industry_diversification: 0.88, permits_per_1k_households: 7, hpi_change_5y_pct: 35,
    price_to_income_ratio: 3.2, median_price_per_sqft: 140, sale_to_list_ratio: 0.97, price_reduction_share_pct: 22, median_days_on_market: 30, below_comp_sale_share_pct: 10,
    price_to_rent_ratio: 11, rent_growth_1y_pct: 3.5, rental_vacancy_rate_pct: 5, fmr_to_market_rent_ratio: 1.02, effective_property_tax_rate_pct: 1.1,
    violent_crime_per_100k: 350, property_crime_per_100k: 2000, violent_crime_trend_3y_pct: -8,
    fema_nri_risk_score: 30, flood_zone_share_pct: 2, wildfire_risk_score: 5, extreme_heat_days: 8, insurance_availability_index: 75,
    landlord_regulatory_index: 80,
    ...overrides,
  };
  return Object.entries(v).map(([k, val]) => o(k, val, extra));
}
