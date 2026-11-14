import { describe, expect, it } from "vitest";
import { analyzeAssignment, analyzeFlip, maoCostBased, maoRuleOfThumb } from "./flip.js";
import { closingCosts, dispositionCosts, holdingCosts, shortTermFinancingCosts, sizeShortTermLoan } from "./costs.js";
import { estimateRehab } from "./rehab.js";

describe("cost functions", () => {
  it("closing, holding, disposition", () => {
    expect(closingCosts({ price: 200_000, rate: 0.02, fixed: 1500 })).toBe(5500);
    expect(holdingCosts({ months: 6, annualPropertyTax: 3600, annualInsurance: 1200, monthlyUtilities: 150 })).toEqual({ monthly: 550, total: 3300 });
    expect(dispositionCosts({ salePrice: 300_000, commissionRate: 0.05, sellerClosingRate: 0.01, sellerConcessions: 3000 })).toBeCloseTo(21_000, 8);
  });
  it("sizes short-term loans by the binding constraint", () => {
    // LTC binds: 0.9 × (150k + 50k) = 180k < 0.7 × 300k = 210k
    expect(sizeShortTermLoan({ purchasePrice: 150_000, rehabCost: 50_000, arv: 300_000, maxLtc: 0.9, maxLtv: 0.7, financeRehab: true })).toBe(180_000);
    // LTV binds
    expect(sizeShortTermLoan({ purchasePrice: 150_000, rehabCost: 50_000, arv: 220_000, maxLtc: 0.9, maxLtv: 0.7, financeRehab: true })).toBeCloseTo(154_000, 8);
  });
  it("computes hard-money financing cost", () => {
    const f = shortTermFinancingCosts({ loanAmount: 180_000, annualRate: 0.12, points: 0.02, lenderFees: 1000, months: 6 });
    expect(f.points).toBeCloseTo(3600, 8);
    expect(f.interest).toBeCloseTo(10_800, 8);
    expect(f.total).toBeCloseTo(15_400, 8);
  });
  it("rejects percentage-points passed as whole numbers", () => {
    expect(() => closingCosts({ price: 100_000, rate: 2 })).toThrow();
    expect(() => shortTermFinancingCosts({ loanAmount: 1, annualRate: 12, months: 1 })).toThrow();
  });
});

describe("rehab estimate", () => {
  it("per-sqft with placeholder flag", () => {
    const r = estimateRehab({ livingAreaSqft: 1500, scope: "moderate" });
    expect(r.base).toBe(52_500);
    expect(r.total).toBeCloseTo(57_750, 8);
    expect(r.isPlaceholderRate).toBe(true);
  });
  it("custom rate clears the placeholder flag", () => {
    const r = estimateRehab({ livingAreaSqft: 1000, scope: "full", costPerSqftByScope: { full: 55 }, contingencyRate: 0 });
    expect(r.total).toBe(55_000);
    expect(r.isPlaceholderRate).toBe(false);
  });
  it("line items take precedence", () => {
    const r = estimateRehab({ livingAreaSqft: 1500, scope: "gut", lineItems: [{ category: "Roof", quantity: 20, unitCost: 450 }, { category: "Paint", quantity: 1, unitCost: 4000 }], contingencyRate: 0.15 });
    expect(r.method).toBe("line_items");
    expect(r.base).toBe(13_000);
    expect(r.total).toBeCloseTo(14_950, 8);
  });
  it("requires a method", () => {
    expect(() => estimateRehab({ livingAreaSqft: 1000 })).toThrow(/lineItems or a rehab scope/);
  });
});

