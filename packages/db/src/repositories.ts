/**
 * Typed data access. Every function takes a transaction that was opened with the right context
 * (withAnonymous / withUser / withTenant); none of them adds its own org filter for security,
 * because RLS is the enforcement layer. Explicit org filters appear only where they help the planner.
 */
import type { Tx } from './client.js';

export type OrgRole = 'owner' | 'admin' | 'manager' | 'acquisitions' | 'analyst' | 'viewer';

// ---------------------------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------------------------

export async function signUp(
  tx: Tx,
  p: { email: string; displayName: string; passwordHash: string; orgName: string; orgSlug: string },
): Promise<{ userId: string; orgId: string }> {
  const { rows } = await tx.query<{ user_id: string; org_id: string }>(
    'select user_id, org_id from app.sign_up($1, $2, $3, $4, $5)',
    [p.email, p.displayName, p.passwordHash, p.orgName, p.orgSlug],
  );
  const r = rows[0]!;
  return { userId: r.user_id, orgId: r.org_id };
}

export async function loginLookup(tx: Tx, email: string): Promise<{ userId: string; passwordHash: string | null; status: string } | null> {
  const { rows } = await tx.query<{ user_id: string; password_hash: string | null; status: string }>(
    'select user_id, password_hash, status from app.login_lookup($1)',
    [email],
  );
  const r = rows[0];
  return r ? { userId: r.user_id, passwordHash: r.password_hash, status: r.status } : null;
}

export async function createSession(
  tx: Tx,
  p: { userId: string; tokenHash: Buffer; ttlSeconds: number; ip?: string | null; userAgent?: string | null },
): Promise<{ sessionId: string; activeOrgId: string | null; expiresAt: Date }> {
  const { rows } = await tx.query<{ session_id: string; active_org_id: string | null; expires_at: Date }>(
    `select session_id, active_org_id, expires_at from app.create_session($1, $2, make_interval(secs => $3), $4::inet, $5)`,
    [p.userId, p.tokenHash, p.ttlSeconds, p.ip ?? null, p.userAgent ?? null],
  );
  const r = rows[0]!;
  return { sessionId: r.session_id, activeOrgId: r.active_org_id, expiresAt: r.expires_at };
}

export interface ResolvedSession {
  sessionId: string;
  userId: string;
  activeOrgId: string | null;
  role: OrgRole | null;
  expiresAt: Date;
}

export async function resolveSession(tx: Tx, tokenHash: Buffer): Promise<ResolvedSession | null> {
  const { rows } = await tx.query<{ session_id: string; user_id: string; active_org_id: string | null; role: OrgRole | null; expires_at: Date }>(
    'select session_id, user_id, active_org_id, role, expires_at from app.resolve_session($1)',
    [tokenHash],
  );
  const r = rows[0];
  return r ? { sessionId: r.session_id, userId: r.user_id, activeOrgId: r.active_org_id, role: r.role, expiresAt: r.expires_at } : null;
}

/** Requires withUser/withTenant context; RLS limits revocation to the caller's own sessions. */
export async function revokeSession(tx: Tx, sessionId: string): Promise<boolean> {
  const r = await tx.query('update public.sessions set revoked_at = now() where id = $1 and revoked_at is null', [sessionId]);
  return (r.rowCount ?? 0) > 0;
}

export async function switchSessionOrg(tx: Tx, sessionId: string, orgId: string): Promise<boolean> {
  const { rows } = await tx.query<{ ok: boolean }>('select app.switch_session_org($1, $2) as ok', [sessionId, orgId]);
  return rows[0]?.ok === true;
}

// ---------------------------------------------------------------------------------------------
// Organizations and members
// ---------------------------------------------------------------------------------------------

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: OrgRole;
}

export async function listMyOrganizations(tx: Tx): Promise<OrgSummary[]> {
  const { rows } = await tx.query<OrgSummary>(
    `select o.id, o.name, o.slug::text as slug, o.plan, m.role
       from public.organizations o
       join public.memberships m on m.org_id = o.id and m.user_id = app.current_user_id() and m.status = 'active'
      order by o.name`,
  );
  return rows;
}

export async function createOrganization(tx: Tx, name: string, slug: string): Promise<string> {
  const { rows } = await tx.query<{ id: string }>('select app.create_organization($1, $2) as id', [name, slug]);
  return rows[0]!.id;
}

export interface Member {
  userId: string;
  email: string;
  displayName: string;
  role: OrgRole;
  status: string;
  joinedAt: Date;
}

export async function listMembers(tx: Tx): Promise<Member[]> {
  const { rows } = await tx.query<Member>(
    `select u.id as "userId", u.email::text as email, u.display_name as "displayName", m.role, m.status::text as status, m.created_at as "joinedAt"
       from public.memberships m join public.users u on u.id = m.user_id
      where m.org_id = app.current_org_id()
      order by m.created_at`,
  );
  return rows;
}

export async function getCurrentUser(tx: Tx): Promise<{ id: string; email: string; displayName: string } | null> {
  const { rows } = await tx.query<{ id: string; email: string; displayName: string }>(
    `select id, email::text as email, display_name as "displayName" from public.users where id = app.current_user_id()`,
  );
  return rows[0] ?? null;
}

