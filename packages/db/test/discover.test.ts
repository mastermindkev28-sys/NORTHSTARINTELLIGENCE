/**
 * Discover schema (0003): global public-record data is written only by the ingest role, readable by
 * signed-in members only for license-displayable sources, append-only where history matters; tenant
 * buy boxes and watchlists follow standard tenant isolation.
 */
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { INVESTMENT_STRATEGIES } from '../../core/src/strategies';
import { createDb, repo, withAnonymous, withTenant, type Db } from '../src/index';

const available = inject('dbAvailable');
const d = available ? describe : describe.skip;
const HASH = 'scrypt$N=16384,r=8,p=1$c2FsdA$aGFzaA';

let db: Db;
let owner: pg.Client;
let ingest: pg.Client;
interface Tenant {
  userId: string;
  orgId: string;
}
let acme: Tenant;
let beta: Tenant;
let parcelId: string;

async function signUp(prefix: string): Promise<Tenant> {
  const slug = `${prefix}-${randomBytes(3).toString('hex')}`;
  return withAnonymous(db, (tx) => repo.signUp(tx, { email: `${slug}@example.com`, displayName: prefix, passwordHash: HASH, orgName: prefix, orgSlug: slug }));
}
const as = <T>(t: Tenant, fn: (tx: pg.PoolClient) => Promise<T>) => withTenant(db, t, fn);

const source = (key: string, display: 'permitted' | 'not_stated', status = 'built') =>
  ingest.query(
    `insert into discover.county_sources (source_key, state, county_fips, county_name, category, title, platform, status, license_tag, license_name, automated_access, commercial_display)
     values ($1, 'PA', '42101', 'Philadelphia County', 'code_enforcement', 'Test', 'carto', $3, 'tag', 'License', 'permitted', $2)`,
    [key, display, status],
  );
const event = (key: string, id: string, version: number, status = 'active') =>
  ingest.query(
    `insert into discover.property_events (source_key, source_record_id, version, event_type, status, discovered_at, supersedes_version)
     values ($1, $2, $3, 'code_violation', $4, now(), $5)`,
    [key, id, version, status, version === 1 ? null : version - 1],
  );

