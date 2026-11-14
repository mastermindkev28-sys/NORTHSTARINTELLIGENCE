import type { Sourced } from "@northstar/core";

export type ProviderCapability = "property_details" | "comparable_sales" | "valuation" | "rent_estimate";

export interface AddressQuery {
  line1: string;
  city: string;
  state: string;
  zip: string;
}

export interface PropertyDetails {
  /** Facts keyed by field name. Absent fields mean the provider did not supply them — never defaulted. */
  facts: Partial<{
    bedrooms: Sourced<number>;
    bathrooms: Sourced<number>;
    livingAreaSqft: Sourced<number>;
    lotSizeSqft: Sourced<number>;
    yearBuilt: Sourced<number>;
    propertyType: Sourced<string>;
    apn: Sourced<string>;
    county: Sourced<string>;
    ownerName: Sourced<string>;
    ownerOccupied: Sourced<boolean>;
    assessedValue: Sourced<number>;
    annualTaxAmount: Sourced<number>;
    lastSalePrice: Sourced<number>;
    lastSaleDate: Sourced<string>;
    latitude: Sourced<number>;
    longitude: Sourced<number>;
  }>;
}

export interface ComparableRecord {
  id: string;
  address: string;
  /** "closed_sale" from recorded transactions; "listing" from active/removed listings (weaker evidence). */
  kind: "closed_sale" | "listing";
  price: number;
  date: string;
  livingAreaSqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  yearBuilt: number | null;
  distanceMiles: number | null;
}

export interface ValuationEstimate {
  value: Sourced<number>;
  low: number | null;
  high: number | null;
}

export interface RentEstimate {
  monthlyRent: Sourced<number>;
  low: number | null;
  high: number | null;
  comparables: ComparableRecord[];
}

export interface ProviderMeta {
  provider: string;
  retrievedAt: string;
  isDemoData: boolean;
  /** Billable units consumed (for usage metering and cost tracking). */
  units: number;
}

export interface ProviderResult<T> {
  data: T;
  meta: ProviderMeta;
}

export interface CompsCriteria {
  radiusMiles?: number;
  monthsBack?: number;
  maxResults?: number;
}

export interface PropertyDataProvider {
  readonly id: string;
  readonly capabilities: ReadonlySet<ProviderCapability>;
  readonly isDemo: boolean;
  getPropertyDetails?(address: AddressQuery): Promise<ProviderResult<PropertyDetails> | null>;
  getComparableSales?(address: AddressQuery, criteria: CompsCriteria): Promise<ProviderResult<ComparableRecord[]>>;
  getValuation?(address: AddressQuery): Promise<ProviderResult<ValuationEstimate> | null>;
  getRentEstimate?(address: AddressQuery): Promise<ProviderResult<RentEstimate> | null>;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;
