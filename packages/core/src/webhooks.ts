/**
 * Inbound webhook verification: HMAC-SHA256 over `${timestamp}.${rawBody}`, constant-time compare,
 * replay window, and multiple active secrets to allow rotation. Provider-specific schemes (Twilio,
 * Stripe) get their own adapters but follow the same contract.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WebhookVerifyInput {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secrets: string[];
  toleranceSeconds?: number;
  nowSeconds?: number;
}

export type WebhookVerifyResult = { ok: true } | { ok: false; reason: 'missing_headers' | 'stale' | 'bad_signature' | 'no_secret' };

export function signWebhook(secret: string, timestamp: string, rawBody: string): string {
  return 'v1=' + createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function verifyWebhook(i: WebhookVerifyInput): WebhookVerifyResult {
  if (i.secrets.length === 0) return { ok: false, reason: 'no_secret' };
  if (!i.timestamp || !i.signature) return { ok: false, reason: 'missing_headers' };
  const ts = Number(i.timestamp);
  const now = i.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(ts) || Math.abs(now - ts) > (i.toleranceSeconds ?? 300)) return { ok: false, reason: 'stale' };
  const given = Buffer.from(i.signature);
  for (const s of i.secrets) {
    const expected = Buffer.from(signWebhook(s, i.timestamp, i.rawBody));
    if (expected.length === given.length && timingSafeEqual(expected, given)) return { ok: true };
  }
  return { ok: false, reason: 'bad_signature' };
}
