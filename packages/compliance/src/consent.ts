import { z } from "zod";

export const Channel = z.enum(["sms", "voice", "email"]);
export type Channel = z.infer<typeof Channel>;

/**
 * - express_written: signed (incl. e-sign) agreement that clearly authorizes marketing messages via automated
 *   technology / artificial voice to a specific number (47 CFR 64.1200(f)(9)). Required for automated marketing.
 * - express: number provided by the consumer for contact about the inquiry (non-marketing / informational).
 * - inquiry: consumer inquiry creating an established business relationship for 3 months (47 CFR 64.1200(f)(5)).
 *   Provides a DNC exemption for live/manual calls only — never authorizes automated marketing.
 */
export const ConsentKind = z.enum(["express_written", "express", "inquiry"]);
export type ConsentKind = z.infer<typeof ConsentKind>;

export const ConsentRecord = z.object({
  id: z.string(),
  channel: Channel,
  kind: ConsentKind,
  capturedAt: z.string().datetime({ offset: true }),
  /** Where it came from: "web_form:https://…", "sms_keyword:START", "verbal:call-recording-id". */
  source: z.string().min(1),
  /** Exact disclosure text shown to the consumer — required for express_written. */
  disclosureText: z.string().optional(),
  evidenceRef: z.string().optional(),
  revokedAt: z.string().datetime({ offset: true }).nullable().optional(),
  revocationSource: z.string().optional(),
});
export type ConsentRecord = z.infer<typeof ConsentRecord>;

export interface ConsentStatus {
  hasExpressWritten: boolean;
  hasExpress: boolean;
  /** Inquiry-based established business relationship still active (≤ 90 days). */
  hasActiveInquiry: boolean;
  /** Any revocation on this channel after the latest grant. */
  revoked: boolean;
  basis: ConsentRecord | null;
}

const INQUIRY_EBR_DAYS = 90;

export function resolveConsent(records: readonly ConsentRecord[], channel: Channel, now: Date): ConsentStatus {
  const relevant = records.filter((r) => r.channel === channel);
  const active = relevant.filter((r) => !r.revokedAt || Date.parse(r.revokedAt) > now.getTime());
  const latestGrant = Math.max(0, ...relevant.map((r) => Date.parse(r.capturedAt)));
  const latestRevocation = Math.max(0, ...relevant.filter((r) => r.revokedAt).map((r) => Date.parse(r.revokedAt as string)));
  const revoked = latestRevocation > 0 && latestRevocation >= latestGrant;
  if (revoked) return { hasExpressWritten: false, hasExpress: false, hasActiveInquiry: false, revoked: true, basis: null };

  const ew = active.find((r) => r.kind === "express_written" && !!r.disclosureText);
  const ex = active.find((r) => r.kind === "express");
  const inquiry = active.find((r) => r.kind === "inquiry" && now.getTime() - Date.parse(r.capturedAt) <= INQUIRY_EBR_DAYS * 86_400_000);
  return {
    hasExpressWritten: !!ew,
    hasExpress: !!ew || !!ex,
    hasActiveInquiry: !!inquiry,
    revoked: false,
    basis: ew ?? ex ?? inquiry ?? null,
  };
}
