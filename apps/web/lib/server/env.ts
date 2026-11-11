import 'server-only';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. See .env.example and docs/DEPLOYMENT_GUIDE.md.`);
  return v;
}

/**
 * The app must connect as a non-owner login role (RLS is forced, never bypassed). Hosted Postgres
 * integrations (e.g. Neon on Vercel) inject DATABASE_URL as the owner role, so when APP_DB_ROLE and
 * APP_DB_PASSWORD are set the same host/database is used with the app role's credentials instead.
 * APP_DATABASE_URL, if set, always wins.
 */
function appDatabaseUrl(): string {
  if (process.env.APP_DATABASE_URL) return process.env.APP_DATABASE_URL;
  const base = required('DATABASE_URL');
  const role = process.env.APP_DB_ROLE;
  const password = process.env.APP_DB_PASSWORD;
  if (!role || !password) return base;
  const u = new URL(base);
  u.username = encodeURIComponent(role);
  u.password = encodeURIComponent(password);
  return u.toString();
}

export const env = {
  get databaseUrl() {
    return appDatabaseUrl();
  },
  propertyProvider: process.env.PROPERTY_DATA_PROVIDER ?? 'mock',
  /** 'demo' (bundled, labeled demo dataset + cited pilot law) or 'db' (geo reference tables from migration 0005). */
  marketDataSource: process.env.MARKET_DATA_SOURCE === 'db' ? ('db' as const) : ('demo' as const),
  isProduction: process.env.NODE_ENV === 'production',
};
