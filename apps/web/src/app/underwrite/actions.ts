"use server";
import { analyzeRental, underwriteWholesaleDeal, type RentalResult, type WholesaleDealResult } from "@northstar/underwriting";

export interface AnalyzerState {
  wholesale?: WholesaleDealResult;
  rental?: Omit<RentalResult, "trace"> & { trace: RentalResult["trace"]["steps"] };
  error?: string;
}

const num = (f: FormData, k: string, fallback?: number): number => {
  const raw = f.get(k);
  if (raw === null || String(raw).trim() === "") {
    if (fallback === undefined) throw new Error(`${k} is required`);
    return fallback;
  }
  const v = Number(String(raw).replace(/[,$\s]/g, ""));
  if (!Number.isFinite(v)) throw new Error(`${k} must be a number`);
  return v;
};
const rate = (f: FormData, k: string, fallback: number) => num(f, k, fallback * 100) / 100;

export async function analyze(_prev: AnalyzerState, f: FormData): Promise<AnalyzerState> {
  try {
    const wholesale = underwriteWholesaleDeal({
      asOf: new Date().toISOString().slice(0, 10),
      subject: { livingAreaSqft: num(f, "sqft") },
      arv: { method: "manual", value: num(f, "arv"), origin: "user_assumption" },
      rehab: { method: "manual", value: num(f, "rehab"), origin: "user_assumption" },
      askingPrice: f.get("asking") ? num(f, "asking") : undefined,
      assumptions: {
        arvFactor: rate(f, "arvFactor", 0.7), targetAssignmentFee: num(f, "fee", 10000), holdMonths: num(f, "hold", 6),
        endBuyerProfitRate: rate(f, "profit", 0.15), annualPropertyTax: num(f, "tax", 0), annualInsurance: num(f, "insurance", 0),
        endBuyerFinancing: f.get("financed") ? { maxLtc: 0.9, maxLtv: 0.7, annualRate: rate(f, "hmRate", 0.12) } : undefined,
      },
    });
    const purchase = num(f, "rentalPrice", wholesale.recommendedMaxOffer ?? 0);
    const r = purchase > 0 && f.get("rent") ? analyzeRental({
      purchasePrice: purchase, rehabCost: num(f, "rehab"), closingCosts: purchase * 0.02, monthlyRent: num(f, "rent"), vacancyRate: rate(f, "vacancy", 0.06),
      annualPropertyTax: num(f, "tax", 0), annualInsurance: num(f, "insurance", 0), managementRate: 0.08, maintenanceRate: 0.06, capexRate: 0.05,
      financing: { downPaymentRate: rate(f, "down", 0.25), annualRate: rate(f, "rate", 0.075), termMonths: 360 },
    }) : undefined;
    return { wholesale, rental: r ? { ...r, trace: r.trace.steps } : undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Analysis failed" };
  }
}
