import { describe, expect, it, vi } from 'vitest';
import {
  MockMessagingProvider,
  MockPropertyProvider,
  ProviderError,
  RentCastProvider,
  checkCompliance,
  collectFieldValues,
  createMessenger,
  createPropertyProvider,
  isOptOutKeyword,
  type OutboundMessage,
} from '../src/index';

const q = { line1: '123 Maple St', city: 'Austin', state: 'TX', postalCode: '78701' };

describe('MockPropertyProvider', () => {
  const p = new MockPropertyProvider();
  it('is deterministic and always flagged as demo data', async () => {
    const a = await p.getProperty(q);
    const b = await p.getProperty({ ...q, line1: '123  maple st' });
    expect({ ...a, address: null }).toEqual({ ...b, address: null });
    expect(a.demo).toBe(true);
    expect(a.livingSqft.provenance).toMatchObject({ provider: 'mock', licenseTag: 'demo' });
    expect(a.lastSale).toMatchObject({ value: null, reason: 'not_provided' });
  });
  it('labels comps and owners as demo', async () => {
    const comps = await p.getComps({ ...q, maxResults: 4 });
    expect(comps).toHaveLength(4);
    expect(comps.every((c) => c.demo && c.address.includes('DEMO'))).toBe(true);
    expect((await p.getOwner(q)).names.value).toEqual(['DEMO OWNER']);
    expect((await p.getSalesHistory(q))[0]!.documentType).toMatch(/DEMO/);
  });
  it('produces value and rent estimates with ranges', async () => {
    const v = await p.getValueEstimate(q);
    expect(v.value.value).toBeGreaterThan(0);
    expect(v.low!).toBeLessThan(v.value.value!);
    const r = await p.getRentEstimate(q);
    expect(r.value.value! % 25).toBe(0);
  });
});

