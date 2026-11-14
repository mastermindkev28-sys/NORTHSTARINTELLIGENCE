import { screenFairHousing, type FairHousingFinding } from "./fairHousing.js";

export interface ContentCheckInput {
  body: string;
  channel: "sms" | "voice" | "email";
  businessName: string;
  isFirstMessageInThread: boolean;
  /** Message is composed or sent by an AI agent. */
  aiGenerated: boolean;
}

export interface ContentIssue {
  code: "MISSING_SENDER_ID" | "MISSING_OPT_OUT_INSTRUCTIONS" | "MISSING_AI_DISCLOSURE" | "FAIR_HOUSING_REVIEW" | "PROHIBITED_CLAIM" | "TOO_LONG";
  message: string;
  blocking: boolean;
}

/** Claims an agent must never make to a seller without human authorization. */
const PROHIBITED_CLAIMS: { pattern: RegExp; message: string }[] = [
  { pattern: /\b(we (will|can) (pay|offer) you|our offer is|i can offer|offer you \$)/i, message: "Binding price/offer language requires human approval." },
  { pattern: /\b(guarantee[ds]?|guaranteed)\b/i, message: "Guarantee language is prohibited." },
  { pattern: /\b(we are (licensed )?(realtors?|agents?|brokers?)|as your (agent|realtor))\b/i, message: "Licensing/agency representations are prohibited unless verified." },
  { pattern: /\b(legal advice|tax advice|you should (not )?(file|declare) bankruptcy)\b/i, message: "Legal/tax advice is prohibited." },
];

export function checkOutboundContent(i: ContentCheckInput): { issues: ContentIssue[]; fairHousing: FairHousingFinding[] } {
  const issues: ContentIssue[] = [];
  const lower = i.body.toLowerCase();
  if (i.channel === "sms" && i.isFirstMessageInThread) {
    if (!lower.includes(i.businessName.toLowerCase())) {
      issues.push({ code: "MISSING_SENDER_ID", message: `First message must identify the sender (${i.businessName}).`, blocking: true });
    }
    if (!/\b(reply|text) stop\b/i.test(i.body)) {
      issues.push({ code: "MISSING_OPT_OUT_INSTRUCTIONS", message: 'First message must include opt-out instructions (e.g., "Reply STOP to opt out").', blocking: true });
    }
  }
  if (i.aiGenerated && i.isFirstMessageInThread && !/\b(automated|ai|virtual assistant|assistant)\b/i.test(i.body)) {
    issues.push({ code: "MISSING_AI_DISCLOSURE", message: "AI-composed first messages must disclose that an automated assistant is communicating.", blocking: true });
  }
  if (i.channel === "sms" && i.body.length > 640) {
    issues.push({ code: "TOO_LONG", message: "SMS exceeds 640 characters (4 segments).", blocking: false });
  }
  for (const c of PROHIBITED_CLAIMS) {
    if (c.pattern.test(i.body)) issues.push({ code: "PROHIBITED_CLAIM", message: c.message, blocking: true });
  }
  const fairHousing = screenFairHousing(i.body);
  if (fairHousing.length) {
    issues.push({ code: "FAIR_HOUSING_REVIEW", message: `Potential fair housing issue: ${fairHousing.map((f) => f.category).join(", ")}`, blocking: true });
  }
  return { issues, fairHousing };
}
