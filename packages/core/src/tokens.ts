import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256-bit opaque bearer token, URL-safe. Only its hash is ever stored. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const SESSION_COOKIE = 'ns_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days, sliding expiry handled by re-issue
