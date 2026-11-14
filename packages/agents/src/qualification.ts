import { z } from "zod";
import { classifyInbound } from "@northstar/compliance";
import type { StructuredModel } from "./llm";

const Evidence = z.string().describe("Verbatim quote from the transcript supporting this value, or empty string if none.");
const conf = z.number().min(0).max(1);

/** Schema the model must return. Every extracted value carries verbatim evidence and a confidence score. */
export const QualificationExtraction = z.object({
  motivation: z.object({ summary: z.string(), level: z.enum(["high", "medium", "low", "unknown"]), evidence: Evidence, confidence: conf }),
  timeline: z.object({ value: z.enum(["asap", "within_30_days", "within_90_days", "within_6_months", "flexible", "unknown"]), evidence: Evidence, confidence: conf }),
  condition: z.object({ value: z.enum(["turnkey", "light_repairs", "moderate_repairs", "major_repairs", "teardown", "unknown"]), repairsMentioned: z.array(z.string()), evidence: Evidence, confidence: conf }),
  occupancy: z.object({ value: z.enum(["owner_occupied", "tenant_occupied", "vacant", "unknown"]), evidence: Evidence, confidence: conf }),
  askingPrice: z.object({ value: z.number().nullable(), evidence: Evidence, confidence: conf }),
  decisionMakers: z.object({ value: z.string(), evidence: Evidence, confidence: conf }),
  appointment: z.object({ requested: z.boolean(), preferredTimes: z.array(z.string()) }),
  sellerQuestions: z.array(z.string()),
  sentiment: z.enum(["positive", "neutral", "negative", "hostile"]),
  needsHuman: z.boolean(),
  needsHumanReason: z.string(),
});
export type QualificationExtraction = z.infer<typeof QualificationExtraction>;

export const QUALIFICATION_SYSTEM_PROMPT = `You extract structured seller-qualification facts from a conversation between a real estate acquisitions team and a property owner.

Rules:
- Extract only what the seller actually said. If something was not stated, use "unknown", null, or an empty list.
- For every value, copy the exact supporting words from the transcript into "evidence". If you cannot quote it, the value must be unknown/null.
- Never infer anything about the seller's race, religion, national origin, sex, familial status, disability, age, or any other protected characteristic, and never record such details even if mentioned.
- Set needsHuman to true when the seller: asks to negotiate a price or requests an offer, mentions an attorney, lawsuit, bankruptcy, or foreclosure sale date within 30 days, is hostile or distressed, asks a legal or tax question, or says anything you are unsure how to handle. Explain why in needsHumanReason.
- Confidence reflects how explicitly the seller stated the value (1 = stated directly and unambiguously).`;

export interface QualificationResult {
  extraction: QualificationExtraction;
  /** Fields nulled because their evidence was not found verbatim in the transcript (hallucination guard). */
  rejectedFields: string[];
  optOut: boolean;
  simulated: boolean;
  usage: { inputTokens: number; outputTokens: number };
}

const normalizeWs = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Acquisitions agent — qualification extraction. Deterministic safety layers wrap the model:
 *  1. Opt-out detection runs FIRST, without the model; the model is never called on a revocation.
 *  2. Every extracted value must be backed by a verbatim quote from the seller's own messages, else it is discarded.
 */
export async function extractQualification(model: StructuredModel, transcript: { role: "seller" | "team"; text: string }[]): Promise<QualificationResult | { optOut: true }> {
  const lastSeller = [...transcript].reverse().find((m) => m.role === "seller");
  if (lastSeller && classifyInbound(lastSeller.text).intent === "opt_out") return { optOut: true };

  const rendered = transcript.map((m) => `${m.role === "seller" ? "SELLER" : "TEAM"}: ${m.text}`).join("\n");
  const res = await model.generate({ system: QUALIFICATION_SYSTEM_PROMPT, input: `<transcript>\n${rendered}\n</transcript>`, schema: QualificationExtraction, effort: "medium" });
  const sellerText = normalizeWs(transcript.filter((m) => m.role === "seller").map((m) => m.text).join(" \n "));
  const e = structuredClone(res.object);
  const rejected: string[] = [];
  const supported = (evidence: string) => evidence.trim().length > 0 && sellerText.includes(normalizeWs(evidence));

  if (e.motivation.level !== "unknown" && !supported(e.motivation.evidence)) { rejected.push("motivation"); e.motivation = { summary: "", level: "unknown", evidence: "", confidence: 0 }; }
  if (e.timeline.value !== "unknown" && !supported(e.timeline.evidence)) { rejected.push("timeline"); e.timeline = { value: "unknown", evidence: "", confidence: 0 }; }
  if (e.condition.value !== "unknown" && !supported(e.condition.evidence)) { rejected.push("condition"); e.condition = { value: "unknown", repairsMentioned: [], evidence: "", confidence: 0 }; }
  if (e.occupancy.value !== "unknown" && !supported(e.occupancy.evidence)) { rejected.push("occupancy"); e.occupancy = { value: "unknown", evidence: "", confidence: 0 }; }
  if (e.askingPrice.value !== null) {
    // The number itself must appear in the seller's words (e.g. "150k", "150,000", "$150000").
    const digits = sellerText.replace(/[,$]/g, "");
    const v = e.askingPrice.value;
    const forms = [String(v), `${v / 1000}k`, `${v / 1000} thousand`];
    if (!supported(e.askingPrice.evidence) || !forms.some((f) => digits.includes(f))) { rejected.push("askingPrice"); e.askingPrice = { value: null, evidence: "", confidence: 0 }; }
  }
  if (e.decisionMakers.value && !supported(e.decisionMakers.evidence)) { rejected.push("decisionMakers"); e.decisionMakers = { value: "", evidence: "", confidence: 0 }; }
  if (rejected.length >= 3) { e.needsHuman = true; e.needsHumanReason = `${e.needsHumanReason} Multiple extracted values lacked transcript evidence.`.trim(); }

  return { extraction: e, rejectedFields: rejected, optOut: false, simulated: res.simulated, usage: res.usage };
}
