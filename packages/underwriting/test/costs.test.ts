import { describe, expect, it } from 'vitest';
import {
  calculateClosingCosts,
  calculateDispositionCosts,
  calculateFinancingCosts,
  calculateHoldingCosts,
  estimateRenovation,
} from '../src/index';

describe('estimateRenovation', () => {
  it('extends line items and applies contingency', () => {
    const r = estimateRenovation({
      lineItems: [
        { category: 'Paint', quantity: 10, unitCost: 100 },
        { category: 'Kitchen', description: 'Cabinets', quantity: 2, unitCost: 2500 },
        { category: 'Paint', quantity: 1, unitCost: 500 },
      ],
      squareFeet: 1300,
    });
    expect(r.value.subtotal).toBe(6500);
    expect(r.value.contingency).toBe(650);
    expect(r.value.total).toBe(7150);
    expect(r.value.costPerSqft).toBe(5.5);
    expect(r.value.byCategory).toEqual({ Paint: 1500, Kitchen: 5000 });
    expect(r.assumptions.find((a) => a.key === 'contingencyRate')?.value).toBe(0.1);
  });
  it('warns on empty scope and thin contingency', () => {
    expect(estimateRenovation({ lineItems: [] }).warnings[0]!.code).toBe('renovation_empty');
    const thin = estimateRenovation({ lineItems: [{ category: 'Roof', quantity: 1, unitCost: 9000 }], contingencyRate: 0.02 });
    expect(thin.warnings.map((w) => w.code)).toContain('renovation_low_contingency');
    expect(thin.value.costPerSqft).toBeNull();
  });
  it('rejects invalid line items', () => {
    expect(() => estimateRenovation({ lineItems: [{ category: '', quantity: 1, unitCost: 1 }] })).toThrow('category');
    expect(() => estimateRenovation({ lineItems: [{ category: 'X', quantity: -1, unitCost: 1 }] })).toThrow('quantity');
    expect(() => estimateRenovation({ lineItems: 'x' as never })).toThrow('array');
    expect(() => estimateRenovation({ lineItems: [], contingencyRate: 1.5 })).toThrow('contingencyRate');
  });
});

describe('calculateClosingCosts', () => {
  it('sums percentage and fixed costs', () => {
    const r = calculateClosingCosts({
      basePrice: 200_000,
      percentageCosts: { titleInsurance: 0.005, transferTax: 0.01 },
      fixedCosts: { escrow: 650 },
    });
    expect(r.value).toEqual({
      percentageTotal: 3000,
      fixedTotal: 650,
      total: 3650,
      effectiveRate: 0.01825,
      items: { titleInsurance: 1000, transferTax: 2000, escrow: 650 },
    });
  });
  it('handles a zero base price', () => {
    expect(calculateClosingCosts({ basePrice: 0, fixedCosts: { recording: 100 } }).value.effectiveRate).toBe(0);
  });
});

describe('calculateHoldingCosts', () => {
  it('prorates annual costs monthly', () => {
    const r = calculateHoldingCosts({ holdingMonths: 6, annualPropertyTax: 3600, annualInsurance: 1200, monthlyUtilities: 200 });
    expect(r.value).toEqual({ monthlyTotal: 600, total: 3600, months: 6 });
  });
  it('includes optional HOA, maintenance and other', () => {
    const r = calculateHoldingCosts({ holdingMonths: 2, annualPropertyTax: 0, annualInsurance: 0, monthlyHoa: 100, monthlyMaintenance: 50, monthlyOther: 25 });
    expect(r.value.total).toBe(350);
  });
});

describe('calculateFinancingCosts', () => {
  it('computes interest-only hard money costs', () => {
    const r = calculateFinancingCosts({
      purchasePrice: 150_000,
      loanToValue: 0.9,
      financedRehab: 30_000,
      annualInterestRate: 0.12,
      points: 0.02,
      lenderFees: 1000,
      holdingMonths: 6,
    });
    expect(r.value).toEqual({
      loanAmount: 165_000,
      downPayment: 15_000,
      pointsCost: 3300,
      lenderFees: 1000,
      monthlyPayment: 1650,
      interestPaid: 9900,
      totalFinancingCost: 14_200,
    });
  });
  it('sums declining-balance interest on amortizing loans', () => {
    const r = calculateFinancingCosts({ purchasePrice: 200_000, loanAmount: 200_000, annualInterestRate: 0.06, holdingMonths: 1, paymentType: 'amortizing', termMonths: 360 });
    expect(r.value.interestPaid).toBe(1000);
    expect(r.value.monthlyPayment).toBe(1199.1);
    const twelve = calculateFinancingCosts({ purchasePrice: 200_000, loanAmount: 200_000, annualInterestRate: 0.06, holdingMonths: 12, paymentType: 'amortizing', termMonths: 360 });
    expect(twelve.value.interestPaid).toBeLessThan(12_000);
    expect(twelve.value.interestPaid).toBeGreaterThan(11_900);
  });
  it('validates loan inputs', () => {
    expect(() => calculateFinancingCosts({ purchasePrice: 1, loanAmount: 1, loanToValue: 0.5, annualInterestRate: 0.1, holdingMonths: 1 })).toThrow('either');
    expect(() => calculateFinancingCosts({ purchasePrice: 1, loanAmount: 1, annualInterestRate: 0.1, holdingMonths: 1, paymentType: 'amortizing' })).toThrow('termMonths');
    const over = calculateFinancingCosts({ purchasePrice: 100, loanAmount: 150, annualInterestRate: 0.1, holdingMonths: 1 });
    expect(over.warnings[0]!.code).toBe('financing_loan_exceeds_price');
  });
  it('defaults to no loan when neither amount nor LTV is given', () => {
    const r = calculateFinancingCosts({ purchasePrice: 100_000, annualInterestRate: 0.1, holdingMonths: 3 });
    expect(r.value.loanAmount).toBe(0);
    expect(r.value.downPayment).toBe(100_000);
    expect(r.value.totalFinancingCost).toBe(0);
  });
});

describe('calculateDispositionCosts', () => {
  it('computes commission, closing, concessions and net proceeds', () => {
    const r = calculateDispositionCosts({ salePrice: 300_000, commissionRate: 0.05, sellerClosingRate: 0.01, sellerConcessions: 2000, otherFixed: 500 });
    expect(r.value).toEqual({ commission: 15_000, sellerClosing: 3000, concessions: 2000, other: 500, total: 20_500, netProceeds: 279_500 });
  });
});
