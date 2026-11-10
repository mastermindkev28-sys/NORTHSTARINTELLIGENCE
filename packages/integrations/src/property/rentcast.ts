/**
 * RentCast adapter (secondary launch provider per docs/DATA_PROVIDER_EVALUATION.md).
 * Auth: X-Api-Key header. Credential: RENTCAST_API_KEY.
 *
 * Field mapping follows RentCast's public API documentation as understood at build time and MUST be
 * re-verified against live responses when a key is provisioned (tracked in docs/INTEGRATION_CATALOG.md).
 * Responses are validated defensively: unexpected shapes yield null fields with reason 'provider_error'
 * rather than guessed values.
 * Note: RentCast AVM "comparables" include listings, not only closed sales; they are surfaced as comps
 * with confidence capped accordingly and must be reviewed before use in ARV.
 */
import { ProviderError, type AddressQuery, type CompRecord, type CompsQuery, type FieldProvenance, type OwnerRecord, type PropertyDataProvider, type PropertyRecord, type ProvidedField, type SaleEvent, type UsageMeter, type ValueEstimate } from './types.js';

export interface RentCastConfig {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  meter?: UsageMeter;
  now?: () => Date;
}

type Json = Record<string, unknown>;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

export class RentCastProvider implements PropertyDataProvider {
  readonly id = 'rentcast' as const;
  readonly displayName = 'RentCast';
  private readonly base: string;
  private readonly http: typeof fetch;

  constructor(private readonly cfg: RentCastConfig) {
    if (!cfg.apiKey) throw new ProviderError('rentcast', 'not_configured', 'RENTCAST_API_KEY is not set');
    this.base = (cfg.baseUrl ?? 'https://api.rentcast.io/v1').replace(/\/$/, '');
    this.http = cfg.fetch ?? fetch;
  }

  private now() {
    return (this.cfg.now ?? (() => new Date()))();
  }

  private prov(recordId: string | null, confidence: number): FieldProvenance {
    return { provider: 'rentcast', providerRecordId: recordId, retrievedAt: this.now().toISOString(), confidence, licenseTag: 'rentcast-standard' };
  }

  private field<T>(value: T | null, recordId: string | null, confidence = 0.8): ProvidedField<T> {
    return value === null || value === undefined
      ? { value: null, reason: 'not_provided', provenance: this.prov(recordId, 0) }
      : { value, provenance: this.prov(recordId, confidence) };
  }

