import { z } from "zod";

/**
 * Every value that reaches an investment decision carries its origin.
 * The UI and reports MUST render these distinctly — an AI interpretation is never shown as a verified fact.
 */
export const ValueOrigin = z.enum([
  /** Confirmed against an authoritative source (e.g., recorded deed, signed contract, inspection). */
  "verified",
  /** Entered or chosen by a user as an assumption (e.g., rehab budget, target margin). */
  "user_assumption",
  /** Supplied by a third-party data provider (AVM, rent estimate, public-record attribute). */
  "third_party_estimate",
  /** Inferred by an AI model from unstructured input (conversation, document). Requires review. */
  "ai_generated",
  /** Deterministically computed by a Northstar function from other values. */
  "calculated",
]);
export type ValueOrigin = z.infer<typeof ValueOrigin>;

export const SourceRef = z.object({
  /** Provider or system identifier, e.g. "attom", "user:7f1c…", "agent:acquisitions". */
  system: z.string().min(1),
  /** Provider-specific record identifier, if any. */
  recordId: z.string().optional(),
  /** ISO-8601 timestamp of retrieval or entry. */
  retrievedAt: z.string().datetime({ offset: true }),
  /** Optional URL or document reference for audit. */
  reference: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

export const sourcedSchema = <T extends z.ZodType>(value: T) =>
  z.object({
    value,
    origin: ValueOrigin,
    source: SourceRef.optional(),
    /** 0..1 confidence. Required for third_party_estimate and ai_generated values. */
    confidence: z.number().min(0).max(1).optional(),
    note: z.string().optional(),
  });

export interface Sourced<T> {
  value: T;
  origin: ValueOrigin;
  source?: SourceRef;
  confidence?: number;
  note?: string;
}

export function sourced<T>(
  value: T,
  origin: ValueOrigin,
  extra: Omit<Sourced<T>, "value" | "origin"> = {},
): Sourced<T> {
  if ((origin === "third_party_estimate" || origin === "ai_generated") && extra.confidence === undefined) {
    throw new Error(`Values with origin "${origin}" must declare a confidence score.`);
  }
  if (extra.confidence !== undefined && (extra.confidence < 0 || extra.confidence > 1)) {
    throw new Error("confidence must be within [0, 1]");
  }
  return { value, origin, ...extra };
}

/** Human-readable labels used consistently by reports and the UI. */
export const ORIGIN_LABEL: Record<ValueOrigin, string> = {
  verified: "Verified",
  user_assumption: "User assumption",
  third_party_estimate: "Third-party estimate",
  ai_generated: "AI interpretation — review required",
  calculated: "Calculated",
};
