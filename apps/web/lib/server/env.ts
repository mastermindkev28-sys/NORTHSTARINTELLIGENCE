import 'server-only';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. See .env.example and docs/DEPLOYMENT_GUIDE.md.`);
  return v;
}

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  propertyProvider: process.env.PROPERTY_DATA_PROVIDER ?? 'mock',
  /** 'demo' (bundled, labeled demo dataset + cited pilot law) or 'db' (geo reference tables from migration 0005). */
  marketDataSource: process.env.MARKET_DATA_SOURCE === 'db' ? ('db' as const) : ('demo' as const),
  isProduction: process.env.NODE_ENV === 'production',
};
