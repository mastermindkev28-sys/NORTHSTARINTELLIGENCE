/**
 * Usage: DATABASE_OWNER_URL=postgres://owner@host/db pnpm db:migrate
 * Optionally provisions the application login role when APP_DB_ROLE / APP_DB_PASSWORD are set
 * (local development and CI only; production roles are provisioned by infrastructure).
 */
import pg from 'pg';
import { migrate } from '../src/migrate.js';
import { MIGRATIONS_DIR } from '../src/paths.js';

const url = process.env.DATABASE_OWNER_URL;
if (!url) {
  console.error('DATABASE_OWNER_URL is required');
  process.exit(1);
}
const res = await migrate(url, MIGRATIONS_DIR, (m) => console.log(m));
console.log(JSON.stringify({ level: 'info', msg: 'migrations complete', applied: res.applied.length, skipped: res.skipped.length }));

const role = process.env.APP_DB_ROLE;
const password = process.env.APP_DB_PASSWORD;
if (role && password) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(role)) throw new Error('APP_DB_ROLE must be a simple identifier');
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const exists = await c.query('select 1 from pg_roles where rolname = $1', [role]);
  const lit = (await c.query<{ q: string }>('select quote_literal($1) as q', [password])).rows[0]!.q;
  if (exists.rowCount === 0) await c.query(`create role ${role} login nobypassrls password ${lit} in role northstar_app`);
  else await c.query(`alter role ${role} login nobypassrls password ${lit}`);
  await c.query(`grant northstar_app to ${role}`);
  await c.end();
  console.log(JSON.stringify({ level: 'info', msg: 'application role ready', role }));
}
