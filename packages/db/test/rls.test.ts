/**
 * Integration tests against a real PostgreSQL instance, connected as a NON-owner role that is a member
 * of northstar_app (exactly the production posture). These tests are the primary evidence that one
 * customer's data can never be read or modified by another.
 */
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb, migrate, repo, withAnonymous, withTenant, withUser, type Db } from '../src/index';
import { MIGRATIONS_DIR } from '../src/paths';

const available = inject('dbAvailable');
const d = available ? describe : describe.skip;

const HASH = 'scrypt$N=16384,r=8,p=1$c2FsdA$aGFzaA';
const tokenHash = (t: string) => createHash('sha256').update(t).digest();

let db: Db;
let owner: pg.Client;

interface Tenant {
  userId: string;
  orgId: string;
}
let acme: Tenant; // org A, owner
let beta: Tenant; // org B, owner

async function signUp(prefix: string): Promise<Tenant> {
  const slug = `${prefix}-${randomBytes(3).toString('hex')}`;
  return withAnonymous(db, (tx) =>
    repo.signUp(tx, { email: `${slug}@example.com`, displayName: prefix, passwordHash: HASH, orgName: prefix, orgSlug: slug }),
  );
}

/** Add an existing or new user to an org with a role, using the owner connection (test fixture only). */
async function addMember(orgId: string, role: repo.OrgRole): Promise<Tenant> {
  const email = `m-${randomBytes(4).toString('hex')}@example.com`;
  const u = await owner.query<{ id: string }>(`insert into users (email, display_name, password_hash) values ($1, 'Member', $2) returning id`, [email, HASH]);
  await owner.query('insert into memberships (org_id, user_id, role) values ($1, $2, $3)', [orgId, u.rows[0]!.id, role]);
  return { userId: u.rows[0]!.id, orgId };
}

const as = <T>(t: Tenant, fn: Parameters<typeof withTenant<T>>[2]) => withTenant(db, t, fn);

const newAnalysis = {
  name: 'Test deal',
  kind: 'wholesale_deal' as const,
  engineVersion: '1.0.0',
  inputs: { arv: 1 },
  report: { ok: true },
  inputsFingerprint: '0123456789abcdef',
};