function fakeFetch(routes: Record<string, { status?: number; body: unknown }>) {
  return vi.fn(async (url: URL | string) => {
    const u = new URL(String(url));
    const route = routes[u.pathname];
    if (!route) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
}

const rcRecord = {
  id: 'rc-1',
  addressLine1: '123 Maple St',
  city: 'Austin',
  state: 'TX',
  zipCode: '78701',
  county: 'Travis',
  propertyType: 'Single Family',
  bedrooms: 3,
  bathrooms: 2,
  squareFootage: 1600,
  lotSize: 6000,
  yearBuilt: 1984,
  assessorID: '0123-45',
  lastSaleDate: '2018-04-02T00:00:00.000Z',
  lastSalePrice: 210000,
  ownerOccupied: false,
  owner: { names: ['JANE DOE'], mailingAddress: { formattedAddress: 'PO Box 1, Austin, TX 78701' } },
  history: { '2018-04-02': { event: 'Sale', date: '2018-04-02T00:00:00.000Z', price: 210000 }, '2009-01-10': { event: 'Sale', date: '2009-01-10T00:00:00.000Z', price: 120000 } },
};

describe('RentCastProvider', () => {
  const now = () => new Date('2026-11-10T12:00:00Z');
  it('maps property, owner, and history with provenance and meters calls', async () => {
    const meter = vi.fn();
    const f = fakeFetch({ '/v1/properties': { body: [rcRecord] } });
    const p = new RentCastProvider({ apiKey: 'k', fetch: f, meter, now });
    const prop = await p.getProperty(q);
    expect(prop.livingSqft).toEqual({ value: 1600, provenance: { provider: 'rentcast', providerRecordId: 'rc-1', retrievedAt: '2026-11-10T12:00:00.000Z', confidence: 0.8, licenseTag: 'rentcast-standard' } });
    expect(prop.lastSale.value).toEqual({ date: '2018-04-02', price: 210000 });
    expect(prop.demo).toBe(false);
    const owner = await p.getOwner(q);
    expect(owner.names.value).toEqual(['JANE DOE']);
    expect(owner.ownerOccupied.value).toBe(false);
    const hist = await p.getSalesHistory(q);
    expect(hist.map((h) => h.date)).toEqual(['2018-04-02', '2009-01-10']);
    expect(meter).toHaveBeenCalledWith({ provider: 'rentcast', operation: 'property', billable: true });
    const call = (f as unknown as { mock: { calls: [URL, RequestInit][] } }).mock.calls[0]!;
    expect(String(call[0])).toContain('address=123+Maple+St%2C+Austin%2C+TX+78701');
    expect((call[1].headers as Record<string, string>)['X-Api-Key']).toBe('k');
  });
  it('returns null-with-reason for missing fields instead of inventing values', async () => {
    const p = new RentCastProvider({ apiKey: 'k', fetch: fakeFetch({ '/v1/properties': { body: [{ id: 'x', bedrooms: 'three' }] } }), now });
    const prop = await p.getProperty(q);
    expect(prop.bedrooms).toMatchObject({ value: null, reason: 'not_provided' });
    expect(prop.address.value).toBeNull();
    expect((await p.getOwner(q)).names.value).toBeNull();
  });
  it('maps comps, dropping incomplete ones and enforcing radius', async () => {
    const p = new RentCastProvider({
      apiKey: 'k',
      now,
      fetch: fakeFetch({
        '/v1/avm/value': {
          body: {
            price: 320000,
            priceRangeLow: 300000,
            priceRangeHigh: 340000,
            comparables: [
              { id: 'c1', formattedAddress: '1 A St', price: 310000, squareFootage: 1550, removedDate: '2026-09-01', distance: 0.4, bedrooms: 3, bathrooms: 2 },
              { id: 'c2', formattedAddress: '2 B St', price: 300000, squareFootage: null, listedDate: '2026-08-01', distance: 0.5 },
              { id: 'c3', formattedAddress: '3 C St', price: 290000, squareFootage: 1500, listedDate: '2026-08-01', distance: 3 },
            ],
          },
        },
        '/v1/avm/rent/long-term': { body: { rent: 1850, rentRangeLow: 1700, rentRangeHigh: 2000 } },
      }),
    });
    const comps = await p.getComps({ ...q, radiusMiles: 1 });
    expect(comps.map((c) => c.providerRecordId)).toEqual(['c1']);
    expect(comps[0]!.provenance.confidence).toBe(0.6);
    expect(await p.getValueEstimate(q)).toMatchObject({ value: { value: 320000 }, low: 300000, high: 340000 });
    expect(await p.getRentEstimate(q)).toMatchObject({ value: { value: 1850 }, low: 1700, high: 2000 });
  });
  it.each([
    [401, 'unauthorized', false],
    [404, 'not_found', false],
    [429, 'rate_limited', true],
    [503, 'upstream', true],
    [400, 'upstream', false],
  ])('maps HTTP %i to %s (retryable=%s)', async (status, kind, retryable) => {
    const p = new RentCastProvider({ apiKey: 'k', fetch: fakeFetch({ '/v1/properties': { status, body: {} } }) });
    await expect(p.getProperty(q)).rejects.toMatchObject({ kind, retryable });
  });
  it('handles empty results, network errors, and non-JSON bodies', async () => {
    await expect(new RentCastProvider({ apiKey: 'k', fetch: fakeFetch({ '/v1/properties': { body: [] } }) }).getProperty(q)).rejects.toMatchObject({ kind: 'not_found' });
    const boom = vi.fn(async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    await expect(new RentCastProvider({ apiKey: 'k', fetch: boom }).getProperty(q)).rejects.toMatchObject({ kind: 'upstream', retryable: true });
    const html = vi.fn(async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch;
    await expect(new RentCastProvider({ apiKey: 'k', fetch: html }).getProperty(q)).rejects.toMatchObject({ kind: 'invalid_response' });
  });
  it('refuses to construct without credentials', () => {
    expect(() => new RentCastProvider({ apiKey: '' })).toThrow(ProviderError);
  });
});

describe('createPropertyProvider', () => {
  it('defaults to the mock and never silently falls back', () => {
    expect(createPropertyProvider({}).id).toBe('mock');
    expect(createPropertyProvider({ PROPERTY_DATA_PROVIDER: 'rentcast', RENTCAST_API_KEY: 'k' }).id).toBe('rentcast');
    expect(() => createPropertyProvider({ PROPERTY_DATA_PROVIDER: 'rentcast' })).toThrow(/RENTCAST_API_KEY/);
    expect(() => createPropertyProvider({ PROPERTY_DATA_PROVIDER: 'realie' })).toThrow(/planned/);
    expect(() => createPropertyProvider({ PROPERTY_DATA_PROVIDER: 'nope' })).toThrow(/Unknown/);
  });
  it('keeps disagreeing provider values side by side', () => {
    expect(collectFieldValues([{ provider: 'a', field: { value: 1600 } }, { provider: 'b', field: { value: 1650 } }, { provider: 'c', field: { value: null } }])).toEqual([
      { provider: 'a', value: 1600 },
      { provider: 'b', value: 1650 },
    ]);
  });
});

describe('messaging compliance', () => {
  const base: OutboundMessage = {
    orgId: 'org',
    channel: 'sms',
    to: '+15125550100',
    body: 'Hi, following up on your property.',
    recipientTimeZone: 'America/Chicago',
    consent: { capturedAt: '2026-11-01T00:00:00Z', method: 'web_form', reference: 'form-1' },
    idempotencyKey: 'k1',
  };
  const noon = () => new Date('2026-11-10T18:00:00Z'); // 12:00 in Chicago
  const night = () => new Date('2026-11-11T04:00:00Z'); // 22:00 in Chicago
  const deps = (suppressed = false, now = noon) => ({ isSuppressed: async () => suppressed, now });

  it('allows compliant messages', async () => {
    expect(await checkCompliance(base, deps())).toEqual({ allowed: true });
  });
  it.each([
    ['suppressed', { ...base }, deps(true)],
    ['no_consent', { ...base, consent: undefined }, deps()],
    ['unknown_timezone', { ...base, recipientTimeZone: undefined }, deps()],
    ['unknown_timezone', { ...base, recipientTimeZone: 'Mars/Olympus' }, deps()],
    ['quiet_hours', { ...base }, deps(false, night)],
    ['invalid_address', { ...base, to: '5125550100' }, deps()],
    ['empty_body', { ...base, body: '  ' }, deps()],
  ])('blocks: %s', async (reason, msg, d) => {
    expect(await checkCompliance(msg as OutboundMessage, d)).toEqual({ allowed: false, reason });
  });
  it('email skips SMS-only rules but still honors suppression', async () => {
    const email = { ...base, channel: 'email' as const, to: 'seller@example.com', consent: undefined, recipientTimeZone: undefined };
    expect(await checkCompliance(email, deps(false, night))).toEqual({ allowed: true });
    expect(await checkCompliance(email, deps(true))).toEqual({ allowed: false, reason: 'suppressed' });
  });
  it('recognizes opt-out keywords', () => {
    for (const k of ['STOP', 'stop', ' Unsubscribe ', 'opt out', 'QUIT.']) expect(isOptOutKeyword(k)).toBe(true);
    for (const k of ['please stop by tomorrow', 'stopping', 'yes']) expect(isOptOutKeyword(k)).toBe(false);
  });
  it('messenger enforces the gate and idempotency, and allows retry after provider failure', async () => {
    const provider = new MockMessagingProvider();
    const send = createMessenger(provider, deps());
    expect(await send(base)).toEqual({ status: 'sent', providerMessageId: 'mock_1' });
    expect(await send(base)).toEqual({ status: 'duplicate' });
    expect(await send({ ...base, idempotencyKey: 'k2', consent: undefined })).toEqual({ status: 'blocked', reason: 'no_consent' });
    expect(provider.sent).toHaveLength(1);

    const flaky = { id: 'flaky', calls: 0, async send() { if (this.calls++ === 0) throw new Error('503'); return { providerMessageId: 'ok' }; } };
    const send2 = createMessenger(flaky, deps());
    await expect(send2(base)).rejects.toThrow('503');
    expect(await send2(base)).toEqual({ status: 'sent', providerMessageId: 'ok' });
  });
});
