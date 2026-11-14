import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Inbound webhook verification for lead sources (Northstar format):
 *   header  x-northstar-signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>
 * Rejects stale timestamps (replay window) and uses constant-time comparison.
 */
export function signWebhook(secret: string, rawBody: string, timestampSec: number): string {
  const mac = createHmac("sha256", secret).update(`${timestampSec}.${rawBody}`).digest("hex");
  return `t=${timestampSec},v1=${mac}`;
}

export type WebhookVerification = { valid: true; timestamp: number } | { valid: false; reason: "missing" | "malformed" | "stale" | "mismatch" };

export function verifyWebhook(secret: string, rawBody: string, header: string | null | undefined, nowSec: number, toleranceSec = 300): WebhookVerification {
  if (!header) return { valid: false, reason: "missing" };
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  const sig = parts.v1;
  if (!Number.isInteger(t) || !sig || !/^[0-9a-f]{64}$/.test(sig)) return { valid: false, reason: "malformed" };
  if (Math.abs(nowSec - t) > toleranceSec) return { valid: false, reason: "stale" };
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const given = Buffer.from(sig, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { valid: false, reason: "mismatch" };
  return { valid: true, timestamp: t };
}

/**
 * Twilio request validation: base64(HMAC-SHA1(authToken, url + concat(sorted(key + value)))).
 * See https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url);
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
}

export function verifyTwilioSignature(authToken: string, url: string, params: Record<string, string>, header: string | null | undefined): boolean {
  if (!header) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
