import { describe, expect, it } from "vitest";
import { analyzeRental, type RentalInputs } from "./rental";
import { projectHold } from "./projection";
import { sensitivity1D, sensitivity2D, tornado, withValue } from "./sensitivity";

const base: RentalInputs = {
  purchasePrice: 200_000,
  closingCosts: 4000,
  rehabCost: 10_000,
  monthlyRent: 2000,
  vacancyRate: 0.05,
  annualPropertyTax: 3000,
  annualInsurance: 1200,
  managementRate: 0.08,
  maintenanceRate: 0.05,
  capexRate: 0.05,
  financing: { downPaymentRate: 0.25, annualRate: 0.07, termMonths: 360 },
};

describe("analyzeRental", () => {
  // Reference values from an independent Python implementation.
  it("matches reference figures", () => {
    const r = analyzeRental(base);
    expect(r.grossScheduledIncome).toBe(24_000);
    expect(r.effectiveGrossIncome).toBeCloseTo(22_800, 8);
    expect(r.operatingExpenses.total).toBeCloseTo(8364, 8);
    expect(r.netOperatingIncome).toBeCloseTo(14_436, 8);
    expect(r.loanAmount).toBe(150_000);
    expect(r.annualDebtService).toBeCloseTo(11_975.4449132, 5);
    expect(r.annualCashFlow).toBeCloseTo(2460.5550868, 5);
    expect(r.totalCashInvested).toBe(64_000);
    expect(r.cashOnCash as number).toBeCloseTo(0.0384461732, 8);
    expect(r.dscr as number).toBeCloseTo(1.2054666949, 8);
    expect(r.capRate).toBeCloseTo(0.07218, 10);
    expect(r.grossRentMultiplier).toBeCloseTo(200_000 / 24_000, 10);
    expect(r.rentToCostRatio).toBeCloseTo(2000 / 210_000, 10);
  });

  it("unlevered: DSCR null, cash-on-cash equals NOI over cash", () => {
    const r = analyzeRental({ ...base, financing: undefined });
    expect(r.dscr).toBeNull();
    expect(r.annualDebtService).toBe(0);
    expect(r.cashOnCash as number).toBeCloseTo(14_436 / 214_000, 10);
  });

  it("warns on weak coverage and missing reserves", () => {
    const r = analyzeRental({ ...base, monthlyRent: 1500, managementRate: 0, capexRate: 0 });
    expect(r.dscr as number).toBeLessThan(1.2);
    expect(r.warnings.some((w) => /DSCR/.test(w))).toBe(true);
    expect(r.warnings.some((w) => /management/.test(w))).toBe(true);
    expect(r.warnings.some((w) => /capital expenditure/.test(w))).toBe(true);
  });

  it("interest-only financing", () => {
    const r = analyzeRental({
      ...base,
      financing: { loanAmount: 150_000, annualRate: 0.08, termMonths: 360, interestOnly: true },
    });
    expect(r.annualDebtService).toBeCloseTo(12_000, 8);
  });

  it("validates inputs", () => {
    expect(() => analyzeRental({ ...base, vacancyRate: 5 })).toThrow();
    expect(() => analyzeRental({ ...base, purchasePrice: 0 })).toThrow();
    expect(() =>
      analyzeRental({ ...base, financing: { annualRate: 0.07, termMonths: 360 } }),
    ).toThrow(/loanAmount or downPaymentRate/);
  });
});

describe("projectHold", () => {
  it("year 1 equals the stabilized analysis and IRR reconciles with cash flows", () => {
    const p = projectHold({
      rental: base,
      years: 5,
      annualRentGrowth: 0.03,
      annualExpenseGrowth: 0.03,
      annualAppreciation: 0.03,
      saleCostRate: 0.06,
    });
    const y1 = analyzeRental(base);
    expect(p.years[0]?.netOperatingIncome).toBeCloseTo(y1.netOperatingIncome, 8);
    expect(p.years[0]?.cashFlow).toBeCloseTo(y1.annualCashFlow, 8);
    expect(p.cashFlows[0]).toBe(-64_000);
    expect(p.years).toHaveLength(5);
    expect(p.years[4]?.propertyValue).toBeCloseTo(210_000 * 1.03 ** 5, 6);
    expect(p.irr).not.toBeNull();
    // NPV at the IRR should be ~0.
    const npvAtIrr = p.cashFlows.reduce((s, cf, t) => s + cf / (1 + (p.irr as number)) ** t, 0);
    expect(npvAtIrr).toBeCloseTo(0, 4);
    expect(p.totalProfit).toBeCloseTo(p.totalCashFlow + p.saleProceeds - 64_000, 6);
  });
  it("rejects invalid horizons", () => {
    expect(() =>
      projectHold({
        rental: base,
        years: 0,
        annualRentGrowth: 0,
        annualExpenseGrowth: 0,
        annualAppreciation: 0,
        saleCostRate: 0,
      }),
    ).toThrow();
  });
});

describe("sensitivity", () => {
  const coc = (i: RentalInputs) => analyzeRental(i).cashOnCash;
  it("withValue does not mutate the base", () => {
    const changed = withValue(base, "financing.annualRate", 0.09);
    expect(changed.financing?.annualRate).toBe(0.09);
    expect(base.financing?.annualRate).toBe(0.07);
    expect(() => withValue(base, "nope.deep", 1)).toThrow();
  });
  it("1D: higher rent increases cash-on-cash monotonically", () => {
    const pts = sensitivity1D(base, "monthlyRent", [1800, 2000, 2200], coc);
    expect(pts[0]!.output!).toBeLessThan(pts[1]!.output!);
    expect(pts[1]!.output!).toBeLessThan(pts[2]!.output!);
    expect(pts[1]!.output!).toBeCloseTo(analyzeRental(base).cashOnCash as number, 12);
  });
  it("2D grid shape", () => {
    const g = sensitivity2D(
      base,
      "monthlyRent",
      [1900, 2100],
      "financing.annualRate",
      [0.06, 0.07, 0.08],
      coc,
    );
    expect(g.outputs).toHaveLength(2);
    expect(g.outputs[0]).toHaveLength(3);
  });
  it("tornado sorts by swing", () => {
    const bars = tornado(
      base,
      [
        { path: "annualInsurance", label: "Insurance", low: 1000, high: 1400 },
        { path: "monthlyRent", label: "Rent", low: 1800, high: 2200 },
      ],
      coc,
    );
    expect(bars[0]?.label).toBe("Rent");
    expect(bars[0]!.swing).toBeGreaterThan(bars[1]!.swing);
  });
});
