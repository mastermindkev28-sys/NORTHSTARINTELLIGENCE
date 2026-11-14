import { randomBytes } from "node:crypto";
import pg from "pg";
import { migrate } from "./migrate";

export const ORG_A = "11111111-1111-4111-8111-111111111111";
export const ORG_B = "22222222-2222-4222-8222-222222222222";

export interface TestDatabase {
  name: string;
  /** Superuser/owner pool (bypasses RLS) — use only for setup and assertions about raw state. */
  admin: pg.Pool;
  /** Application-role pool (RLS enforced). */
  app: pg.Pool;
  close(): Promise<void>;
}

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgres://northstar:northstar@localhost:54329/northstar";
const APP_TEST_PASSWORD = "northstar_app_test";

export async function isDatabaseAvailable(): Promise<boolean> {
  const c = new pg.Client({ connectionString: ADMIN_URL, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
}

/** Creates an isolated database, applies all migrations, and seeds two organizations. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `northstar_test_${randomBytes(4).toString("hex")}`;
  const root = new pg.Client({ connectionString: ADMIN_URL });
  await root.connect();
  await root.query(`CREATE DATABASE ${name}`);
  await root.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const admin = new pg.Pool({ connectionString: url.toString(), max: 4 });
  const c = await admin.connect();
  try {
    await migrate(c);
    // Test-only: allow the application role to log in. Production uses managed credentials.
    await c.query(`ALTER ROLE northstar_app LOGIN PASSWORD '${APP_TEST_PASSWORD}'`);
    await c.query(
      `INSERT INTO organizations (id, name, slug, business_name) VALUES ($1, 'Alpha Acquisitions', 'alpha', 'Alpha Homes'), ($2, 'Beta Investments', 'beta', 'Beta Buys')`,
      [ORG_A, ORG_B],
    );
  } finally {
    c.release();
  }
  const appUrl = new URL(url.toString());
  appUrl.username = "northstar_app";
  appUrl.password = APP_TEST_PASSWORD;
  const app = new pg.Pool({ connectionString: appUrl.toString(), max: 8 });

  return {
    name,
    admin,
    app,
    async close() {
      await app.end();
      await admin.end();
      const r = new pg.Client({ connectionString: ADMIN_URL });
      await r.connect();
      await r.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await r.end();
    },
  };
}
