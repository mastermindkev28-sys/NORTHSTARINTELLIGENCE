import { describe, expect, it } from 'vitest';
import { analyzeRental, npv, projectRental, type RentalInput } from '../src/index';

const input: RentalInput = {
  purchasePrice: 200_000,
  monthlyRents: [1800],
  vacancyRate: 0.05,
  expenses: { annualPropertyTax: 2400, annualInsurance: 1200, managementRate: 0.08, maintenanceRate: 0.05, capexRate: 0.05 },
  loan: { downPaymentRate: 0.25, annualInterestRate: 0.07, termMonths: 360 },
  closingCosts: 4000,
};

describe('analyzeRental', () => {
  const r = analyzeRental(input);
  it('computes income and NOI', () => {
    expect(r.value.grossPotentialRent).toBe(21_600);
    expect(r.value.vacancyLoss).toBe(1080);
    expect(r.value.effectiveGrossIncome).toBe(20_520);
    expect(r.value.expenseBreakdown).toMatchObject({ propertyTax: 2400, insurance: 1200, management: 1641.6, maintenance: 1080, capex: 1080 });
    expect(r.value.operatingExpenses).toBe(7401.6);
    expect(r.value.netOperatingIncome).toBe(13_118.4);
  });
  it('computes debt service and cash flow', () => {
    expect(r.value.loanAmount).toBe(150_000);
    expect(r.value.monthlyDebtService).toBe(997.95);
    expect(r.value.annualDebtService).toBe(11_975.44);
    expect(r.value.annualCashFlow).toBe(1142.96);
    expect(r.value.totalCashInvested).toBe(54_000);
  });
  it('computes return ratios', () => {
    expect(r.value.capRate).toBeCloseTo(0.065592, 10);
    expect(r.value.cashOnCash!).toBeCloseTo(0.0211658349, 8);
    expect(r.value.dscr!).toBeCloseTo(1.0954415552, 8);
    expect(r.value.grossRentMultiplier).toBeCloseTo(9.259259, 5);
    expect(r.value.breakEvenOccupancy).toBeCloseTo(0.8970854126, 8);
    expect(r.value.rentToPrice).toBeCloseTo(0.009, 10);
  });
  it('flags DSCR below typical lender minimums', () => {
    expect(r.warnings.map((w) => w.code)).toContain('rental_dscr_below_lender');
  });
  it('treats all-cash purchases correctly', () => {
    const { loan: _loan, ...cash } = input;
    const c = analyzeRental(cash);
    expect(c.value.dscr).toBeNull();
    expect(c.value.annualDebtService).toBe(0);
    expect(c.value.totalCashInvested).toBe(204_000);
    expect(c.value.cashOnCash!).toBeCloseTo(13_118.4 / 204_000, 12);
  });
  it('supports explicit loan amount, interest-only, points, other income and repairs', () => {
    const c = analyzeRental({
      ...input,
      otherMonthlyIncome: 50,
      initialRepairs: 6000,
      loan: { loanAmount: 160_000, annualInterestRate: 0.08, termMonths: 360, interestOnly: true, points: 0.01 },
    });
    expect(c.value.monthlyDebtService).toBeCloseTo(1066.67, 2);
    expect(c.value.totalCashInvested).toBe(200_000 - 160_000 + 4000 + 1600 + 6000);
    expect(c.value.effectiveGrossIncome).toBe(21_120);
  });
  it('flags negative cash flow, DSCR < 1, zero vacancy, missing reserves and self-management', () => {
    const bad = analyzeRental({ ...input, monthlyRents: [1200], vacancyRate: 0, expenses: { annualPropertyTax: 2400, annualInsurance: 1200 } });
    expect(bad.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['rental_dscr_below_1', 'rental_negative_cash_flow', 'rental_zero_vacancy', 'rental_no_reserves', 'rental_self_managed']),
    );
  });
  it('handles multi-unit rents and HOA/utilities', () => {
    const m = analyzeRental({ ...input, monthlyRents: [1000, 1100], expenses: { ...input.expenses, monthlyHoa: 100, monthlyUtilities: 150, annualOther: 500 } });
    expect(m.value.grossPotentialRent).toBe(25_200);
    expect(m.value.expenseBreakdown).toMatchObject({ hoa: 1200, utilities: 1800, other: 500 });
  });
  it('validates inputs', () => {
    expect(() => analyzeRental({ ...input, monthlyRents: [] })).toThrow('at least one');
    expect(() => analyzeRental({ ...input, vacancyRate: 5 })).toThrow('vacancyRate');
    expect(() => analyzeRental({ ...input, loan: { loanAmount: 1, downPaymentRate: 0.2, annualInterestRate: 0.07, termMonths: 360 } })).toThrow('either');
  });
});

describe('projectRental', () => {
  const p = projectRental({ rental: input, years: 5, annualRentGrowth: 0.03, annualExpenseGrowth: 0.025, annualAppreciation: 0.03 });
  it('grows income, expenses, and value and pays down the loan', () => {
    const y = p.value.years;
    expect(y).toHaveLength(5);
    expect(y[0]!.netOperatingIncome).toBe(13_118.4);
    expect(y[0]!.cashFlow).toBe(1142.96);
    expect(y[4]!.effectiveGrossIncome).toBeCloseTo(20_520 * 1.03 ** 4, 1);
    expect(y[0]!.propertyValue).toBe(206_000);
    for (let i = 1; i < y.length; i++) expect(y[i]!.loanBalance).toBeLessThan(y[i - 1]!.loanBalance);
    expect(y[4]!.cumulativeCashFlow).toBeCloseTo(y.reduce((a, r) => a + r.cashFlow, 0), 1);
  });
  it('produces an IRR that zeroes the NPV of the cash flows', () => {
    const y = p.value.years;
    const flows = [-54_000, ...y.map((r) => r.cashFlow)];
    flows[flows.length - 1]! += p.value.netSaleProceeds;
    expect(p.value.irr).not.toBeNull();
    expect(npv(p.value.irr!, flows)).toBeCloseTo(0, 4);
    expect(p.value.equityMultiple!).toBeGreaterThan(1);
  });
  it('handles all-cash and interest-only projections', () => {
    const { loan: _l, ...cash } = input;
    const c = projectRental({ rental: cash, years: 3, annualRentGrowth: 0, annualExpenseGrowth: 0, annualAppreciation: 0 });
    expect(c.value.years.every((r) => r.loanBalance === 0)).toBe(true);
    const io = projectRental({ rental: { ...input, loan: { ...input.loan!, interestOnly: true } }, years: 2, annualRentGrowth: 0, annualExpenseGrowth: 0, annualAppreciation: 0 });
    expect(io.value.years[1]!.loanBalance).toBe(150_000);
  });
  it('rejects unreasonable horizons and growth rates', () => {
    expect(() => projectRental({ rental: input, years: 0, annualRentGrowth: 0, annualExpenseGrowth: 0, annualAppreciation: 0 })).toThrow();
    expect(() => projectRental({ rental: input, years: 5, annualRentGrowth: 3, annualExpenseGrowth: 0, annualAppreciation: 0 })).toThrow('annualRentGrowth');
  });
});
