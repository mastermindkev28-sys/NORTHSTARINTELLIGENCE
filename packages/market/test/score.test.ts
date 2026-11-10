import { describe, expect, it } from 'vitest';
import {
  CATEGORY_KEYS,
  MarketInputError,
  PROFILES,
  computeMarketScore,
  confidenceLabel,
  customProfile,
  freshnessFactor,
  normalizeAbsolute,
  getMetric,
  pickObservation,
  resolutionFactor,
  sourceRef,
} from '../src/index';
import { AS_OF, fullSet, o, zip } from './helpers';

const score = (obs = fullSet(), profile = PROFILES.balanced, area = zip()) => computeMarketScore({ area, observations: obs, profile, asOf: AS_OF });

describe('normalization', () => {
  it('maps reference worst→0 and best→100, linear and clamped, direction-aware', () => {
    const up = getMetric('population_growth_5y_pct'); // [-4, 10]
    expect(normalizeAbsolute(up, -4)).toBe(0);
    expect(normalizeAbsolute(up, 10)).toBe(100);
    expect(normalizeAbsolute(up, 3)).toBeCloseTo(50);
    expect(normalizeAbsolute(up, 50)).toBe(100);
    const down = getMetric('unemployment_rate_pct'); // [9, 2.5]
    expect(normalizeAbsolute(down, 9)).toBe(0);
    expect(normalizeAbsolute(down, 2.5)).toBe(100);
    expect(normalizeAbsolute(down, 20)).toBe(0);
  });
});

