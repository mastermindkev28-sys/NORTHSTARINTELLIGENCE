import { NorthstarError, sourced } from "@northstar/core";
import { get, getJson, num, str } from "./http";
import type { AddressQuery, ComparableRecord, FetchLike, PropertyDataProvider, ProviderCapability, ProviderResult, RentEstimate, ValuationEstimate } from "./types";

/**
 * RentCast adapter for long-term rent estimates and value estimates. RentCast comparables are LISTINGS
 * (asking prices), not recorded closed sales, so they are labeled kind="listing" and must not be used as
 * closed-sale comps for ARV without user review.
 */
export class RentCastProvider implements PropertyDataProvider {
  readonly id = "rentcast";
  readonly isDemo = false;
  readonly capabilities: ReadonlySet<ProviderCapability> = new Set(["rent_estimate", "valuation"]);
  private readonly baseUrl: string;

  constructor(private readonly opts: { apiKey: string | undefined; fetch: FetchLike; baseUrl?: string; now?: () => Date }) {
    this.baseUrl = opts.baseUrl ?? "https://api.rentcast.io/v1";
  }

  private headers(): Record<string, string> {
    if (!this.opts.apiKey) throw new NorthstarError("PROVIDER_NOT_CONFIGURED", "RENTCAST_API_KEY is not configured");
    return { "X-Api-Key": this.opts.apiKey };
  }

  private addressParam(a: AddressQuery): string {
    return encodeURIComponent(`${a.line1}, ${a.city}, ${a.state} ${a.zip}`);
  }

  private mapComparables(body: unknown): ComparableRecord[] {
    const list = (get(body, "comparables") as unknown[] | undefined) ?? [];
    const out: ComparableRecord[] = [];
    for (const c of list) {
      const price = num(get(c, "price"));
      const address = str(get(c, "formattedAddress"));
      const date = str(get(c, "removedDate")) ?? str(get(c, "lastSeenDate")) ?? str(get(c, "listedDate"));
      if (price === undefined || !address || !date) continue; // incomplete records are dropped, never filled
      out.push({
        id: str(get(c, "id")) ?? address, address, kind: "listing", price, date: date.slice(0, 10),
        livingAreaSqft: num(get(c, "squareFootage")) ?? null, bedrooms: num(get(c, "bedrooms")) ?? null, bathrooms: num(get(c, "bathrooms")) ?? null,
        yearBuilt: num(get(c, "yearBuilt")) ?? null, distanceMiles: num(get(c, "distance")) ?? null,
      });
    }
    return out;
  }

  async getRentEstimate(address: AddressQuery): Promise<ProviderResult<RentEstimate> | null> {
    const body = await getJson(this.opts.fetch, "RentCast", `${this.baseUrl}/avm/rent/long-term?address=${this.addressParam(address)}`, this.headers());
    const rent = num(get(body, "rent"));
    if (rent === undefined) return null;
    const retrievedAt = (this.opts.now?.() ?? new Date()).toISOString();
    const comparables = this.mapComparables(body);
    return {
      data: {
        monthlyRent: sourced(rent, "third_party_estimate", { source: { system: "rentcast", retrievedAt, reference: "RentCast long-term rent AVM" }, confidence: comparables.length >= 5 ? 0.7 : 0.55 }),
        low: num(get(body, "rentRangeLow")) ?? null, high: num(get(body, "rentRangeHigh")) ?? null, comparables,
      },
      meta: { provider: this.id, retrievedAt, isDemoData: false, units: 1 },
    };
  }

  async getValuation(address: AddressQuery): Promise<ProviderResult<ValuationEstimate> | null> {
    const body = await getJson(this.opts.fetch, "RentCast", `${this.baseUrl}/avm/value?address=${this.addressParam(address)}`, this.headers());
    const price = num(get(body, "price"));
    if (price === undefined) return null;
    const retrievedAt = (this.opts.now?.() ?? new Date()).toISOString();
    return {
      data: { value: sourced(price, "third_party_estimate", { source: { system: "rentcast", retrievedAt, reference: "RentCast value AVM (listing-based)" }, confidence: 0.55 }), low: num(get(body, "priceRangeLow")) ?? null, high: num(get(body, "priceRangeHigh")) ?? null },
      meta: { provider: this.id, retrievedAt, isDemoData: false, units: 1 },
    };
  }
}
