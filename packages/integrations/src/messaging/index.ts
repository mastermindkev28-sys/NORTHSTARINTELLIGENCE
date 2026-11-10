/**
 * Outbound messaging contract with a compliance gate that every send passes through.
 * The gate is deliberately conservative: when consent or local time cannot be established, the message
 * is NOT sent. TCPA/DNC rules vary by message type and state; this gate is a floor, not legal advice.
 */
export type Channel = 'sms' | 'voice' | 'email';

export interface OutboundMessage {
  orgId: string;
  channel: Channel;
  to: string; // E.164 phone or email
  body: string;
  /** IANA timezone of the recipient, e.g. America/Chicago. Required for sms/voice. */
  recipientTimeZone?: string;
  /** Evidence of prior express consent for this channel (required for sms/voice). */
  consent?: { capturedAt: string; method: 'web_form' | 'inbound_message' | 'verbal_recorded' | 'written'; reference: string };
  idempotencyKey: string;
}

export type ComplianceDecision = { allowed: true } | { allowed: false; reason: 'suppressed' | 'no_consent' | 'quiet_hours' | 'unknown_timezone' | 'invalid_address' | 'empty_body' };

export interface ComplianceDeps {
  isSuppressed(channel: Channel, address: string): Promise<boolean>;
  now?: () => Date;
  /** Allowed local sending window, inclusive start hour, exclusive end hour. Default 8–21 (8am–9pm). */
  window?: { startHour: number; endHour: number };
}

const E164 = /^\+[1-9]\d{6,14}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function localHour(date: Date, timeZone: string): number | null {
  try {
    const h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date);
    return Number(h);
  } catch {
    return null;
  }
}

export async function checkCompliance(msg: OutboundMessage, deps: ComplianceDeps): Promise<ComplianceDecision> {
  if (!msg.body.trim()) return { allowed: false, reason: 'empty_body' };
  const voiceOrSms = msg.channel === 'sms' || msg.channel === 'voice';
  if (voiceOrSms ? !E164.test(msg.to) : !EMAIL.test(msg.to)) return { allowed: false, reason: 'invalid_address' };
  if (await deps.isSuppressed(msg.channel, msg.to)) return { allowed: false, reason: 'suppressed' };
  if (voiceOrSms) {
    if (!msg.consent) return { allowed: false, reason: 'no_consent' };
    if (!msg.recipientTimeZone) return { allowed: false, reason: 'unknown_timezone' };
    const hour = localHour((deps.now ?? (() => new Date()))(), msg.recipientTimeZone);
    if (hour === null) return { allowed: false, reason: 'unknown_timezone' };
    const w = deps.window ?? { startHour: 8, endHour: 21 };
    if (hour < w.startHour || hour >= w.endHour) return { allowed: false, reason: 'quiet_hours' };
  }
  return { allowed: true };
}

/** Recognizes standard opt-out keywords in inbound replies (CTIA/carrier conventions). */
export function isOptOutKeyword(text: string): boolean {
  return /^\s*(stop|stopall|unsubscribe|cancel|end|quit|revoke|opt[\s-]?out)\s*[.!]?\s*$/i.test(text);
}

export interface SendResult {
  status: 'sent' | 'blocked' | 'duplicate';
  providerMessageId?: string;
  reason?: string;
}

export interface MessagingProvider {
  readonly id: string;
  send(msg: OutboundMessage): Promise<{ providerMessageId: string }>;
}

/** Mock provider: records messages in memory, never contacts anyone. */
export class MockMessagingProvider implements MessagingProvider {
  readonly id = 'mock';
  readonly sent: OutboundMessage[] = [];
  async send(msg: OutboundMessage) {
    this.sent.push(msg);
    return { providerMessageId: `mock_${this.sent.length}` };
  }
}

/** The only path to send a message: compliance gate + idempotency + provider call. */
export function createMessenger(provider: MessagingProvider, deps: ComplianceDeps & { seen?: Set<string> }) {
  const seen = deps.seen ?? new Set<string>();
  return async function send(msg: OutboundMessage): Promise<SendResult> {
    const key = `${msg.orgId}:${msg.idempotencyKey}`;
    if (seen.has(key)) return { status: 'duplicate' };
    const decision = await checkCompliance(msg, deps);
    if (!decision.allowed) return { status: 'blocked', reason: decision.reason };
    seen.add(key); // reserve before the call so concurrent duplicates cannot both send
    try {
      const { providerMessageId } = await provider.send(msg);
      return { status: 'sent', providerMessageId };
    } catch (err) {
      seen.delete(key); // allow a retry after a failed provider call
      throw err;
    }
  };
}