d('database: tenancy, RBAC, audit (real Postgres, RLS enforced)', () => {
  beforeAll(async () => {
    db = createDb(inject('appUrl'));
    owner = new pg.Client({ connectionString: inject('ownerUrl') });
    await owner.connect();
    acme = await signUp('acme');
    beta = await signUp('beta');
  });

  afterAll(async () => {
    await db?.end();
    await owner?.end();
  });

  describe('role posture', () => {
    it('the app role cannot bypass RLS and does not own tables', async () => {
      const { rows } = await owner.query(`select rolbypassrls, rolsuper from pg_roles where rolname = 'northstar_test_app'`);
      expect(rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });
      const owners = await owner.query(`select distinct tableowner from pg_tables where schemaname = 'public'`);
      expect(owners.rows.map((r) => r.tableowner)).not.toContain('northstar_test_app');
    });
    it('every public table has RLS enabled and forced', async () => {
      const { rows } = await owner.query(`
        select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'schema_migrations'`);
      expect(rows.length).toBeGreaterThanOrEqual(10);
      for (const r of rows) expect({ table: r.relname, rls: r.relrowsecurity, force: r.relforcerowsecurity }).toEqual({ table: r.relname, rls: true, force: true });
    });
    it('the app role has no access to schema_migrations', async () => {
      await expect(withAnonymous(db, (tx) => tx.query('select * from schema_migrations'))).rejects.toThrow(/permission denied/);
    });
    it('re-running migrations is a no-op and edited migrations are rejected', async () => {
      const res = await migrate(inject('ownerUrl'), MIGRATIONS_DIR);
      expect(res.applied).toEqual([]);
      await owner.query(`update schema_migrations set checksum = 'tampered' where name = '0001_foundation.sql'`);
      await expect(migrate(inject('ownerUrl'), MIGRATIONS_DIR)).rejects.toThrow(/checksum mismatch/);
      const files = await (await import('../src/migrate')).loadMigrations(MIGRATIONS_DIR);
      await owner.query(`update schema_migrations set checksum = $1 where name = '0001_foundation.sql'`, [files[0]!.checksum]);
    });
  });

  describe('no context = no data', () => {
    it('anonymous transactions see no tenant rows', async () => {
      await as(acme, (tx) => repo.createAnalysis(tx, newAnalysis));
      const counts = await withAnonymous(db, async (tx) => ({
        orgs: (await tx.query('select * from organizations')).rowCount,
        users: (await tx.query('select * from users')).rowCount,
        analyses: (await tx.query('select * from underwriting_analyses')).rowCount,
        audit: (await tx.query('select * from audit_log')).rowCount,
      }));
      expect(counts).toEqual({ orgs: 0, users: 0, analyses: 0, audit: 0 });
    });
    it('anonymous transactions cannot insert tenant rows', async () => {
      await expect(
        withAnonymous(db, (tx) => tx.query(`insert into underwriting_analyses (org_id, name, kind, engine_version, inputs, report, inputs_fingerprint) values ($1, 'x', 'rental', '1', '{}', '{}', '0123456789abcdef')`, [acme.orgId])),
      ).rejects.toThrow(/row-level security/);
    });
  });

  describe('cross-tenant isolation', () => {
    let acmeAnalysis: string;
    beforeAll(async () => {
      acmeAnalysis = await as(acme, (tx) => repo.createAnalysis(tx, { ...newAnalysis, name: 'Acme secret deal' }));
    });

    it('a tenant only sees its own analyses', async () => {
      const mine = await as(acme, (tx) => repo.listAnalyses(tx));
      const theirs = await as(beta, (tx) => repo.listAnalyses(tx));
      expect(mine.map((a) => a.name)).toContain('Acme secret deal');
      expect(theirs.map((a) => a.name)).not.toContain('Acme secret deal');
      expect(await as(beta, (tx) => repo.getAnalysis(tx, acmeAnalysis))).toBeNull();
    });

    it('a query without any WHERE clause still only returns the current tenant', async () => {
      const rows = await as(beta, async (tx) => (await tx.query('select org_id from underwriting_analyses')).rows);
      expect(rows.every((r) => r.org_id === beta.orgId)).toBe(true);
    });

    it('a tenant cannot update or delete another tenant’s rows', async () => {
      const upd = await as(beta, (tx) => tx.query(`update underwriting_analyses set name = 'pwned' where id = $1`, [acmeAnalysis]));
      expect(upd.rowCount).toBe(0);
      const del = await as(beta, (tx) => repo.deleteAnalysis(tx, acmeAnalysis));
      expect(del).toBe(false);
      expect((await as(acme, (tx) => repo.getAnalysis(tx, acmeAnalysis)))?.name).toBe('Acme secret deal');
    });

    it('a tenant cannot insert rows into another tenant', async () => {
      await expect(
        as(beta, (tx) => tx.query(`insert into underwriting_analyses (org_id, name, kind, engine_version, inputs, report, inputs_fingerprint) values ($1, 'x', 'rental', '1', '{}', '{}', '0123456789abcdef')`, [acme.orgId])),
      ).rejects.toThrow(/row-level security/);
    });

    it('a tenant cannot move its row into another tenant', async () => {
      const id = await as(beta, (tx) => repo.createAnalysis(tx, newAnalysis));
      await expect(as(beta, (tx) => tx.query('update underwriting_analyses set org_id = $2 where id = $1', [id, acme.orgId]))).rejects.toThrow(/row-level security/);
    });

    it('forging app.org_id for an org the user is not a member of yields nothing', async () => {
      // beta's user claims acme's org: membership check in app.in_tenant() blocks it.
      const forged = { userId: beta.userId, orgId: acme.orgId };
      const rows = await withTenant(db, forged, async (tx) => (await tx.query('select * from underwriting_analyses')).rows);
      expect(rows).toEqual([]);
      await expect(withTenant(db, forged, (tx) => repo.createAnalysis(tx, newAnalysis))).rejects.toThrow(/row-level security/);
    });

    it('cross-tenant foreign keys are rejected', async () => {
      const prop = await as(acme, async (tx) =>
        (await tx.query<{ id: string }>(`insert into properties (address_line1, city, state, postal_code) values ('1 Main St', 'Austin', 'TX', '78701') returning id`)).rows[0]!.id,
      );
      await expect(as(beta, (tx) => repo.createAnalysis(tx, { ...newAnalysis, propertyId: prop }))).rejects.toThrow(/does not belong/);
      await expect(as(beta, (tx) => tx.query(`insert into leads (source, property_id) values ('web', $1)`, [prop]))).rejects.toThrow(/does not belong/);
    });

    it('users and memberships of other tenants are invisible', async () => {
      const users = await as(beta, async (tx) => (await tx.query('select id from users')).rows.map((r) => r.id));
      expect(users).toEqual([beta.userId]);
      const members = await as(beta, (tx) => repo.listMembers(tx));
      expect(members.map((m) => m.userId)).toEqual([beta.userId]);
      const orgs = await as(beta, (tx) => repo.listMyOrganizations(tx));
      expect(orgs.map((o) => o.id)).toEqual([beta.orgId]);
    });

    it('settings are transaction-local and never leak across pooled connections', async () => {
      await as(acme, async () => {});
      const leaked = await withAnonymous(db, async (tx) => (await tx.query(`select app.current_user_id() u, app.current_org_id() o`)).rows[0]);
      expect(leaked).toEqual({ u: null, o: null });
    });

    it('concurrent requests for different tenants stay isolated', async () => {
      const runs = await Promise.all(
        Array.from({ length: 20 }, (_, i) => {
          const t = i % 2 === 0 ? acme : beta;
          return as(t, async (tx) => {
            await tx.query('select pg_sleep(0.01)');
            const { rows } = await tx.query('select distinct org_id from underwriting_analyses');
            return { expected: t.orgId, seen: rows.map((r) => r.org_id) };
          });
        }),
      );
      for (const r of runs) expect(r.seen).toEqual([r.expected]);
    });
  });

  describe('role-based permissions', () => {
    let viewer: Tenant;
    let analyst: Tenant;
    let admin: Tenant;
    beforeAll(async () => {
      viewer = await addMember(acme.orgId, 'viewer');
      analyst = await addMember(acme.orgId, 'analyst');
      admin = await addMember(acme.orgId, 'admin');
    });

    it('viewers can read but not write', async () => {
      expect((await as(viewer, (tx) => repo.listAnalyses(tx))).length).toBeGreaterThan(0);
      await expect(as(viewer, (tx) => repo.createAnalysis(tx, newAnalysis))).rejects.toThrow(/row-level security/);
    });

    it('analysts can create but not delete', async () => {
      const id = await as(analyst, (tx) => repo.createAnalysis(tx, newAnalysis));
      expect(await as(analyst, (tx) => repo.deleteAnalysis(tx, id))).toBe(false);
      expect(await as(acme, (tx) => repo.deleteAnalysis(tx, id))).toBe(true);
    });

    it('only owners/admins read the audit log', async () => {
      expect((await as(analyst, (tx) => repo.listAudit(tx))).length).toBe(0);
      expect((await as(admin, (tx) => repo.listAudit(tx))).length).toBeGreaterThan(0);
    });

    it('only owners/admins manage memberships, and only owners grant owner', async () => {
      expect(await as(analyst, (tx) => repo.updateMemberRole(tx, viewer.userId, 'manager'))).toBe(false);
      expect(await as(admin, (tx) => repo.updateMemberRole(tx, viewer.userId, 'acquisitions'))).toBe(true);
      await expect(as(admin, (tx) => repo.updateMemberRole(tx, viewer.userId, 'owner'))).rejects.toThrow(/only an owner/);
      expect(await as(acme, (tx) => repo.updateMemberRole(tx, viewer.userId, 'viewer'))).toBe(true);
    });

    it('an organization can never lose its last owner', async () => {
      await expect(as(acme, (tx) => repo.updateMemberRole(tx, acme.userId, 'admin'))).rejects.toThrow(/at least one active owner/);
      await expect(as(acme, (tx) => tx.query('delete from memberships where user_id = $1 and org_id = $2', [acme.userId, acme.orgId]))).rejects.toThrow(/at least one active owner/);
    });

    it('suspended members lose access immediately', async () => {
      const temp = await addMember(acme.orgId, 'analyst');
      await owner.query(`update memberships set status = 'suspended' where user_id = $1`, [temp.userId]);
      expect(await as(temp, (tx) => repo.listAnalyses(tx))).toEqual([]);
    });

    it('any member, including a viewer, can record an opt-out', async () => {
      await as(viewer, (tx) => tx.query(`insert into communication_suppressions (channel, address, reason) values ('sms', '+15125550100', 'opt_out')`));
      expect(await as(acme, (tx) => repo.isSuppressed(tx, 'sms', '+15125550100'))).toBe(true);
      expect(await as(beta, (tx) => repo.isSuppressed(tx, 'sms', '+15125550100'))).toBe(false);
    });
  });

  describe('audit log', () => {
    it('row changes are audited automatically with changed columns, not values', async () => {
      const id = await as(acme, (tx) => repo.createAnalysis(tx, { ...newAnalysis, name: 'Audited' }));
      await as(acme, (tx) => tx.query(`update underwriting_analyses set name = 'Audited v2' where id = $1`, [id]));
      const entries = (await as(acme, (tx) => repo.listAudit(tx))).filter((e) => e.targetId === id);
      expect(entries.map((e) => e.action).sort()).toEqual(['underwriting_analyses.insert', 'underwriting_analyses.update']);
      const upd = entries.find((e) => e.action.endsWith('update'))!;
      expect(upd.metadata).toEqual({ changed: ['name'] });
      expect(upd.actorUserId).toBe(acme.userId);
      expect(JSON.stringify(upd.metadata)).not.toContain('Audited v2');
    });

    it('records the request id from the tenant context', async () => {
      const requestId = `req_${randomUUID()}`;
      const id = await withTenant(db, { ...acme, requestId }, (tx) => repo.createAnalysis(tx, newAnalysis));
      const e = (await as(acme, (tx) => repo.listAudit(tx))).find((x) => x.targetId === id)!;
      expect(e.requestId).toBe(requestId);
    });

    it('is append-only even for the table owner', async () => {
      await expect(as(acme, (tx) => tx.query('update audit_log set action = $1', ['x.y']))).rejects.toThrow(/permission denied|append-only/);
      await expect(as(acme, (tx) => tx.query('delete from audit_log'))).rejects.toThrow(/permission denied|append-only/);
      await expect(owner.query('update audit_log set action = $1', ['x.y'])).rejects.toThrow(/append-only/);
      await expect(owner.query('delete from audit_log')).rejects.toThrow(/append-only/);
      await expect(owner.query('truncate audit_log')).rejects.toThrow(/append-only/);
    });

    it('members cannot forge entries attributed to someone else or another org', async () => {
      await expect(
        as(acme, (tx) => tx.query(`insert into audit_log (org_id, actor_type, actor_user_id, action) values ($1, 'user', $2, 'fake.entry')`, [acme.orgId, beta.userId])),
      ).rejects.toThrow(/row-level security/);
      await expect(
        as(acme, (tx) => tx.query(`insert into audit_log (org_id, actor_type, actor_user_id, action) values ($1, 'user', $2, 'fake.entry')`, [beta.orgId, acme.userId])),
      ).rejects.toThrow(/row-level security/);
      await as(acme, (tx) => repo.recordAudit(tx, { action: 'report.export', targetType: 'underwriting_analysis', targetId: 'x' }));
    });
  });

  describe('finalized analyses', () => {
    it('freeze inputs and report once final', async () => {
      const id = await as(acme, (tx) => repo.createAnalysis(tx, newAnalysis));
      await as(acme, (tx) => repo.setAnalysisStatus(tx, id, 'final'));
      await expect(as(acme, (tx) => tx.query(`update underwriting_analyses set report = '{}' where id = $1`, [id]))).rejects.toThrow(/immutable/);
      expect(await as(acme, (tx) => repo.setAnalysisStatus(tx, id, 'archived'))).toBe(true);
    });
  });

  describe('sessions', () => {
    it('create, resolve, switch org, and revoke', async () => {
      const token = randomBytes(32).toString('base64url');
      const s = await withAnonymous(db, (tx) => repo.createSession(tx, { userId: acme.userId, tokenHash: tokenHash(token), ttlSeconds: 3600, ip: '203.0.113.5', userAgent: 'vitest' }));
      expect(s.activeOrgId).toBe(acme.orgId);
      const r = await withAnonymous(db, (tx) => repo.resolveSession(tx, tokenHash(token)));
      expect(r).toMatchObject({ userId: acme.userId, activeOrgId: acme.orgId, role: 'owner' });

      const second = await withUser(db, acme.userId, (tx) => repo.createOrganization(tx, 'Acme Holdings', `acme-holdings-${randomBytes(2).toString('hex')}`));
      expect(await withUser(db, acme.userId, (tx) => repo.switchSessionOrg(tx, s.sessionId, second))).toBe(true);
      expect(await withUser(db, acme.userId, (tx) => repo.switchSessionOrg(tx, s.sessionId, beta.orgId))).toBe(false);
      expect((await withAnonymous(db, (tx) => repo.resolveSession(tx, tokenHash(token))))?.activeOrgId).toBe(second);

      expect(await withUser(db, beta.userId, (tx) => repo.revokeSession(tx, s.sessionId))).toBe(false);
      expect(await withUser(db, acme.userId, (tx) => repo.revokeSession(tx, s.sessionId))).toBe(true);
      expect(await withAnonymous(db, (tx) => repo.resolveSession(tx, tokenHash(token)))).toBeNull();
    });

    it('unknown, expired, and disabled-user sessions do not resolve', async () => {
      expect(await withAnonymous(db, (tx) => repo.resolveSession(tx, tokenHash('nope')))).toBeNull();
      const t = await addMember(beta.orgId, 'analyst');
      const token = 'expired-token';
      await withAnonymous(db, (tx) => repo.createSession(tx, { userId: t.userId, tokenHash: tokenHash(token), ttlSeconds: 60 }));
      await owner.query(`update sessions set expires_at = now() - interval '1 second' where token_hash = $1`, [tokenHash(token)]);
      expect(await withAnonymous(db, (tx) => repo.resolveSession(tx, tokenHash(token)))).toBeNull();
      const token2 = 'disabled-user';
      await withAnonymous(db, (tx) => repo.createSession(tx, { userId: t.userId, tokenHash: tokenHash(token2), ttlSeconds: 60 }));
      await owner.query(`update users set status = 'disabled' where id = $1`, [t.userId]);
      expect(await withAnonymous(db, (tx) => repo.resolveSession(tx, tokenHash(token2)))).toBeNull();
    });

    it('rejects absurd session lifetimes', async () => {
      await expect(withAnonymous(db, (tx) => repo.createSession(tx, { userId: acme.userId, tokenHash: tokenHash('long'), ttlSeconds: 90 * 86400 }))).rejects.toThrow(/ttl/);
    });

    it('the app role cannot read session token hashes of other users', async () => {
      const rows = await withUser(db, beta.userId, async (tx) => (await tx.query('select user_id from sessions')).rows);
      expect(rows.every((r) => r.user_id === beta.userId)).toBe(true);
    });
  });

  describe('sign-up validation', () => {
    it('rejects duplicate emails and slugs atomically', async () => {
      const slug = `dup-${randomBytes(3).toString('hex')}`;
      await withAnonymous(db, (tx) => repo.signUp(tx, { email: `${slug}@example.com`, displayName: 'A', passwordHash: HASH, orgName: 'A', orgSlug: slug }));
      await expect(withAnonymous(db, (tx) => repo.signUp(tx, { email: `${slug}@example.com`, displayName: 'B', passwordHash: HASH, orgName: 'B', orgSlug: `${slug}-2` }))).rejects.toThrow(/duplicate key/);
      await expect(withAnonymous(db, (tx) => repo.signUp(tx, { email: `other-${slug}@example.com`, displayName: 'B', passwordHash: HASH, orgName: 'B', orgSlug: slug }))).rejects.toThrow(/duplicate key/);
      const orphan = await owner.query('select 1 from users where email = $1', [`other-${slug}@example.com`]);
      expect(orphan.rowCount).toBe(0);
    });
    it('rejects plaintext passwords and invalid slugs', async () => {
      await expect(withAnonymous(db, (tx) => repo.signUp(tx, { email: 'p@example.com', displayName: 'P', passwordHash: 'hunter2', orgName: 'P', orgSlug: 'p-org' }))).rejects.toThrow(/scrypt/);
      await expect(withAnonymous(db, (tx) => repo.signUp(tx, { email: 'q@example.com', displayName: 'Q', passwordHash: HASH, orgName: 'Q', orgSlug: 'Bad Slug!' }))).rejects.toThrow(/check constraint/);
    });
  });

  describe('usage metering', () => {
    it('is idempotent per organization', async () => {
      const key = `evt_${randomUUID()}`;
      expect(await as(acme, (tx) => repo.recordUsage(tx, { meter: 'underwriting.run', quantity: 1, idempotencyKey: key }))).toBe(true);
      expect(await as(acme, (tx) => repo.recordUsage(tx, { meter: 'underwriting.run', quantity: 1, idempotencyKey: key }))).toBe(false);
      expect(await as(beta, (tx) => repo.recordUsage(tx, { meter: 'underwriting.run', quantity: 1, idempotencyKey: key }))).toBe(true);
      const n = await as(acme, async (tx) => (await tx.query('select count(*)::int n from usage_events where idempotency_key = $1', [key])).rows[0].n);
      expect(n).toBe(1);
    });
  });
});
