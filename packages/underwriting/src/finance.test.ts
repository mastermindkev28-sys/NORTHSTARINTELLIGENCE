import { describe, expect, it } from "vitest";
import { amortizationSchedule, annualizeReturn, interestPaidOver, irr, monthlyPayment, npv, remainingBalance } from "./finance.js";
import { CalculationInputError } from "./trace.js";

// Reference values computed independently (Python closed-form) — see docs/UNDERWRITING_METHODOLOGY.md §Verification.
describe("monthlyPayment", () => {
  it("matches standard amortization references", () => {
    expect(monthlyPayment(200_000, 0.06, 360)).toBeCloseTo(1199.1010503, 6);
    expect(monthlyPayment(300_000, 0.07, 360)).toBeCloseTo(1995.9074855, 6);
  });
  it("handles zero interest and zero principal", () => {
    expect(monthlyPayment(100_000, 0, 120)).toBeCloseTo(833.3333333, 6);
    expect(monthlyPayment(0, 0.08, 360)).toBe(0);
  });
  it("rejects invalid inputs", () => {
    expect(() => monthlyPayment(-1, 0.06, 360)).toThrow(CalculationInputError);
    expect(() => monthlyPayment(100, 6, 360)).toThrow(/decimal rate/); // 6 instead of 0.06
    expect(() => monthlyPayment(100, 0.06, 0)).toThrow(/positive integer/);
    expect(() => monthlyPayment(100, 0.06, 12.5)).toThrow(/positive integer/);
    expect(() => monthlyPayment(Number.NaN, 0.06, 12)).toThrow(/finite/);
  });
});

describe("remainingBalance and schedule", () => {
  it("matches the closed-form balance", () => {
    expect(remainingBalance(200_000, 0.06, 360, 60)).toBeCloseTo(186_108.7136456, 4);
    expect(remainingBalance(200_000, 0.06, 360, 0)).toBe(200_000);
    expect(remainingBalance(200_000, 0.06, 360, 360)).toBe(0);
    expect(remainingBalance(120_000, 0, 120, 60)).toBeCloseTo(60_000, 6);
  });
  it("schedule fully amortizes and agrees with the closed form", () => {
    const s = amortizationSchedule(200_000, 0.06, 360);
    expect(s).toHaveLength(360);
    expect(s.at(-1)?.balance).toBe(0);
    expect(s[59]?.balance).toBeCloseTo(186_108.7136456, 4);
    const totalInterest = s.reduce((a, r) => a + r.interest, 0);
    expect(totalInterest).toBeCloseTo(231_676.378, 2);
    const totalPrincipal = s.reduce((a, r) => a + r.principal, 0);
    expect(totalPrincipal).toBeCloseTo(200_000, 6);
  });
  it("sums interest over a partial period", () => {
    expect(interestPaidOver(200_000, 0.06, 12, { interestOnly: false, termMonths: 360 })).toBeCloseTo(11_933.1891791, 4);
    expect(interestPaidOver(150_000, 0.12, 6, { interestOnly: true })).toBeCloseTo(9_000, 8);
    expect(() => interestPaidOver(1, 0.1, 1, { interestOnly: false })).toThrow(/termMonths/);
  });
});

describe("npv and irr", () => {
  it("computes NPV", () => {
    expect(npv(0.1, [-1000, 300, 400, 500])).toBeCloseTo(-21.0368144, 6);
  });
  it("solves IRR", () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 9);
    expect(irr([-1000, 300, 400, 500])).toBeCloseTo(0.0889633947, 8);
    const r = irr([-50_000, 4_000, 4_200, 4_400, 4_600, 70_000]) as number;
    expect(npv(r, [-50_000, 4_000, 4_200, 4_400, 4_600, 70_000])).toBeCloseTo(0, 5);
  });
  it("returns null when IRR is undefined", () => {
    expect(irr([100, 200])).toBeNull();
    expect(irr([-100, -200])).toBeNull();
    expect(irr([])).toBeNull();
  });
  it("handles negative IRR", () => {
    const r = irr([-1000, 200, 200, 200]) as number;
    expect(r).toBeLessThan(0);
    expect(npv(r, [-1000, 200, 200, 200])).toBeCloseTo(0, 6);
  });
  it("annualizes returns", () => {
    expect(annualizeReturn(0.1, 12)).toBeCloseTo(0.1, 12);
    expect(annualizeReturn(0.1, 6)).toBeCloseTo(0.21, 12);
    expect(annualizeReturn(0.1, 0)).toBeNull();
  });
});