describe('computeMarketScore', () => {
  it('is deterministic', () => {
    expect(score()).toEqual(score());
  });

  it('computes category scores as weighted means and overall from profile weights', () => {
    const r = score();
    expect(r.overall).not.toBeNull();
    expect(r.coverage).toBe(1);
    const manual = r.categories.reduce((s, c) => s + c.weight * c.scoreProvisional, 0);
    expect(r.overall).toBeCloseTo(manual, 0);
    for (const c of r.categories) {
      const tw = c.variables.reduce((s, v) => s + v.weight, 0);
      expect(c.scoreProvisional).toBeCloseTo(c.variables.reduce((s, v) => s + v.score * v.weight, 0) / tw, 0);
    }
    expect(r.categories.map((c) => c.key)).toEqual([...CATEGORY_KEYS]);
    expect(r.categories.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1, 6);
  });

  it('balanced profile uses the owner baseline weights 25/20/20/15/10/10', () => {
    const r = score();
    expect(Object.fromEntries(r.categories.map((c) => [c.key, c.weight]))).toEqual({ growth: 0.25, affordability: 0.2, regulatory: 0.2, rental_economics: 0.15, public_safety: 0.1, environmental_risk: 0.1 });
  });

  it('missing data never raises a score: removing any single observation cannot increase the overall above the full-data score when that variable is at least neutral', () => {
    const full = fullSet();
    const baseResult = score(full);
    const base = baseResult.overallProvisional;
    const varScore = new Map(baseResult.categories.flatMap((c) => c.variables).map((v) => [v.metric, v.score]));
    for (const obs of full) {
      if ((varScore.get(obs.metric) ?? 100) < 50) continue;
      const without = score(full.filter((x) => x !== obs));
      // Imputation is min(50, observed category mean): a strong market can only lose by dropping data.
      expect(without.overallProvisional).toBeLessThanOrEqual(base + 1e-9);
      expect(without.confidence).toBeLessThan(score(full).confidence + 1e-9);
    }
  });

  it('a missing variable is imputed at neutral-or-worse and never above the observed category mean', () => {
    const r = score(fullSet().filter((x) => x.metric !== 'violent_crime_per_100k'));
    const cat = r.categories.find((c) => c.key === 'public_safety')!;
    const missing = cat.variables.find((v) => v.metric === 'violent_crime_per_100k')!;
    expect(missing.status).toBe('missing');
    expect(missing.score).toBeLessThanOrEqual(50);
    expect(missing.confidence).toBe(0);
    const observed = cat.variables.filter((v) => v.status === 'observed');
    const mean = observed.reduce((s, v) => s + v.score * v.weight, 0) / observed.reduce((s, v) => s + v.weight, 0);
    expect(missing.score).toBeLessThanOrEqual(mean + 1e-9);
  });

  it('a weak market with missing safety data does not look safer than neutral', () => {
    const r = score(fullSet().filter((x) => !x.metric.includes('crime')));
    const safety = r.categories.find((c) => c.key === 'public_safety')!;
    expect(safety.sufficient).toBe(false);
    expect(safety.score).toBeNull();
    expect(safety.scoreProvisional).toBe(50);
    expect(r.flags.map((f) => f.code)).toContain('safety.data_unavailable');
  });

  it('shows insufficient data below 60% category coverage, and withholds overall below 60% overall coverage', () => {
    const r = score([o('population_growth_5y_pct', 8)]);
    expect(r.categories.find((c) => c.key === 'growth')!.score).toBeNull();
    expect(r.overall).toBeNull();
    expect(r.confidenceLabel).toBe('very_low');
  });

  it('excludes projections from scoring but returns them separately', () => {
    const proj = o('population_growth_5y_pct', 40, { isProjection: true, periodEnd: '2026-10-01' });
    const r = score([...fullSet(), proj]);
    const v = r.categories.find((c) => c.key === 'growth')!.variables.find((x) => x.metric === 'population_growth_5y_pct')!;
    expect(v.value).toBe(6);
    expect(r.projections).toEqual([proj]);
  });

  it('ignores observations whose period ends after asOf', () => {
    const future = o('unemployment_rate_pct', 1, { periodEnd: '2027-01-31' });
    expect(pickObservation([future], AS_OF)).toBeNull();
  });

  it('prefers the finest geographic level, then the latest period', () => {
    const a = o('price_to_rent_ratio', 10, { measuredAt: 'metro', periodEnd: '2026-09-30' });
    const b = o('price_to_rent_ratio', 12, { measuredAt: 'zip', periodEnd: '2025-09-30' });
    const c = o('price_to_rent_ratio', 13, { measuredAt: 'zip', periodEnd: '2026-06-30' });
    expect(pickObservation([a, b, c], AS_OF)!.value).toBe(13);
  });

  it('lowers confidence for stale, inherited, low-coverage and lower-quality sources without changing the score', () => {
    const fresh = score().confidence;
    const stale = score(fullSet({}, { periodEnd: '2019-12-31' }));
    expect(stale.confidence).toBeLessThan(fresh);
    expect(stale.flags.map((f) => f.code)).toContain('data.stale');
    const inherited = score(fullSet({}, { measuredAt: 'state' }));
    expect(inherited.confidence).toBeLessThan(fresh);
    expect(inherited.overall).toBe(score().overall);
    expect(inherited.flags.map((f) => f.code)).toContain('data.inherited');
    const licensed = score(fullSet({}, { source: sourceRef('licensed_sales') }));
    expect(licensed.confidence).toBeLessThan(fresh);
    const lowCov = score(fullSet({}, { reportingCoverage: 0.6 }));
    expect(lowCov.flags.map((f) => f.code)).toContain('safety.low_reporting_coverage');
  });

  it('confidence helpers behave as documented', () => {
    expect(freshnessFactor(10, 30)).toBe(1);
    expect(freshnessFactor(60, 30)).toBe(0.5);
    expect(freshnessFactor(10_000, 30)).toBe(0.4);
    expect(resolutionFactor('zip', 'zip')).toBe(1);
    expect(resolutionFactor('zip', 'city')).toBeCloseTo(0.85);
    expect(resolutionFactor('zip', 'metro')).toBeCloseTo(0.7225);
    expect(resolutionFactor('neighborhood', 'state')).toBeCloseTo(0.522, 2);
    expect(confidenceLabel(0.85)).toBe('high');
    expect(confidenceLabel(0.65)).toBe('moderate');
    expect(confidenceLabel(0.45)).toBe('low');
    expect(confidenceLabel(0.1)).toBe('very_low');
  });

  it('rejects unknown metrics, non-finite values and bad coverage', () => {
    expect(() => score([o('percent_minority', 10)])).toThrow(MarketInputError);
    expect(() => score([o('unemployment_rate_pct', Number.NaN)])).toThrow(/finite/);
    expect(() => score([o('violent_crime_per_100k', 300, { reportingCoverage: 2 })])).toThrow(/reportingCoverage/);
    expect(() => score([o('unemployment_rate_pct', 4, { periodEnd: 'yesterday' })])).toThrow(/invalid ISO date/);
  });

  it('marks results from demo sources or areas as demo', () => {
    expect(score().isDemo).toBe(false);
    expect(score(fullSet({}, { source: sourceRef('demo') })).isDemo).toBe(true);
    expect(score(fullSet(), PROFILES.balanced, zip('zip:demo-1', true)).isDemo).toBe(true);
  });
});

