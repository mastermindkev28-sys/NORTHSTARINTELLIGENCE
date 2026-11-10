import { describe, expect, it } from 'vitest';
import {
  DemoMarketDataSource,
  INVESTMENT_STRATEGIES,
  METRICS,
  MarketInputError,
  PROFILES,
  SOURCES,
  assertPermittedMetricKey,
  demoDataset,
  getProfile,
  getSource,
  isProhibitedMetricKey,
  jurisdictionStack,
  percentileScores,
  rankAreas,
  scoreArea,
  sourceRef,
  summarizeTrend,
} from '../src/index';
import { AS_OF, fullSet, o, zip } from './helpers';

describe('fair housing guardrails', () => {
  it('no catalog metric is a protected characteristic or a proxy for one', () => {
    for (const m of METRICS) expect(isProhibitedMetricKey(m.key), m.key).toBe(false);
  });
  it('protected characteristics and common proxies are rejected even if someone adds them', () => {
    for (const k of ['pct_black', 'race_share', 'hispanic_population', 'foreign_born_pct', 'limited_english_proficiency', 'religious_congregations', 'female_headed_households', 'households_with_children', 'single_parent_share', 'disability_rate', 'median_age', 'over_65_share', 'school_demographics', 'voucher_holder_share', 'national_origin_mix', 'percent_minority']) {
      expect(isProhibitedMetricKey(k), k).toBe(true);
      expect(() => assertPermittedMetricKey(k)).toThrow(MarketInputError);
    }
    expect(() => assertPermittedMetricKey('price_to_rent_ratio')).not.toThrow();
    expect(() => assertPermittedMetricKey('made_up_metric')).toThrow(/not in the metric catalog/);
  });
  it('public safety metrics are aggregate rates, documented as never attributed to a property', () => {
    const safety = METRICS.filter((m) => m.category === 'public_safety');
    expect(safety.length).toBeGreaterThan(0);
    for (const m of safety) expect(['per_100k', 'pct']).toContain(m.unit);
    expect(safety.find((m) => m.key === 'violent_crime_per_100k')!.description).toMatch(/never attributed to an individual property/);
  });
  it('catalog integrity: unique keys, valid ranges, known sources', () => {
    expect(new Set(METRICS.map((m) => m.key)).size).toBe(METRICS.length);
    for (const m of METRICS) {
      expect(m.reference[0]).not.toBe(m.reference[1]);
      expect(m.weight).toBeGreaterThan(0);
      for (const s of m.sources) expect(getSource(s), `${m.key} → ${s}`).toBeDefined();
    }
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
    expect(sourceRef('unknown_source').class).toBe('third_party');
  });
});

describe('profiles', () => {
  it('has a profile for every strategy in the shared enum plus balanced', () => {
    for (const s of INVESTMENT_STRATEGIES) expect(getProfile(s).id).toBe(s);
    expect(getProfile('balanced').label).toMatch(/Balanced/);
    expect(() => getProfile('yolo')).toThrow(MarketInputError);
    for (const p of Object.values(PROFILES)) expect(p.priorities.length).toBeGreaterThan(0);
  });
});

describe('comparison', () => {
  it('percentiles are direction-aware with shared ranks for ties, and fall back to absolute for < 3 areas', () => {
    const p = percentileScores(new Map([['a', 3], ['b', 5], ['c', 5], ['d', 9]]), 'unemployment_rate_pct');
    expect(p.get('a')).toBe(100);
    expect(p.get('d')).toBe(0);
    expect(p.get('b')).toBe(p.get('c'));
    const two = percentileScores(new Map([['a', 2.5], ['b', 9]]), 'unemployment_rate_pct');
    expect(two.get('a')).toBe(100);
  });
  it('ranks by overall, puts withheld scores last, and supports relative mode', () => {
    const inputs = [
      { area: zip('zip:a'), observations: fullSet(), profile: PROFILES.balanced, asOf: AS_OF },
      { area: zip('zip:b'), observations: fullSet({ unemployment_rate_pct: 8, price_to_rent_ratio: 20 }), profile: PROFILES.balanced, asOf: AS_OF },
      { area: zip('zip:c'), observations: [o('unemployment_rate_pct', 3)], profile: PROFILES.balanced, asOf: AS_OF },
      { area: zip('zip:d'), observations: fullSet({ unemployment_rate_pct: 5 }), profile: PROFILES.balanced, asOf: AS_OF },
    ];
    const abs = rankAreas(inputs);
    expect(abs.map((r) => r.area.key)).toEqual(['zip:a', 'zip:d', 'zip:b', 'zip:c']);
    const rel = rankAreas(inputs, 'relative');
    expect(rel[rel.length - 1]!.area.key).toBe('zip:c');
    expect(rel[0]!.categories[0]!.variables[0]!.normalization).toBe('relative');
    expect(() => rankAreas([inputs[0]!, { ...inputs[1]!, asOf: '2026-01-01' }])).toThrow(/share one valuation date/);
  });
  it('summarizes trends, keeping projections out of change and CAGR', () => {
    const t = summarizeTrend('median_price_per_sqft', [
      o('median_price_per_sqft', 100, { period: '2022', periodEnd: '2022-12-31' }),
      o('median_price_per_sqft', 121, { period: '2024', periodEnd: '2024-12-31' }),
      o('median_price_per_sqft', 200, { period: '2027F', periodEnd: '2027-12-31', isProjection: true }),
    ]);
    expect(t.latest).toBe(121);
    expect(t.change).toBe(21);
    expect(t.cagr).toBeCloseTo(0.1, 2);
    expect(t.direction).toBe('rising');
    expect(t.hasProjection).toBe(true);
    expect(summarizeTrend('median_price_per_sqft', []).direction).toBe('unknown');
    expect(summarizeTrend('unemployment_rate_pct', [o('unemployment_rate_pct', 4, { periodEnd: '2024-01-01' }), o('unemployment_rate_pct', 4.01, { periodEnd: '2025-01-01' })]).direction).toBe('flat');
  });
});

