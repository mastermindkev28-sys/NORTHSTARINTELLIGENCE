import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineWorkflowStoreContract } from "@northstar/workflows";
import { createTestDatabase, isDatabaseAvailable, ORG_A, ORG_B, type TestDatabase } from "./testDb";
import { migrate } from "./migrate";
import { withTenant } from "./tenant";
import { PostgresWorkflowStore } from "./workflowStore";

const available = await isDatabaseAvailable();
if (!available && process.env.CI) throw new Error("Database tests require DATABASE_URL in CI");
const suite = available ? describe : describe.skip;

suite("postgres foundation", () => {
  let db: TestDatabase;
  beforeAll(async () => {
    db = await createTestDatabase();
  });
  afterAll(async () => {
    await db?.close();
  });

  describe("migrations", () => {
    it("are idempotent", async () => {
      const c = await db.admin.connect();
      try {
        expect(await migrate(c)).toEqual([]);
      } finally {
        c.release();
      }
    });
    it("refuse to run when an applied migration was modified", async () => {
      const c = await db.admin.connect();
      try {
        await c.query("UPDATE app.schema_migrations SET checksum = 'tampered' WHERE name = '0001_foundation.sql'");
        await expect(migrate(c)).rejects.toThrow(/modified after being applied/);
      } finally {
        await c.query("UPDATE app.schema_migrations SET checksum = $1 WHERE name = '0001_foundation.sql'", [
          (await import("node:crypto")).createHash("sha256").update(await (await import("node:fs/promises")).readFile(new URL("../migrations/0001_foundation.sql", import.meta.url), "utf8")).digest("hex"),
        ]);
        c.release();
      }
    });
  });

  describe("row-level security", () => {
    it("isolates tenants on read and write", async () => {
      const leadA = await withTenant(db.app, ORG_A, async (c) => (await c.query("INSERT INTO leads (organization_id, source) VALUES ($1, 'ppc') RETURNING id", [ORG_A])).rows[0].id);
      await withTenant(db.app, ORG_B, (c) => c.query("INSERT INTO leads (organization_id, source) VALUES ($1, 'seo')", [ORG_B]));

      const seenByA = await withTenant(db.app, ORG_A, async (c) => (await c.query("SELECT id, organization_id FROM leads")).rows);
      expect(seenByA).toHaveLength(1);
      expect(seenByA[0].id).toBe(leadA);
      const seenByB = await withTenant(db.app, ORG_B, async (c) => (await c.query("SELECT id FROM leads WHERE id = $1", [leadA])).rows);
      expect(seenByB).toHaveLength(0);
    });

    it("blocks cross-tenant inserts and updates", async () => {
      await expect(withTenant(db.app, ORG_A, (c) => c.query("INSERT INTO leads (organization_id, source) VALUES ($1, 'ppc')", [ORG_B]))).rejects.toThrow(/row-level security/);
      const updated = await withTenant(db.app, ORG_B, async (c) => (await c.query("UPDATE leads SET status = 'dead' WHERE source = 'ppc'")).rowCount);
      expect(updated).toBe(0);
      await expect(withTenant(db.app, ORG_A, (c) => c.query("UPDATE leads SET organization_id = $1", [ORG_B]))).rejects.toThrow(/row-level security/);
    });

    it("fails closed without tenant context", async () => {
      const c = await db.app.connect();
      try {
        expect((await c.query("SELECT * FROM leads")).rowCount).toBe(0);
        expect((await c.query("SELECT * FROM organizations")).rowCount).toBe(0);
        await expect(c.query("INSERT INTO leads (organization_id, source) VALUES ($1, 'ppc')", [ORG_A])).rejects.toThrow(/row-level security/);
      } finally {
        c.release();
      }
    });

    it("tenant context does not leak across pooled connections", async () => {
      await withTenant(db.app, ORG_A, (c) => c.query("SELECT 1"));
      const c = await db.app.connect();
      try {
        const r = await c.query("SELECT current_setting('app.org_id', true) AS org");
        expect(r.rows[0].org ?? "").toBe("");
      } finally {
        c.release();
      }
    });

    it("organizations are visible only to themselves", async () => {
      const orgs = await withTenant(db.app, ORG_A, async (c) => (await c.query("SELECT slug FROM organizations")).rows.map((r) => r.slug));
      expect(orgs).toEqual(["alpha"]);
    });

    it("rejects malformed tenant ids before touching the database", async () => {
      await expect(withTenant(db.app, "'; DROP TABLE leads; --", (c) => c.query("SELECT 1"))).rejects.toThrow(/Invalid organization id/);
    });

    it("every table with organization_id has forced RLS and a policy", async () => {
      const r = await db.admin.query(`
        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
               (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS policies
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
           AND EXISTS (SELECT 1 FROM information_schema.columns col WHERE col.table_name = c.relname AND col.column_name = 'organization_id')`);
      expect(r.rows.length).toBeGreaterThan(20);
      for (const row of r.rows) {
        expect({ table: row.relname, rls: row.relrowsecurity, forced: row.relforcerowsecurity, hasPolicy: Number(row.policies) > 0 }).toEqual({ table: row.relname, rls: true, forced: true, hasPolicy: true });
      }
    });
  });

  describe("integrity constraints", () => {
    it("audit log is append-only for the app role and even for the owner", async () => {
      await withTenant(db.app, ORG_A, (c) => c.query("INSERT INTO audit_log (organization_id, actor_type, actor_id, action, target_type, target_id) VALUES ($1, 'user', 'u1', 'lead.created', 'lead', 'x')", [ORG_A]));
      await expect(withTenant(db.app, ORG_A, (c) => c.query("UPDATE audit_log SET action = 'tampered'"))).rejects.toThrow(/permission denied/);
      await expect(withTenant(db.app, ORG_A, (c) => c.query("DELETE FROM audit_log"))).rejects.toThrow(/permission denied/);
      await expect(db.admin.query("DELETE FROM audit_log")).rejects.toThrow(/append-only/);
    });

    it("estimates and AI interpretations must carry a confidence score", async () => {
      await withTenant(db.app, ORG_A, async (c) => {
        const p = (await c.query("INSERT INTO properties (organization_id, address_key, line1, city, state, zip5) VALUES ($1, 'k', '1 MAIN ST', 'X', 'IL', '60601') RETURNING id", [ORG_A])).rows[0].id;
        await c.query("SAVEPOINT s");
        await expect(c.query("INSERT INTO property_facts (organization_id, property_id, field, value, origin, source_system, retrieved_at) VALUES ($1,$2,'avm','250000','third_party_estimate','mock',now())", [ORG_A, p])).rejects.toThrow(/check constraint/);
        await c.query("ROLLBACK TO SAVEPOINT s");
        await c.query("INSERT INTO property_facts (organization_id, property_id, field, value, origin, source_system, retrieved_at, confidence) VALUES ($1,$2,'avm','250000','third_party_estimate','mock',now(), 0.7)", [ORG_A, p]);
      });
    });

    it("express written consent requires the disclosure text", async () => {
      await expect(withTenant(db.app, ORG_A, (c) => c.query("INSERT INTO consent_records (organization_id, phone_e164, channel, kind, captured_at, source) VALUES ($1, '+13125550142', 'sms', 'express_written', now(), 'web_form')", [ORG_A]))).rejects.toThrow(/check constraint/);
    });

    it("the app role cannot create or modify global identities", async () => {
      await expect(withTenant(db.app, ORG_A, (c) => c.query("INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'x@y.z')"))).rejects.toThrow(/permission denied/);
    });
  });

  describe("PostgresWorkflowStore", () => {
    defineWorkflowStoreContract(
      { describe, it, expect, beforeEach },
      async () => {
        await db.admin.query("TRUNCATE events, workflow_runs, workflow_steps, workflow_logs, dead_letters, approvals CASCADE");
        return new PostgresWorkflowStore(db.app);
      },
      { a: ORG_A, b: ORG_B },
    );
  });
});
