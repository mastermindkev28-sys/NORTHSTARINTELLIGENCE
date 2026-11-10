/**
 * Property-based invariants over seeded pseudo-random inputs. Seeded so failures are reproducible.
 */
import { describe, expect, it } from 'vitest';
import {
  amortizationSchedule,
  amortizingPayment,
  analyzeRental,
  calculateMao,
  irr,
  npv,
  remainingBalance,
} from '../src/index.js';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const between = (r: () => number, lo: number, hi: number) => lo + (hi - lo) * r();
const CASES = 300;

describe('invariants', () => {
  it('MAO is linear: +$1 repairs → −$1 MAO; +$1 ARV → +multiplier MAO', () => {
    const r = rng(42);
    for (let i = 0; i < CASES; i++) {
      const arv = Math.round(between(r, 50_000, 2_000_000));
      const repairs = Math.round(between(r, 0, arv * 0.4));
      const mult = between(r, 0.6, 0.85);
      const base = calculateMao({ arv, repairCosts: repairs, arvMultiplier: mult }).value.mao;
      expect(calculateMao({ arv, repairCosts: repairs + 1000, arvMultiplier: mult }).value.mao).toBeCloseTo(base - 1000, 1);
      expect(calculateMao({ arv: arv + 1000, repairCosts: repairs, arvMultiplier: mult }).value.mao).toBeCloseTo(base + 1000 * mult, 1);
    }
  });

  it('amortization: schedule principal sums to the loan and matches closed-form balances', () => {
    const r = rng(7);
    for (let i = 0; i < 40; i++) {
      const L = Math.round(between(r, 10_000, 1_500_000));
      const rate = between(r, 0, 0.15);
      const n = [120, 180, 240, 360][Math.floor(r() * 4)]!;
      const s = amortizationSchedule(L, rate, n);
      expect(s.reduce((a, x) => a + x.principal, 0)).toBeCloseTo(L, 4);
      const k = Math.floor(r() * n);
      if (k > 0) expect(remainingBalance(L, rate, n, k)).toBeCloseTo(s[k - 1]!.balance, 2);
      expect(amortizingPayment(L, rate, n)).toBeGreaterThanOrEqual(L / n - 1e-9);
    }
  });

  it('IRR is a root of NPV whenever it exists (NPV changes sign across it)', () => {
    const r = rng(99);
    for (let i = 0; i < CASES; i++) {
      const flows = [-between(r, 1000, 100_000), ...Array.from({ length: 1 + Math.floor(r() * 10) }, () => between(r, -5000, 40_000))];
      const x = irr(flows);
      if (x === null) continue;
      const scale = flows.reduce((a, f) => a + Math.abs(f), 0);
      const atRoot = Math.abs(npv(x, flows)) < scale * 1e-9;
      const bracketed = Math.sign(npv(x - 1e-8, flows)) !== Math.sign(npv(x + 1e-8, flows));
      expect(atRoot || bracketed).toBe(true);
    }
  });

  it('rental: NOI = EGI − OpEx, CF = NOI − DS, and results are deterministic', () => {
    const r = rng(2026);
    for (let i = 0; i < CASES; i++) {
      const input = {
        purchasePrice: between(r, 60_000, 900_000),
        monthlyRents: Array.from({ length: 1 + Math.floor(r() * 4) }, () => between(r, 500, 4000)),
        vacancyRate: between(r, 0, 0.15),
        expenses: { annualPropertyTax: between(r, 500, 12_000), annualInsurance: between(r, 400, 5000), managementRate: between(r, 0, 0.12), maintenanceRate: between(r, 0, 0.1) },
        loan: { downPaymentRate: between(r, 0.15, 0.4), annualInterestRate: between(r, 0.03, 0.12), termMonths: 360 },
      };
      const a = analyzeRental(input).value;
      expect(a.netOperatingIncome).toBeCloseTo(a.effectiveGrossIncome - a.operatingExpenses, 1);
      expect(a.annualCashFlow).toBeCloseTo(a.netOperatingIncome - a.annualDebtService, 1);
      expect(analyzeRental(structuredClone(input)).value).toEqual(a);
    }
  });
});
