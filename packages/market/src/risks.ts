/**
 * Material risk flags. Flags are evaluated from raw values and category results and are always returned next to the
 * score, never averaged into it. Thresholds are v0.1 hypotheses, versioned with the methodology.
 */
import type { CategoryResult } from './score';
import type { RegulatoryIndexResult } from './regulatory';
import type { FlagSeverity, GeoArea, RiskFlag } from './types';

interface Threshold {
  metric: string;
  code: string;
  title: string;
  category: RiskFlag['category'];
  /** Flag when value is ≥ (direction 'above') or ≤ (direction 'below') the threshold. */
  direction: 'above' | 'below';
  caution: number;
  critical?: number;
  detail: (v: number) => string;
}

export const RISK_THRESHOLDS: readonly Threshold[] = [
  { metric: 'fema_nri_risk_score', code: 'env.nri_high', title: 'Elevated natural hazard risk', category: 'environmental_risk', direction: 'above', caution: 55, critical: 70, detail: (v) => `FEMA NRI composite risk score ${v}. A generalized hazard score, not a substitute for an insurance quote or inspection.` },
  { metric: 'flood_zone_share_pct', code: 'env.flood', title: 'Significant flood hazard exposure', category: 'environmental_risk', direction: 'above', caution: 7, critical: 15, detail: (v) => `${v}% of residential parcels intersect a FEMA Special Flood Hazard Area. Flood insurance may be required by lenders.` },
  { metric: 'wildfire_risk_score', code: 'env.wildfire', title: 'Wildfire exposure', category: 'environmental_risk', direction: 'above', caution: 60, critical: 80, detail: (v) => `NRI wildfire score ${v}.` },
  { metric: 'insurance_availability_index', code: 'env.insurance', title: 'Constrained insurance market', category: 'environmental_risk', direction: 'below', caution: 55, critical: 35, detail: (v) => `Insurance availability index ${v}/100. Obtain actual quotes before underwriting.` },
  { metric: 'extreme_heat_days', code: 'env.heat', title: 'Frequent extreme heat', category: 'environmental_risk', direction: 'above', caution: 35, detail: (v) => `About ${v} days a year above 95°F; plan for HVAC and utility costs.` },
  { metric: 'effective_property_tax_rate_pct', code: 'cost.tax_burden', title: 'High property tax burden', category: 'rental_economics', direction: 'above', caution: 2, critical: 2.5, detail: (v) => `Effective property tax rate ${v}% of value per year.` },
  { metric: 'rental_vacancy_rate_pct', code: 'rent.vacancy', title: 'High rental vacancy', category: 'rental_economics', direction: 'above', caution: 9, critical: 12, detail: (v) => `Rental vacancy ${v}%.` },
  { metric: 'population_growth_5y_pct', code: 'growth.pop_decline', title: 'Population decline', category: 'growth', direction: 'below', caution: -1, critical: -3, detail: (v) => `Population changed ${v}% over five years.` },
  { metric: 'unemployment_rate_pct', code: 'growth.unemployment', title: 'Elevated unemployment', category: 'growth', direction: 'above', caution: 6.5, critical: 8.5, detail: (v) => `Unemployment rate ${v}%.` },
  { metric: 'violent_crime_trend_3y_pct', code: 'safety.rising', title: 'Rising violent crime (aggregate)', category: 'public_safety', direction: 'above', caution: 10, critical: 25, detail: (v) => `Area violent crime rate changed ${v}% over three years. Aggregate area statistic; not a statement about any property.` },
];

const ORDER: Record<FlagSeverity, number> = { critical: 0, caution: 1, info: 2 };

export function computeRiskFlags(p: { area: GeoArea; categories: CategoryResult[]; regulatory: RegulatoryIndexResult | null; asOf: string }): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const vars = new Map(p.categories.flatMap((c) => c.variables).map((v) => [v.metric, v]));

  for (const t of RISK_THRESHOLDS) {
    const v = vars.get(t.metric);
    if (!v || v.value === null) continue;
    const hit = (lim: number) => (t.direction === 'above' ? v.value! >= lim : v.value! <= lim);
    const severity: FlagSeverity | null = t.critical !== undefined && hit(t.critical) ? 'critical' : hit(t.caution) ? 'caution' : null;
    if (severity) flags.push({ code: t.code, severity, category: t.category, title: t.title, detail: t.detail(v.value), evidence: { metric: t.metric, value: v.value, threshold: severity === 'critical' ? t.critical! : t.caution } });
  }

  const cat = (k: CategoryResult['key']) => p.categories.find((c) => c.key === k)!;
  const aff = cat('affordability');
  const env = cat('environmental_risk');
  if (aff.sufficient && env.sufficient && aff.scoreProvisional >= 65 && env.scoreProvisional <= 40) {
    flags.push({ code: 'combo.cheap_but_exposed', severity: 'critical', category: 'environmental_risk', title: 'Inexpensive but exposed', detail: 'Prices screen as affordable, but hazard and insurance indicators are weak. Low prices may reflect insurance, maintenance or disaster exposure.', evidence: { value: `affordability ${aff.scoreProvisional} / environmental ${env.scoreProvisional}` } });
  }

  const safety = cat('public_safety');
  if (!safety.sufficient) {
    flags.push({ code: 'safety.data_unavailable', severity: 'caution', category: 'data_quality', title: 'Public safety data incomplete', detail: 'Crime data is missing or below coverage threshold. Missing data is not an indication that an area is safe; the category is scored at neutral-or-worse.' });
  }
  const lowCov = safety.variables.filter((v) => v.reportingCoverage !== null && v.reportingCoverage < 0.8);
  if (lowCov.length) {
    const min = Math.min(...lowCov.map((v) => v.reportingCoverage!));
    flags.push({ code: 'safety.low_reporting_coverage', severity: 'caution', category: 'data_quality', title: 'Partial crime reporting coverage', detail: `Reporting agencies cover about ${Math.round(min * 100)}% of the population. Rates may understate actual crime.`, evidence: { value: min, threshold: 0.8 } });
  }

  for (const c of p.categories) {
    if (!c.sufficient && c.key !== 'public_safety' && c.weight > 0) {
      flags.push({ code: `data.insufficient.${c.key}`, severity: 'caution', category: 'data_quality', title: `${c.label}: insufficient data`, detail: `Only ${Math.round(c.coverage * 100)}% of this category's weight has data. The category score is withheld and contributes at neutral-or-worse.` });
    }
  }
  const stale = [...vars.values()].filter((v) => v.stale);
  if (stale.length) flags.push({ code: 'data.stale', severity: 'info', category: 'data_quality', title: 'Some data is out of date', detail: stale.map((v) => `${v.label} (${v.period})`).join('; ') });
  const inherited = [...vars.values()].filter((v) => v.inherited);
  if (inherited.length) flags.push({ code: 'data.inherited', severity: 'info', category: 'data_quality', title: 'Some values measured at a coarser level', detail: `${inherited.length} variable${inherited.length === 1 ? '' : 's'} use parent-area data (lower confidence): ${inherited.map((v) => v.label).join(', ')}.` });

  if (p.regulatory) flags.push(...p.regulatory.flags);

  const seen = new Set<string>();
  return flags
    .filter((f) => (seen.has(f.code) ? false : (seen.add(f.code), true)))
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.code.localeCompare(b.code));
}
