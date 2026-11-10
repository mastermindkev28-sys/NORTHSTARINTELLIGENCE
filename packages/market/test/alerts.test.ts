import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALERT_RULES,
  MarketInputError,
  PROFILES,
  computeMarketScore,
  evaluateRule,
  evaluateRules,
  ruleLabel,
  snapshotOf,
  validateAlertRule,
  type AlertRule,
  type MarketSnapshot,
} from '../src/index';
import { AS_OF, fullSet, zip } from './helpers';

const snap = (overrides: Record<string, number> = {}, asOf = AS_OF): MarketSnapshot =>
  ({ ...snapshotOf(computeMarketScore({ area: zip(), observations: fullSet(overrides), profile: PROFILES.balanced, asOf: AS_OF })), asOf });

describe('snapshots', () => {
  it('captures overall, categories, flags and metric values with sources', () => {
    const s = snap();
    expect(s.overall).not.toBeNull();
    expect(s.metrics.unemployment_rate_pct).toEqual({ value: 3.5, period: '2026', source: 'American Community Survey 5-year' });
    expect(Object.keys(s.categories)).toHaveLength(6);
  });
});

describe('alert rules', () => {
  it('score_change fires on a move ≥ threshold, with old and new values as evidence', () => {
    const prev = snap({}, '2025-11-10');
    const curr = snap({ unemployment_rate_pct: 9, employment_growth_1y_pct: -2, population_growth_5y_pct: -4, wage_growth_1y_pct: 0 });
    const a = evaluateRule({ kind: 'score_change', minPoints: 3 }, prev, curr);
    expect(a).toHaveLength(1);
    expect(a[0]!.severity).toBe('caution');
    expect(a[0]!.evidence).toMatchObject({ variable: 'overall', oldValue: prev.overall, newValue: curr.overall, previousAsOf: '2025-11-10' });
    expect(evaluateRule({ kind: 'score_change', minPoints: 50 }, prev, curr)).toEqual([]);
    expect(evaluateRule({ kind: 'score_change', minPoints: 3 }, null, curr)).toEqual([]);
  });

  it('category_change and confidence_drop compare against the previous snapshot', () => {
    const prev = snap({}, '2025-11-10');
    const curr = snap({ violent_crime_per_100k: 1200, property_crime_per_100k: 5000 });
    expect(evaluateRule({ kind: 'category_change', category: 'public_safety', minPoints: 10 }, prev, curr)).toHaveLength(1);
    const lowConf = { ...curr, confidence: prev.confidence - 0.3 };
    expect(evaluateRule({ kind: 'confidence_drop', minDrop: 0.1 }, prev, lowConf)).toHaveLength(1);
    expect(evaluateRule({ kind: 'confidence_drop', minDrop: 0.1 }, null, lowConf)).toEqual([]);
  });

  it('new_risk_flag fires only for flags not present before and at or above the severity', () => {
    const prev = snap({}, '2025-11-10');
    const curr = snap({ flood_zone_share_pct: 30 });
    const a = evaluateRule({ kind: 'new_risk_flag', minSeverity: 'critical' }, prev, curr);
    expect(a.map((x) => x.evidence.variable)).toEqual(['env.flood']);
    expect(evaluateRule({ kind: 'new_risk_flag', minSeverity: 'critical' }, curr, curr)).toEqual([]);
  });

  it('metric_threshold fires on crossing, not while it stays crossed', () => {
    const rule: AlertRule = { kind: 'metric_threshold', metric: 'rental_vacancy_rate_pct', op: 'above', value: 8 };
    const prev = snap({}, '2025-11-10');
    const curr = snap({ rental_vacancy_rate_pct: 10 });
    expect(evaluateRule(rule, prev, curr)).toHaveLength(1);
    expect(evaluateRule(rule, curr, curr)).toEqual([]);
    expect(evaluateRule({ ...rule, op: 'below', value: 4 }, prev, curr)).toEqual([]);
  });

  it('regulatory_change reports changed factors and newly scheduled changes once', () => {
    const base = snap();
    const prev: MarketSnapshot = { ...base, regulatory: { just_cause_required: { display: 'Not required', effectiveDate: null } }, pending: [] };
    const curr: MarketSnapshot = { ...base, regulatory: { just_cause_required: { display: 'Required', effectiveDate: '2026-11-01' } }, pending: [{ factor: 'rent_regulation', label: 'Rent control', effectiveDate: '2027-01-01', value: 'Local rent control' }] };
    const a = evaluateRule({ kind: 'regulatory_change' }, prev, curr);
    expect(a.map((x) => x.title)).toEqual(['Regulatory change: just cause required', 'Scheduled change: Rent control']);
    expect(evaluateRule({ kind: 'regulatory_change' }, curr, curr)).toEqual([]);
  });

  it('evaluateRules dedupes and gives stable keys so re-runs never duplicate', () => {
    const prev = snap({}, '2025-11-10');
    const curr = snap({ flood_zone_share_pct: 30 });
    const once = evaluateRules([...DEFAULT_ALERT_RULES, { kind: 'new_risk_flag', minSeverity: 'info' }], prev, curr);
    const keys = once.map((x) => x.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(evaluateRules(DEFAULT_ALERT_RULES, prev, curr).map((x) => x.dedupeKey)).toEqual(evaluateRules(DEFAULT_ALERT_RULES, prev, curr).map((x) => x.dedupeKey));
  });

  it('validates rules and labels them', () => {
    expect(() => validateAlertRule({ kind: 'score_change', minPoints: 0 })).toThrow(MarketInputError);
    expect(() => validateAlertRule({ kind: 'category_change', category: 'vibes' as never, minPoints: 5 })).toThrow(/unknown category/);
    expect(() => validateAlertRule({ kind: 'category_change', category: 'growth', minPoints: 500 })).toThrow(MarketInputError);
    expect(() => validateAlertRule({ kind: 'metric_threshold', metric: 'percent_minority', op: 'above', value: 1 })).toThrow(/not in the metric catalog/);
    expect(() => validateAlertRule({ kind: 'metric_threshold', metric: 'unemployment_rate_pct', op: 'sideways' as never, value: 1 })).toThrow(MarketInputError);
    expect(() => validateAlertRule({ kind: 'metric_threshold', metric: 'unemployment_rate_pct', op: 'above', value: Infinity })).toThrow(MarketInputError);
    expect(() => validateAlertRule({ kind: 'new_risk_flag', minSeverity: 'meh' as never })).toThrow(MarketInputError);
    expect(() => validateAlertRule({ kind: 'confidence_drop', minDrop: 2 })).toThrow(MarketInputError);
    expect(() => validateAlertRule({ kind: 'nope' } as never)).toThrow(/unknown alert rule/);
    const all: AlertRule[] = [...DEFAULT_ALERT_RULES, { kind: 'category_change', category: 'growth', minPoints: 5 }, { kind: 'metric_threshold', metric: 'unemployment_rate_pct', op: 'above', value: 6 }];
    for (const r of all) expect(ruleLabel(r).length).toBeGreaterThan(5);
  });
});