describe("MAO", () => {
  it("70% rule", () => {
    expect(maoRuleOfThumb({ arv: 300_000, repairCost: 40_000 })).toBeCloseTo(170_000, 8);
    expect(maoRuleOfThumb({ arv: 300_000, repairCost: 40_000, assignmentFee: 10_000 })).toBeCloseTo(160_000, 8);
  });
  it("cost-based MAO solves price-dependent closing costs exactly", () => {
    const p = maoCostBased({
      arv: 300_000, repairCost: 40_000, targetProfit: { type: "arv_rate", value: 0.15 }, buyerClosingRate: 0.02,
      holdingCost: 3300, financingCost: 15_400, dispositionCost: 19_500, assignmentFee: 10_000,
    });
    // numerator = 300000 − 40000 − 45000 − 3300 − 15400 − 19500 − 0 − 10000 = 166,800
    expect(p).toBeCloseTo(166_800 / 1.02, 8);
    // Verify the identity: end buyer at price P + fee plus closing on P yields exactly the target profit.
    const endBuyerProfit = 300_000 - (p + 10_000) - p * 0.02 - 40_000 - 3300 - 15_400 - 19_500;
    expect(endBuyerProfit).toBeCloseTo(45_000, 6);
  });
  it("can be negative when the deal does not work", () => {
    expect(maoRuleOfThumb({ arv: 100_000, repairCost: 90_000 })).toBeLessThan(0);
  });
});

describe("analyzeFlip", () => {
  it("produces a consistent cash and profit picture", () => {
    const r = analyzeFlip({
      purchasePrice: 150_000, arv: 300_000, rehabCost: 50_000, holdMonths: 6,
      acquisition: { closingRate: 0.02 },
      holding: { annualPropertyTax: 3600, annualInsurance: 1200, monthlyUtilities: 150 },
      disposition: { commissionRate: 0.05, sellerClosingRate: 0.01 },
      financing: { maxLtc: 0.9, maxLtv: 0.7, financeRehab: true, annualRate: 0.12, points: 0.02, lenderFees: 1000 },
    });
    expect(r.loanAmount).toBe(180_000);
    expect(r.acquisitionCosts).toBe(3000);
    expect(r.holdingCosts).toBe(3300);
    expect(r.financingCosts).toBeCloseTo(15_400, 8);
    expect(r.dispositionCosts).toBeCloseTo(18_000, 8);
    expect(r.totalProjectCost).toBeCloseTo(239_700, 6);
    expect(r.netProfit).toBeCloseTo(60_300, 6);
    // Loan 180k: 150k toward purchase... financed rehab = min(180k−150k, 50k) = 30k → purchase portion 150k.
    // cash = (150k−150k) + (50k−30k) + 3000 + 3300 + 15400 = 41,700
    expect(r.cashRequired).toBeCloseTo(41_700, 6);
    expect(r.cashOnCashReturn as number).toBeCloseTo(60_300 / 41_700, 10);
    expect(r.trace.steps.some((s) => s.key === "net_profit")).toBe(true);
  });
  it("all-cash flip", () => {
    const r = analyzeFlip({ purchasePrice: 100_000, arv: 180_000, rehabCost: 30_000, holdMonths: 4, acquisition: {}, holding: {}, disposition: { commissionRate: 0.05 } });
    expect(r.loanAmount).toBe(0);
    expect(r.cashRequired).toBe(130_000);
    expect(r.netProfit).toBeCloseTo(41_000, 8);
  });
  it("rejects zero hold period", () => {
    expect(() => analyzeFlip({ purchasePrice: 1, arv: 1, rehabCost: 0, holdMonths: 0, acquisition: {}, holding: {}, disposition: {} })).toThrow();
  });
});

describe("analyzeAssignment", () => {
  it("computes fee, cushion and viability", () => {
    const r = analyzeAssignment({ contractPrice: 150_000, endBuyerPrice: 162_000, endBuyerMaxPrice: 170_000, wholesalerCosts: 1500 });
    expect(r.assignmentFee).toBe(12_000);
    expect(r.netToWholesaler).toBe(10_500);
    expect(r.buyerCushion).toBe(8000);
    expect(r.maxSupportableFee).toBe(20_000);
    expect(r.viable).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/vary by state/);
  });
  it("flags unsellable assignments", () => {
    const r = analyzeAssignment({ contractPrice: 160_000, endBuyerPrice: 180_000, endBuyerMaxPrice: 170_000 });
    expect(r.viable).toBe(false);
    expect(r.warnings[0]).toMatch(/unlikely to sell/);
  });
});
