'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createMemoryRateLimiter,
  fieldErrors,
  generateToken,
  hashPassword,
  hashToken,
  loginSchema,
  signUpSchema,
  slugify,
  validatePasswordStrength,
  verifyPassword,
} from '@northstar/core';
import { repo, withAnonymous, withUser } from '@northstar/db';
import { db, log } from '../server/db';
import { clientIp, getSession } from '../server/session';
import { env } from '../server/env';

export interface FormState {
  error?: string;
  fields?: Record<string, string>;
  /** Echoed back so the form keeps non-secret values after React resets it on submit. */
  values?: Record<string, string>;
}

// Per-instance limiter; replace with a shared store when running multiple instances (docs/ARCHITECTURE_DECISIONS.md, ADR-007).
const loginLimiter = createMemoryRateLimiter({ capacity: 10, refillPerSecond: 10 / 300 });

async function issueSession(userId: string) {
  const token = generateToken();
  const h = await headers();
  const ip = await clientIp();
  const s = await withAnonymous(db(), (tx) =>
    repo.createSession(tx, { userId, tokenHash: hashToken(token), ttlSeconds: SESSION_TTL_SECONDS, ip, userAgent: h.get('user-agent') }),
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    expires: s.expiresAt,
  });
}

export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(form);
  const values = { displayName: String(raw.displayName ?? ''), email: String(raw.email ?? ''), orgName: String(raw.orgName ?? '') };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };
  const weak = validatePasswordStrength(parsed.data.password);
  if (weak) return { fields: { password: weak }, values };
  const { displayName, email, password, orgName } = parsed.data;
  const passwordHash = await hashPassword(password);
  try {
    const slug = `${slugify(orgName).slice(0, 52)}-${generateToken(4).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'x'}`;
    const { userId } = await withAnonymous(db(), (tx) => repo.signUp(tx, { email, displayName, passwordHash, orgName, orgSlug: slug }));
    await issueSession(userId);
    log.info('auth.sign_up', { userId });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return { fields: { email: 'An account with this email already exists.' }, values };
    log.error('auth.sign_up_failed', { err: e });
    return { error: 'We could not create your account. Please try again.', values };
  }
  redirect('/app');
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { email: String(form.get('email') ?? '') };
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Enter your email and password.', values };
  const ip = (await clientIp()) ?? 'unknown';
  const limit = await loginLimiter.consume(`${ip}:${parsed.data.email}`);
  if (!limit.allowed) return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterMs / 1000)} seconds.`, values };

  const found = await withAnonymous(db(), (tx) => repo.loginLookup(tx, parsed.data.email));
  // verifyPassword spends equal time when the user does not exist (enumeration defense).
  const ok = await verifyPassword(parsed.data.password, found?.passwordHash ?? null);
  if (!found || !ok || found.status !== 'active') {
    log.warn('auth.login_failed', { ip });
    return { error: 'Email or password is incorrect.', values };
  }
  await issueSession(found.userId);
  redirect('/app');
}

export async function logoutAction(): Promise<void> {
  const s = await getSession();
  if (s) await withUser(db(), s.userId, (tx) => repo.revokeSession(tx, s.sessionId));
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

export async function switchOrgAction(form: FormData): Promise<void> {
  const s = await getSession();
  const orgId = String(form.get('orgId') ?? '');
  if (!s) redirect('/login');
  await withUser(db(), s.userId, (tx) => repo.switchSessionOrg(tx, s.sessionId, orgId));
  redirect('/app');
}
