import { describe, expect, it } from "vitest";
import { underwriteWholesaleDeal, type WholesaleDealInput } from "./deal";

const baseInput: WholesaleDealInput = {
  asOf: "2026-11-01",
  subject: { livingAreaSqft: 1500, bedrooms: 3, bathrooms: 2 },
  arv: {
    method: "comps",
    comps: [
      { id: "c1", salePrice: 300_000, livingAreaSqft: 1500, saleDate: "2026-09-10", distanceMiles: 0.3 },
      { id: "c2", salePrice: 312_000, livingAreaSqft: 1560, saleDate: "2026-08-20", distanceMiles: 0.5 },
      { id: "c3", salePrice: 290_000, livingAreaSqft: 1450, saleDate: "2026-10-05", distanceMiles: 0.2 },
      { id: "c4", salePrice: 305_000, livingAreaSqft: 1525, saleDate: "2026-07-30", distanceMiles: 0.6 },
    ],
  },
  rehab: { method: "manual", value: 40_000, origin: "user_assumption" },
  askingPrice: 150_000,
  assumptions: { annualPropertyTax: 3600, annualInsurance: 1200, monthlyUtilities: 150 },
};

describe("underwriteWholesaleDeal", () => {
  it("produces a full, traceable recommendation", () => {
    const r = underwriteWholesaleDeal(baseInput);
    expect(r.arv.value).toBe(300_000); // every comp is $200/sqft
    expect(r.maoRuleOfThumb).toBeCloseTo(160_000, 6);
    // cost-based: (300000 − 40000 − 45000 − 3300 − 0 − 19500 − 10000) / 1.02
    expect(r.maoCostBased).toBeCloseTo(182_200 / 1.02, 6);
    expect(r.recommendedMaxOffer).toBe(160_000);
    expect(r.spreadToAsking).toBe(10_000);
    expect(r.decision).toBe("pursue");
    expect(r.trace.find((s) => s.key === "recommended_max_offer")).toBeDefined();
    expect(r.assumptions.find((x) => x.key === "rehab")?.origin).toBe("user_assumption");
    expect(r.limitations.join(" ")).toMatch(/not an appraisal/);
    expect(r.limitations.join(" ")).toMatch(/human review/);
  });

  it("is reproducible", () => {
    expect(JSON.stringify(underwriteWholesaleDeal(baseInput))).toBe(JSON.stringify(underwriteWholesaleDeal(baseInput)));
  });

  it("negotiate vs pass thresholds", () => {
    expect(underwriteWholesaleDeal({ ...baseInput, askingPrice: 170_000 }).decision).toBe("negotiate");
    expect(underwriteWholesaleDeal({ ...baseInput, askingPrice: 200_000 }).decision).toBe("pass");
  });

  it("returns insufficient_data rather than inventing an ARV", () => {
    const r = underwriteWholesaleDeal({ ...baseInput, arv: { method: "comps", comps: [] } });
    expect(r.decision).toBe("insufficient_data");
    expect(r.recommendedMaxOffer).toBeNull();
  });

  it("flags AI-sourced ARV", () => {
    const r = underwriteWholesaleDeal({ ...baseInput, arv: { method: "manual", value: 300_000, origin: "ai_generated" } });
    expect(r.warnings.join(" ")).toMatch(/AI interpretation/);
    expect(r.arv.origin).toBe("ai_generated");
  });

  it("includes end-buyer financing costs when provided", () => {
    const withFin = underwriteWholesaleDeal({ ...baseInput, assumptions: { ...baseInput.assumptions, endBuyerFinancing: { maxLtc: 0.9, maxLtv: 0.7, annualRate: 0.12 } } });
    const without = underwriteWholesaleDeal(baseInput);
    expect(withFin.endBuyerCosts!.financing).toBeGreaterThan(0);
    expect(withFin.maoCostBased!).toBeLessThan(without.maoCostBased!);
  });

  it("passes when costs exceed value", () => {
    const r = underwriteWholesaleDeal({ ...baseInput, rehab: { method: "manual", value: 250_000, origin: "user_assumption" } });
    expect(r.recommendedMaxOffer).toBe(0);
    expect(r.decision).toBe("pass");
  });

  it("rejects malformed input at the boundary", () => {
    expect(() => underwriteWholesaleDeal({ ...baseInput, asOf: "not-a-date" })).toThrow();
    expect(() => underwriteWholesaleDeal({ ...baseInput, assumptions: { arvFactor: 70 } })).toThrow();
  });

  it("downgrades pursue when comp confidence is insufficient", () => {
    const r = underwriteWholesaleDeal({ ...baseInput, arv: { method: "comps", comps: baseInput.arv.method === "comps" ? baseInput.arv.comps.slice(0, 2) : [] } });
    expect(r.decision).toBe("negotiate");
    expect(r.decisionReasons.join(" ")).toMatch(/confidence/);
  });
});
