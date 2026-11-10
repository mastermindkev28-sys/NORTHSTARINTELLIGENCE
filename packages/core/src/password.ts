/**
 * Password hashing with scrypt (memory-hard, built into Node; no native dependency).
 * Format: scrypt$N=<n>,r=<r>,p=<p>$<salt b64url>$<hash b64url>
 * Parameters are stored with the hash so they can be raised later without invalidating old hashes.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (pw: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw, salt, len, opts, (e, k) => (e ? reject(e) : resolve(k))));

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;
const DEFAULT = { N: 16384, r: 8, p: 1 } as const;
const KEY_LEN = 32;

export function validatePasswordStrength(pw: string): string | null {
  if (typeof pw !== 'string') return 'Password is required.';
  if (pw.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (pw.length > PASSWORD_MAX_LENGTH) return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (new Set(pw).size < 5) return 'Password is too repetitive.';
  return null;
}

export async function hashPassword(pw: string, params: { N: number; r: number; p: number } = DEFAULT): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize('NFKC'), salt, KEY_LEN, { ...params, maxmem: 128 * params.N * params.r * 2 });
  return `scrypt$N=${params.N},r=${params.r},p=${params.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

const PARSE = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;
// A fixed, valid hash used to spend equal time when the account does not exist (user enumeration defense).
const DUMMY = 'scrypt$N=16384,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  const m = PARSE.exec(stored ?? DUMMY) ?? PARSE.exec(DUMMY)!;
  const [, n, r, p, saltB64, hashB64] = m;
  const N = Number(n), R = Number(r), P = Number(p);
  if (N > 2 ** 20 || R > 32 || P > 16) return false; // refuse attacker-controlled DoS parameters
  const expected = Buffer.from(hashB64!, 'base64url');
  const actual = await scrypt(String(pw).normalize('NFKC'), Buffer.from(saltB64!, 'base64url'), expected.length || KEY_LEN, {
    N, r: R, p: P, maxmem: 128 * N * R * 2,
  });
  const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
  return ok && stored != null && PARSE.test(stored);
}
