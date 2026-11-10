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
  isProduction: process.env.NODE_ENV === 'production',
};
