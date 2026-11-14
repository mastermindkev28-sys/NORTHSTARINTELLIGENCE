import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

export const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

export interface AppliedMigration {
  name: string;
  checksum: string;
}

/**
 * Applies pending SQL migrations in lexical order, each in its own transaction, under an advisory lock so
 * concurrent deploys cannot race. Refuses to proceed if an applied migration's checksum has changed.
 */
export async function migrate(
  client: pg.Client | pg.PoolClient,
  dir = MIGRATIONS_DIR,
): Promise<string[]> {
  await client.query("CREATE SCHEMA IF NOT EXISTS app");
  await client.query(`CREATE TABLE IF NOT EXISTS app.schema_migrations (
    name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  await client.query("SELECT pg_advisory_lock(727274)");
  try {
    const files = (await readdir(dir)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
    const applied = new Map<string, string>(
      (
        await client.query<AppliedMigration>("SELECT name, checksum FROM app.schema_migrations")
      ).rows.map((r) => [r.name, r.checksum]),
    );
    const newlyApplied: string[] = [];
    for (const file of files) {
      const sql = await readFile(path.join(dir, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const prior = applied.get(file);
      if (prior) {
        if (prior !== checksum)
          throw new Error(
            `Migration ${file} was modified after being applied. Create a new migration instead.`,
          );
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO app.schema_migrations (name, checksum) VALUES ($1, $2)", [
          file,
          checksum,
        ]);
        await client.query("COMMIT");
        newlyApplied.push(file);
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(e as Error).message}`, { cause: e });
      }
    }
    return newlyApplied;
  } finally {
    await client.query("SELECT pg_advisory_unlock(727274)");
  }
}
