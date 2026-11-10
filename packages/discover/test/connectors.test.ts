import { describe, expect, it } from 'vitest';
import {
  ArcGisConnector,
  COUNTY_SOURCES,
  CartoConnector,
  DemoCountyConnector,
  MemoryDiscoverStore,
  SocrataConnector,
  SourceError,
  buildConnector,
  contentHash,
  mapCookSale,
  mapPhillyRtt,
  mapPhillyViolation,
  mapSheriffSaleStatus,
  normalizeAddress,
  runIngestion,
  type FetchLike,
  type SourceLicense,
} from '../src/index';

const license: SourceLicense = { tag: 'test', name: 'Test', automatedAccess: 'permitted', commercialDisplay: 'permitted', attributionRequired: false };
const county = { state: 'PA', countyFips: '42101', name: 'Philadelphia County' };
const now = () => '2026-11-10T12:00:00.000Z';

function stub(responses: { status?: number; body?: unknown; throws?: Error; badJson?: boolean }[]) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const f: FetchLike = async (url, init) => {
    calls.push({ url, headers: init?.headers ?? {} });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)]!;
    if (r.throws) throw r.throws;
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      json: async () => {
        if (r.badJson) throw new SyntaxError('bad');
        return r.body;
      },
      text: async () => JSON.stringify(r.body),
    };
  };
  return { f, calls };
}

const passthrough = (row: Record<string, unknown>, ctx: { sourceKey: string; licenseTag: string; retrievedAt: string }) =>
  typeof row['id'] === 'string' ? { sourceKey: ctx.sourceKey, sourceRecordId: row['id'], category: 'recorder' as const, retrievedAt: ctx.retrievedAt, licenseTag: ctx.licenseTag, attributes: {} } : null;

describe('SocrataConnector', () => {
  const make = (f: FetchLike) => new SocrataConnector({ sourceKey: 'cook.test', county, category: 'recorder', license, domain: 'data.example.gov', datasetId: 'abcd-1234', orderBy: 'sale_date', map: passthrough, appToken: 'secret-token', pageSize: 2, http: { fetch: f }, now });
  it('builds SoQL paging with a stable order and incremental filter', () => {
    const url = new URL(make(stub([]).f).buildUrl({ cursor: '4', since: '2026-01-01' }));
    expect(url.pathname).toBe('/resource/abcd-1234.json');
    expect(url.searchParams.get('$limit')).toBe('2');
    expect(url.searchParams.get('$offset')).toBe('4');
    expect(url.searchParams.get('$order')).toBe('sale_date,:id');
    expect(url.searchParams.get('$where')).toBe("sale_date >= '2026-01-01T00:00:00'");
  });
  it('sends the app token as a header, never in the URL, and pages until a short page', async () => {
    const { f, calls } = stub([{ body: [{ id: 'a' }, { id: 'b' }] }, { body: [{ id: 'c' }, { nope: 1 }] }]);
    const c = make(f);
    const p1 = await c.fetchPage({});
    expect(p1.nextCursor).toBe('2');
    expect(calls[0]!.headers['X-App-Token']).toBe('secret-token');
    expect(calls[0]!.url).not.toContain('secret-token');
    const p2 = await c.fetchPage({ cursor: p1.nextCursor! });
    expect(p2.records.map((r) => r.sourceRecordId)).toEqual(['c']);
    expect(p2.skipped).toBe(1);
    expect(p2.nextCursor).toBe('4');
    expect(p1.records[0]).toMatchObject({ licenseTag: 'test', retrievedAt: now() });
  });
  it('maps HTTP failures to typed, retry-aware errors', async () => {
    const cases: [number | Error | 'bad', string, boolean][] = [
      [401, 'unauthorized', false],
      [404, 'not_found', false],
      [429, 'rate_limited', true],
      [503, 'upstream', true],
      [new Error('ECONNRESET'), 'network', true],
      ['bad', 'invalid_response', false],
    ];
    for (const [r, kind, retryable] of cases) {
      const s = r instanceof Error ? stub([{ throws: r }]) : r === 'bad' ? stub([{ badJson: true }]) : stub([{ status: r }]);
      const err = await make(s.f).fetchPage({}).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SourceError);
      expect((err as SourceError).kind).toBe(kind);
      expect((err as SourceError).retryable).toBe(retryable);
    }
    const notArray = await make(stub([{ body: { rows: [] } }]).f).fetchPage({}).catch((e: unknown) => e);
    expect((notArray as SourceError).kind).toBe('invalid_response');
  });
  it('rejects unsafe configuration and query values', () => {
    expect(() => new SocrataConnector({ sourceKey: 'x', county, category: 'recorder', license, domain: 'data.example.gov', datasetId: 'bad', orderBy: 'a', map: passthrough })).toThrow(/4x4/);
    expect(() => new SocrataConnector({ sourceKey: 'x', county, category: 'recorder', license, domain: 'a.gov', datasetId: 'abcd-1234', orderBy: 'a; drop', map: passthrough })).toThrow(/identifier/);
    expect(() => make(stub([]).f).buildUrl({ since: "2026-01-01' OR 1=1" })).toThrow(/YYYY-MM-DD/);
    expect(() => make(stub([]).f).buildUrl({ cursor: '-1' })).toThrow(/cursor/);
  });
  it('refuses to build a connector for a source that prohibits automated access', () => {
    expect(() => new SocrataConnector({ sourceKey: 'x', county, category: 'recorder', license: { ...license, automatedAccess: 'prohibited' }, domain: 'a.gov', datasetId: 'abcd-1234', orderBy: 'a', map: passthrough })).toThrow(/prohibit automated access/);
  });
});