  private address(q: AddressQuery): string {
    return [q.line1, q.city, [q.state, q.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }

  private async get(path: string, params: Record<string, string | number>, operation: string): Promise<unknown> {
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 10_000);
    let res: Response;
    try {
      res = await this.http(url, { headers: { 'X-Api-Key': this.cfg.apiKey, Accept: 'application/json' }, signal: ctrl.signal });
    } catch (e) {
      throw new ProviderError('rentcast', 'upstream', `network error: ${(e as Error).message}`, true);
    } finally {
      clearTimeout(timer);
    }
    await this.cfg.meter?.({ provider: 'rentcast', operation, billable: res.ok });
    if (res.status === 401 || res.status === 403) throw new ProviderError('rentcast', 'unauthorized', 'API key rejected');
    if (res.status === 404) throw new ProviderError('rentcast', 'not_found', 'no record for address');
    if (res.status === 429) throw new ProviderError('rentcast', 'rate_limited', 'rate limited', true);
    if (!res.ok) throw new ProviderError('rentcast', 'upstream', `HTTP ${res.status}`, res.status >= 500);
    try {
      return await res.json();
    } catch {
      throw new ProviderError('rentcast', 'invalid_response', 'response was not JSON');
    }
  }

  private async record(q: AddressQuery): Promise<Json> {
    const data = await this.get('/properties', { address: this.address(q) }, 'property');
    const rec = Array.isArray(data) ? data[0] : null;
    if (!rec || typeof rec !== 'object') throw new ProviderError('rentcast', 'not_found', 'no record for address');
    return rec as Json;
  }

  async getProperty(q: AddressQuery): Promise<PropertyRecord> {
    const r = await this.record(q);
    const id = str(r.id);
    const line1 = str(r.addressLine1);
    const city = str(r.city);
    const state = str(r.state);
    const zip = str(r.zipCode);
    const lastPrice = num(r.lastSalePrice);
    const lastDate = str(r.lastSaleDate);
    return {
      address: this.field(line1 && city && state && zip ? { line1, city, state, postalCode: zip, county: str(r.county) } : null, id, 0.95),
      apn: this.field(str(r.assessorID), id, 0.9),
      propertyType: this.field(str(r.propertyType), id),
      bedrooms: this.field(num(r.bedrooms), id),
      bathrooms: this.field(num(r.bathrooms), id),
      livingSqft: this.field(num(r.squareFootage), id),
      lotSqft: this.field(num(r.lotSize), id),
      yearBuilt: this.field(num(r.yearBuilt), id),
      lastSale: this.field(lastPrice !== null && lastDate ? { date: lastDate.slice(0, 10), price: lastPrice } : null, id, 0.9),
      demo: false,
    };
  }

  async getOwner(q: AddressQuery): Promise<OwnerRecord> {
    const r = await this.record(q);
    const id = str(r.id);
    const owner = (r.owner && typeof r.owner === 'object' ? r.owner : {}) as Json;
    const names = Array.isArray(owner.names) ? owner.names.filter((n): n is string => typeof n === 'string') : null;
    const mailing = owner.mailingAddress && typeof owner.mailingAddress === 'object' ? str((owner.mailingAddress as Json).formattedAddress) : null;
    return {
      names: this.field(names && names.length ? names : null, id, 0.85),
      mailingAddress: this.field(mailing, id, 0.85),
      ownerOccupied: this.field(typeof r.ownerOccupied === 'boolean' ? r.ownerOccupied : null, id, 0.7),
      demo: false,
    };
  }

  async getSalesHistory(q: AddressQuery): Promise<SaleEvent[]> {
    const r = await this.record(q);
    const id = str(r.id);
    const history = (r.history && typeof r.history === 'object' ? r.history : {}) as Record<string, Json>;
    return Object.values(history)
      .filter((h) => str(h.date))
      .map((h) => ({ date: str(h.date)!.slice(0, 10), price: num(h.price), documentType: str(h.event), provenance: this.prov(id, 0.85) }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  async getComps(q: CompsQuery): Promise<CompRecord[]> {
    const data = (await this.get('/avm/value', { address: this.address(q), compCount: Math.min(q.maxResults ?? 10, 25) }, 'comps')) as Json;
    const comps = Array.isArray(data.comparables) ? (data.comparables as Json[]) : [];
    const out: CompRecord[] = [];
    for (const c of comps) {
      const price = num(c.price);
      const sqft = num(c.squareFootage);
      const date = str(c.removedDate) ?? str(c.lastSeenDate) ?? str(c.listedDate);
      const address = str(c.formattedAddress);
      const id = str(c.id);
      if (price === null || sqft === null || !date || !address || !id) continue; // incomplete comps are dropped, never patched
      const distance = num(c.distance);
      if (q.radiusMiles !== undefined && distance !== null && distance > q.radiusMiles) continue;
      out.push({ providerRecordId: id, address, salePrice: price, saleDate: date.slice(0, 10), livingSqft: sqft, bedrooms: num(c.bedrooms), bathrooms: num(c.bathrooms), distanceMiles: distance, provenance: this.prov(id, 0.6), demo: false });
    }
    return out;
  }

  private async estimate(path: string, q: AddressQuery, op: string): Promise<ValueEstimate> {
    const d = (await this.get(path, { address: this.address(q) }, op)) as Json;
    return { value: this.field(num(d.price) ?? num(d.rent), null, 0.6), low: num(d.priceRangeLow) ?? num(d.rentRangeLow), high: num(d.priceRangeHigh) ?? num(d.rentRangeHigh), demo: false };
  }

  getValueEstimate(q: AddressQuery) {
    return this.estimate('/avm/value', q, 'value_estimate');
  }

  getRentEstimate(q: AddressQuery) {
    return this.estimate('/avm/rent/long-term', q, 'rent_estimate');
  }
}
