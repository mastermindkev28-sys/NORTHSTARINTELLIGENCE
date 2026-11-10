import { describe, expect, it } from 'vitest';
import {
  ResultBuilder,
  UnderwritingInputError,
  requireNumber,
  roundCurrency,
  roundTo,
  safeDivide,
  sourced,
  toSourced,
  valueOf,
} from '../src/index';

describe('roundTo / roundCurrency', () => {
  it('rounds half away from zero without binary representation error', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(2.675, 2)).toBe(2.68);
    expect(roundTo(-1.005, 2)).toBe(-1.01);
    expect(roundTo(1.004999, 2)).toBe(1);
    expect(roundCurrency(1199.1010503)).toBe(1199.1);
  });
  it('never returns negative zero', () => {
    expect(Object.is(roundTo(-0.001, 2), 0)).toBe(true);
  });
  it('passes through non-finite values unchanged', () => {
    expect(roundTo(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });
  it('handles large values', () => {
    expect(roundCurrency(12_345_678.905)).toBe(12_345_678.91);
  });
});

describe('requireNumber', () => {
  it('accepts bare numbers and sourced values', () => {
    expect(requireNumber('x', 5)).toBe(5);
    expect(requireNumber('x', sourced(7, 'verified'))).toBe(7);
  });
  it.each([
    [Number.NaN, 'finite'],
    [Number.POSITIVE_INFINITY, 'finite'],
    [undefined, 'required'],
  ])('rejects %s', (v, msg) => {
    expect(() => requireNumber('x', v as number)).toThrow(msg);
  });
  it('enforces bounds and integers', () => {
    expect(() => requireNumber('x', -1, { min: 0 })).toThrow(UnderwritingInputError);
    expect(() => requireNumber('x', 0, { gt: 0 })).toThrow('> 0');
    expect(() => requireNumber('rate', 7, { max: 1 })).toThrow('≤ 1');
    expect(() => requireNumber('n', 1.5, { integer: true })).toThrow('whole number');
  });
  it('rejects strings and malformed objects', () => {
    expect(() => requireNumber('x', '5' as unknown as number)).toThrow('number or a sourced value');
    expect(() => requireNumber('x', { value: 'a' } as unknown as number)).toThrow('finite');
  });
  it('reports the failing field', () => {
    try {
      requireNumber('purchasePrice', -5, { min: 0 });
    } catch (e) {
      expect((e as UnderwritingInputError).field).toBe('purchasePrice');
    }
  });
});

describe('provenance helpers', () => {
  it('treats bare numbers as user assumptions', () => {
    expect(toSourced(3)).toEqual({ value: 3, source: 'user_assumption' });
    expect(valueOf(sourced(4, 'third_party_estimate', { sourceRef: 'AVM' }))).toBe(4);
  });
  it('records assumptions once with metadata', () => {
    const b = new ResultBuilder();
    b.input('arv', 'ARV', sourced(300000, 'verified', { sourceRef: 'Appraisal', asOf: '2026-11-01', note: 'n' }));
    b.input('arv', 'ARV', 1);
    expect(b.assumptions).toEqual([
      { key: 'arv', label: 'ARV', value: 300000, source: 'verified', sourceRef: 'Appraisal', asOf: '2026-11-01', note: 'n' },
    ]);
  });
  it('dedupes warnings by code', () => {
    const b = new ResultBuilder();
    b.warn('a', 'info', 'one');
    b.warn('a', 'critical', 'two');
    expect(b.warnings).toHaveLength(1);
  });
  it('safeDivide returns null on zero denominator', () => {
    expect(safeDivide(1, 0)).toBeNull();
    expect(safeDivide(1, 4)).toBe(0.25);
  });
});
