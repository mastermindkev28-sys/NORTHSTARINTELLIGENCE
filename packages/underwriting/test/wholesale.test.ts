import { describe, expect, it } from 'vitest';
import { analyzeAssignment, analyzeFlip, calculateDetailedMao, calculateMao, sourced } from '../src/index';

describe('calculateMao (rule of thumb)', () => {
  it('applies ARV × 70% − repairs − fee by default', () => {
    const r = calculateMao({ arv: 300_000, repairCosts: 40_000, assignmentFee: 10_000 });
    expect(r.value).toEqual({ mao: 160_000, buyerMaxPrice: 170_000, arvMultiplier: 0.7 });
    expect(r.trace.at(-1)!.formula).toBe('Buyer Max Price − Assignment Fee');
    expect(r.warnings).toEqual([]);
  });
  it('honours a custom multiplier and deductions', () => {
    const r = calculateMao({ arv: 200_000, repairCosts: 20_000, arvMultiplier: 0.75, otherDeductions: 5000 });
    expect(r.value.mao).toBe(125_000);
  });
  it('flags non-viable and heavy-rehab deals', () => {
    const r = calculateMao({ arv: 100_000, repairCosts: 80_000, assignmentFee: 5000 });
    expect(r.value.mao).toBe(-15_000);
    expect(r.warnings.map((w) => w.code)).toEqual(['mao_non_positive', 'mao_heavy_rehab']);
  });
  it('preserves provenance on assumptions', () => {
    const r = calculateMao({ arv: sourced(300_000, 'third_party_estimate', { sourceRef: 'AVM' }), repairCosts: 40_000 });
    expect(r.assumptions.find((a) => a.key === 'arv')).toMatchObject({ source: 'third_party_estimate', sourceRef: 'AVM' });
    expect(r.assumptions.find((a) => a.key === 'repairCosts')!.source).toBe('user_assumption');
  });
  it('rejects nonsensical inputs', () => {
    expect(() => calculateMao({ arv: 0, repairCosts: 0 })).toThrow('arv');
    expect(() => calculateMao({ arv: 1, repairCosts: -1 })).toThrow('repairCosts');
    expect(() => calculateMao({ arv: 1, repairCosts: 0, arvMultiplier: 70 })).toThrow('arvMultiplier');
  });
});

describe('calculateDetailedMao (cost stack)', () => {
  const base = {
    arv: 300_000,
    repairCosts: 40_000,
    buyerAcquisitionCosts: 3000,
    holdingCosts: 3600,
    financingCosts: 14_200,
    dispositionCosts: 20_000,
    assignmentFee: 10_000,
  };
  it('works backward from ARV with a percentage profit target', () => {
    const r = calculateDetailedMao({ ...base, targetProfit: 0.1, targetProfitIsRate: true });
    expect(r.value.totalCostStack).toBe(80_800);
    expect(r.value.targetProfit).toBe(30_000);
    expect(r.value.buyerMaxPrice).toBe(189_200);
    expect(r.value.mao).toBe(179_200);
    expect(r.value.impliedMultiplier).toBeCloseTo(0.597333, 6);
  });
  it('accepts a dollar profit target', () => {
    expect(calculateDetailedMao({ ...base, targetProfit: 25_000 }).value.mao).toBe(184_200);
  });
  it('flags non-viable deals', () => {
    expect(calculateDetailedMao({ ...base, targetProfit: 250_000 }).warnings[0]!.code).toBe('mao_non_positive');
  });
});

describe('analyzeAssignment', () => {
  const input = {
    contractPrice: 150_000,
    buyerPrice: 165_000,
    arv: 300_000,
    repairCosts: 40_000,
    buyerOtherCosts: 40_800,
    wholesalerCosts: 2000,
  };
  it('computes fee, wholesaler net, and the buyer view', () => {
    const r = analyzeAssignment(input);
    expect(r.value.assignmentFee).toBe(15_000);
    expect(r.value.wholesalerNet).toBe(13_000);
    expect(r.value.buyerAllIn).toBe(245_800);
    expect(r.value.buyerProjectedProfit).toBe(54_200);
    expect(r.value.buyerMargin).toBeCloseTo(0.180667, 6);
    expect(r.value.maxSupportableFee).toBe(39_200);
    expect(r.value.viableForBuyer).toBe(true);
  });
  it('max supportable fee leaves the buyer exactly at their minimum margin', () => {
    const max = analyzeAssignment(input).value.maxSupportableFee;
    const atMax = analyzeAssignment({ ...input, buyerPrice: 150_000 + max });
    expect(atMax.value.buyerMargin).toBeCloseTo(0.1, 10);
    expect(atMax.value.viableForBuyer).toBe(true);
  });
  it('flags thin buyer margins and negative fees', () => {
    const r = analyzeAssignment({ ...input, buyerPrice: 200_000 });
    expect(r.value.viableForBuyer).toBe(false);
    expect(r.warnings.map((w) => w.code)).toContain('assignment_buyer_margin_thin');
    const neg = analyzeAssignment({ ...input, buyerPrice: 140_000 });
    expect(neg.warnings.map((w) => w.code)).toContain('assignment_negative_fee');
  });
});

describe('analyzeFlip', () => {
  const input = {
    purchasePrice: 165_000,
    repairCosts: 40_000,
    acquisitionCosts: 3000,
    holdingCosts: 3600,
    financingCosts: 14_200,
    dispositionCosts: 20_000,
    salePrice: 300_000,
    holdingMonths: 6,
  };
  it('computes project cost, profit and returns', () => {
    const r = analyzeFlip(input);
    expect(r.value.totalProjectCost).toBe(245_800);
    expect(r.value.netProfit).toBe(54_200);
    expect(r.value.returnOnCost).toBeCloseTo(54_200 / 245_800, 12);
    expect(r.value.returnOnCash).toBeCloseTo(54_200 / 225_800, 12);
    expect(r.value.annualizedReturnOnCash).toBeCloseTo((1 + 54_200 / 225_800) ** 2 - 1, 12);
    expect(r.value.profitMarginOnSale).toBeCloseTo(0.180667, 6);
    expect(r.value.breakEvenSalePrice).toBe(245_800);
    expect(r.warnings).toEqual([]);
  });
  it('uses explicit cash invested when supplied', () => {
    expect(analyzeFlip({ ...input, cashInvested: 50_000 }).value.returnOnCash).toBeCloseTo(1.084, 10);
  });
  it('flags losses, thin margins and zero cash', () => {
    expect(analyzeFlip({ ...input, salePrice: 240_000 }).warnings[0]!.code).toBe('flip_loss');
    expect(analyzeFlip({ ...input, salePrice: 260_000 }).warnings[0]!.code).toBe('flip_thin_margin');
    const zero = analyzeFlip({ ...input, cashInvested: 0 });
    expect(zero.value.returnOnCash).toBeNull();
    expect(zero.value.annualizedReturnOnCash).toBeNull();
    expect(zero.warnings.map((w) => w.code)).toContain('flip_no_cash');
  });
});
