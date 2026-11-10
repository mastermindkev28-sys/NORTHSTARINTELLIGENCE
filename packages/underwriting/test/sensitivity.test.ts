import { describe, expect, it } from 'vitest';
import {
  calculateMao,
  compareFinancingScenarios,
  maoSensitivity,
  oneWaySensitivity,
  rentalSensitivity,
  analyzeRental,
  type RentalInput,
} from '../src/index.js';

const rental: RentalInput = {
  purchasePrice: 200_000,
  monthlyRents: [900, 900],
  vacancyRate: 0.05,
  expenses: { annualPropertyTax: 2400, annualInsurance: 1200, managementRate: 0.08, maintenanceRate: 0.05, capexRate: 0.05 },
  loan: { downPaymentRate: 0.25, annualInterestRate: 0.07, termMonths: 360 },
  closingCosts: 4000,
};

describe('oneWaySensitivity', () => {
  it('varies one input without mutating the base', () => {
    const base = { arv: 300_000, repairCosts: 40_000 };
    const rows = oneWaySensitivity(base, 300_000, [-0.1, 0, 0.1], (i, v) => ({ ...i, arv: v }), (i) => calculateMao(i).value.mao);
    expect(rows.map((r) => r.output)).toEqual([149_000, 170_000, 191_000]);
    expect(base.arv).toBe(300_000);
  });
  it('rejects empty or impossible deltas', () => {
    expect(() => oneWaySensitivity({}, 1, [], (i) => i, () => 0)).toThrow('at least one');
    expect(() => oneWaySensitivity({}, 1, [-2], (i) => i, () => 0)).toThrow();
  });
});

describe('maoSensitivity', () => {
  const g = maoSensitivity({ arv: 300_000, repairCosts: 40_000, assignmentFee: 10_000 });
  it('centre cell equals the base MAO', () => {
    expect(g.cells[2]![2]).toBe(160_000);
    expect(g.rowValues[2]).toBe(300_000);
    expect(g.colValues[2]).toBe(40_000);
  });
  it('MAO rises with ARV and falls with repairs', () => {
    for (let r = 1; r < 5; r++) expect(g.cells[r]![2]!).toBeGreaterThan(g.cells[r - 1]![2]!);
    for (let c = 1; c < 5; c++) expect(g.cells[2]![c]!).toBeLessThan(g.cells[2]![c - 1]!);
  });
});

describe('rentalSensitivity', () => {
  it('centre cell equals the base analysis', () => {
    const g = rentalSensitivity(rental);
    const base = analyzeRental(rental).value;
    expect(g.cells[2]![2]!.cashOnCash).toBe(base.cashOnCash);
    expect(g.cells[2]![2]!.dscr).toBe(base.dscr);
    expect(g.cells[4]![0]!.monthlyCashFlow).toBeGreaterThan(g.cells[0]![4]!.monthlyCashFlow);
  });
  it('preserves the unit rent mix when scaling rents', () => {
    const g = rentalSensitivity({ ...rental, monthlyRents: [600, 1200] }, [0.5], [0]);
    expect(g.rowValues[0]).toBe(2700);
  });
  it('requires loan terms', () => {
    const { loan: _l, ...cash } = rental;
    expect(() => rentalSensitivity(cash)).toThrow('loan');
  });
});

describe('compareFinancingScenarios', () => {
  const { loan: _l, ...base } = rental;
  it('runs each structure on identical operating assumptions', () => {
    const rows = compareFinancingScenarios(base, [
      { id: 'cash', label: 'All cash', loan: null },
      { id: 'conv', label: '25% down conventional', loan: { downPaymentRate: 0.25, annualInterestRate: 0.07, termMonths: 360 } },
      { id: 'dscr', label: '20% down DSCR loan', loan: { downPaymentRate: 0.2, annualInterestRate: 0.08, termMonths: 360, points: 0.015 } },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['cash', 'conv', 'dscr']);
    const noi = rows.map((r) => r.result.value.netOperatingIncome);
    expect(new Set(noi).size).toBe(1);
    expect(rows[0]!.result.value.dscr).toBeNull();
    expect(rows[2]!.result.value.totalCashInvested).toBe(40_000 + 4000 + 160_000 * 0.015);
  });
  it('rejects empty and duplicate scenarios', () => {
    expect(() => compareFinancingScenarios(base, [])).toThrow('at least one');
    expect(() => compareFinancingScenarios(base, [{ id: 'a', label: 'a', loan: null }, { id: 'a', label: 'b', loan: null }])).toThrow('duplicate');
  });
});
