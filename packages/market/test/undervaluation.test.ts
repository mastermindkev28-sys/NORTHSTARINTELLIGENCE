import { describe, expect, it } from 'vitest';
import { MarketInputError, assessUndervaluation, type UvComp } from '../src/index';

const AS_OF = '2026-11-10';
const comp = (id: string, price: number, extra: Partial<UvComp> = {}): UvComp => ({ id, salePrice: price, squareFeet: 1500, saleDate: '2026-08-01', distanceMiles: 0.4, ...extra });
const tightComps = [comp('a', 200_000), comp('b', 205_000), comp('c', 198_000), comp('d', 202_000), comp('e', 201_000)];
const base = { asOf: AS_OF, subjectSquareFeet: 1500, priceBasis: 'list_price' as const };

describe('assessUndervaluation', () => {
  it('calls a property potentially below market only with ≥ 3 eligible comps and a clear discount', () => {
    const r = assessUndervaluation({ ...base, price: 160_000, comps: tightComps });
    expect(r.classification).toBe('potentially_below_market');
    expect(r.confidence).toBe('high');
    const s = r.signals.find((x) => x.key === 'below_comps')!;
    expect(s.status).toBe('supported');
    expect(s.discountPct).toBeCloseTo(20.2, 0);
    expect(r.compValue!.compCount).toBe(5);
  });

  it('never calls it below market from an AVM alone', () => {
    const r = assessUndervaluation({ ...base, price: 100_000, avms: [{ provider: 'AVM One', value: 250_000, asOf: AS_OF }] });
    expect(r.classification).toBe('indicators_only');
    expect(r.signals.find((x) => x.key === 'below_avm')!.status).toBe('indicative');
  });

  it('never calls it below market from one or two comps, and refuses minComps below 3', () => {
    const r = assessUndervaluation({ ...base, price: 100_000, comps: tightComps.slice(0, 2) });
    expect(r.classification).toBe('insufficient_evidence');
    expect(r.signals.find((x) => x.key === 'below_comps')!.status).toBe('insufficient_evidence');
    expect(() => assessUndervaluation({ ...base, price: 100_000, comps: tightComps, options: { minComps: 1 } })).toThrow(/cannot be below 3/);
  });

  it('excludes stale, distant, future and non-arm\'s-length comps with reasons', () => {
    const comps = [...tightComps.slice(0, 2), comp('old', 150_000, { saleDate: '2025-01-01' }), comp('far', 150_000, { distanceMiles: 3 }), comp('fut', 150_000, { saleDate: '2027-01-01' }), comp('rel', 90_000, { armsLength: false })];
    const r = assessUndervaluation({ ...base, price: 150_000, comps });
    const ex = r.signals.find((x) => x.key === 'below_comps')!.evidence.excluded as { id: string; reason: string }[];
    expect(ex.map((e) => e.id).sort()).toEqual(['far', 'fut', 'old', 'rel']);
    expect(r.classification).toBe('insufficient_evidence');
  });

  it('reports not below market when the price is close to comp value', () => {
    const r = assessUndervaluation({ ...base, price: 195_000, comps: tightComps });
    expect(r.classification).toBe('not_below_market');
  });

  it('treats a discount amid widely dispersed comps as inconclusive', () => {
    const wide = [comp('a', 120_000), comp('b', 300_000), comp('c', 180_000)];
    const r = assessUndervaluation({ ...base, price: 150_000, comps: wide });
    expect(r.signals.find((x) => x.key === 'below_comps')!.status).toBe('insufficient_evidence');
    expect(r.classification).not.toBe('potentially_below_market');
  });

  it('keeps neighborhood, distress and seller statements as separate signals', () => {
    const r = assessUndervaluation({
      ...base, price: 120_000,
      neighborhood: { medianPricePerSqft: 120, sampleSize: 25, windowDays: 180, areaName: 'Test Hood', source: 'licensed_sales' },
      distressEvents: [{ type: 'lis_pendens', status: 'active', eventDate: '2026-09-01', source: 'county recorder' }, { type: 'tax_sale', status: 'resolved', eventDate: '2025-01-01', source: 'treasurer' }],
      sellerAskingPrice: { value: 125_000, statedAt: '2026-11-01' },
    });
    expect(r.signals.map((s) => s.key)).toEqual(['below_comps', 'below_neighborhood', 'distress', 'seller_requested']);
    expect(r.signals.find((s) => s.key === 'distress')!.status).toBe('present');
    expect((r.signals.find((s) => s.key === 'distress')!.evidence.active as unknown[]).length).toBe(1);
    expect(r.signals.find((s) => s.key === 'seller_requested')!.status).toBe('statement');
    expect(r.classification).toBe('indicators_only');
    const small = assessUndervaluation({ ...base, price: 120_000, neighborhood: { medianPricePerSqft: 120, sampleSize: 4, windowDays: 180, areaName: 'Tiny', source: 'x' } });
    expect(small.signals.find((s) => s.key === 'below_neighborhood')!.status).toBe('insufficient_evidence');
  });

  it('reports assessed value only as a tax measure and never uses it', () => {
    const withAssessed = assessUndervaluation({ ...base, price: 160_000, comps: tightComps, assessedValue: { value: 400_000, year: 2026, jurisdiction: 'County' } });
    const without = assessUndervaluation({ ...base, price: 160_000, comps: tightComps });
    expect(withAssessed.taxMeasures!.note).toMatch(/not current market value/);
    expect({ ...withAssessed, taxMeasures: null }).toEqual(without);
  });

  it('validates inputs', () => {
    expect(() => assessUndervaluation({ ...base, price: 0 })).toThrow(MarketInputError);
    expect(() => assessUndervaluation({ ...base, subjectSquareFeet: 0, price: 1 })).toThrow(MarketInputError);
    expect(() => assessUndervaluation({ ...base, price: 1, avms: [{ provider: 'x', value: 0, asOf: AS_OF }] })).toThrow(MarketInputError);
  });
});
