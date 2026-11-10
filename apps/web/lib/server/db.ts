import 'server-only';
import { createDb, type Db } from '@northstar/db';
import { createLogger } from '@northstar/core';
import { env } from './env';

const globalForDb = globalThis as unknown as { __northstarDb?: Db };

export function db(): Db {
  if (!globalForDb.__northstarDb) globalForDb.__northstarDb = createDb(env.databaseUrl);
  return globalForDb.__northstarDb;
}

export const log = createLogger({ service: 'web' });
