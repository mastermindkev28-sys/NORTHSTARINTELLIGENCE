import { describe, expect, it } from 'vitest';
import * as discover from '../src/index';
import {
  SIGNAL_TYPES,
  scoreDataConfidence,
  scorePropertySignals,
  scoreStrategyFit,
  type BuyBox,
} from '../src/index';

describe('scorePropertySignals', () => {
  const asOf = '2026-11-10';
  it('scores nothing for no events', () => {
    const s = scorePropertySignals([], asOf);
    expect(s).toMatchObject({ kind: 'property_signal', score: 0, band: 'none', points: 0, factors: [] });
  });
  it('applies weights, saturation and full credit for scheduled events (hand-checked)', () => {
    const s = scorePropertySignals([{ id: 'a', eventType: 'sheriff_sale_scheduled', status: 'scheduled', eventDate: '2026-01-01', scheduledDate: '2026-12-15' }], asOf);
    expect(s.points).toBe(35);
    expect(s.score).toBe(Math.round(100 * (1 - Math.exp(-35 / 60)))); // 44
    expect(s.band).toBe('moderate');
  });
  it('decays past events with a one-year half-life', () => {
    const s = scorePropertySignals([{ id: 'v', eventType: 'code_violation', status: 'active', eventDate: '2025-11-10' }], asOf);
    expect(s.points).toBe(5); // 10 × 0.5
    expect(s.factors[0]!.detail).toContain('365 days old');
  });
  it('gives resolved and dismissed events zero weight but keeps them visible', () => {
    const s = scorePropertySignals(
      [
        { id: 'r', eventType: 'lis_pendens', status: 'dismissed', eventDate: '2026-10-01' },
        { id: 'q', eventType: 'code_violation', status: 'resolved', eventDate: '2026-10-01' },
      ],
      asOf,
    );
    expect(s.points).toBe(0);
    expect(s.band).toBe('none');
    expect(s.factors).toHaveLength(2);
  });
  it('applies diminishing returns to repeated events of one type', () => {
    const s = scorePropertySignals(
      [1, 2, 3].map((i) => ({ id: `c${i}`, eventType: 'code_violation' as const, status: 'active' as const })),
      asOf,
    );
    expect(s.points).toBe(15); // 10 + 2.5 + 2.5
  });
  it('halves stale scheduled events and discounts postponements', () => {
    const stale = scorePropertySignals([{ id: 's', eventType: 'sheriff_sale_scheduled', status: 'scheduled', scheduledDate: '2026-09-01' }], asOf);
    expect(stale.points).toBe(17.5);
    const post = scorePropertySignals([{ id: 'p', eventType: 'tax_sale_listed', status: 'postponed' }], asOf);
    expect(post.points).toBe(24);
  });
  it('is deterministic regardless of input order', () => {
    const ev = [
      { id: 'a', eventType: 'tax_delinquency' as const, status: 'active' as const, eventDate: '2026-06-01' },
      { id: 'b', eventType: 'vacancy_indicator' as const, status: 'active' as const },
      { id: 'c', eventType: 'code_violation' as const, status: 'active' as const, eventDate: '2026-03-01' },
    ];
    expect(scorePropertySignals(ev, asOf)).toEqual(scorePropertySignals([...ev].reverse(), asOf));
  });
  it('rejects unsupported types, statuses and dates', () => {
    expect(() => scorePropertySignals([{ id: 'x', eventType: 'divorce' as never, status: 'active' }], asOf)).toThrow(/unsupported signal type/);
    expect(() => scorePropertySignals([{ id: 'x', eventType: 'code_violation', status: 'open' as never }], asOf)).toThrow(/unsupported status/);
    expect(() => scorePropertySignals([], '11/10/2026')).toThrow(/ISO date/);
  });
  it('has no signal types describing a person\'s circumstances', () => {
    const banned = /divorce|death|illness|medical|bankrupt|age|elder|senior|race|religio|disab|famil|marital|income|desperat|distress|vulnerab/i;
    expect(SIGNAL_TYPES.filter((t) => banned.test(t))).toEqual([]);
  });
});

