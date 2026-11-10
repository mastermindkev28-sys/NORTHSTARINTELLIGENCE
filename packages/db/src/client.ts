/**
 * Tenant-scoped database access.
 *
 * All application queries run inside `withTenant`, which opens a transaction and sets the
 * transaction-local settings that RLS policies read (app.user_id, app.org_id, app.request_id).
 * Because the settings are transaction-local (`set_config(..., true)`), they can never leak to the
 * next request that reuses the pooled connection.
 */
import pg from 'pg';

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

export interface TenantContext {
  userId: string;
  orgId: string;
  requestId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createDb(connectionString: string, max = 10): Db {
  const pool = new pg.Pool({ connectionString, max, idleTimeoutMillis: 30_000, statement_timeout: 15_000 });
  pool.on('error', (err) => {
    // Idle client errors must not crash the process; surface them to the logger.
    console.error(JSON.stringify({ level: 'error', msg: 'pg pool idle client error', err: err.message }));
  });
  return pool;
}

async function inTransaction<T>(db: Db, setup: (tx: Tx) => Promise<void>, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tx = await db.connect();
  try {
    await tx.query('begin');
    await setup(tx);
    const out = await fn(tx);
    await tx.query('commit');
    return out;
  } catch (err) {
    await tx.query('rollback').catch(() => {});
    throw err;
  } finally {
    tx.release();
  }
}

/** Run `fn` as `ctx.userId` acting within `ctx.orgId`. RLS enforces isolation and role permissions. */
export function withTenant<T>(db: Db, ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(ctx.userId)) throw new Error('withTenant: userId must be a UUID');
  if (!UUID_RE.test(ctx.orgId)) throw new Error('withTenant: orgId must be a UUID');
  return inTransaction(
    db,
    async (tx) => {
      await tx.query(
        `select set_config('app.user_id', $1, true), set_config('app.org_id', $2, true), set_config('app.request_id', $3, true)`,
        [ctx.userId, ctx.orgId, ctx.requestId ?? ''],
      );
    },
    fn,
  );
}

/** Authenticated but not yet inside an organization (e.g. org switcher, creating a first org). */
export function withUser<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(userId)) throw new Error('withUser: userId must be a UUID');
  return inTransaction(db, async (tx) => {
    await tx.query(`select set_config('app.user_id', $1, true)`, [userId]);
  }, fn);
}

/** No identity: only the security-definer auth functions are usable. */
export function withAnonymous<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inTransaction(db, async () => {}, fn);
}