describe('ArcGisConnector', () => {
  const layerUrl = 'https://gis.example.gov/arcgis/rest/services/Open_Data_Parcels/MapServer/0';
  const make = (f: FetchLike) => new ArcGisConnector({ sourceKey: 'cuy.test', county, category: 'assessor', license, layerUrl, orderBy: 'OBJECTID', sinceField: 'LAST_UPDATE', outFields: ['OBJECTID', 'PARCEL'], map: (row, ctx) => passthrough({ id: String(row['OBJECTID']) }, ctx), pageSize: 2, http: { fetch: f }, now });
  it('builds a query URL without geometry and with a date filter', () => {
    const u = new URL(make(stub([]).f).buildUrl({ since: '2026-10-01' }));
    expect(u.pathname.endsWith('/MapServer/0/query')).toBe(true);
    expect(u.searchParams.get('where')).toBe("1=1 AND LAST_UPDATE >= DATE '2026-10-01'");
    expect(u.searchParams.get('returnGeometry')).toBe('false');
    expect(u.searchParams.get('outFields')).toBe('OBJECTID,PARCEL');
  });
  it('follows exceededTransferLimit for paging and surfaces ArcGIS error bodies', async () => {
    const p = await make(stub([{ body: { features: [{ attributes: { OBJECTID: 1 } }], exceededTransferLimit: true } }]).f).fetchPage({});
    expect(p.nextCursor).toBe('1');
    const done = await make(stub([{ body: { features: [{ attributes: { OBJECTID: 1 } }, { attributes: { OBJECTID: 2 } }], exceededTransferLimit: false } }]).f).fetchPage({});
    expect(done.nextCursor).toBeNull();
    const err = await make(stub([{ body: { error: { code: 400, message: 'Invalid query' } } }]).f).fetchPage({}).catch((e: unknown) => e);
    expect((err as SourceError).kind).toBe('upstream');
    const bad = await make(stub([{ body: {} }]).f).fetchPage({}).catch((e: unknown) => e);
    expect((bad as SourceError).kind).toBe('invalid_response');
    expect(() => new ArcGisConnector({ sourceKey: 'x', county, category: 'assessor', license, layerUrl: 'http://insecure/MapServer/0', orderBy: 'a', map: passthrough })).toThrow();
  });
});