describe('scoreDataConfidence', () => {
  const asOf = '2026-11-10';
  const fresh = (key: string, sourceKind: discover.SourceKind = 'official_api') => ({ key, sourceKind, retrievedAt: '2026-11-10' });
  const all = discover.DEFAULT_REQUIRED_FIELDS.map((k) => fresh(k));
  it('scores a complete, fresh, official, exactly matched record at 100', () => {
    const s = scoreDataConfidence({ fields: all, asOf });
    expect(s.score).toBe(100);
    expect(s.band).toBe('high');
    expect(s.missingFields).toEqual([]);
  });
  it('reduces for staleness, missing fields, weak matches and conflicts (hand-checked)', () => {
    const fields = all.slice(0, 5).map((f) => ({ ...f, sourceKind: 'licensed_provider' as const, retrievedAt: '2026-05-14' })); // ~180 days
    const s = scoreDataConfidence({ fields, asOf, matchConfidence: 0.7, conflicts: 1 });
    // 40×0.75 = 30 · 25×(1−180/365) = 12.7 · 20×5/7 = 14.3 · 15×0.7 = 10.5 · one conflict −10
    expect(s.factors.map((f) => f.contribution)).toEqual([30, 12.7, 14.3, 10.5, -10]);
    expect(s.score).toBe(58);
    expect(s.band).toBe('medium');
    expect(s.missingFields).toEqual(['living_area', 'last_sale_date']);
    expect(s.factors.find((f) => f.key === 'conflicts')!.contribution).toBe(-10);
  });
  it('credits human verification as full quality', () => {
    const s = scoreDataConfidence({ fields: all.map((f) => ({ ...f, sourceKind: 'ai_extracted' as const, verified: true })), asOf });
    expect(s.score).toBe(100);
  });
  it('forces zero confidence for demo data', () => {
    const s = scoreDataConfidence({ fields: [...all, fresh('note', 'demo')], asOf });
    expect(s.score).toBe(0);
    expect(s.demo).toBe(true);
    expect(s.band).toBe('low');
  });
  it('handles empty input and validates match confidence', () => {
    expect(scoreDataConfidence({ fields: [], asOf }).score).toBe(15);
    expect(() => scoreDataConfidence({ fields: all, asOf, matchConfidence: 2 })).toThrow();
  });
});

describe('scoreStrategyFit', () => {
  const box: BuyBox = {
    id: 'bb1',
    name: 'Philly rentals',
    strategies: ['buy_and_hold', 'brrrr'],
    geography: { states: ['PA'], countyFips: ['42101'] },
    propertyTypes: ['single_family', 'townhouse'],
    minBedrooms: 2,
    maxPrice: 200_000,
    minCapRate: 0.07,
    minDscr: 1.2,
    minMonthlyCashFlow: 200,
  };
  const facts = { state: 'pa', countyFips: '42101', propertyType: 'Townhouse', bedrooms: 3, price: 150_000 };
  it('fits when every criterion passes', () => {
    const s = scoreStrategyFit('buy_and_hold', box, facts, { capRate: 0.08, dscr: 1.4, monthlyCashFlow: 300 });
    expect(s).toMatchObject({ kind: 'strategy_fit', status: 'fit', score: 100, missing: [] });
  });
  it('gives partial credit to near-miss soft criteria', () => {
    const s = scoreStrategyFit('buy_and_hold', box, facts, { capRate: 0.0665, dscr: 1.4, monthlyCashFlow: 300 });
    // cap rate misses by 5% of target → credit 0.75; 8 criteria total
    expect(s.status).toBe('partial');
    expect(s.score).toBe(Math.round((100 * 7.75) / 8));
  });
  it('is not a fit on any hard failure, whatever the returns', () => {
    const s = scoreStrategyFit('buy_and_hold', box, { ...facts, price: 250_000 }, { capRate: 0.2, dscr: 3, monthlyCashFlow: 2000 });
    expect(s.status).toBe('not_a_fit');
    expect(s.score).toBe(0);
    expect(s.criteria.find((c) => c.key === 'price')!.result).toBe('fail');
  });
  it('reports insufficient data instead of guessing', () => {
    const s = scoreStrategyFit('buy_and_hold', box, { ...facts, bedrooms: undefined }, { capRate: 0.08, dscr: 1.4, monthlyCashFlow: 300 });
    expect(s).toMatchObject({ status: 'insufficient_data', score: null });
    expect(s.missing).toContain('bedrooms');
    const t = scoreStrategyFit('buy_and_hold', box, facts, { capRate: 0.08 });
    expect(t.status).toBe('insufficient_data');
  });
  it('rejects strategies outside the buy box and empty buy boxes', () => {
    expect(scoreStrategyFit('wholesale', box, facts, {}).status).toBe('not_a_fit');
    expect(scoreStrategyFit('wholesale', { id: 'e', name: 'empty', strategies: ['wholesale'] }, facts, {}).status).toBe('insufficient_data');
  });
  it('checks capital against the investor profile and adds experience notes', () => {
    const profile = { experience: 'new' as const, capitalAvailable: 30_000, financing: ['dscr' as const], riskTolerance: 'moderate' as const };
    const s = scoreStrategyFit('brrrr', box, facts, { capRate: 0.08, dscr: 1.4, monthlyCashFlow: 300, cashRequired: 45_000 }, profile);
    expect(s.status).toBe('not_a_fit');
    expect(s.criteria.find((c) => c.key === 'capital')!.result).toBe('fail');
    expect(s.notes[0]).toMatch(/BRRRR/);
  });
});

describe('score separation', () => {
  it('exposes no function that combines the three scores', () => {
    const names = Object.keys(discover).filter((k) => typeof (discover as Record<string, unknown>)[k] === 'function');
    expect(names.filter((n) => /opportunity|overall|combined|composite|total.?score|universal/i.test(n))).toEqual([]);
  });
  it('returns distinct result kinds', () => {
    const kinds = [
      scorePropertySignals([], '2026-11-10').kind,
      scoreDataConfidence({ fields: [], asOf: '2026-11-10' }).kind,
      scoreStrategyFit('wholesale', { id: 'x', name: 'x', strategies: ['wholesale'], maxPrice: 1 }, { price: 1 }, {}).kind,
    ];
    expect(new Set(kinds).size).toBe(3);
  });
});
