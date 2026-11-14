import { NorthstarError, sourced, type SourceRef } from "@northstar/core";
import { get, getJson, num, str } from "./http";
import type { AddressQuery, FetchLike, PropertyDataProvider, PropertyDetails, ProviderCapability, ProviderResult, ValuationEstimate } from "./types";

/**
 * ATTOM Property API adapter (public-record property characteristics, ownership, assessment, and AVM).
 * Requires a commercial ATTOM license; display/storage rights depend on the contract (see DATA_PROVIDER_EVALUATION.md).
 * Field mapping is defensive: any field ATTOM omits stays absent. Contract-verify against live responses at onboarding.
 */
export class AttomProvider implements PropertyDataProvider {
  readonly id = "attom";
  readonly isDemo = false;
  readonly capabilities: ReadonlySet<ProviderCapability> = new Set(["property_details", "valuation"]);
  private readonly baseUrl: string;

  constructor(private readonly opts: { apiKey: string | undefined; fetch: FetchLike; baseUrl?: string; now?: () => Date }) {
    this.baseUrl = opts.baseUrl ?? "https://api.gateway.attomdata.com/propertyapi/v1.0.0";
  }

  private headers(): Record<string, string> {
    if (!this.opts.apiKey) throw new NorthstarError("PROVIDER_NOT_CONFIGURED", "ATTOM_API_KEY is not configured");
    return { apikey: this.opts.apiKey };
  }

  private query(a: AddressQuery): string {
    return `address1=${encodeURIComponent(a.line1)}&address2=${encodeURIComponent(`${a.city}, ${a.state} ${a.zip}`)}`;
  }

  async getPropertyDetails(address: AddressQuery): Promise<ProviderResult<PropertyDetails> | null> {
    const body = await getJson(this.opts.fetch, "ATTOM", `${this.baseUrl}/property/expandedprofile?${this.query(address)}`, this.headers());
    const p = (get(body, "property") as unknown[] | undefined)?.[0];
    if (!p) return null;
    const retrievedAt = (this.opts.now?.() ?? new Date()).toISOString();
    const recordId = str(get(p, "identifier.attomId")) ?? (num(get(p, "identifier.attomId"))?.toString());
    const source: SourceRef = { system: "attom", recordId, retrievedAt };
    // Public-record attributes relayed by a provider: third-party data, high but not verified confidence.
    const rec = <T>(v: T | undefined, confidence = 0.85) => (v === undefined ? undefined : sourced(v, "third_party_estimate", { source, confidence }));
    const facts: PropertyDetails["facts"] = {};
    const assign = <K extends keyof PropertyDetails["facts"]>(k: K, v: PropertyDetails["facts"][K] | undefined) => {
      if (v !== undefined) facts[k] = v;
    };
    assign("bedrooms", rec(num(get(p, "building.rooms.beds"))));
    assign("bathrooms", rec(num(get(p, "building.rooms.bathstotal"))));
    assign("livingAreaSqft", rec(num(get(p, "building.size.livingsize")) ?? num(get(p, "building.size.universalsize"))));
    assign("lotSizeSqft", rec(num(get(p, "lot.lotsize2"))));
    assign("yearBuilt", rec(num(get(p, "summary.yearbuilt"))));
    assign("propertyType", rec(str(get(p, "summary.propertyType")) ?? str(get(p, "summary.proptype"))));
    assign("apn", rec(str(get(p, "identifier.apn")), 0.95));
    assign("county", rec(str(get(p, "area.countrysecsubd")) ?? str(get(p, "area.munname"))));
    assign("ownerName", rec(str(get(p, "assessment.owner.owner1.fullName")) ?? str(get(p, "owner.owner1.fullname")), 0.8));
    const absentee = str(get(p, "summary.absenteeInd"));
    if (absentee) assign("ownerOccupied", rec(/owner occupied/i.test(absentee), 0.7));
    assign("assessedValue", rec(num(get(p, "assessment.assessed.assdttlvalue"))));
    assign("annualTaxAmount", rec(num(get(p, "assessment.tax.taxamt"))));
    assign("lastSalePrice", rec(num(get(p, "sale.amount.saleamt"))));
    assign("lastSaleDate", rec(str(get(p, "sale.saleTransDate")) ?? str(get(p, "sale.amount.salerecdate"))));
    assign("latitude", rec(num(get(p, "location.latitude")), 0.9));
    assign("longitude", rec(num(get(p, "location.longitude")), 0.9));
    return { data: { facts }, meta: { provider: this.id, retrievedAt, isDemoData: false, units: 1 } };
  }

  async getValuation(address: AddressQuery): Promise<ProviderResult<ValuationEstimate> | null> {
    const body = await getJson(this.opts.fetch, "ATTOM", `${this.baseUrl}/attomavm/detail?${this.query(address)}`, this.headers());
    const p = (get(body, "property") as unknown[] | undefined)?.[0];
    const value = num(get(p, "avm.amount.value"));
    if (value === undefined) return null;
    const retrievedAt = (this.opts.now?.() ?? new Date()).toISOString();
    // ATTOM's AVM confidence score (0–100) is mapped to 0–1; absent → conservative 0.5.
    const scr = num(get(p, "avm.amount.scr"));
    const confidence = scr === undefined ? 0.5 : Math.max(0, Math.min(1, scr / 100));
    return {
      data: { value: sourced(value, "third_party_estimate", { source: { system: "attom", retrievedAt, reference: "ATTOM AVM" }, confidence }), low: num(get(p, "avm.amount.low")) ?? null, high: num(get(p, "avm.amount.high")) ?? null },
      meta: { provider: this.id, retrievedAt, isDemoData: false, units: 1 },
    };
  }
}
