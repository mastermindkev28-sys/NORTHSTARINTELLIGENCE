import { describe, expect, it } from 'vitest';
import {
  buildRentalReport,
  buildWholesaleDealReport,
  ENGINE_VERSION,
  fingerprint,
  sourced,
  stableStringify,
  type WholesaleDealInput,
} from '../src/index.js';

const deal: WholesaleDealInput = {
  subjectSquareFeet: sourced(1600, 'verified', { sourceRef: 'County assessor' }),
  valuationDate: '2026-11-10',
  comps: [
    { id: 'A', salePrice: 300_000, squareFeet: 1500, adjustments: { bathroom: 5000 }, saleDate: '2026-09-01' },
    { id: 'B', salePrice: 310_000, squareFeet: 1550, saleDate: '2026-08-15' },
    { id: 'C', salePrice: 295_000, squareFeet: 1450, adjustments: { garage: -2000 }, saleDate: '2026-07-20' },
  ],
  repairLineItems: [
    { category: 'Kitchen', quantity: 1, unitCost: 18_000 },
    { category: 'Flooring', quantity: 1600, unitCost: 4.5 },
    { category: 'Paint', quantity: 1, unitCost: 6000 },
  ],
  assignmentFee: 12_000,
  wholesalerCosts: 1500,
  buyer: {
    acquisitionClosingRate: 0.015,
    holdingMonths: 5,
    annualPropertyTax: 3600,
    annualInsurance: 1500,
    monthlyUtilities: 200,
    loanToValue: 0.85,
    financeRehab: true,
    annualInterestRate: 0.115,
    points: 0.02,
    commissionRate: 0.05,
    sellerClosingRate: 0.01,
    targetProfitRate: 0.1,
  },
};

