/**
 * Market Intelligence schema (0005) against real Postgres with RLS: reference data is shared read-only for the app
 * role and writable only by ingest; tenant watchlists, profiles, rules and alerts are isolated per organization.
 */
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb, marketRepo, repo, withAnonymous, withTenant, type Db } from '../src/index';

const available = inject('dbAvailable');
const d = available ? describe : describe.skip;

const HASH = 'scrypt$N=16384,r=8,p=1$c2FsdA$aGFzaA';
let db: Db;
let ingestDb: Db;
let owner: pg.Client;
interface Tenant { userId: string; orgId: string }
let a: Tenant;
let b: Tenant;
let viewer: Tenant;

async function signUp(prefix: string): Promise<Tenant> {
  const slug = `${prefix}-${randomBytes(3).toString('hex')}`;
  return withAnonymous(db, (tx) => repo.signUp(tx, { email: `${slug}@example.com`, displayName: prefix, passwordHash: HASH, orgName: prefix, orgSlug: slug }));
}

d('market intelligence schema (real Postgres, RLS enforced)', () => {
  beforeAll(async () => {
    db = createDb(inject('appUrl'));
    owner = new pg.Client({ connectionString: inject('ownerUrl') });
    await owner.connect();
    const exists = await owner.query(`select 1 from pg_roles where rolname = 'northstar_test_ingest'`);
    if (exists.rowCount === 0) await owner.query(`create role northstar_test_ingest login nobypassrls password 'ingest-test-only'`);
    await owner.query('grant northstar_ingest to northstar_test_ingest');
    const u = new URL(inject('appUrl'));
    u.username = 'northstar_test_ingest';
    u.password = 'ingest-test-only';
    ingestDb = createDb(u.toString());
    a = await signUp('mkt-a');
    b = await signUp('mkt-b');
    const vu = await owner.query<{ id: string }>(`insert into users (email, display_name, password_hash) values ($1, 'Viewer', $2) returning id`, [`v-${randomBytes(4).toString('hex')}@example.com`, HASH]);
    await owner.query(`insert into memberships (org_id, user_id, role) values ($1, $2, 'viewer')`, [a.orgId, vu.rows[0]!.id]);
    viewer = { userId: vu.rows[0]!.id, orgId: a.orgId };

    await marketRepo.withIngest(ingestDb, async (tx) => {
      await marketRepo.upsertGeoArea(tx, { key: 'state:42', level: 'state', code: '42', name: 'Pennsylvania', parentKey: null, stateCode: 'PA', isDemo: false });
      await marketRepo.upsertGeoArea(tx, { key: 'city:4260000', level: 'city', code: '4260000', name: 'Philadelphia', parentKey: 'state:42', stateCode: 'PA', countyFips: '42101', isDemo: false });
      await marketRepo.upsertGeoArea(tx, { key: 'zip:19134', level: 'zip', code: '19134', name: '19134', parentKey: 'city:4260000', stateCode: 'PA', zcta: '19134', isDemo: false });
      await marketRepo.insertObservation(tx, 'zip:19134', { metric: 'rental_vacancy_rate_pct', value: 7.1, period: '2019–2023 (5-yr)', periodEnd: '2023-12-31', measuredAt: 'zip', sourceId: 'census_acs5', sourceClass: 'official', retrievedAt: '2026-11-10T00:00:00Z', isProjection: false });
      await marketRepo.insertRegulatoryRow(tx, { jurisdictionKey: 'city:4260000', factor: 'just_cause_required', value: true, citationTitle: 'Philadelphia Bill No. 250330-AA', citationSection: 'Phila. Code § 9-804(12)', sourceUrl: 'https://files.amlegal.com/pdffiles/Philadelphia/250330-AA.pdf', effectiveDate: '2026-11-01', retrievedAt: '2026-11-10T00:00:00Z', verification: 'official', notes: null });
    });
  });

  afterAll(async () => {
    await db?.end();
    await ingestDb?.end();
    await owner?.end();
  });

  describe('reference data', () => {
    it('is readable by any signed-in member with provenance intact', async () => {
      const r = await withTenant(db, b, async (tx) => ({
        zips: await marketRepo.listGeoAreas(tx, { level: 'zip' }),
        area: await marketRepo.getGeoArea(tx, 'city:4260000'),
        obs: await marketRepo.getObservations(tx, 'zip:19134'),
        reg: await marketRepo.getRegulatoryRows(tx, ['state:42', 'city:4260000']),
      }));
      expect(r.zips.map((z) => z.key)).toContain('zip:19134');
      expect(r.area).toMatchObject({ name: 'Philadelphia', countyFips: '42101', parentKey: 'state:42' });
      expect(r.obs[0]).toMatchObject({ metric: 'rental_vacancy_rate_pct', value: 7.1, periodEnd: '2023-12-31', sourceId: 'census_acs5', isProjection: false });
      expect(r.reg[0]).toMatchObject({ factor: 'just_cause_required', value: true, effectiveDate: '2026-11-01', jurisdictionName: 'Philadelphia', verification: 'official' });
    });

    it('is not readable anonymously', async () => {
      const n = await withAnonymous(db, async (tx) => (await tx.query('select count(*)::int as n from geo_areas')).rows[0].n);
      expect(n).toBe(0);
    });

    it('cannot be written by the app role, even by an owner', async () => {
      await expect(withTenant(db, a, (tx) => tx.query(`insert into geo_areas (key, level, code, name) values ('state:99', 'state', '99', 'Nowhere')`))).rejects.toThrow(/permission denied/);
      await expect(withTenant(db, a, (tx) => tx.query(`update geo_metric_observations set value = 0`))).rejects.toThrow(/permission denied/);
      await expect(withTenant(db, a, (tx) => tx.query(`delete from regulatory_factors`))).rejects.toThrow(/permission denied/);
    });

    it('regulatory factors are append-only even for ingest', async () => {
      await expect(marketRepo.withIngest(ingestDb, (tx) => tx.query(`update regulatory_factors set notes = 'x'`))).rejects.toThrow(/permission denied|append-only/);
      await expect(owner.query(`delete from regulatory_factors`)).rejects.toThrow(/append-only/);
    });

    it('rejects protected-characteristic metrics, invalid values and malformed keys at the database', async () => {
      const ins = (metric: string, value = 1) => marketRepo.withIngest(ingestDb, (tx) => marketRepo.insertObservation(tx, 'zip:19134', { metric, value, period: '2024', periodEnd: '2024-12-31', measuredAt: 'zip', sourceId: 'x', sourceClass: 'official', retrievedAt: '2026-11-10T00:00:00Z', isProjection: false }));
      for (const m of ['pct_hispanic', 'median_age', 'households_with_children', 'disability_rate', 'foreign_born_share']) await expect(ins(m)).rejects.toThrow(/geo_metric_not_protected/);
      await expect(ins('rent_growth_1y_pct', Number.NaN)).rejects.toThrow(/check constraint/);
      await expect(marketRepo.withIngest(ingestDb, (tx) => marketRepo.upsertGeoArea(tx, { key: 'zip:19134', level: 'state', code: 'x', name: 'mismatch', parentKey: null, stateCode: null, isDemo: false }))).rejects.toThrow(/check constraint/);
      expect(await ins('rent_growth_1y_pct', 2)).toBe(true);
      expect(await ins('rent_growth_1y_pct', 2)).toBe(false); // idempotent re-ingest
    });
  });

  describe('tenant watchlists, profiles, rules and alerts', () => {
    let wl: string;
    beforeAll(async () => {
      wl = await withTenant(db, a, async (tx) => {
        const id = await marketRepo.createWatchlist(tx, { name: 'Pilot markets', strategy: 'buy_and_hold' });
        await marketRepo.addWatchlistItem(tx, { watchlistId: id, areaKey: 'zip:19134', areaName: '19134' });
        await marketRepo.createAlertRule(tx, id, { kind: 'score_change', minPoints: 5 });
        await marketRepo.insertAlerts(tx, id, [{ dedupeKey: 'k1', areaKey: 'zip:19134', areaName: '19134', kind: 'score_change', severity: 'caution', title: 'Score down', detail: 'd', evidence: { oldValue: 60, newValue: 52 } }]);
        await marketRepo.createScoreProfile(tx, { name: 'Cash flow first', baseProfile: 'buy_and_hold', categoryWeights: { rental_economics: 40 } });
        return id;
      });
    });

    it('a tenant sees only its own market records', async () => {
      const mine = await withTenant(db, a, async (tx) => ({ w: await marketRepo.listWatchlists(tx), i: await marketRepo.listWatchlistItems(tx), r: await marketRepo.listAlertRules(tx), al: await marketRepo.listAlerts(tx), p: await marketRepo.listScoreProfiles(tx) }));
      expect(mine.w).toHaveLength(1);
      expect(mine.w[0]).toMatchObject({ name: 'Pilot markets', strategy: 'buy_and_hold', itemCount: 1, openAlerts: 1 });
      expect(mine.i).toHaveLength(1);
      expect(mine.r[0]!.rule).toEqual({ kind: 'score_change', minPoints: 5 });
      expect(mine.al[0]!.evidence).toEqual({ oldValue: 60, newValue: 52 });
      expect(mine.p[0]!.categoryWeights).toEqual({ rental_economics: 40 });
      const theirs = await withTenant(db, b, async (tx) => ({ w: await marketRepo.listWatchlists(tx), i: await marketRepo.listWatchlistItems(tx), al: await marketRepo.listAlerts(tx), p: await marketRepo.listScoreProfiles(tx), raw: (await tx.query('select count(*)::int as n from market_alerts')).rows[0].n }));
      expect(theirs).toEqual({ w: [], i: [], al: [], p: [], raw: 0 });
    });

    it('a tenant cannot attach items, rules or alerts to another tenant’s watchlist', async () => {
      await expect(withTenant(db, b, (tx) => marketRepo.addWatchlistItem(tx, { watchlistId: wl, areaKey: 'zip:19134', areaName: 'x' }))).rejects.toThrow(/does not belong|row-level security/);
      await expect(withTenant(db, b, (tx) => marketRepo.createAlertRule(tx, wl, { kind: 'regulatory_change' }))).rejects.toThrow(/does not belong|row-level security/);
      await expect(withTenant(db, b, (tx) => marketRepo.insertAlerts(tx, wl, [{ dedupeKey: 'x', areaKey: 'zip:19134', areaName: 'x', kind: 'k', severity: 'info', title: 't', detail: 'd', evidence: {} }]))).rejects.toThrow(/does not belong|row-level security/);
      expect(await withTenant(db, b, (tx) => marketRepo.deleteWatchlist(tx, wl))).toBe(false);
    });

    it('alerts are idempotent per dedupe key and acknowledgement is recorded', async () => {
      const n = await withTenant(db, a, (tx) => marketRepo.insertAlerts(tx, wl, [{ dedupeKey: 'k1', areaKey: 'zip:19134', areaName: '19134', kind: 'score_change', severity: 'caution', title: 'dup', detail: 'd', evidence: {} }]));
      expect(n).toBe(0);
      const ok = await withTenant(db, a, async (tx) => marketRepo.acknowledgeAlert(tx, (await marketRepo.listAlerts(tx))[0]!.id));
      expect(ok).toBe(true);
      expect(await withTenant(db, a, (tx) => marketRepo.listAlerts(tx, { openOnly: true }))).toEqual([]);
    });

    it('viewers can read but not create watchlists; duplicate items are ignored; snapshots save', async () => {
      expect((await withTenant(db, viewer, (tx) => marketRepo.listWatchlists(tx))).length).toBe(1);
      await expect(withTenant(db, viewer, (tx) => marketRepo.createWatchlist(tx, { name: 'nope', strategy: null }))).rejects.toThrow(/row-level security/);
      const again = await withTenant(db, a, (tx) => marketRepo.addWatchlistItem(tx, { watchlistId: wl, areaKey: 'zip:19134', areaName: '19134' }));
      expect(again).toBeNull();
      const item = (await withTenant(db, a, (tx) => marketRepo.listWatchlistItems(tx, wl)))[0]!;
      await withTenant(db, a, (tx) => marketRepo.saveItemSnapshot(tx, item.id, { overall: 61.2 }));
      const after = (await withTenant(db, a, (tx) => marketRepo.listWatchlistItems(tx, wl)))[0]!;
      expect(after.lastSnapshot).toEqual({ overall: 61.2 });
      expect(after.lastCheckedAt).not.toBeNull();
    });

    it('rejects unknown alert rule kinds and strategies', async () => {
      await expect(withTenant(db, a, (tx) => marketRepo.createAlertRule(tx, wl, { kind: 'vibes' }))).rejects.toThrow(/check constraint/);
      await expect(withTenant(db, a, (tx) => marketRepo.createWatchlist(tx, { name: 'x', strategy: 'timeshare' }))).rejects.toThrow(/invalid input value for enum/);
    });

    it('rule toggling, profile and item deletion work within the tenant', async () => {
      await withTenant(db, a, async (tx) => {
        const r = (await marketRepo.listAlertRules(tx, wl))[0]!;
        expect(await marketRepo.setAlertRuleEnabled(tx, r.id, false)).toBe(true);
        const p = (await marketRepo.listScoreProfiles(tx))[0]!;
        expect((await marketRepo.getScoreProfile(tx, p.id))!.name).toBe('Cash flow first');
        expect(await marketRepo.deleteScoreProfile(tx, p.id)).toBe(true);
        const extra = await marketRepo.addWatchlistItem(tx, { watchlistId: wl, areaKey: 'state:42', areaName: 'PA' });
        expect(await marketRepo.removeWatchlistItem(tx, extra!)).toBe(true);
        expect(await marketRepo.deleteAlertRule(tx, r.id)).toBe(true);
        expect((await marketRepo.getWatchlist(tx, wl))!.name).toBe('Pilot markets');
      });
    });
  });
});
