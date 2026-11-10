/**
 * Provider selection. There is deliberately NO silent fallback from a real provider to demo data:
 * if a configured provider fails, the error surfaces. Demo data is used only when explicitly chosen.
 */
import { MockPropertyProvider } from './mock';
import { RentCastProvider } from './rentcast';
import { ProviderError, type PropertyDataProvider, type UsageMeter } from './types';

export interface ProviderEnv {
  PROPERTY_DATA_PROVIDER?: string;
  RENTCAST_API_KEY?: string;
  REALIE_API_KEY?: string;
}

export function createPropertyProvider(env: ProviderEnv, meter?: UsageMeter): PropertyDataProvider {
  const choice = env.PROPERTY_DATA_PROVIDER ?? 'mock';
  switch (choice) {
    case 'mock':
      return new MockPropertyProvider();
    case 'rentcast':
      return new RentCastProvider({ apiKey: env.RENTCAST_API_KEY ?? '', ...(meter ? { meter } : {}) });
    case 'realie':
      throw new ProviderError('realie', 'not_configured', 'Realie adapter is planned (primary launch provider); awaiting API credentials and live schema verification.');
    default:
      throw new ProviderError('mock', 'not_configured', `Unknown PROPERTY_DATA_PROVIDER "${choice}"`);
  }
}

/**
 * When two providers disagree, keep both values side by side. Resolution (which value the operator
 * accepts) is an explicit, audited user action, never an automatic merge.
 */
export function collectFieldValues<T>(fields: { provider: string; field: { value: T | null } }[]): { provider: string; value: T }[] {
  return fields.filter((f) => f.field.value !== null).map((f) => ({ provider: f.provider, value: f.field.value as T }));
}
