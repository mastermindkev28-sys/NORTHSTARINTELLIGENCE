import { describe, expect, it } from 'vitest';
import {
  amortizationSchedule,
  amortizingPayment,
  annualizeReturn,
  interestOnlyPayment,
  irr,
  npv,
  remainingBalance,
  roundCurrency,
} from '../src/index.js';

describe('amortizingPayment', () => {
  it('matches standard mortgage tables', () => {
    expect(roundCurrency(amortizingPayment(200_000, 0.06, 360))).toBe(1199.1);
    expect(roundCurrency(amortizingPayment(150_000, 0.07, 360))).toBe(997.95);
    expect(roundCurrency(amortizingPayment(100_000, 0.05, 180))).toBe(790.79);
  });
  it('amortizes linearly at zero interest', () => {
    expect(amortizingPayment(120_000, 0, 360)).toBeCloseTo(333.3333, 4);
  });
  it('returns 0 for zero principal', () => {
    expect(amortizingPayment(0, 0.07, 360)).toBe(0);
  });
  it('rejects invalid terms', () => {
    expect(() => amortizingPayment(100_000, 0.07, 0)).toThrow();
    expect(() => amortizingPayment(100_000, 0.07, 12.5)).toThrow('whole number');
    expect(() => amortizingPayment(100_000, 7, 360)).toThrow('≤ 1');
    expect(() => amortizingPayment(-1, 0.07, 360)).toThrow();
  });
});

describe('interestOnlyPayment', () => {
  it('computes monthly interest', () => {
    expect(interestOnlyPayment(300_000, 0.12)).toBe(3000);
  });
});

describe('amortization schedule and balances', () => {
  const sched = amortizationSchedule(200_000, 0.06, 360);
  it('pays the loan to exactly zero', () => {
    expect(sched).toHaveLength(360);
    expect(sched[359]!.balance).toBe(0);
    const principal = sched.reduce((a, r) => a + r.principal, 0);
    expect(principal).toBeCloseTo(200_000, 6);
  });
  it('first-month interest is balance × r', () => {
    expect(sched[0]!.interest).toBeCloseTo(1000, 8);
  });
  it('closed-form remaining balance matches the schedule', () => {
    expect(remainingBalance(200_000, 0.06, 360, 60)).toBeCloseTo(sched[59]!.balance, 4);
    expect(remainingBalance(200_000, 0.06, 360, 0)).toBe(200_000);
    expect(remainingBalance(200_000, 0.06, 360, 360)).toBe(0);
    expect(remainingBalance(200_000, 0.06, 360, 500)).toBe(0);
    expect(remainingBalance(120_000, 0, 360, 180)).toBeCloseTo(60_000, 6);
  });
});

describe('npv / irr', () => {
  it('npv discounts from t=0', () => {
    expect(npv(0.1, [-100, 110])).toBeCloseTo(0, 10);
    expect(npv(0, [-100, 50, 50])).toBe(0);
  });
  it('irr solves simple and multi-period cases', () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 8);
    expect(irr([-1000, 300, 400, 500])).toBeCloseTo(0.0889633947, 8);
  });
  it('irr handles negative returns', () => {
    const r = irr([-1000, 400, 400])!;
    expect(r).toBeLessThan(0);
    expect(npv(r, [-1000, 400, 400])).toBeCloseTo(0, 6);
  });
  it('irr is null without a sign change', () => {
    expect(irr([100, 200])).toBeNull();
    expect(irr([-100, -200])).toBeNull();
  });
  it('irr rejects bad input', () => {
    expect(() => irr([100])).toThrow('two periods');
    expect(() => irr([-100, Number.NaN])).toThrow('finite');
  });
});

describe('annualizeReturn', () => {
  it('compounds holding-period returns', () => {
    expect(annualizeReturn(0.21, 24)).toBeCloseTo(0.1, 10);
    expect(annualizeReturn(0.1, 12)).toBeCloseTo(0.1, 10);
    expect(annualizeReturn(0.05, 6)).toBeCloseTo(0.1025, 10);
  });
  it('is null for total loss', () => {
    expect(annualizeReturn(-1, 12)).toBeNull();
  });
});
