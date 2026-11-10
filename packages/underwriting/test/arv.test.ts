import { describe, expect, it } from 'vitest';
import { calculateArv, sourced, type ComparableSale } from '../src/index.js';

const comps: ComparableSale[] = [
  { id: 'A', salePrice: 300_000, squareFeet: 1500, adjustments: { bathroom: 5000 }, saleDate: '2026-09-01', distanceMiles: 0.4 },
  { id: 'B', salePrice: sourced(310_000, 'verified', { sourceRef: 'County deed' }), squareFeet: 1550, saleDate: '2026-08-15', distanceMiles: 0.6 },
  { id: 'C', salePrice: 295_000, squareFeet: 1450, adjustments: { garage: -2000 }, saleDate: '2026-07-20', distanceMiles: 0.8 },
];

describe('calculateArv', () => {
  const r = calculateArv({ subjectSquareFeet: 1600, comps, asOfDate: '2026-11-10' });

  it('computes the weighted mean of adjusted indicated values', () => {
    expect(r.value.arv).toBe(322_881.23);
    expect(r.value.median).toBe(323_310.34);
    expect(r.value.low).toBe(320_000);
    expect(r.value.high).toBe(325_333.33);
    expect(r.value.weightedPricePerSqft).toBe(201.8);
    expect(r.value.compCount).toBe(3);
  });

  it('exposes a per-comp breakdown with provenance', () => {
    const b = r.value.comps.find((c) => c.id === 'B')!;
    expect(b.source).toBe('verified');
    expect(b.indicatedValue).toBe(320_000);
    const a = r.value.comps.find((c) => c.id === 'A')!;
    expect(a.adjustedPrice).toBe(305_000);
    expect(a.source).toBe('user_assumption');
  });

  it('records a formula trace for every comp and the final ARV', () => {
    expect(r.trace.map((t) => t.label)).toEqual([
      'Comp A indicated value',
      'Comp B indicated value',
      'Comp C indicated value',
      'ARV (weighted mean of indicated values)',
    ]);
    expect(r.source).toBe('calculated');
  });

  it('has no warnings for a clean, recent, nearby set', () => {
    expect(r.warnings).toEqual([]);
  });

  it('applies weights', () => {
    const w = calculateArv({ subjectSquareFeet: 1600, comps: [{ ...comps[0]!, weight: 3 }, comps[1]!] });
    expect(w.value.arv).toBeCloseTo((325_333.3333 * 3 + 320_000) / 4, 1);
  });

  it('warns on thin, stale, distant, heavily adjusted, dispersed, and AI-extracted comps', () => {
    const w = calculateArv({
      subjectSquareFeet: 1600,
      asOfDate: '2026-11-10',
      comps: [
        { id: 'X', salePrice: sourced(200_000, 'ai_interpretation'), squareFeet: 1500, adjustments: { condition: 60_000 }, saleDate: '2025-01-01', distanceMiles: 3 },
        { id: 'Y', salePrice: 400_000, squareFeet: 1500, saleDate: '2027-01-01' },
      ],
    });
    const codes = w.warnings.map((x) => x.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'comp_heavy_adjustment_X',
        'comp_distance_X',
        'comp_stale_X',
        'comp_unverified_X',
        'comp_future_Y',
        'comp_count_low',
        'comp_dispersion_high',
      ]),
    );
  });

  it('rejects invalid input', () => {
    expect(() => calculateArv({ subjectSquareFeet: 1600, comps: [] })).toThrow('at least one');
    expect(() => calculateArv({ subjectSquareFeet: 0, comps })).toThrow('subjectSquareFeet');
    expect(() => calculateArv({ subjectSquareFeet: 1600, comps: [comps[0]!, comps[0]!] })).toThrow('duplicate');
    expect(() => calculateArv({ subjectSquareFeet: 1600, comps: [{ id: 'Z', salePrice: 100, squareFeet: 0 }] })).toThrow('squareFeet');
    expect(() => calculateArv({ subjectSquareFeet: 1600, comps: [{ id: '', salePrice: 100, squareFeet: 10 }] })).toThrow('id');
    expect(() => calculateArv({ subjectSquareFeet: 1600, comps: [{ id: 'Z', salePrice: 100, squareFeet: 10, adjustments: { x: -200 } }] })).toThrow('positive');
    expect(() => calculateArv({ subjectSquareFeet: 1600, comps, asOfDate: 'not-a-date' })).toThrow('ISO');
    expect(() => calculateArv({ subjectSquareFeet: 1600, comps: [{ id: 'Z', salePrice: 100, squareFeet: 10, saleDate: 'bad' }], asOfDate: '2026-01-01' })).toThrow('ISO');
    expect(() => calculateArv({ subjectSquareFeet: 1600, comps: [{ id: 'Z', salePrice: 100, squareFeet: 10, weight: 0 }] })).toThrow('weight');
  });
});
