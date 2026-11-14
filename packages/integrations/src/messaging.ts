import { NorthstarError } from "@northstar/core";

export interface OutboundSms {
  to: string;
  body: string;
  /** Stable key; adapters must not send twice for the same key. */
  idempotencyKey: string;
}

export interface SendResult {
  provider: string;
  providerMessageId: string;
  status: "queued" | "sent";
}

/**
 * Messaging port. Callers MUST pass a compliance decision of "allow" — the adapters re-assert it so an agent
 * cannot bypass the outreach gate by calling the adapter directly.
 */
export interface MessagingPort {
  readonly provider: string;
  sendSms(msg: OutboundSms, complianceVerdict: "allow"): Promise<SendResult>;
}

function assertAllowed(verdict: string): void {
  if (verdict !== "allow") throw new NorthstarError("COMPLIANCE_BLOCKED", "Outbound message has no 'allow' compliance decision");
}

/** Records messages instead of sending them. Used in development, tests, and the demo workspace. */
export class SandboxMessaging implements MessagingPort {
  readonly provider = "sandbox";
  readonly sent: (OutboundSms & { providerMessageId: string })[] = [];
  async sendSms(msg: OutboundSms, complianceVerdict: "allow"): Promise<SendResult> {
    assertAllowed(complianceVerdict);
    const existing = this.sent.find((m) => m.idempotencyKey === msg.idempotencyKey);
    if (existing) return { provider: this.provider, providerMessageId: existing.providerMessageId, status: "queued" };
    const providerMessageId = `sandbox-${this.sent.length + 1}`;
    this.sent.push({ ...msg, providerMessageId });
    return { provider: this.provider, providerMessageId, status: "queued" };
  }
}

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; ok: boolean; json(): Promise<unknown> }>;

/**
 * Twilio Programmable Messaging via REST (Messages resource), using a Messaging Service (required for A2P 10DLC).
 * Idempotency: Twilio has no idempotency key for Messages, so callers persist the idempotency key with the message
 * row (unique index) BEFORE calling send; a retry first checks for an existing provider_message_id.
 */
export class TwilioMessaging implements MessagingPort {
  readonly provider = "twilio";
  constructor(private readonly cfg: { accountSid?: string; authToken?: string; messagingServiceSid?: string; fetch: FetchFn; statusCallbackUrl?: string }) {}

  async sendSms(msg: OutboundSms, complianceVerdict: "allow"): Promise<SendResult> {
    assertAllowed(complianceVerdict);
    const { accountSid, authToken, messagingServiceSid } = this.cfg;
    if (!accountSid || !authToken || !messagingServiceSid) throw new NorthstarError("PROVIDER_NOT_CONFIGURED", "Twilio credentials are not configured");
    const form = new URLSearchParams({ To: msg.to, MessagingServiceSid: messagingServiceSid, Body: msg.body });
    if (this.cfg.statusCallbackUrl) form.set("StatusCallback", this.cfg.statusCallbackUrl);
    const res = await this.cfg.fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (res.status === 429 || res.status >= 500) throw new NorthstarError("PROVIDER_UNAVAILABLE", `Twilio unavailable (HTTP ${res.status})`, { retryable: true });
    const body = (await res.json()) as { sid?: string; message?: string; code?: number };
    if (!res.ok || !body.sid) throw new NorthstarError("PROVIDER_UNAVAILABLE", `Twilio rejected message: ${body.message ?? res.status}`, { retryable: false, details: { code: body.code } });
    return { provider: this.provider, providerMessageId: body.sid, status: "queued" };
  }
}