describe('CartoConnector and pilot mappings', () => {
  const make = (f: FetchLike) => new CartoConnector({ sourceKey: 'phl.rtt_summary', county, category: 'recorder', license, endpoint: 'https://phl.carto.com/api/v2/sql', table: 'rtt_summary', orderBy: 'recording_date', map: mapPhillyRtt, pageSize: 100, http: { fetch: f }, now });
  it('builds deterministic SQL from validated identifiers', () => {
    expect(make(stub([]).f).buildSql({ cursor: '200', since: '2026-10-01' })).toBe("SELECT * FROM rtt_summary WHERE recording_date >= '2026-10-01' ORDER BY recording_date, cartodb_id LIMIT 100 OFFSET 200");
    expect(() => new CartoConnector({ sourceKey: 'x', county, category: 'recorder', license, endpoint: 'https://phl.carto.com/api/v2/sql', table: 'rtt; drop table x', orderBy: 'a', map: passthrough })).toThrow();
  });
  it('maps a Philadelphia deed into an instrument and a sale event', async () => {
    const row = { document_id: '53987654', document_type: 'DEED', recording_date: '2026-10-03T00:00:00Z', document_date: '2026-09-30T00:00:00Z', grantors: 'DOE JOHN; DOE MARY', grantees: 'ACME HOLDINGS LLC', total_consideration: 185000, street_address: '1234 N 5TH ST', zip_code: '19122', opa_account_num: '881234500' };
    const p = await make(stub([{ body: { rows: [row, { document_type: 'DEED' }] } }]).f).fetchPage({});
    expect(p.skipped).toBe(1);
    const r = p.records[0]!;
    expect(r.instrument).toMatchObject({ instrumentType: 'DEED', recordedDate: '2026-10-03', instrumentDate: '2026-09-30', consideration: 185000, apn: '881234500' });
    expect(r.instrument!.parties).toEqual([
      { role: 'grantor', name: 'DOE JOHN' },
      { role: 'grantor', name: 'DOE MARY' },
      { role: 'grantee', name: 'ACME HOLDINGS LLC' },
    ]);
    expect(r.event).toEqual({ eventType: 'recent_sale', status: 'completed', eventDate: '2026-10-03', amount: 185000 });
  });
  it('keeps mortgages as instruments only (no balance or event inferred)', () => {
    const r = mapPhillyRtt({ document_id: '1', document_type: 'MORTGAGE', recording_date: '2026-10-03', total_consideration: 150000 }, { sourceKey: 'k', licenseTag: 't', retrievedAt: now() })!;
    expect(r.event).toBeUndefined();
    expect(r.instrument!.consideration).toBe(150000);
  });
  it('maps violation statuses and Cook sales; skips unmappable rows', () => {
    const ctx = { sourceKey: 'k', licenseTag: 't', retrievedAt: now() };
    expect(mapPhillyViolation({ casenumber: 'C1', violationstatus: 'OPEN', violationdate: '2026-05-01' }, ctx)!.event).toMatchObject({ status: 'active', eventType: 'code_violation' });
    expect(mapPhillyViolation({ casenumber: 'C2', violationstatus: 'COMPLIED' }, ctx)!.event!.status).toBe('resolved');
    expect(mapPhillyViolation({ casenumber: 'C3', violationstatus: 'WEIRD' }, ctx)).toBeNull();
    const sale = mapCookSale({ doc_no: '2601234567', pin: '14-21-101-001-0000', sale_date: '2026-08-01T00:00:00.000', sale_price: '420000', deed_type: 'Warranty', seller_name: 'A', buyer_name: 'B' }, ctx)!;
    expect(sale).toMatchObject({ sourceRecordId: '2601234567:14-21-101-001-0000', apn: '14-21-101-001-0000' });
    expect(sale.event).toMatchObject({ eventDate: '2026-08-01', amount: 420000 });
    expect(mapCookSale({ pin: 'x' }, ctx)).toBeNull();
  });
  it('maps sheriff sale statuses into the lifecycle', () => {
    expect(['withdrawn', 'bankruptcy', 'postponed', 'cancelled', 'unsold', 'sold', 'Scheduled', '???'].map(mapSheriffSaleStatus)).toEqual(['withdrawn', 'postponed', 'postponed', 'cancelled', 'expired', 'completed', 'scheduled', null]);
  });
});

describe('county registry', () => {
  it('has unique keys, valid FIPS codes, and no source marked verified without live checks', () => {
    const keys = COUNTY_SOURCES.map((s) => s.sourceKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of COUNTY_SOURCES) {
      expect(s.county.countyFips).toMatch(/^\d{5}$/);
      expect(s.status).not.toBe('verified');
      expect(s.mappingVerified).toBe(false);
      expect(s.license.automatedAccess).not.toBe('prohibited');
    }
  });
  it('builds connectors only for built sources', () => {
    expect(buildConnector('phl.rtt_summary').sourceKey).toBe('phl.rtt_summary');
    expect(buildConnector('cook.parcel_sales').county.countyFips).toBe('17031');
    expect(buildConnector('phl.li_violations').category).toBe('code_enforcement');
    expect(() => buildConnector('cook.tax_sale')).toThrow(/planned/);
    expect(() => buildConnector('nope')).toThrow(/unknown/);
  });
});

