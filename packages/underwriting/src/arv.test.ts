import { describe, expect, it } from "vitest";
import { estimateArv, type ComparableSale } from "./arv.js";

const asOf = "2026-11-01";
const comp = (id: string, salePrice: number, sqft: number, saleDate: string, distanceMiles = 0.3, adjustments?: ComparableSale["adjustments"]): ComparableSale => ({
  id, salePrice, livingAreaSqft: sqft, saleDate, distanceMiles, adjustments,
});

describe("estimateArv", () => {
  it("computes equal-weighted price per sqft exactly", () => {
    const comps = [comp("a", 300_000, 1500, "2026-09-01"), comp("b", 320_000, 1600, "2026-08-15"), comp("c", 290_000, 1450, "2026-10-01")];
    // each comp is exactly $200/sqft
    const r = estimateArv({ livingAreaSqft: 1500 }, comps, { asOf, weighting: "equal" });
    expect(r.weightedPricePerSqft).toBeCloseTo(200, 9);
    expect(r.arv).toBe(300_000);
    expect(r.dispersion).toBeCloseTo(0, 9);
    expect(r.included).toHaveLength(3);
    expect(r.grade).not.toBe("insufficient");
  });

  it("applies explicit adjustments", () => {
    const comps = [
      comp("a", 280_000, 1400, "2026-09-01", 0.2, [{ label: "No garage vs subject garage", amount: 10_000 }]),
      comp("b", 290_000, 1450, "2026-09-01", 0.2),
      comp("c", 300_000, 1500, "2026-09-01", 0.2),
    ];
    const r = estimateArv({ livingAreaSqft: 1450 }, comps, { asOf, weighting: "equal" });
    const a = r.included.find((c) => c.id === "a");
    expect(a?.adjustedPrice).toBe(290_000);
    expect(a?.pricePerSqft).toBeCloseTo(290_000 / 1400, 9);
  });

  it("excludes comps by date, distance, and size with reasons", () => {
    const comps = [
      comp("old", 300_000, 1500, "2025-01-01"),
      comp("far", 300_000, 1500, "2026-10-01", 3),
      comp("big", 600_000, 3000, "2026-10-01"),
      comp("future", 300_000, 1500, "2026-12-01"),
      comp("bad", 0, 1500, "2026-10-01"),
      comp("ok", 300_000, 1500, "2026-10-01"),
    ];
    const r = estimateArv({ livingAreaSqft: 1500 }, comps, { asOf });
    expect(r.included.map((c) => c.id)).toEqual(["ok"]);
    const reasons = Object.fromEntries(r.excluded.map((e) => [e.id, e.reason]));
    expect(reasons.old).toMatch(/months ago/);
    expect(reasons.far).toMatch(/mi away/);
    expect(reasons.big).toMatch(/Living area/);
    expect(reasons.future).toMatch(/after the valuation date/);
    expect(reasons.bad).toMatch(/invalid/);
    expect(r.grade).toBe("insufficient");
    expect(r.confidence).toBeLessThanOrEqual(0.35);
    expect(r.warnings.join(" ")).toMatch(/at least 3/);
  });

  it("trims statistical outliers", () => {
    const comps = [
      comp("a", 300_000, 1500, "2026-09-01"),
      comp("b", 306_000, 1500, "2026-09-01"),
      comp("c", 294_000, 1500, "2026-09-01"),
      comp("d", 303_000, 1500, "2026-09-01"),
      comp("x", 600_000, 1500, "2026-09-01"), // $400/sqft outlier
    ];
    const r = estimateArv({ livingAreaSqft: 1500 }, comps, { asOf, weighting: "equal" });
    expect(r.excluded.find((e) => e.id === "x")?.reason).toMatch(/outlier/);
    expect(r.arv).toBe(300_800); // mean of 300k,306k,294k,303k = 300,750 → rounded to nearest $100
  });

  it("weights closer and more recent comps more heavily", () => {
    const comps = [comp("near-new", 330_000, 1500, "2026-10-15", 0.1), comp("far-old", 270_000, 1500, "2026-06-01", 0.9), comp("mid", 300_000, 1500, "2026-08-01", 0.5)];
    const equal = estimateArv({ livingAreaSqft: 1500 }, comps, { asOf, weighting: "equal", trimOutliers: false });
    const weighted = estimateArv({ livingAreaSqft: 1500 }, comps, { asOf, weighting: "recency_distance", trimOutliers: false });
    expect(weighted.arv as number).toBeGreaterThan(equal.arv as number);
    const weightSum = weighted.included.reduce((s, c) => s + c.weight, 0);
    expect(weightSum).toBeCloseTo(1, 12);
  });

  it("returns null ARV when nothing qualifies, without inventing a value", () => {
    const r = estimateArv({ livingAreaSqft: 1500 }, [], { asOf });
    expect(r.arv).toBeNull();
    expect(r.grade).toBe("insufficient");
    expect(r.confidence).toBe(0);
  });

  it("flags high dispersion", () => {
    const comps = [comp("a", 240_000, 1500, "2026-10-01"), comp("b", 360_000, 1500, "2026-10-01"), comp("c", 300_000, 1500, "2026-10-01")];
    const r = estimateArv({ livingAreaSqft: 1500 }, comps, { asOf, trimOutliers: false });
    expect(r.dispersion as number).toBeCloseTo(0.2, 6);
    expect(r.grade).not.toBe("high");
  });

  it("is deterministic", () => {
    const comps = [comp("a", 300_000, 1500, "2026-09-01"), comp("b", 320_000, 1550, "2026-08-15", 0.6), comp("c", 290_000, 1450, "2026-10-01", 0.4)];
    const r1 = estimateArv({ livingAreaSqft: 1500 }, comps, { asOf });
    const r2 = estimateArv({ livingAreaSqft: 1500 }, comps, { asOf });
    expect(r1.arv).toBe(r2.arv);
    expect(r1.confidence).toBe(r2.confidence);
  });

  it("rejects a zero-size subject", () => {
    expect(() => estimateArv({ livingAreaSqft: 0 }, [], { asOf })).toThrow();
  });
});