describe('risk flags are never hidden by a high score', () => {
  it('raises critical flags for severe hazards even when the overall score is high', () => {
    const r = score(fullSet({ flood_zone_share_pct: 30, fema_nri_risk_score: 85 }));
    expect(r.overall!).toBeGreaterThan(60);
    const crit = r.flags.filter((f) => f.severity === 'critical').map((f) => f.code);
    expect(crit).toEqual(expect.arrayContaining(['env.flood', 'env.nri_high']));
    expect(r.flags[0]!.severity).toBe('critical');
  });

  it('flags inexpensive-but-exposed markets', () => {
    const r = score(fullSet({ price_to_income_ratio: 2.5, median_price_per_sqft: 70, sale_to_list_ratio: 0.94, price_reduction_share_pct: 40, median_days_on_market: 15, below_comp_sale_share_pct: 25, fema_nri_risk_score: 90, flood_zone_share_pct: 25, wildfire_risk_score: 50, insurance_availability_index: 20 }));
    expect(r.flags.map((f) => f.code)).toContain('combo.cheap_but_exposed');
  });

  it('covers caution and critical thresholds in both directions', () => {
    const r = score(fullSet({ population_growth_5y_pct: -4, unemployment_rate_pct: 7, effective_property_tax_rate_pct: 2.1, rental_vacancy_rate_pct: 13, violent_crime_trend_3y_pct: 30, insurance_availability_index: 50, extreme_heat_days: 40, wildfire_risk_score: 65 }));
    const by = Object.fromEntries(r.flags.map((f) => [f.code, f.severity]));
    expect(by).toMatchObject({ 'growth.pop_decline': 'critical', 'growth.unemployment': 'caution', 'cost.tax_burden': 'caution', 'rent.vacancy': 'critical', 'safety.rising': 'critical', 'env.insurance': 'caution', 'env.heat': 'caution', 'env.wildfire': 'caution' });
    for (const f of r.flags) if (f.evidence?.metric) expect(f.evidence.value).toBeDefined();
  });
});

describe('strategy profiles', () => {
  it('every strategy produces a different weighting and a valid score', () => {
    const results = Object.values(PROFILES).map((p) => score(fullSet(), p));
    for (const r of results) expect(r.overall).not.toBeNull();
    const weights = new Set(Object.values(PROFILES).map((p) => JSON.stringify(p.categoryWeights) + JSON.stringify(p.variableEmphasis)));
    expect(weights.size).toBe(Object.keys(PROFILES).length);
  });

  it('flip rewards liquidity more than buy-and-hold does', () => {
    const slow = fullSet({ median_days_on_market: 120 });
    const fast = fullSet({ median_days_on_market: 15 });
    const gap = (p: keyof typeof PROFILES) => score(fast, PROFILES[p]).overall! - score(slow, PROFILES[p]).overall!;
    expect(gap('fix_and_flip')).toBeGreaterThan(gap('buy_and_hold'));
  });

  it('section 8 weights the HUD FMR benchmark heavily; flip ignores it', () => {
    const lo = fullSet({ fmr_to_market_rent_ratio: 0.8 });
    const hi = fullSet({ fmr_to_market_rent_ratio: 1.15 });
    expect(score(hi, PROFILES.section_8).overall! - score(lo, PROFILES.section_8).overall!).toBeGreaterThan(3);
    expect(score(hi, PROFILES.fix_and_flip).overall).toBe(score(lo, PROFILES.fix_and_flip).overall);
  });

  it('custom profiles validate weights and metrics', () => {
    const p = customProfile({ id: 'x', label: 'Mine', categoryWeights: { public_safety: 0, growth: 50 } });
    expect(p.id).toBe('custom:x');
    expect(score(fullSet(), p).categories.find((c) => c.key === 'public_safety')!.weight).toBe(0);
    expect(() => customProfile({ id: 'x', label: 'x', categoryWeights: { growth: -1 } })).toThrow(MarketInputError);
    expect(() => customProfile({ id: 'x', label: 'x', categoryWeights: { nope: 1 } as never })).toThrow(/unknown category/);
    expect(() => customProfile({ id: 'x', label: 'x', categoryWeights: { growth: 0, affordability: 0, regulatory: 0, rental_economics: 0, public_safety: 0, environmental_risk: 0 } })).toThrow(/at least one/);
    expect(() => customProfile({ id: 'x', label: 'x', categoryWeights: {}, variableEmphasis: { median_age: 1 } })).toThrow(/unknown metric/);
    expect(() => customProfile({ id: 'x', label: 'x', categoryWeights: {}, variableEmphasis: { median_days_on_market: 11 } })).toThrow(/between 0 and 10/);
  });
});
