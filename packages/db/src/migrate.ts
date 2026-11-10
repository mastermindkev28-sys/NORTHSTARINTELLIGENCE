/**
 * Minimal, dependency-free migration runner.
 *  - Applies migrations/NNNN_name.sql in lexical order, each in its own transaction.
 *  - Records name + SHA-256 checksum in public.schema_migrations; refuses to run if an applied file changed.
 *  - Serializes concurrent runners with a transaction-scoped advisory lock.
 * Runs as the schema owner (DATABASE_OWNER_URL), never as the application role.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const LOCK_KEY = 7_340_021_118; // arbitrary constant for pg_advisory_xact_lock

export interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

export async function loadMigrations(dir: string): Promise<MigrationFile[]> {
  const files = (await readdir(dir)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(join(dir, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    }),
  );
}

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

export async function migrate(connectionString: string, dir: string, log: (m: string) => void = () => {}): Promise<MigrateResult> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const result: MigrateResult = { applied: [], skipped: [] };
  try {
    await client.query(`create table if not exists public.schema_migrations (
      name text primary key, checksum text not null, applied_at timestamptz not null default now())`);
    const files = await loadMigrations(dir);
    for (const file of files) {
      await client.query('begin');
      try {
        await client.query('select pg_advisory_xact_lock($1)', [LOCK_KEY]);
        const { rows } = await client.query<{ checksum: string }>('select checksum from public.schema_migrations where name = $1', [file.name]);
        if (rows[0]) {
          if (rows[0].checksum !== file.checksum) {
            throw new Error(`Migration ${file.name} was modified after being applied (checksum mismatch). Create a new migration instead.`);
          }
          result.skipped.push(file.name);
          await client.query('commit');
          continue;
        }
        await client.query(file.sql);
        await client.query('insert into public.schema_migrations (name, checksum) values ($1, $2)', [file.name, file.checksum]);
        await client.query('commit');
        result.applied.push(file.name);
        log(`applied ${file.name}`);
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }
    return result;
  } finally {
    await client.end();
  }
}
