import type { ParsedLeadInput } from "./schema.js";

/**
 * Explainable lead scoring.
 *
 * FAIR HOUSING GUARDRAIL: Scoring uses ONLY property, transaction, and engagement signals listed in
 * `ALLOWED_SCORING_SIGNALS`. It never uses names, demographics, neighborhood composition, language,
 * or any protected characteristic or proxy. Adding a signal requires compliance review (see SECURITY_AND_COMPLIANCE.md).
 */
export const ALLOWED_SCORING_SIGNALS = [
  "motivation_keywords", "distress_tags", "timeline", "condition", "occupancy", "price_to_value", "contactability", "engagement", "source",
] as const;
export type ScoringSignal = (typeof ALLOWED_SCORING_SIGNALS)[number];

export interface ScoreFactor {
  signal: ScoringSignal;
  points: number;
  explanation: string;
}

export type LeadTier = "hot" | "warm" | "nurture" | "cold";

export interface LeadScore {
  score: number;
  tier: LeadTier;
  factors: ScoreFactor[];
  version: string;
}

export const SCORING_VERSION = "2026.11.1";

/** Property/transaction situations that commonly indicate seller motivation. Matched on whole words. */
const MOTIVATION_PATTERNS: { pattern: RegExp; label: string; points: number }[] = [
  { pattern: /\b(foreclos\w*|pre-?foreclosure|notice of default|auction date|behind on (my )?(mortgage|payments))\b/i, label: "foreclosure / payment distress", points: 18 },
  { pattern: /\b(probate|inherit\w*|estate sale|passed away|executor)\b/i, label: "inherited / probate property", points: 14 },
  { pattern: /\b(tax (lien|delinquen\w*|sale)|back taxes)\b/i, label: "tax delinquency", points: 14 },
  { pattern: /\b(divorc\w*|separation)\b/i, label: "divorce / separation", points: 10 },
  { pattern: /\b(relocat\w*|job transfer|moving out of state|moving away)\b/i, label: "relocation", points: 8 },
  { pattern: /\b(tired landlord|bad tenants?|evict\w*|problem tenants?)\b/i, label: "landlord fatigue", points: 10 },
  { pattern: /\b(code violation\w*|condemned|fire damage|water damage|foundation (issue|problem)s?|mold)\b/i, label: "condition distress", points: 10 },
  { pattern: /\b(need (to sell )?(fast|quick\w*|asap)|sell (fast|quick\w*|asap)|as[- ]is|cash offer)\b/i, label: "urgency / as-is sale", points: 8 },
  { pattern: /\b(vacant|empty|abandoned)\b/i, label: "vacant property", points: 6 },
];

const DISTRESS_TAGS: Record<string, number> = {
  "pre-foreclosure": 15, preforeclosure: 15, foreclosure: 15, probate: 12, "tax-delinquent": 12, "tax delinquent": 12,
  vacant: 8, absentee: 5, "high-equity": 6, "high equity": 6, "free-and-clear": 6, "code-violation": 8, divorce: 8, "tired-landlord": 8,
};

export interface ScoringContext {
  /** Estimated market value (e.g., ARV or AVM) for price-to-value. Optional. */
  estimatedValue?: number;
  /** Lead has replied to outreach. */
  hasReplied?: boolean;
  /** Seller requested a call/appointment. */
  requestedContact?: boolean;
  /** Best phone line type from normalization. */
  phoneLineType?: string;
  hasValidPhone?: boolean;
  hasValidEmail?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function scoreLead(lead: ParsedLeadInput, ctx: ScoringContext = {}): LeadScore {
  const factors: ScoreFactor[] = [];
  const add = (signal: ScoringSignal, points: number, explanation: string) => {
    if (points !== 0) factors.push({ signal, points, explanation });
  };

  // Motivation keywords in free text (capped so verbose notes cannot dominate).
  if (lead.notes) {
    let kw = 0;
    const labels: string[] = [];
    for (const m of MOTIVATION_PATTERNS) {
      if (m.pattern.test(lead.notes)) {
        kw += m.points;
        labels.push(m.label);
      }
    }
    add("motivation_keywords", Math.min(kw, 30), labels.length ? `Seller notes indicate: ${labels.join(", ")}` : "");
  }

  let tagPoints = 0;
  const tagHits: string[] = [];
  for (const t of lead.tags) {
    const p = DISTRESS_TAGS[t.toLowerCase().trim()];
    if (p) {
      tagPoints += p;
      tagHits.push(t);
    }
  }
  add("distress_tags", Math.min(tagPoints, 20), tagHits.length ? `List tags: ${tagHits.join(", ")}` : "");

  const timelinePoints: Record<string, number> = { asap: 20, within_30_days: 16, within_90_days: 10, within_6_months: 4, flexible: 0, unknown: 0 };
  if (lead.timeline) add("timeline", timelinePoints[lead.timeline] ?? 0, `Timeline: ${lead.timeline.replace(/_/g, " ")}`);

  const conditionPoints: Record<string, number> = { teardown: 10, major_repairs: 10, moderate_repairs: 7, light_repairs: 3, turnkey: -3, unknown: 0 };
  if (lead.condition) add("condition", conditionPoints[lead.condition] ?? 0, `Condition: ${lead.condition.replace(/_/g, " ")}`);

  if (lead.occupancy === "vacant") add("occupancy", 6, "Property is vacant");
  else if (lead.occupancy === "tenant_occupied") add("occupancy", 2, "Tenant-occupied (possible landlord motivation)");

  if (lead.askingPrice !== undefined && ctx.estimatedValue && ctx.estimatedValue > 0) {
    const ratio = lead.askingPrice / ctx.estimatedValue;
    const pts = ratio <= 0.65 ? 15 : ratio <= 0.75 ? 10 : ratio <= 0.85 ? 5 : ratio <= 1 ? 0 : -8;
    add("price_to_value", pts, `Asking price is ${(ratio * 100).toFixed(0)}% of estimated value`);
  }

  if (ctx.hasValidPhone) add("contactability", ctx.phoneLineType === "mobile" ? 6 : 4, `Valid ${ctx.phoneLineType === "mobile" ? "mobile " : ""}phone`);
  else add("contactability", -10, "No valid phone number");
  if (ctx.hasValidEmail) add("contactability", 2, "Valid email");

  if (ctx.requestedContact) add("engagement", 15, "Seller requested contact");
  else if (ctx.hasReplied) add("engagement", 10, "Seller replied to outreach");

  const inbound = ["web_form", "ppc", "seo", "referral"];
  if (inbound.includes(lead.source)) add("source", 8, "Inbound seller-initiated lead");

  const raw = factors.reduce((s, f) => s + f.points, 0);
  // Base of 20 so a contactable lead with no other information lands in "nurture", not "cold".
  const score = clamp(Math.round(20 + raw), 0, 100);
  const tier: LeadTier = score >= 70 ? "hot" : score >= 50 ? "warm" : score >= 30 ? "nurture" : "cold";
  return { score, tier, factors, version: SCORING_VERSION };
}
