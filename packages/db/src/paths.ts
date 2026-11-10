import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
