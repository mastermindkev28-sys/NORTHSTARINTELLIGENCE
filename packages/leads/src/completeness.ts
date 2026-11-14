import type { ParsedLeadInput } from "./schema.js";

export type QualificationField = "property_address" | "phone" | "timeline" | "condition" | "occupancy" | "asking_price" | "motivation" | "seller_name";

export interface CompletenessResult {
  /** 0..1 share of qualification fields known. */
  completeness: number;
  missing: QualificationField[];
  /** Suggested next questions, ordered by qualification value. Neutral, non-leading wording. */
  nextQuestions: string[];
  readyForUnderwriting: boolean;
}

const QUESTIONS: Record<QualificationField, string> = {
  property_address: "What is the address of the property you're considering selling?",
  phone: "What's the best number to reach you?",
  seller_name: "Who should I say I'm speaking with?",
  motivation: "What has you thinking about selling the property?",
  timeline: "If the numbers work, when would you ideally like to close?",
  condition: "How would you describe the property's condition — any repairs it needs?",
  occupancy: "Is the property currently lived in by you, rented to tenants, or vacant?",
  asking_price: "Do you have a price in mind that would work for you?",
};

const ORDER: QualificationField[] = ["property_address", "phone", "seller_name", "motivation", "timeline", "condition", "occupancy", "asking_price"];

export function assessCompleteness(lead: ParsedLeadInput, opts: { hasValidPhone: boolean }): CompletenessResult {
  const known: Record<QualificationField, boolean> = {
    property_address: !!lead.propertyAddress,
    phone: opts.hasValidPhone,
    seller_name: !!(lead.firstName || lead.lastName),
    motivation: !!lead.notes && lead.notes.trim().length >= 10,
    timeline: !!lead.timeline && lead.timeline !== "unknown",
    condition: !!lead.condition && lead.condition !== "unknown",
    occupancy: !!lead.occupancy && lead.occupancy !== "unknown",
    asking_price: lead.askingPrice !== undefined,
  };
  const missing = ORDER.filter((f) => !known[f]);
  return {
    completeness: (ORDER.length - missing.length) / ORDER.length,
    missing,
    nextQuestions: missing.map((f) => QUESTIONS[f]),
    readyForUnderwriting: known.property_address && known.condition,
  };
}
