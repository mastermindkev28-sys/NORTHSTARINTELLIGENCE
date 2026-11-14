import { stableHash, sourced } from "@northstar/core";
import type { AddressQuery, ComparableRecord, CompsCriteria, PropertyDataProvider, PropertyDetails, ProviderCapability, ProviderResult, RentEstimate, ValuationEstimate } from "./types.js";

/**
 * Deterministic synthetic data for demos, development, and tests. Every record is labeled demo data
 * (`system: "demo"`, meta.isDemoData = true) and the registry refuses this provider in production.
 */
export class DemoPropertyProvider implements PropertyDataProvider {
  readonly id = "demo";
  readonly isDemo = true;
  readonly capabilities: ReadonlySet<ProviderCapability> = new Set(["property_details", "comparable_sales", "valuation", "rent_estimate"]);
  constructor(private readonly now: () => Date = () => new Date()) {}

  private seed(address: AddressQuery): () => number {
    let s = parseInt(stableHash([address.line1.toUpperCase(), address.zip]).slice(0, 8), 16);
    return () => {
      s = (s * 1664525 + 1013904223) % 2 ** 32;
      return s / 2 ** 32;
    };
  }

  private meta(units = 1) {
    return { provider: this.id, retrievedAt: this.now().toISOString(), isDemoData: true, units };
  }

  private base(address: AddressQuery) {
    const rnd = this.seed(address);
    const sqft = Math.round(1000 + rnd() * 1400);
    const ppsf = Math.round(140 + rnd() * 120);
    return { rnd, sqft, ppsf, beds: 2 + Math.floor(rnd() * 3), baths: 1 + Math.floor(rnd() * 3) * 0.5 + (rnd() > 0.5 ? 0.5 : 0), year: 1940 + Math.floor(rnd() * 70) };
  }

  async getPropertyDetails(address: AddressQuery): Promise<ProviderResult<PropertyDetails>> {
    const b = this.base(address);
    const src = { system: "demo", retrievedAt: this.now().toISOString(), reference: "Synthetic demo data — not a real property record" };
    const est = (v: number) => sourced(v, "third_party_estimate", { source: src, confidence: 0.5 });
    return {
      data: {
        facts: {
          bedrooms: est(b.beds), bathrooms: est(b.baths), livingAreaSqft: est(b.sqft), yearBuilt: est(b.year),
          propertyType: sourced("Single Family Residence", "third_party_estimate", { source: src, confidence: 0.5 }),
          annualTaxAmount: est(Math.round(b.sqft * b.ppsf * 0.018)),
        },
      },
      meta: this.meta(),
    };
  }

  async getComparableSales(address: AddressQuery, criteria: CompsCriteria = {}): Promise<ProviderResult<ComparableRecord[]>> {
    const b = this.base(address);
    const n = Math.min(criteria.maxResults ?? 6, 8);
    const comps: ComparableRecord[] = [];
    for (let i = 0; i < n; i++) {
      const sqft = Math.round(b.sqft * (0.85 + b.rnd() * 0.3));
      const ppsf = b.ppsf * (0.9 + b.rnd() * 0.2);
      const daysAgo = Math.floor(15 + b.rnd() * 160);
      comps.push({
        id: `demo-comp-${i + 1}`, address: `${100 + Math.floor(b.rnd() * 900)} Demo Comp St, ${address.city}, ${address.state}`, kind: "closed_sale",
        price: Math.round((sqft * ppsf) / 500) * 500, date: new Date(this.now().getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10),
        livingAreaSqft: sqft, bedrooms: b.beds + (b.rnd() > 0.7 ? 1 : 0), bathrooms: b.baths, yearBuilt: b.year + Math.floor(b.rnd() * 10) - 5,
        distanceMiles: Math.round(b.rnd() * (criteria.radiusMiles ?? 1) * 100) / 100,
      });
    }
    return { data: comps, meta: this.meta(n) };
  }

  async getValuation(address: AddressQuery): Promise<ProviderResult<ValuationEstimate>> {
    const b = this.base(address);
    const v = Math.round((b.sqft * b.ppsf) / 1000) * 1000;
    return { data: { value: sourced(v, "third_party_estimate", { source: { system: "demo", retrievedAt: this.now().toISOString() }, confidence: 0.5 }), low: Math.round(v * 0.9), high: Math.round(v * 1.1) }, meta: this.meta() };
  }

  async getRentEstimate(address: AddressQuery): Promise<ProviderResult<RentEstimate>> {
    const b = this.base(address);
    const rent = Math.round((b.sqft * b.ppsf * 0.0075) / 25) * 25;
    return { data: { monthlyRent: sourced(rent, "third_party_estimate", { source: { system: "demo", retrievedAt: this.now().toISOString() }, confidence: 0.5 }), low: Math.round(rent * 0.9), high: Math.round(rent * 1.1), comparables: [] }, meta: this.meta() };
  }
}