d('database: discover schema (global data + tenant buy boxes)', () => {
  beforeAll(async () => {
    db = createDb(inject('appUrl'));
    owner = new pg.Client({ connectionString: inject('ownerUrl') });
    ingest = new pg.Client({ connectionString: inject('ingestUrl') });
    await owner.connect();
    await ingest.connect();
    acme = await signUp('acme');
    beta = await signUp('beta');
    await source('phl.open', 'permitted');
    await source('cook.unstated', 'not_stated');
    const p = await ingest.query<{ id: string }>(`insert into discover.parcels (state, county_fips, apn, apn_normalized, address_line1, postal_code, address_key) values ('PA', '42101', '88-1234500', '881234500', '12 OAK ST', '19104', '12 OAK ST||19104') returning id`);
    parcelId = p.rows[0]!.id;
    await event('phl.open', 'V1', 1);
    await event('phl.open', 'V1', 2, 'resolved');
    await event('cook.unstated', 'S1', 1);
    await ingest.query(`insert into discover.record_links (source_key, source_record_id, parcel_id, confidence, method) values ('phl.open', 'V1', $1, 0.99, 'auto')`, [parcelId]);
  });
  afterAll(async () => {
    await db?.end();
    await owner?.end();
    await ingest?.end();
  });

  it('every discover table has RLS enabled and forced', async () => {
    const { rows } = await owner.query(`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'discover' and c.relkind = 'r'`);
    expect(rows.length).toBe(7);
    for (const r of rows) expect([r.relname, r.relrowsecurity, r.relforcerowsecurity]).toEqual([r.relname, true, true]);
  });

  it('the ingest role cannot bypass RLS', async () => {
    const { rows } = await owner.query(`select rolbypassrls, rolsuper, rolcanlogin from pg_roles where rolname = 'northstar_ingest'`);
    expect(rows[0]).toEqual({ rolbypassrls: false, rolsuper: false, rolcanlogin: false });
  });

  it('members read parcels and events from displayable sources only', async () => {
    const parcels = await as(acme, (tx) => tx.query('select id from discover.parcels'));
    expect(parcels.rows.map((r) => r.id)).toEqual([parcelId]);
    const events = await as(beta, (tx) => tx.query('select source_key, version from discover.property_events order by version'));
    expect(events.rows).toEqual([
      { source_key: 'phl.open', version: 1 },
      { source_key: 'phl.open', version: 2 },
    ]);
    const current = await as(acme, (tx) => tx.query('select source_record_id, status, parcel_id from discover.current_property_events'));
    expect(current.rows).toEqual([{ source_record_id: 'V1', status: 'resolved', parcel_id: parcelId }]);
  });

  it('anonymous sessions and forged org ids see no global data', async () => {
    const anon = await withAnonymous(db, (tx) => tx.query('select count(*)::int as n from discover.parcels'));
    expect(anon.rows[0].n).toBe(0);
    const forged = await withTenant(db, { userId: acme.userId, orgId: beta.orgId }, (tx) => tx.query('select count(*)::int as n from discover.parcels'));
    expect(forged.rows[0].n).toBe(0);
  });

  it('members cannot write global data or read internal tables', async () => {
    await expect(as(acme, (tx) => tx.query(`insert into discover.parcels (state, county_fips) values ('PA', '42101')`))).rejects.toThrow(/permission denied/);
    await expect(as(acme, (tx) => tx.query(`update discover.parcels set city = 'X'`))).rejects.toThrow(/permission denied/);
    await expect(as(acme, (tx) => tx.query('select * from discover.match_reviews'))).rejects.toThrow(/permission denied/);
    await expect(as(acme, (tx) => tx.query('select * from discover.ingestion_runs'))).rejects.toThrow(/permission denied/);
  });

  it('source records and events are append-only, even for the owner', async () => {
    await ingest.query(`insert into discover.source_records (source_key, source_record_id, version, content_hash, category, retrieved_at, license_tag) values ('phl.open', 'R1', 1, '0123456789abcdef', 'code_enforcement', now(), 'tag')`);
    await expect(ingest.query(`update discover.source_records set license_tag = 'x'`)).rejects.toThrow(/append-only|permission denied/);
    await expect(owner.query(`update discover.property_events set status = 'active'`)).rejects.toThrow(/append-only/);
    await expect(owner.query(`delete from discover.source_records`)).rejects.toThrow(/append-only/);
    await expect(ingest.query(`insert into discover.source_records (source_key, source_record_id, version, content_hash, category, retrieved_at, license_tag) values ('phl.open', 'R1', 2, '0123456789abcdef', 'code_enforcement', now(), 'tag')`)).rejects.toThrow(/duplicate key/);
  });

  it('enforces version chains, the auto-link threshold, and license rules', async () => {
    await expect(ingest.query(`insert into discover.property_events (source_key, source_record_id, version, event_type, status, discovered_at, supersedes_version) values ('phl.open', 'V9', 3, 'code_violation', 'active', now(), 1)`)).rejects.toThrow(/check constraint/);
    await expect(event('phl.open', 'V1', 2)).rejects.toThrow(/duplicate key/);
    await expect(ingest.query(`insert into discover.record_links (source_key, source_record_id, parcel_id, confidence, method) values ('phl.open', 'V2', $1, 0.7, 'auto')`, [parcelId])).rejects.toThrow(/record_links_auto_threshold/);
    await ingest.query(`insert into discover.record_links (source_key, source_record_id, parcel_id, confidence, method, decided_by) values ('phl.open', 'V2', $1, 0.7, 'human', 'reviewer@northstar')`, [parcelId]);
    await expect(
      ingest.query(`insert into discover.county_sources (source_key, state, county_fips, county_name, category, title, platform, status, license_tag, license_name, automated_access, commercial_display) values ('x.prohibited', 'PA', '42101', 'X', 'tax', 'X', 'manual', 'built', 't', 'n', 'prohibited', 'prohibited')`),
    ).rejects.toThrow(/county_sources_no_prohibited_ingest/);
    await expect(source('x.badverify', 'permitted', 'verified')).rejects.toThrow(/county_sources_verified_has_date/);
  });

  it('only one open review per record, and decisions must be complete', async () => {
    const q = `insert into discover.match_reviews (source_key, source_record_id, confidence, candidates) values ('phl.open', 'M1', 0.7, '[]')`;
    await ingest.query(q);
    await expect(ingest.query(q)).rejects.toThrow(/duplicate key/);
    await expect(ingest.query(`update discover.match_reviews set status = 'linked' where source_record_id = 'M1'`)).rejects.toThrow(/check constraint/);
    await ingest.query(`update discover.match_reviews set status = 'linked', resolved_parcel_id = $1, decided_at = now(), decided_by = 'reviewer' where source_record_id = 'M1'`, [parcelId]);
  });

  it('the strategy enum matches the shared TypeScript list', async () => {
    const { rows } = await owner.query(`select unnest(enum_range(null::app.investment_strategy))::text as v`);
    expect(rows.map((r) => r.v)).toEqual([...INVESTMENT_STRATEGIES]);
  });

  describe('tenant tables', () => {
    it('buy boxes, profiles and watchlists are isolated per tenant', async () => {
      const prof = await as(acme, (tx) => tx.query(`insert into investor_profiles (name, experience, risk_tolerance, financing, strategies) values ('Core', 'experienced', 'moderate', '{cash,dscr}', '{buy_and_hold,brrrr}') returning id`));
      const profileId = prof.rows[0].id as string;
      await as(acme, (tx) => tx.query(`insert into buy_boxes (name, strategies, investor_profile_id, criteria) values ('Philly rentals', '{buy_and_hold}', $1, '{"maxPrice": 200000}')`, [profileId]));
      await as(acme, (tx) => tx.query('insert into watchlist_items (parcel_id) values ($1)', [parcelId]));
      await as(acme, (tx) => tx.query(`insert into saved_searches (name, filters) values ('Open violations', '{"signal": "code_violation"}')`));
      for (const t of ['investor_profiles', 'buy_boxes', 'watchlist_items', 'saved_searches']) {
        expect((await as(acme, (tx) => tx.query(`select count(*)::int as n from ${t}`))).rows[0].n).toBe(1);
        expect((await as(beta, (tx) => tx.query(`select count(*)::int as n from ${t}`))).rows[0].n).toBe(0);
      }
      await expect(as(beta, (tx) => tx.query(`insert into buy_boxes (name, strategies, investor_profile_id) values ('steal', '{wholesale}', $1)`, [profileId]))).rejects.toThrow(/does not belong/);
    });
    it('validates strategies, financing and criteria shape', async () => {
      await expect(as(acme, (tx) => tx.query(`insert into buy_boxes (name, strategies) values ('x', '{flip}')`))).rejects.toThrow(/invalid input value for enum/);
      await expect(as(acme, (tx) => tx.query(`insert into buy_boxes (name, strategies) values ('x', '{}')`))).rejects.toThrow(/check constraint/);
      await expect(as(acme, (tx) => tx.query(`insert into buy_boxes (name, strategies, criteria) values ('x', '{wholesale}', '[]')`))).rejects.toThrow(/check constraint/);
      await expect(as(acme, (tx) => tx.query(`insert into investor_profiles (name, experience, risk_tolerance, financing) values ('x', 'new', 'low', '{crypto}')`))).rejects.toThrow(/check constraint/);
    });
    it('viewers cannot create buy boxes', async () => {
      const u = await owner.query<{ id: string }>(`insert into users (email, display_name, password_hash) values ($1, 'Viewer', $2) returning id`, [`v-${randomBytes(4).toString('hex')}@example.com`, HASH]);
      await owner.query(`insert into memberships (org_id, user_id, role) values ($1, $2, 'viewer')`, [acme.orgId, u.rows[0]!.id]);
      const viewer = { userId: u.rows[0]!.id, orgId: acme.orgId };
      await expect(as(viewer, (tx) => tx.query(`insert into buy_boxes (name, strategies) values ('x', '{wholesale}')`))).rejects.toThrow(/row-level security/);
      expect((await as(viewer, (tx) => tx.query('select count(*)::int as n from buy_boxes'))).rows[0].n).toBe(1);
    });
  });
});