describe('demo dataset and data source', () => {
  it('is fully labeled demo, deterministic, and covers state, metro and ZIP levels', async () => {
    const d = demoDataset();
    expect(d.areas.every((a) => a.isDemo)).toBe(true);
    for (const list of d.observations.values()) for (const ob of list) expect(ob.source.class).toBe('demo');
    expect(new Set(d.areas.map((a) => a.level))).toEqual(new Set(['state', 'metro', 'zip']));
    expect(d.regulatory.every((r) => r.verification === 'demo')).toBe(true);
    const src = new DemoMarketDataSource();
    expect((await src.listAreas({ level: 'zip', parentKey: 'metro:demo-m21' })).length).toBe(4);
    expect(await src.getArea('nope')).toBeNull();
  });

  it('builds jurisdiction stacks state → metro and scores every demo area without throwing', async () => {
    const src = new DemoMarketDataSource();
    const z = (await src.listAreas({ level: 'zip', parentKey: 'metro:demo-m11' }))[0]!;
    expect(await jurisdictionStack(src, z)).toEqual(['state:demo-s1', 'metro:demo-m11']);
    for (const a of await src.listAreas()) {
      const r = await scoreArea(src, a, { profile: PROFILES.buy_and_hold, asOf: AS_OF });
      expect(r.score.overallProvisional).toBeGreaterThanOrEqual(0);
      expect(r.score.overallProvisional).toBeLessThanOrEqual(100);
    }
  });

  it('exercises the edge cases it was designed for', async () => {
    const src = new DemoMarketDataSource();
    const get = async (k: string) => scoreArea(src, (await src.getArea(k))!, { profile: PROFILES.balanced, asOf: AS_OF });
    expect((await get('metro:demo-m22')).score.flags.map((f) => f.code)).toContain('safety.data_unavailable');
    expect((await get('metro:demo-m31')).score.flags.map((f) => f.code)).toContain('safety.low_reporting_coverage');
    expect((await get('metro:demo-m41')).score.flags.map((f) => f.code)).toContain('combo.cheap_but_exposed');
    expect((await get('metro:demo-m11')).score.flags.map((f) => f.code)).toContain('reg.rent_control');
    expect((await get('metro:demo-m32')).regulatory.pending.length).toBeGreaterThan(0);
    expect((await get('metro:demo-m21')).score.projections.length).toBe(1);
    // Real pilot jurisdictions have cited law but no connected metrics: score withheld, not guessed.
    const phl = await get('city:4260000');
    expect(phl.score.isDemo).toBe(false);
    expect(phl.score.overall).toBeNull();
    expect(phl.regulatory.factors.find((f) => f.key === 'just_cause_required')!.value).toBe(true);
  });

  it('two vintages exist so monitoring can compare', async () => {
    const src = new DemoMarketDataSource();
    const area = (await src.getArea('metro:demo-m31'))!;
    const now = await scoreArea(src, area, { profile: PROFILES.balanced, asOf: AS_OF });
    const prior = await scoreArea(src, area, { profile: PROFILES.balanced, asOf: '2025-11-10' });
    expect(now.score.overall).not.toBe(prior.score.overall);
  });
});
