/**
 * Deterministic mock provider. Every record is flagged demo: true and labelled "DEMO DATA" so it can
 * never be mistaken for real property information. Values are derived from a hash of the address,
 * so the same address always returns the same demo record (useful for tests and product demos).
 */
import type { AddressQuery, CompRecord, CompsQuery, FieldProvenance, OwnerRecord, PropertyDataProvider, PropertyRecord, ProvidedField, SaleEvent, ValueEstimate } from './types.js';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
function seq(seed: number) {
  let s = seed || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
const key = (q: AddressQuery) => `${q.line1}|${q.city ?? ''}|${q.state}|${q.postalCode ?? ''}`.toLowerCase().replace(/\s+/g, ' ').trim();

export class MockPropertyProvider implements PropertyDataProvider {
  readonly id = 'mock' as const;
  readonly displayName = 'Demo data (mock provider)';
  constructor(private readonly now: () => Date = () => new Date('2026-11-10T00:00:00Z')) {}

  private prov(recordId: string | null, confidence = 0.5): FieldProvenance {
    return { provider: 'mock', providerRecordId: recordId, retrievedAt: this.now().toISOString(), confidence, licenseTag: 'demo' };
  }
  private f<T>(value: T, id: string): ProvidedField<T> {
    return { value, provenance: this.prov(id) };
  }

  async getProperty(q: AddressQuery): Promise<PropertyRecord> {
    const k = key(q);
    const r = seq(hash(k));
    const id = `demo-${hash(k).toString(16)}`;
    const sqft = Math.round(900 + r() * 1800);
    return {
      address: this.f({ line1: q.line1, city: q.city ?? 'Demo City', state: q.state, postalCode: q.postalCode ?? '00000', county: 'Demo County' }, id),
      apn: this.f(`DEMO-${(hash(k) % 1_000_000).toString().padStart(6, '0')}`, id),
      propertyType: this.f('single_family', id),
      bedrooms: this.f(2 + Math.floor(r() * 3), id),
      bathrooms: this.f(1 + Math.floor(r() * 3) * 0.5 + 0.5, id),
      livingSqft: this.f(sqft, id),
      lotSqft: this.f(Math.round(sqft * (2.5 + r() * 3)), id),
      yearBuilt: this.f(1950 + Math.floor(r() * 60), id),
      lastSale: { value: null, reason: 'not_provided', provenance: this.prov(id) },
      demo: true,
    };
  }

  async getOwner(q: AddressQuery): Promise<OwnerRecord> {
    const id = `demo-${hash(key(q)).toString(16)}`;
    return {
      names: this.f(['DEMO OWNER'], id),
      mailingAddress: this.f(`${q.line1} (DEMO)`, id),
      ownerOccupied: this.f(hash(key(q)) % 2 === 0, id),
      demo: true,
    };
  }

  async getSalesHistory(q: AddressQuery): Promise<SaleEvent[]> {
    const r = seq(hash(key(q)) + 7);
    const id = `demo-${hash(key(q)).toString(16)}`;
    return [
      { date: '2019-06-14', price: Math.round(150_000 + r() * 100_000), documentType: 'DEMO warranty deed', provenance: this.prov(id) },
    ];
  }

  async getComps(q: CompsQuery): Promise<CompRecord[]> {
    const subject = await this.getProperty(q);
    const base = subject.livingSqft.value ?? 1500;
    const r = seq(hash(key(q)) + 13);
    const n = Math.min(q.maxResults ?? 5, 10);
    const ppsf = 150 + r() * 100;
    return Array.from({ length: n }, (_, i) => {
      const sqft = Math.round(base * (0.85 + r() * 0.3));
      const id = `demo-comp-${hash(key(q) + i).toString(16)}`;
      return {
        providerRecordId: id,
        address: `${100 + i * 12} Demo Ave (DEMO DATA)`,
        salePrice: Math.round((sqft * ppsf * (0.93 + r() * 0.14)) / 100) * 100,
        saleDate: new Date(this.now().getTime() - Math.floor(r() * 170) * 86_400_000).toISOString().slice(0, 10),
        livingSqft: sqft,
        bedrooms: subject.bedrooms.value,
        bathrooms: subject.bathrooms.value,
        distanceMiles: Math.round(r() * Math.min(q.radiusMiles ?? 1, 1) * 100) / 100,
        provenance: this.prov(id),
        demo: true,
      };
    });
  }

  async getValueEstimate(q: AddressQuery): Promise<ValueEstimate> {
    const comps = await this.getComps({ ...q, maxResults: 5 });
    const subject = await this.getProperty(q);
    const ppsf = comps.reduce((a, c) => a + c.salePrice / c.livingSqft, 0) / comps.length;
    const v = Math.round((ppsf * (subject.livingSqft.value ?? 1500)) / 1000) * 1000;
    return { value: this.f(v, 'demo-avm'), low: Math.round(v * 0.92), high: Math.round(v * 1.08), demo: true };
  }

  async getRentEstimate(q: AddressQuery): Promise<ValueEstimate> {
    const v = (await this.getValueEstimate(q)).value.value ?? 200_000;
    const rent = Math.round((v * 0.0085) / 25) * 25;
    return { value: this.f(rent, 'demo-rent-avm'), low: Math.round(rent * 0.9), high: Math.round(rent * 1.1), demo: true };
  }
}
