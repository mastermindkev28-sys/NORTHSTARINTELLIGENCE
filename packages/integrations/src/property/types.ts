/**
 * Property data provider contract. Shaped by docs/DATA_PROVIDER_EVALUATION.md:
 *  - every field carries provenance (provider, record id, retrieval time, confidence, license tag)
 *  - missing fields are null WITH a reason; nothing is invented to fill gaps
 *  - when providers disagree, each value is kept (no silent merging); resolution is a separate, explicit step
 *  - every call is metered per tenant because provider pricing counts lookups
 */

export type ProviderId = 'mock' | 'rentcast' | 'realie' | 'attom' | 'batchdata';

export interface FieldProvenance {
  provider: ProviderId;
  providerRecordId: string | null;
  retrievedAt: string; // ISO-8601
  /** 0–1. Provider-supplied where available, otherwise the adapter's documented default. */
  confidence: number;
  /** Key into the license registry that governs caching/display/redistribution for this value. */
  licenseTag: string;
}

export type ProvidedField<T> =
  | { value: T; provenance: FieldProvenance }
  | { value: null; reason: 'not_provided' | 'not_found' | 'not_licensed' | 'provider_error'; provenance: FieldProvenance };

export interface AddressQuery {
  line1: string;
  city?: string;
  state: string; // 2-letter
  postalCode?: string;
}

export interface PropertyRecord {
  address: ProvidedField<{ line1: string; city: string; state: string; postalCode: string; county: string | null }>;
  apn: ProvidedField<string>;
  propertyType: ProvidedField<string>;
  bedrooms: ProvidedField<number>;
  bathrooms: ProvidedField<number>;
  livingSqft: ProvidedField<number>;
  lotSqft: ProvidedField<number>;
  yearBuilt: ProvidedField<number>;
  lastSale: ProvidedField<{ date: string; price: number }>;
  /** True when the record is synthetic demo data and must never be shown as real. */
  demo: boolean;
}

export interface OwnerRecord {
  names: ProvidedField<string[]>;
  mailingAddress: ProvidedField<string>;
  ownerOccupied: ProvidedField<boolean>;
  demo: boolean;
}

export interface SaleEvent {
  date: string;
  price: number | null;
  documentType: string | null;
  provenance: FieldProvenance;
}

export interface CompRecord {
  providerRecordId: string;
  address: string;
  salePrice: number;
  saleDate: string;
  livingSqft: number;
  bedrooms: number | null;
  bathrooms: number | null;
  distanceMiles: number | null;
  provenance: FieldProvenance;
  demo: boolean;
}

export interface ValueEstimate {
  value: ProvidedField<number>;
  low: number | null;
  high: number | null;
  demo: boolean;
}

export interface CompsQuery extends AddressQuery {
  radiusMiles?: number;
  maxResults?: number;
  soldWithinDays?: number;
}

export interface PropertyDataProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  getProperty(q: AddressQuery): Promise<PropertyRecord>;
  getOwner(q: AddressQuery): Promise<OwnerRecord>;
  getSalesHistory(q: AddressQuery): Promise<SaleEvent[]>;
  getComps(q: CompsQuery): Promise<CompRecord[]>;
  getValueEstimate(q: AddressQuery): Promise<ValueEstimate>;
  getRentEstimate(q: AddressQuery): Promise<ValueEstimate>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderId,
    readonly kind: 'not_configured' | 'unauthorized' | 'rate_limited' | 'not_found' | 'upstream' | 'invalid_response',
    message: string,
    readonly retryable = false,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}

/** Metering hook: called once per billable provider call. */
export type UsageMeter = (event: { provider: ProviderId; operation: string; billable: boolean }) => void | Promise<void>;
