import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { SESSION_COOKIE, hashToken, isRole, type Role } from '@northstar/core';
import { repo, withAnonymous, withTenant, type Tx } from '@northstar/db';
import { db } from './db';

export interface Session {
  sessionId: string;
  userId: string;
  orgId: string;
  role: Role;
  expiresAt: Date;
}

/** Resolve the current session once per request (React cache). */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;
  const s = await withAnonymous(db(), (tx) => repo.resolveSession(tx, hashToken(token)));
  if (!s || !s.activeOrgId || !s.role || !isRole(s.role)) return null;
  return { sessionId: s.sessionId, userId: s.userId, orgId: s.activeOrgId, role: s.role, expiresAt: s.expiresAt };
});

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}

export async function requestId(): Promise<string> {
  const h = await headers();
  return h.get('x-request-id') ?? `req_${randomUUID()}`;
}

/** Run a callback inside the current user's tenant context (RLS-enforced). */
export async function asTenant<T>(fn: (tx: Tx, s: Session) => Promise<T>): Promise<T> {
  const s = await requireSession();
  return withTenant(db(), { userId: s.userId, orgId: s.orgId, requestId: await requestId() }, (tx) => fn(tx, s));
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || h.get('x-real-ip');
  return ip && /^[0-9a-f:.]+$/i.test(ip) ? ip : null;
}
