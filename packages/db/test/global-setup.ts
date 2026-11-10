/**
 * Creates a fresh, isolated test database, applies all migrations as the owner, and provisions a
 * non-owner login role in northstar_app so tests exercise RLS exactly as production does.
 *
 * Requires TEST_DATABASE_ADMIN_URL (a superuser/owner connection to any database on the server),
 * defaulting to postgres://postgres@localhost:5432/postgres. If Postgres is unreachable the DB tests
 * are skipped with a clear message (CI always provides a Postgres service).
 */
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { migrate } from '../src/migrate.js';
import { MIGRATIONS_DIR } from '../src/paths.js';

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? 'postgres://postgres@localhost:5432/postgres';
const DB_NAME = `northstar_test_${process.pid}`;
const APP_ROLE = 'northstar_test_app';
const APP_PASSWORD = 'test-only-password';

export default async function setup(project: TestProject) {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await admin.connect();
  } catch (e) {
    console.warn(`\n[db tests] Postgres not reachable at ${ADMIN_URL} (${(e as Error).message}); DB tests will be skipped.\n`);
    project.provide('dbAvailable', false);
    return;
  }
  await admin.query(`drop database if exists ${DB_NAME}`);
  await admin.query(`create database ${DB_NAME}`);
  const exists = await admin.query('select 1 from pg_roles where rolname = $1', [APP_ROLE]);
  if (exists.rowCount === 0) {
    await admin.query(`create role ${APP_ROLE} login nobypassrls password '${APP_PASSWORD}'`);
  }
  const ownerUrl = withDb(ADMIN_URL, DB_NAME);
  await migrate(ownerUrl, MIGRATIONS_DIR);
  const owner = new pg.Client({ connectionString: ownerUrl });
  await owner.connect();
  await owner.query(`grant northstar_app to ${APP_ROLE}`);
  await owner.end();

  const appUrl = new URL(ownerUrl);
  appUrl.username = APP_ROLE;
  appUrl.password = APP_PASSWORD;
  project.provide('dbAvailable', true);
  project.provide('ownerUrl', ownerUrl);
  project.provide('appUrl', appUrl.toString());

  return async () => {
    await admin.query(`drop database if exists ${DB_NAME} with (force)`);
    await admin.end();
  };
}

function withDb(url: string, db: string) {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

declare module 'vitest' {
  export interface ProvidedContext {
    dbAvailable: boolean;
    ownerUrl: string;
    appUrl: string;
  }
}