describe('runIngestion', () => {
  const parcels = Array.from({ length: 15 }, (_, i) => ({
    parcelId: `parcel-${i}`,
    countyFips: '00000',
    apn: `DEMO${1000 + i}`,
    address: normalizeAddress({ line1: `${100 + i} Maple Ave`, postalCode: '00000' }),
  }));
  it('ingests, links, records events, and is idempotent on re-run', async () => {
    const store = new MemoryDiscoverStore(parcels);
    const c = new DemoCountyConnector(25);
    const r1 = await runIngestion({ connector: c, store, runId: 'run-1', now, pageSize: 10 });
    expect(r1).toMatchObject({ status: 'succeeded', pages: 3, fetched: 25, inserted: 25, unchanged: 0, matched: 25, eventsAppended: 25, nextCursor: null });
    const r2 = await runIngestion({ connector: c, store, runId: 'run-2', now, pageSize: 10 });
    expect(r2).toMatchObject({ status: 'succeeded', inserted: 0, unchanged: 25, eventsAppended: 0 });
    expect(store.records).toHaveLength(25);
    expect(store.events).toHaveLength(25);
    expect(store.runs.get('run-2')!.finishedAt).toBe(now());
  });
  it('appends new versions when a source record changes, without touching history', async () => {
    const store = new MemoryDiscoverStore(parcels);
    const c = new DemoCountyConnector(1);
    await runIngestion({ connector: c, store, runId: 'a', now });
    const changed = new DemoCountyConnector(1);
    const orig = changed.fetchPage.bind(changed);
    changed.fetchPage = async (req) => {
      const p = await orig(req);
      p.records[0]!.event = { ...p.records[0]!.event!, status: 'resolved' };
      return p;
    };
    const r = await runIngestion({ connector: changed, store, runId: 'b', now });
    expect(r).toMatchObject({ inserted: 1, eventsAppended: 1, anomalies: 0 });
    expect(store.records.map((x) => x.version)).toEqual([1, 2]);
    expect(store.events.map((e) => [e.version, e.status])).toEqual([[1, 'active'], [2, 'resolved']]);
  });
  it('queues uncertain matches for review instead of linking them', async () => {
    const store = new MemoryDiscoverStore([{ parcelId: 'x', countyFips: '00000', apn: null, address: normalizeAddress({ line1: '100 Maple Avenue', postalCode: '00000' }) }]);
    const c = new DemoCountyConnector(1);
    c.fetchPage = async () => ({ records: [{ ...(await new DemoCountyConnector(1).fetchPage({})).records[0]!, apn: undefined, address: { line1: '100 Mapel Ave', postalCode: '00000' } }], nextCursor: null, skipped: 0 });
    const r = await runIngestion({ connector: c, store, runId: 'r', now });
    expect(r).toMatchObject({ matched: 0, queuedForReview: 1 });
    expect(store.links.size).toBe(0);
    expect(store.reviews[0]!.result.decision).toBe('review');
  });
  it('records partial and failed runs with the resume cursor', async () => {
    const store = new MemoryDiscoverStore();
    const c = new DemoCountyConnector(30);
    const limited = await runIngestion({ connector: c, store, runId: 'p', now, pageSize: 10, maxPages: 1 });
    expect(limited).toMatchObject({ status: 'partial', nextCursor: '10', unmatched: 10 });
    const failing = new DemoCountyConnector(5);
    failing.fetchPage = async () => {
      throw new SourceError('rate_limited', 'slow down', 429);
    };
    const f = await runIngestion({ connector: failing, store, runId: 'f', now });
    expect(f).toMatchObject({ status: 'failed', error: 'rate_limited: slow down' });
  });
  it('refuses to mix demo and live records', async () => {
    const store = new MemoryDiscoverStore();
    const c = new DemoCountyConnector(1);
    c.fetchPage = async () => ({ records: [{ ...(await new DemoCountyConnector(1).fetchPage({})).records[0]!, demo: false }], nextCursor: null, skipped: 0 });
    const r = await runIngestion({ connector: c, store, runId: 'm', now });
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/must not be mixed/);
  });
  it('ignores retrieval time when hashing content', async () => {
    const [a] = (await new DemoCountyConnector(1, '2026-01-01T00:00:00Z').fetchPage({})).records;
    const [b] = (await new DemoCountyConnector(1, '2026-06-01T00:00:00Z').fetchPage({})).records;
    expect(contentHash(a!)).toBe(contentHash(b!));
  });
  it('enforces append-only event versions in the memory store', async () => {
    const store = new MemoryDiscoverStore();
    const v = { sourceKey: 's', sourceRecordId: 'r', version: 1, eventType: 'code_violation' as const, status: 'active' as const, eventDate: null, filedDate: null, scheduledDate: null, amount: null, discoveredAt: now(), supersedesVersion: null, origin: 'source' as const, anomaly: null };
    await store.appendEventVersion(v);
    await expect(store.appendEventVersion(v)).rejects.toThrow(/append-only/);
  });
});
