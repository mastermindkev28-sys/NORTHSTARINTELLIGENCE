import { resolveConsent, type Channel, type ConsentRecord } from "./consent";
import { checkOutboundContent, type ContentIssue } from "./content";
import { isLocationKnown, isWithinContactWindow, nextContactWindowStart, type ContactWindow, type RecipientLocation } from "./quietHours";

export type OutreachPurpose = "marketing" | "informational" | "conversational_reply";

export interface DncStatus {
  /** National DNC registry result; "unknown" if never scrubbed. */
  national: boolean | "unknown";
  state?: boolean | "unknown";
  /** ISO timestamp of the last registry scrub for this number. */
  scrubbedAt?: string | null;
}

export interface OutreachRequest {
  channel: Channel;
  purpose: OutreachPurpose;
  /** Sent by the system/agent without a human initiating each individual message. */
  automated: boolean;
  /** AI-generated or prerecorded voice. */
  artificialVoice?: boolean;
  recipient: { phoneE164?: string | null; email?: string | null; location: RecipientLocation };
  consents: readonly ConsentRecord[];
  /** How the destination was obtained. Skip-traced/list numbers never receive automated or AI-voice outreach. */
  numberSource?: "consumer_provided" | "skip_trace" | "purchased_list" | "unknown";
  /** Timestamps of solicitation attempts (calls + texts + voicemails, any number) to this recipient in the last 24h. */
  recentAttempts?: readonly string[];
  /** On the organization's internal suppression / do-not-contact list (includes all prior opt-outs). */
  suppressed: boolean;
  dnc: DncStatus;
  /** Minutes since the recipient's most recent inbound message in this thread, if any. */
  minutesSinceInbound?: number | null;
  now: Date;
  orgContactWindow?: Partial<ContactWindow>;
  content?: { body: string; businessName: string; isFirstMessageInThread: boolean; aiGenerated: boolean };
}

export type OutreachVerdict = "allow" | "defer" | "block" | "require_review";

export interface OutreachReason {
  code:
    | "SUPPRESSED" | "CONSENT_REVOKED" | "NO_DESTINATION" | "EXPRESS_WRITTEN_CONSENT_REQUIRED" | "CONSENT_REQUIRED"
    | "DNC_LISTED" | "DNC_SCRUB_STALE" | "QUIET_HOURS" | "CONTENT" | "MANUAL_REVIEW_NO_CONSENT" | "LOCATION_UNKNOWN"
    | "FREQUENCY_CAP" | "NON_CONSENSUAL_NUMBER_SOURCE" | "OK";
  message: string;
}

export interface OutreachDecision {
  verdict: OutreachVerdict;
  reasons: OutreachReason[];
  nextAllowedAt: Date | null;
  contentIssues: ContentIssue[];
}

/** National DNC registry must be scrubbed at least every 31 days (16 CFR 310.4(b)(3)(iv); 47 CFR 64.1200(c)(2)). */
export const DNC_SCRUB_MAX_AGE_DAYS = 31;
/** A reply this soon after the recipient's own message is treated as part of a consumer-initiated conversation. */
export const CONVERSATIONAL_REPLY_MINUTES = 15;
/** FL/OK/MD: no more than 3 solicitations per 24 hours on the same subject, regardless of number used. Applied platform-wide. */
export const MAX_ATTEMPTS_PER_24H = 3;

/**
 * Single choke point for every outbound SMS/voice/email. Fails closed: any unknown or missing signal blocks
 * or defers rather than allowing. Agents cannot bypass this gate (enforced in the messaging adapter).
 */