describe('buildWholesaleDealReport', () => {
  const r = buildWholesaleDealReport(deal);

  it('derives ARV from comps and repairs from line items', () => {
    expect(r.summary.arv).toBe(322_881.23);
    // (18000 + 7200 + 6000) × 1.10
    expect(r.summary.repairCosts).toBe(34_320);
    expect(r.arvAnalysis?.compCount).toBe(3);
  });

  it('recommends the lower of the rule-of-thumb and cost-stack MAOs', () => {
    expect(r.summary.maoRuleOfThumb).toBe(roundC(322_881.23 * 0.7 - 34_320 - 12_000));
    expect(r.summary.recommendedMaxOffer).toBe(Math.min(r.summary.maoRuleOfThumb, r.summary.maoCostStack));
    expect(r.summary.contractPrice).toBe(r.summary.recommendedMaxOffer);
    expect(r.summary.buyerPrice).toBeCloseTo(r.summary.contractPrice + 12_000, 6);
  });

  it('cost stack reconciles to the cost-stack MAO', () => {
    const s = r.costStack;
    const stack = r.summary.repairCosts + s.acquisition + s.holding + s.financing + s.disposition;
    expect(r.summary.maoCostStack).toBeCloseTo(r.summary.arv - stack - s.targetProfit - 12_000, 1);
  });

  it('leaves the end buyer at or above their target margin when offering at the recommended price', () => {
    expect(r.summary.viableForBuyer).toBe(true);
    expect(r.summary.buyerMargin).toBeGreaterThanOrEqual(0.1 - 1e-9);
  });

  it('groups assumptions by provenance and never labels derived values as assumptions', () => {
    expect(r.assumptionsBySource.verified.map((a) => a.key)).toEqual(['subjectSquareFeet']);
    const userKeys = r.assumptionsBySource.user_assumption.map((a) => a.key);
    expect(userKeys).not.toContain('arv');
    expect(userKeys).not.toContain('repairCosts');
    expect(userKeys).not.toContain('holdingCosts');
    expect(userKeys).toEqual(expect.arrayContaining(['assignmentFee', 'targetProfitRate', 'commissionRate', 'contingencyRate']));
  });

  it('includes formulas, warnings sorted by severity, engine version, and disclaimer', () => {
    expect(r.trace.find((t) => t.label === 'Recommended max offer')?.formula).toBe('min(Rule-of-thumb MAO, Cost-stack MAO)');
    expect(r.engineVersion).toBe(ENGINE_VERSION);
    expect(r.disclaimer).toMatch(/not appraisals/);
    expect(r.sensitivity.cells).toHaveLength(5);
  });

  it('is deterministic and fingerprints inputs independent of key order', () => {
    const again = buildWholesaleDealReport(structuredClone(deal));
    expect(again).toEqual(r);
    const reordered = Object.fromEntries(Object.entries(deal).reverse());
    expect(fingerprint(reordered)).toBe(r.inputsFingerprint);
    expect(fingerprint({ ...deal, assignmentFee: 12_001 })).not.toBe(r.inputsFingerprint);
  });

  it('flags a contract price above the recommended max offer', () => {
    const over = buildWholesaleDealReport({ ...deal, contractPrice: 250_000 });
    expect(over.warnings[0]!.severity).toBe('critical');
    expect(over.warnings.map((w) => w.code)).toContain('contract_above_mao');
    expect(over.summary.viableForBuyer).toBe(false);
  });

  it('accepts a direct ARV and repair total, and an ARV override with comps', () => {
    const direct = buildWholesaleDealReport({ ...deal, comps: undefined, repairLineItems: undefined, arv: 300_000, repairCosts: 40_000, buyer: { ...deal.buyer, loanToValue: 0 } });
    expect(direct.summary.maoRuleOfThumb).toBe(158_000);
    expect(direct.costStack.financing).toBe(0);
    const override = buildWholesaleDealReport({ ...deal, arv: sourced(330_000, 'verified', { sourceRef: 'Appraisal' }) });
    expect(override.summary.arv).toBe(330_000);
    expect(override.warnings.map((w) => w.code)).toContain('arv_override');
  });

  it('flags deals where no positive offer works', () => {
    const bad = buildWholesaleDealReport({ ...deal, comps: undefined, subjectSquareFeet: undefined, arv: 100_000, repairLineItems: undefined, repairCosts: 90_000 });
    expect(bad.warnings.map((w) => w.code)).toContain('deal_not_viable');
  });

  it('rejects incomplete input', () => {
    expect(() => buildWholesaleDealReport({ ...deal, comps: undefined })).toThrow('arv');
    expect(() => buildWholesaleDealReport({ ...deal, subjectSquareFeet: undefined })).toThrow('subjectSquareFeet');
    expect(() => buildWholesaleDealReport({ ...deal, repairLineItems: undefined })).toThrow('repairCosts');
    expect(() => buildWholesaleDealReport({ ...deal, buyer: { ...deal.buyer, annualInterestRate: undefined } })).toThrow('annualInterestRate');
  });
});

describe('buildRentalReport', () => {
  const rental = {
    purchasePrice: 180_000,
    monthlyRents: [1650],
    vacancyRate: 0.06,
    expenses: { annualPropertyTax: 2100, annualInsurance: 1100, managementRate: 0.09, maintenanceRate: 0.05, capexRate: 0.05 },
    loan: { downPaymentRate: 0.2, annualInterestRate: 0.0725, termMonths: 360 },
    closingCosts: 3500,
  };
  it('bundles analysis, projection, and sensitivity', () => {
    const r = buildRentalReport({ rental, projection: { years: 10, annualRentGrowth: 0.03, annualExpenseGrowth: 0.03, annualAppreciation: 0.03 } });
    expect(r.kind).toBe('rental');
    expect(r.projection?.years).toHaveLength(10);
    expect(r.sensitivity?.cells[2]![2]!.dscr).toBe(r.analysis.dscr);
    expect(r.trace.filter((t) => t.label === 'Net operating income')).toHaveLength(1);
  });
  it('omits sensitivity for all-cash purchases', () => {
    const { loan: _l, ...cash } = rental;
    const r = buildRentalReport({ rental: cash });
    expect(r.sensitivity).toBeNull();
    expect(r.projection).toBeNull();
  });
});

describe('stableStringify', () => {
  it('sorts keys and drops undefined', () => {
    expect(stableStringify({ b: 1, a: [1, { d: undefined, c: 2 }] })).toBe('{"a":[1,{"c":2}],"b":1}');
  });
});

function roundC(v: number) {
  return Math.round(v * 100) / 100;
}
