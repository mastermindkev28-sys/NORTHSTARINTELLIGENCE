import { z } from "zod";
import { ValueOrigin, type ValueOrigin as ValueOriginT } from "@northstar/core";
import { estimateArv, type ArvResult } from "./arv.js";
import { dispositionCosts, holdingCosts, shortTermFinancingCosts, sizeShortTermLoan } from "./costs.js";
import { maoCostBased, maoRuleOfThumb } from "./flip.js";
import { estimateRehab, type RehabEstimate } from "./rehab.js";
import { METHODOLOGY_VERSION, Trace, type TraceStep } from "./trace.js";

const rate = (max = 1) => z.number().min(0).max(max);
const usd = z.number().min(0).finite();

const CompSchema = z.object({
  id: z.string().min(1),
  address: z.string().optional(),
  salePrice: z.number().positive(),
  saleDate: z.string().date(),
  livingAreaSqft: z.number().positive(),
  distanceMiles: z.number().min(0).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  yearBuilt: z.number().int().optional(),
  adjustments: z.array(z.object({ label: z.string(), amount: z.number() })).optional(),
  source: z.object({ system: z.string(), recordId: z.string().optional(), retrievedAt: z.string(), reference: z.string().optional() }).optional(),
});

export const WholesaleDealInputSchema = z.object({
  asOf: z.string().date(),
  subject: z.object({
    address: z.string().optional(),
    livingAreaSqft: z.number().positive(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().min(0).optional(),
  }),
  arv: z.discriminatedUnion("method", [
    z.object({
      method: z.literal("comps"),
      comps: z.array(CompSchema),
      maxDistanceMiles: z.number().positive().optional(),
      maxAgeMonths: z.number().positive().optional(),
      sqftTolerance: rate(1).optional(),
    }),
    z.object({ method: z.literal("manual"), value: usd, origin: ValueOrigin, note: z.string().optional() }),
  ]),
  rehab: z.union([
    z.object({ method: z.literal("manual"), value: usd, origin: ValueOrigin }),
    z.object({
      method: z.literal("estimate"),
      scope: z.enum(["cosmetic", "moderate", "full", "gut"]).optional(),
      costPerSqft: z.number().positive().optional(),
      lineItems: z.array(z.object({ category: z.string(), quantity: z.number().min(0), unitCost: z.number().min(0) })).optional(),
      contingencyRate: rate(0.5).optional(),
    }),
  ]),
  askingPrice: usd.optional(),
  assumptions: z.object({
    arvFactor: rate().default(0.7),
    targetAssignmentFee: usd.default(10000),
    holdMonths: z.number().positive().max(36).default(6),
    endBuyerProfitRate: rate(0.5).default(0.15),
    endBuyerClosingRate: rate(0.2).default(0.02),
    annualPropertyTax: usd.default(0),
    annualInsurance: usd.default(0),
    monthlyUtilities: usd.default(0),
    commissionRate: rate(0.15).default(0.05),
    sellerClosingRate: rate(0.15).default(0.015),
    endBuyerFinancing: z
      .object({ maxLtc: rate(), maxLtv: rate(), annualRate: rate(), points: rate(0.1).default(0.02), lenderFees: usd.default(0) })
      .optional(),
  }),
});
export type WholesaleDealInput = z.input<typeof WholesaleDealInputSchema>;

export interface AssumptionRecord {
  key: string;
  label: string;
  value: number | string | null;
  origin: ValueOriginT;
  note?: string;
}

export interface WholesaleDealResult {
  methodologyVersion: string;
  arv: { value: number | null; origin: ValueOriginT; comps?: ArvResult };
  rehab: { value: number; origin: ValueOriginT; estimate?: RehabEstimate };
  maoRuleOfThumb: number | null;
  maoCostBased: number | null;
  /** Conservative: the lower of the two MAO methods, floored at 0. Null when ARV is unavailable. */
  recommendedMaxOffer: number | null;
  /** recommendedMaxOffer − askingPrice. Positive = room under MAO. */
  spreadToAsking: number | null;
  endBuyerCosts: { holding: number; financing: number; disposition: number } | null;
  decision: "pursue" | "negotiate" | "pass" | "insufficient_data";
  decisionReasons: string[];
  assumptions: AssumptionRecord[];
  warnings: string[];
  limitations: string[];
  trace: TraceStep[];
}

const LIMITATIONS = [
  "This analysis is an estimate for screening and negotiation planning. It is not an appraisal, broker price opinion, or guarantee of value or profit.",
  "Comparable-sales data may be incomplete or delayed depending on provider coverage and licensing; verify against current local market activity.",
  "Rehab costs must be confirmed by an on-site walkthrough and contractor bids.",
  "Any offer or contract requires human review and authorization before it is sent.",
];

/** Deterministic wholesale deal underwriting. Same input → same output, always. */
export function underwriteWholesaleDeal(rawInput: WholesaleDealInput): WholesaleDealResult {
  const input = WholesaleDealInputSchema.parse(rawInput);
  const a = input.assumptions;
  const trace = new Trace();
  const warnings: string[] = [];
  const assumptions: AssumptionRecord[] = [];
  const reasons: string[] = [];

  // --- ARV ---
  let arvValue: number | null;
  let arvOrigin: ValueOriginT;
  let arvComps: ArvResult | undefined;
  if (input.arv.method === "comps") {
    arvComps = estimateArv(input.subject, input.arv.comps, {
      asOf: input.asOf, maxDistanceMiles: input.arv.maxDistanceMiles, maxAgeMonths: input.arv.maxAgeMonths, sqftTolerance: input.arv.sqftTolerance,
    });
    trace.merge(arvComps.trace);
    warnings.push(...arvComps.warnings);
    arvValue = arvComps.arv;
    arvOrigin = "calculated";
    assumptions.push({ key: "arv", label: "After-repair value", value: arvValue, origin: "calculated", note: `${arvComps.included.length} comps, confidence ${arvComps.grade} (${arvComps.confidence})` });
  } else {
    arvValue = input.arv.value;
    arvOrigin = input.arv.origin;
    assumptions.push({ key: "arv", label: "After-repair value", value: arvValue, origin: arvOrigin, note: input.arv.note });
    if (arvOrigin === "ai_generated") warnings.push("ARV was supplied by an AI interpretation and must be verified with comparable sales.");
  }

  // --- Rehab ---
  let rehabValue: number;
  let rehabOrigin: ValueOriginT;
  let rehabEstimate: RehabEstimate | undefined;
  if (input.rehab.method === "manual") {
    rehabValue = input.rehab.value;
    rehabOrigin = input.rehab.origin;
  } else {
    rehabEstimate = estimateRehab({
      livingAreaSqft: input.subject.livingAreaSqft,
      scope: input.rehab.scope,
      costPerSqftByScope: input.rehab.scope && input.rehab.costPerSqft ? { [input.rehab.scope]: input.rehab.costPerSqft } : undefined,
      lineItems: input.rehab.lineItems,
      contingencyRate: input.rehab.contingencyRate,
    }, trace);
    rehabValue = rehabEstimate.total;
    rehabOrigin = "calculated";
    if (rehabEstimate.isPlaceholderRate) warnings.push("Rehab estimate uses Northstar default $/sqft placeholders. Calibrate rates to your market and contractors.");
  }
  assumptions.push({ key: "rehab", label: "Rehab cost", value: rehabValue, origin: rehabOrigin });

  for (const [key, label, value] of [
    ["arvFactor", "End-buyer ARV factor", a.arvFactor],
    ["targetAssignmentFee", "Target assignment fee", a.targetAssignmentFee],
    ["holdMonths", "End-buyer hold period (months)", a.holdMonths],
    ["endBuyerProfitRate", "End-buyer target profit (% of ARV)", a.endBuyerProfitRate],
    ["endBuyerClosingRate", "End-buyer closing costs (% of price)", a.endBuyerClosingRate],
    ["commissionRate", "Resale commission rate", a.commissionRate],
    ["sellerClosingRate", "Resale seller closing rate", a.sellerClosingRate],
  ] as const) {
    assumptions.push({ key, label, value, origin: "user_assumption" });
  }
  if (input.askingPrice !== undefined) assumptions.push({ key: "askingPrice", label: "Seller asking price", value: input.askingPrice, origin: "user_assumption", note: "As stated by seller; confirm in writing." });

  if (arvValue === null) {
    return {
      methodologyVersion: METHODOLOGY_VERSION, arv: { value: null, origin: arvOrigin, comps: arvComps }, rehab: { value: rehabValue, origin: rehabOrigin, estimate: rehabEstimate },
      maoRuleOfThumb: null, maoCostBased: null, recommendedMaxOffer: null, spreadToAsking: null, endBuyerCosts: null,
      decision: "insufficient_data", decisionReasons: ["ARV could not be determined from the available comparable sales."],
      assumptions, warnings, limitations: LIMITATIONS, trace: trace.steps,
    };
  }

  // --- MAO ---
  const rule = maoRuleOfThumb({ arv: arvValue, repairCost: rehabValue, arvFactor: a.arvFactor, assignmentFee: a.targetAssignmentFee }, trace);
  const holding = holdingCosts({ months: a.holdMonths, annualPropertyTax: a.annualPropertyTax, annualInsurance: a.annualInsurance, monthlyUtilities: a.monthlyUtilities }, trace).total;
  let financing = 0;
  if (a.endBuyerFinancing) {
    // Size the loan against the rule-based end-buyer price as a stable basis (avoids circularity with cost-based MAO).
    const basisPrice = Math.max(rule + a.targetAssignmentFee, 0);
    const loan = sizeShortTermLoan({ purchasePrice: basisPrice, rehabCost: rehabValue, arv: arvValue, maxLtc: a.endBuyerFinancing.maxLtc, maxLtv: a.endBuyerFinancing.maxLtv, financeRehab: true }, trace);
    financing = shortTermFinancingCosts({ loanAmount: loan, annualRate: a.endBuyerFinancing.annualRate, points: a.endBuyerFinancing.points, lenderFees: a.endBuyerFinancing.lenderFees, months: a.holdMonths }, trace).total;
  }
  const disposition = dispositionCosts({ salePrice: arvValue, commissionRate: a.commissionRate, sellerClosingRate: a.sellerClosingRate }, trace);
  const cost = maoCostBased({
    arv: arvValue, repairCost: rehabValue, targetProfit: { type: "arv_rate", value: a.endBuyerProfitRate },
    buyerClosingRate: a.endBuyerClosingRate, holdingCost: holding, financingCost: financing, dispositionCost: disposition, assignmentFee: a.targetAssignmentFee,
  }, trace);

  const recommended = trace.record({
    key: "recommended_max_offer", label: "Recommended maximum offer", formula: "max(0, min(MAO rule, MAO cost-based)) rounded down to $500",
    inputs: { rule, cost }, result: Math.max(0, Math.floor(Math.min(rule, cost) / 500) * 500), unit: "usd",
  });
  const spread = input.askingPrice === undefined ? null : recommended - input.askingPrice;

  let decision: WholesaleDealResult["decision"];
  if (recommended <= 0) {
    decision = "pass";
    reasons.push("Costs and required margins exceed ARV; no positive offer supports the target assignment fee.");
  } else if (spread === null) {
    decision = "negotiate";
    reasons.push("No asking price recorded; use the recommended maximum offer as the negotiation ceiling.");
  } else if (spread >= 0) {
    decision = "pursue";
    reasons.push(`Asking price is ${spread === 0 ? "at" : "below"} the recommended maximum offer.`);
  } else if (input.askingPrice !== undefined && -spread / input.askingPrice <= 0.1) {
    decision = "negotiate";
    reasons.push(`Asking price is within 10% of the recommended maximum offer (gap ${Math.round(-spread).toLocaleString("en-US")}).`);
  } else {
    decision = "pass";
    reasons.push("Asking price exceeds the recommended maximum offer by more than 10%.");
  }
  if (arvComps && (arvComps.grade === "low" || arvComps.grade === "insufficient")) {
    reasons.push(`ARV confidence is ${arvComps.grade}; validate comps before acting.`);
    if (decision === "pursue") decision = "negotiate";
  }

  return {
    methodologyVersion: METHODOLOGY_VERSION,
    arv: { value: arvValue, origin: arvOrigin, comps: arvComps },
    rehab: { value: rehabValue, origin: rehabOrigin, estimate: rehabEstimate },
    maoRuleOfThumb: rule,
    maoCostBased: cost,
    recommendedMaxOffer: recommended,
    spreadToAsking: spread,
    endBuyerCosts: { holding, financing, disposition },
    decision,
    decisionReasons: reasons,
    assumptions,
    warnings,
    limitations: LIMITATIONS,
    trace: trace.steps,
  };
}