export function evaluateOutreach(req: OutreachRequest): OutreachDecision {
  const reasons: OutreachReason[] = [];
  const block = (code: OutreachReason["code"], message: string): OutreachDecision => ({ verdict: "block", reasons: [...reasons, { code, message }], nextAllowedAt: null, contentIssues: [] });

  if (req.suppressed) return block("SUPPRESSED", "Recipient is on the suppression list (opted out or internal do-not-contact).");

  const isPhone = req.channel === "sms" || req.channel === "voice";
  if (isPhone && !req.recipient.phoneE164) return block("NO_DESTINATION", "No valid phone number.");
  if (req.channel === "email" && !req.recipient.email) return block("NO_DESTINATION", "No valid email address.");

  const consent = resolveConsent(req.consents, req.channel, req.now);
  if (consent.revoked) return block("CONSENT_REVOKED", `Consent for ${req.channel} was revoked.`);
  // FCC 26-67: revoking marketing consent revokes ALL future marketing from the caller, on every channel.
  if (req.purpose === "marketing") {
    const revokedElsewhere = (["sms", "voice", "email"] as const).filter((c) => c !== req.channel && resolveConsent(req.consents, c, req.now).revoked);
    if (revokedElsewhere.length) return block("CONSENT_REVOKED", `Marketing consent was revoked on ${revokedElsewhere.join(", ")}; revocation applies to all marketing.`);
  }

  const isReply = req.purpose === "conversational_reply" && req.minutesSinceInbound != null && req.minutesSinceInbound <= CONVERSATIONAL_REPLY_MINUTES;

  if (isPhone && (req.automated || req.artificialVoice) && req.numberSource && req.numberSource !== "consumer_provided") {
    return block("NON_CONSENSUAL_NUMBER_SOURCE", "Numbers obtained by skip tracing or lists may never receive automated messages or AI-voice calls.");
  }

  if (isPhone) {
    // Artificial/AI voice and automated marketing require prior express WRITTEN consent.
    const needsWritten = req.artificialVoice === true || (req.automated && req.purpose === "marketing");
    if (needsWritten && !consent.hasExpressWritten) {
      return block("EXPRESS_WRITTEN_CONSENT_REQUIRED", req.artificialVoice ? "Artificial/AI voice calls require prior express written consent." : "Automated marketing messages require prior express written consent.");
    }
    if (req.automated && req.purpose === "informational" && !consent.hasExpress) {
      return block("CONSENT_REQUIRED", "Automated informational messages require prior express consent.");
    }

    if (req.purpose === "marketing" && !consent.hasExpressWritten) {
      const dncListed = req.dnc.national === true || req.dnc.state === true;
      const dncUnknown = req.dnc.national === "unknown" || req.dnc.state === "unknown";
      const scrubAgeDays = req.dnc.scrubbedAt ? (req.now.getTime() - Date.parse(req.dnc.scrubbedAt)) / 86_400_000 : Infinity;
      if (dncListed && !consent.hasActiveInquiry) return block("DNC_LISTED", "Number is on a Do Not Call registry and there is no qualifying consent or inquiry relationship.");
      if (!dncListed && (dncUnknown || scrubAgeDays > DNC_SCRUB_MAX_AGE_DAYS) && !consent.hasActiveInquiry) {
        return block("DNC_SCRUB_STALE", `Number has not been scrubbed against DNC registries within ${DNC_SCRUB_MAX_AGE_DAYS} days.`);
      }
      if (!req.automated && !consent.hasExpress && !consent.hasActiveInquiry) {
        reasons.push({ code: "MANUAL_REVIEW_NO_CONSENT", message: "Manual marketing outreach without any recorded consent; supervisor review required." });
      }
    }
  }

  let contentIssues: ContentIssue[] = [];
  if (req.content) {
    contentIssues = checkOutboundContent({ ...req.content, channel: req.channel }).issues;
    if (contentIssues.some((i) => i.blocking)) {
      reasons.push({ code: "CONTENT", message: contentIssues.filter((i) => i.blocking).map((i) => i.message).join(" ") });
      return { verdict: "require_review", reasons, nextAllowedAt: null, contentIssues };
    }
  }

  if (isPhone && !isReply && !req.recipient.location.timeZone && !isLocationKnown({ ...req.recipient.location, phoneE164: req.recipient.phoneE164 })) {
    reasons.push({ code: "LOCATION_UNKNOWN", message: "Recipient time zone cannot be determined; outreach is not permitted until a location is known." });
    return { verdict: "require_review", reasons, nextAllowedAt: null, contentIssues };
  }

  if (isPhone && !isReply && req.purpose !== "conversational_reply") {
    const windowStart = req.now.getTime() - 86_400_000;
    const recent = (req.recentAttempts ?? []).map((t) => Date.parse(t)).filter((t) => t > windowStart).sort((a, b) => a - b);
    if (recent.length >= MAX_ATTEMPTS_PER_24H) {
      reasons.push({ code: "FREQUENCY_CAP", message: `${recent.length} attempts in the last 24 hours (limit ${MAX_ATTEMPTS_PER_24H}).` });
      return { verdict: "defer", reasons, nextAllowedAt: new Date((recent[recent.length - MAX_ATTEMPTS_PER_24H] as number) + 86_400_000), contentIssues };
    }
  }

  const location: RecipientLocation = { ...req.recipient.location, phoneE164: req.recipient.phoneE164 };
  if (isPhone && !isReply && !isWithinContactWindow(req.now, location, req.orgContactWindow)) {
    reasons.push({ code: "QUIET_HOURS", message: "Outside the permitted contact window in the recipient's local time." });
    return { verdict: "defer", reasons, nextAllowedAt: nextContactWindowStart(req.now, location, req.orgContactWindow), contentIssues };
  }

  if (reasons.some((r) => r.code === "MANUAL_REVIEW_NO_CONSENT")) return { verdict: "require_review", reasons, nextAllowedAt: null, contentIssues };
  return { verdict: "allow", reasons: [{ code: "OK", message: "All compliance checks passed." }], nextAllowedAt: null, contentIssues };
}
