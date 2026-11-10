import { describe, expect, it } from 'vitest';
import {
  applyObservation,
  currentVersion,
  expireIfStale,
  isExpectedTransition,
  jaroWinkler,
  normalizeAddress,
  normalizeApn,
  normalizeName,
  normalizePostalCode,
  resolveRecord,
  type EventVersion,
  type ParcelCandidate,
  type SourceRecord,
} from '../src/index';

describe('normalization', () => {
  it('standardizes suffixes, directionals, units and ZIP+4', () => {
    const a = normalizeAddress({ line1: '0123 North Broad Street, Apt. 4B', city: ' philadelphia ', state: 'pa', postalCode: '19107-1234' })!;
    expect(a).toEqual({ line1: '123 N BROAD ST', unit: '4B', city: 'PHILADELPHIA', state: 'PA', postalCode: '19107', key: '123 N BROAD ST|4B|19107' });
    expect(normalizeAddress({ line1: '123 N. Broad St #4B', postalCode: '19107' })!.key).toBe(a.key);
    expect(normalizeAddress({ line1: '123 N Broad St', unit: 'Unit 4B', postalCode: '19107' })!.key).toBe(a.key);
  });
  it('does not guess missing or invalid parts', () => {
    expect(normalizeAddress({ line1: '  ' })).toBeNull();
    expect(normalizeAddress({ line1: '5 Elm St', state: 'XX', postalCode: '1910' })).toMatchObject({ state: null, postalCode: null });
    expect(normalizePostalCode(undefined)).toBeNull();
  });
  it('keeps "Street" as a name when it is not the last token', () => {
    expect(normalizeAddress({ line1: '10 Avenue Of The Arts' })!.line1).toBe('10 AVENUE OF THE ARTS');
  });
  it('normalizes APNs within a county without stripping leading zeros', () => {
    expect(normalizeApn('01-234.5678 / a')).toBe('012345678A');
    expect(normalizeApn('')).toBeNull();
  });
  it('normalizes entity names and measures similarity', () => {
    expect(normalizeName('Smith Family Trust, LLC')).toBe('SMITH FAMILY');
    expect(jaroWinkler('MARTHA', 'MARHTA')).toBeCloseTo(0.9611, 4);
    expect(jaroWinkler('', 'A')).toBe(0);
    expect(jaroWinkler('ABC', 'ABC')).toBe(1);
    expect(jaroWinkler('ABC', 'XYZ')).toBe(0);
  });
});

describe('entity resolution', () => {
  const county = '42101';
  const parcels: ParcelCandidate[] = [
    { parcelId: 'p1', countyFips: county, apn: '881234500', address: normalizeAddress({ line1: '12 Oak St', postalCode: '19104', city: 'Philadelphia' }), ownerNames: ['Jane Roe'] },
    { parcelId: 'p2', countyFips: county, apn: '881234600', address: normalizeAddress({ line1: '21 Oak St', postalCode: '19104', city: 'Philadelphia' }) },
    { parcelId: 'p3', countyFips: '17031', apn: '881234500', address: null },
  ];
  const rec = (over: Partial<SourceRecord>): SourceRecord => ({ sourceKey: 's', sourceRecordId: 'r', category: 'recorder', retrievedAt: '2026-11-10T00:00:00Z', licenseTag: 't', attributes: {}, ...over });

  it('matches an exact parcel number in the same county only', () => {
    const r = resolveRecord(rec({ apn: '88-1234500' }), county, parcels);
    expect(r).toMatchObject({ decision: 'matched', parcelId: 'p1', confidence: 0.99 });
    expect(resolveRecord(rec({ apn: '881234500' }), '99999', parcels).decision).toBe('no_match');
  });
  it('matches an exact address and ZIP', () => {
    const r = resolveRecord(rec({ address: { line1: '12 Oak Street', postalCode: '19104' } }), county, parcels);
    expect(r).toMatchObject({ decision: 'matched', parcelId: 'p1', confidence: 0.9 });
  });
  it('sends a fuzzy street match to review and never crosses house numbers', () => {
    const r = resolveRecord(rec({ address: { line1: '12 Oak Stret', postalCode: '19104' } }), county, parcels);
    expect(r.decision).toBe('review');
    expect(r.candidates.map((c) => c.parcelId)).toEqual(['p1']);
    const owner = resolveRecord(rec({ address: { line1: '12 Oak Stret', postalCode: '19104' }, attributes: { owner_name: 'JANE ROE' } }), county, parcels);
    expect(owner.confidence).toBe(0.75);
    expect(owner.decision).toBe('review');
  });
  it('caps confidence when the parcel number conflicts with the address', () => {
    const r = resolveRecord(rec({ apn: '999', address: { line1: '12 Oak St', postalCode: '19104' } }), county, parcels);
    expect(r.decision).toBe('review');
    expect(r.confidence).toBe(0.65);
  });
  it('uses city when ZIP is missing, and returns no_match without evidence', () => {
    const r = resolveRecord(rec({ address: { line1: '12 Oak St', city: 'PHILADELPHIA' } }), county, parcels);
    expect(r).toMatchObject({ decision: 'review', confidence: 0.75 });
    expect(resolveRecord(rec({ address: { line1: '99 Pine St', postalCode: '19104' } }), county, parcels).decision).toBe('no_match');
  });
  it('sends near-ties to review', () => {
    const dup = [...parcels, { ...parcels[0]!, parcelId: 'p1b' }];
    const r = resolveRecord(rec({ address: { line1: '12 Oak St', postalCode: '19104' } }), county, dup);
    expect(r.decision).toBe('review');
    expect(r.reasons.join(' ')).toMatch(/ambiguous/);
  });
});