export async function updateMemberRole(tx: Tx, userId: string, role: OrgRole): Promise<boolean> {
  const r = await tx.query('update public.memberships set role = $2 where org_id = app.current_org_id() and user_id = $1', [userId, role]);
  return (r.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------------------------
// Underwriting analyses
// ---------------------------------------------------------------------------------------------

export interface AnalysisRow {
  id: string;
  name: string;
  kind: 'wholesale_deal' | 'rental';
  status: 'draft' | 'final' | 'archived';
  engineVersion: string;
  inputsFingerprint: string;
  inputs: unknown;
  report: unknown;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ANALYSIS_COLUMNS = `a.id, a.name, a.kind, a.status, a.engine_version as "engineVersion",
  a.inputs_fingerprint as "inputsFingerprint", a.inputs, a.report, a.created_by as "createdBy",
  u.display_name as "createdByName", a.created_at as "createdAt", a.updated_at as "updatedAt"`;

export async function createAnalysis(
  tx: Tx,
  p: { name: string; kind: AnalysisRow['kind']; engineVersion: string; inputs: unknown; report: unknown; inputsFingerprint: string; propertyId?: string | null },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.underwriting_analyses (name, kind, engine_version, inputs, report, inputs_fingerprint, property_id)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [p.name, p.kind, p.engineVersion, JSON.stringify(p.inputs), JSON.stringify(p.report), p.inputsFingerprint, p.propertyId ?? null],
  );
  return rows[0]!.id;
}

export async function listAnalyses(tx: Tx, limit = 50): Promise<Omit<AnalysisRow, 'inputs' | 'report'>[]> {
  const { rows } = await tx.query(
    `select a.id, a.name, a.kind, a.status, a.engine_version as "engineVersion", a.inputs_fingerprint as "inputsFingerprint",
            a.created_by as "createdBy", u.display_name as "createdByName", a.created_at as "createdAt", a.updated_at as "updatedAt"
       from public.underwriting_analyses a left join public.users u on u.id = a.created_by
      where a.org_id = app.current_org_id()
      order by a.created_at desc limit $1`,
    [Math.min(Math.max(limit, 1), 200)],
  );
  return rows;
}

export async function getAnalysis(tx: Tx, id: string): Promise<AnalysisRow | null> {
  const { rows } = await tx.query<AnalysisRow>(
    `select ${ANALYSIS_COLUMNS} from public.underwriting_analyses a left join public.users u on u.id = a.created_by where a.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function setAnalysisStatus(tx: Tx, id: string, status: AnalysisRow['status']): Promise<boolean> {
  const r = await tx.query('update public.underwriting_analyses set status = $2 where id = $1', [id, status]);
  return (r.rowCount ?? 0) > 0;
}

export async function deleteAnalysis(tx: Tx, id: string): Promise<boolean> {
  const r = await tx.query('delete from public.underwriting_analyses where id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  actorType: string;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  occurredAt: Date;
}

export async function recordAudit(
  tx: Tx,
  p: { action: string; targetType?: string; targetId?: string; metadata?: Record<string, unknown>; ip?: string | null },
): Promise<void> {
  await tx.query(
    `insert into public.audit_log (org_id, actor_type, actor_user_id, action, target_type, target_id, metadata, ip, request_id)
     values (app.current_org_id(), 'user', app.current_user_id(), $1, $2, $3, $4, $5::inet, nullif(current_setting('app.request_id', true), ''))`,
    [p.action, p.targetType ?? null, p.targetId ?? null, JSON.stringify(p.metadata ?? {}), p.ip ?? null],
  );
}

export async function listAudit(tx: Tx, limit = 100): Promise<AuditEntry[]> {
  const { rows } = await tx.query<AuditEntry>(
    `select l.id::text, l.actor_type::text as "actorType", l.actor_user_id as "actorUserId", u.display_name as "actorName",
            l.action, l.target_type as "targetType", l.target_id as "targetId", l.metadata, l.request_id as "requestId", l.occurred_at as "occurredAt"
       from public.audit_log l left join public.users u on u.id = l.actor_user_id
      where l.org_id = app.current_org_id()
      order by l.occurred_at desc, l.id desc limit $1`,
    [Math.min(Math.max(limit, 1), 500)],
  );
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Usage metering
// ---------------------------------------------------------------------------------------------

/** Idempotent: re-sending the same key is a no-op. Returns true when a new event was recorded. */
export async function recordUsage(tx: Tx, p: { meter: string; quantity: number; idempotencyKey: string; metadata?: Record<string, unknown> }): Promise<boolean> {
  const r = await tx.query(
    `insert into public.usage_events (meter, quantity, idempotency_key, metadata) values ($1, $2, $3, $4)
     on conflict (org_id, idempotency_key) do nothing`,
    [p.meter, p.quantity, p.idempotencyKey, JSON.stringify(p.metadata ?? {})],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function isSuppressed(tx: Tx, channel: 'sms' | 'voice' | 'email', address: string): Promise<boolean> {
  const { rows } = await tx.query<{ s: boolean }>('select app.is_suppressed($1, $2) as s', [channel, address]);
  return rows[0]?.s === true;
}