describe('event lifecycle', () => {
  const ref = { sourceKey: 'cuy.sheriff', sourceRecordId: 'CASE-1' };
  const history: EventVersion[] = [];
  const push = (o: ReturnType<typeof applyObservation>) => {
    if (o.kind !== 'unchanged') history.push(o.version);
    return o;
  };
  it('creates, ignores duplicates, and supersedes on change (append-only)', () => {
    const a = push(applyObservation(history, ref, { eventType: 'sheriff_sale_scheduled', status: 'scheduled', scheduledDate: '2026-12-01' }, '2026-11-01'));
    expect(a.kind).toBe('created');
    expect(push(applyObservation(history, ref, { eventType: 'sheriff_sale_scheduled', status: 'scheduled', scheduledDate: '2026-12-01' }, '2026-11-02')).kind).toBe('unchanged');
    const b = push(applyObservation(history, ref, { eventType: 'sheriff_sale_scheduled', status: 'postponed', scheduledDate: '2027-01-15' }, '2026-11-20'));
    expect(b.kind).toBe('superseded');
    if (b.kind === 'superseded') expect(b.version).toMatchObject({ version: 2, supersedesVersion: 1, anomaly: null, discoveredAt: '2026-11-20' });
    expect(history[0]!.status).toBe('scheduled');
    expect(currentVersion(history)!.status).toBe('postponed');
  });
  it('accepts but flags unexpected transitions from terminal states', () => {
    push(applyObservation(history, ref, { eventType: 'sheriff_sale_scheduled', status: 'withdrawn' }, '2026-12-01'));
    const c = push(applyObservation(history, ref, { eventType: 'sheriff_sale_scheduled', status: 'scheduled', scheduledDate: '2027-03-01' }, '2026-12-05'));
    expect(c.kind === 'superseded' && c.version.anomaly).toMatch(/unexpected transition withdrawn → scheduled/);
    expect(isExpectedTransition('postponed', 'completed')).toBe(true);
    expect(isExpectedTransition('resolved', 'active')).toBe(false);
  });
  it('flags a changed event type and rejects unknown statuses', () => {
    const h: EventVersion[] = [];
    const first = applyObservation(h, ref, { eventType: 'lis_pendens', status: 'active' }, '2026-01-01');
    if (first.kind === 'created') h.push(first.version);
    const o = applyObservation(h, ref, { eventType: 'foreclosure_filing', status: 'active' }, '2026-02-01');
    expect(o.kind === 'superseded' && o.version.anomaly).toMatch(/event type changed/);
    expect(() => applyObservation(h, ref, { eventType: 'lis_pendens', status: 'open' as never }, '2026-02-01')).toThrow();
  });
  it('expires stale scheduled events and policy-bound active events deterministically', () => {
    const sched: EventVersion = { ...ref, version: 1, eventType: 'sheriff_sale_scheduled', status: 'scheduled', eventDate: null, filedDate: null, scheduledDate: '2026-09-01', amount: null, discoveredAt: '2026-08-01', supersedesVersion: null, origin: 'source', anomaly: null };
    const e = expireIfStale([sched], '2026-11-10')!;
    expect(e).toMatchObject({ status: 'expired', version: 2, supersedesVersion: 1, origin: 'expiry_rule' });
    expect(expireIfStale([sched], '2026-09-20')).toBeNull();
    expect(expireIfStale([{ ...sched, status: 'completed' }], '2027-01-01')).toBeNull();
    const active: EventVersion = { ...sched, eventType: 'vacancy_indicator', status: 'active', scheduledDate: null };
    expect(expireIfStale([active], '2026-11-10')).toBeNull();
    expect(expireIfStale([active], '2026-11-10', { activeMaxAgeDays: { vacancy_indicator: 90 } })!.status).toBe('expired');
    expect(expireIfStale([], '2026-11-10')).toBeNull();
  });
});
