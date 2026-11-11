/**
 * Market Intelligence data access (migration 0005).
 *
 * Reference reads (geo areas, observations, regulatory factors) work in any authenticated context. Reference writes
 * require a connection acting as northstar_ingest (see `withIngest`). Tenant functions rely on RLS for isolation,
 * exactly like repositories.ts.
 */
import type { Tx, Db } from './client';

// ---------------------------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------------------------

export type GeoLevel = 'state' | 'metro' | 'city' | 'zip' | 'neighborhood';

export interface GeoAreaRow {
  key: string;
  level: GeoLevel;
  code: string;
  name: string;
  parentKey: string | null;
  stateCode: string | null;
  countyFips: string | null;
  zcta: string | null;
  population: number | null;
  isDemo: boolean;
}

const GEO_COLS = `key, level, code, name, parent_key as "parentKey", state_code as "stateCode", county_fips as "countyFips", zcta, population, is_demo as "isDemo"`;

export async function listGeoAreas(tx: Tx, f: { level?: GeoLevel; parentKey?: string } = {}): Promise<GeoAreaRow[]> {
  const { rows } = await tx.query<GeoAreaRow>(
    `select ${GEO_COLS} from public.geo_areas
      where ($1::text is null or level = $1) and ($2::text is null or parent_key = $2)
      order by level, name limit 5000`,
    [f.level ?? null, f.parentKey ?? null],
  );
  return rows;
}

export async function getGeoArea(tx: Tx, key: string): Promise<GeoAreaRow | null> {
  const { rows } = await tx.query<GeoAreaRow>(`select ${GEO_COLS} from public.geo_areas where key = $1`, [key]);
  return rows[0] ?? null;
}

export interface ObservationRow {
  metric: string;
  value: number;
  period: string;
  periodEnd: string;
  measuredAt: GeoLevel;
  sourceId: string;
  sourceClass: 'official' | 'licensed' | 'third_party' | 'user' | 'demo';
  dataset: string | null;
  retrievedAt: string;
  isProjection: boolean;
  isDevelopmental: boolean;
  reportingCoverage: number | null;
  note: string | null;
}

export async function getObservations(tx: Tx, areaKey: string): Promise<ObservationRow[]> {
  const { rows } = await tx.query<ObservationRow>(
    `select metric, value, period, to_char(period_end, 'YYYY-MM-DD') as "periodEnd", measured_at as "measuredAt", source_id as "sourceId",
            source_class as "sourceClass", dataset, to_char(retrieved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "retrievedAt",
            is_projection as "isProjection", is_developmental as "isDevelopmental", reporting_coverage::float8 as "reportingCoverage", note
       from public.geo_metric_observations where area_key = $1 order by metric, period_end`,
    [areaKey],
  );
  return rows;
}

export interface RegulatoryRow {
  jurisdictionKey: string;
  jurisdictionName: string;
  jurisdictionLevel: GeoLevel;
  factor: string;
  value: number | boolean | string | null;
  citationTitle: string;
  citationSection: string | null;
  sourceUrl: string | null;
  effectiveDate: string | null;
  retrievedAt: string;
  verification: 'official' | 'secondary' | 'unverified' | 'demo';
  notes: string | null;
}

export async function getRegulatoryRows(tx: Tx, jurisdictionKeys: string[]): Promise<RegulatoryRow[]> {
  const { rows } = await tx.query<RegulatoryRow>(
    `select r.jurisdiction_key as "jurisdictionKey", g.name as "jurisdictionName", g.level as "jurisdictionLevel", r.factor, r.value,
            r.citation_title as "citationTitle", r.citation_section as "citationSection", r.source_url as "sourceUrl",
            to_char(r.effective_date, 'YYYY-MM-DD') as "effectiveDate",
            to_char(r.retrieved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "retrievedAt", r.verification, r.notes
       from public.regulatory_factors r join public.geo_areas g on g.key = r.jurisdiction_key
      where r.jurisdiction_key = any($1::text[]) order by r.jurisdiction_key, r.factor, r.effective_date nulls first`,
    [jurisdictionKeys],
  );
  return rows;
}

/** Run `fn` as the ingest role. The connection's login role must be a member of northstar_ingest. */
export async function withIngest<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tx = await db.connect();
  try {
    await tx.query('begin');
    await tx.query('set local role northstar_ingest');
    const out = await fn(tx);
    await tx.query('commit');
    return out;
  } catch (e) {
    await tx.query('rollback').catch(() => {});
    throw e;
  } finally {
    tx.release();
  }
}

export async function upsertGeoArea(tx: Tx, a: Omit<GeoAreaRow, 'countyFips' | 'zcta' | 'population'> & Partial<Pick<GeoAreaRow, 'countyFips' | 'zcta' | 'population'>>): Promise<void> {
  await tx.query(
    `insert into public.geo_areas (key, level, code, name, parent_key, state_code, county_fips, zcta, population, is_demo)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (key) do update set name = excluded.name, parent_key = excluded.parent_key, state_code = excluded.state_code,
       county_fips = excluded.county_fips, zcta = excluded.zcta, population = excluded.population, is_demo = excluded.is_demo`,
    [a.key, a.level, a.code, a.name, a.parentKey, a.stateCode, a.countyFips ?? null, a.zcta ?? null, a.population ?? null, a.isDemo],
  );
}

export async function insertObservation(tx: Tx, areaKey: string, o: Omit<ObservationRow, 'dataset' | 'isDevelopmental' | 'reportingCoverage' | 'note'> & Partial<Pick<ObservationRow, 'dataset' | 'isDevelopmental' | 'reportingCoverage' | 'note'>>): Promise<boolean> {
  const r = await tx.query(
    `insert into public.geo_metric_observations (area_key, metric, value, period, period_end, measured_at, source_id, source_class, dataset, retrieved_at, is_projection, is_developmental, reporting_coverage, note)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     on conflict (area_key, metric, period_end, source_id, is_projection) do nothing`,
    [areaKey, o.metric, o.value, o.period, o.periodEnd, o.measuredAt, o.sourceId, o.sourceClass, o.dataset ?? null, o.retrievedAt, o.isProjection, o.isDevelopmental ?? false, o.reportingCoverage ?? null, o.note ?? null],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function insertRegulatoryRow(tx: Tx, r: Omit<RegulatoryRow, 'jurisdictionName' | 'jurisdictionLevel'> & { unit?: string | null }): Promise<boolean> {
  const res = await tx.query(
    `insert into public.regulatory_factors (jurisdiction_key, factor, value, unit, citation_title, citation_section, source_url, effective_date, retrieved_at, verification, notes)
     values ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11) on conflict do nothing`,
    [r.jurisdictionKey, r.factor, JSON.stringify(r.value), r.unit ?? null, r.citationTitle, r.citationSection, r.sourceUrl, r.effectiveDate, r.retrievedAt, r.verification, r.notes],
  );
  return (res.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------------------------
// Tenant: profiles
// ---------------------------------------------------------------------------------------------

export interface ScoreProfileRow {
  id: string;
  name: string;
  baseProfile: string;
  categoryWeights: Record<string, number>;
  variableEmphasis: Record<string, number>;
  regulatoryWeights: Record<string, number>;
  createdAt: Date;
}

const PROFILE_COLS = `id, name, base_profile as "baseProfile", category_weights as "categoryWeights", variable_emphasis as "variableEmphasis", regulatory_weights as "regulatoryWeights", created_at as "createdAt"`;

export async function listScoreProfiles(tx: Tx): Promise<ScoreProfileRow[]> {
  const { rows } = await tx.query<ScoreProfileRow>(`select ${PROFILE_COLS} from public.market_score_profiles where org_id = app.current_org_id() order by name`);
  return rows;
}

export async function getScoreProfile(tx: Tx, id: string): Promise<ScoreProfileRow | null> {
  const { rows } = await tx.query<ScoreProfileRow>(`select ${PROFILE_COLS} from public.market_score_profiles where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createScoreProfile(tx: Tx, p: { name: string; baseProfile: string; categoryWeights: Record<string, number>; variableEmphasis?: Record<string, number>; regulatoryWeights?: Record<string, number> }): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.market_score_profiles (name, base_profile, category_weights, variable_emphasis, regulatory_weights) values ($1, $2, $3, $4, $5) returning id`,
    [p.name, p.baseProfile, p.categoryWeights, p.variableEmphasis ?? {}, p.regulatoryWeights ?? {}],
  );
  return rows[0]!.id;
}

export async function deleteScoreProfile(tx: Tx, id: string): Promise<boolean> {
  const r = await tx.query('delete from public.market_score_profiles where id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------------------------
// Tenant: watchlists
// ---------------------------------------------------------------------------------------------

export interface WatchlistRow {
  id: string;
  name: string;
  strategy: string | null;
  profileId: string | null;
  itemCount: number;
  openAlerts: number;
  createdAt: Date;
}

export async function listWatchlists(tx: Tx): Promise<WatchlistRow[]> {
  const { rows } = await tx.query<WatchlistRow>(
    `select w.id, w.name, w.strategy::text as strategy, w.profile_id as "profileId", w.created_at as "createdAt",
            (select count(*)::int from public.market_watchlist_items i where i.watchlist_id = w.id) as "itemCount",
            (select count(*)::int from public.market_alerts a where a.watchlist_id = w.id and a.acknowledged_at is null) as "openAlerts"
       from public.market_watchlists w where w.org_id = app.current_org_id() order by w.created_at`,
  );
  return rows;
}

export async function getWatchlist(tx: Tx, id: string): Promise<WatchlistRow | null> {
  return (await listWatchlists(tx)).find((w) => w.id === id) ?? null;
}

export async function createWatchlist(tx: Tx, p: { name: string; strategy: string | null; profileId?: string | null }): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.market_watchlists (name, strategy, profile_id) values ($1, $2::app.investment_strategy, $3) returning id`,
    [p.name, p.strategy, p.profileId ?? null],
  );
  return rows[0]!.id;
}

export async function deleteWatchlist(tx: Tx, id: string): Promise<boolean> {
  const r = await tx.query('delete from public.market_watchlists where id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}

export interface WatchlistItemRow {
  id: string;
  watchlistId: string;
  areaKey: string;
  areaName: string;
  notes: string | null;
  lastSnapshot: unknown;
  lastCheckedAt: Date | null;
  createdAt: Date;
}

export async function listWatchlistItems(tx: Tx, watchlistId?: string): Promise<WatchlistItemRow[]> {
  const { rows } = await tx.query<WatchlistItemRow>(
    `select id, watchlist_id as "watchlistId", area_key as "areaKey", area_name as "areaName", notes, last_snapshot as "lastSnapshot",
            last_checked_at as "lastCheckedAt", created_at as "createdAt"
       from public.market_watchlist_items where org_id = app.current_org_id() and ($1::uuid is null or watchlist_id = $1) order by created_at`,
    [watchlistId ?? null],
  );
  return rows;
}

export async function addWatchlistItem(tx: Tx, p: { watchlistId: string; areaKey: string; areaName: string; notes?: string | null }): Promise<string | null> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into public.market_watchlist_items (watchlist_id, area_key, area_name, notes) values ($1, $2, $3, $4)
     on conflict (watchlist_id, area_key) do nothing returning id`,
    [p.watchlistId, p.areaKey, p.areaName, p.notes ?? null],
  );
  return rows[0]?.id ?? null;
}

export async function removeWatchlistItem(tx: Tx, id: string): Promise<boolean> {
  const r = await tx.query('delete from public.market_watchlist_items where id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function saveItemSnapshot(tx: Tx, id: string, snapshot: unknown): Promise<void> {
  await tx.query('update public.market_watchlist_items set last_snapshot = $2, last_checked_at = now() where id = $1', [id, snapshot]);
}

// ---------------------------------------------------------------------------------------------
// Tenant: alert rules and alerts
// ---------------------------------------------------------------------------------------------

export interface AlertRuleRow {
  id: string;
  watchlistId: string;
  rule: { kind: string } & Record<string, unknown>;
  enabled: boolean;
}

export async function listAlertRules(tx: Tx, watchlistId?: string): Promise<AlertRuleRow[]> {
  const { rows } = await tx.query<AlertRuleRow>(
    `select id, watchlist_id as "watchlistId", rule, enabled from public.market_alert_rules
      where org_id = app.current_org_id() and ($1::uuid is null or watchlist_id = $1) order by created_at`,
    [watchlistId ?? null],
  );
  return rows;
}

export async function createAlertRule(tx: Tx, watchlistId: string, rule: { kind: string } & Record<string, unknown>): Promise<string> {
  const { rows } = await tx.query<{ id: string }>('insert into public.market_alert_rules (watchlist_id, rule) values ($1, $2) returning id', [watchlistId, rule]);
  return rows[0]!.id;
}

export async function setAlertRuleEnabled(tx: Tx, id: string, enabled: boolean): Promise<boolean> {
  const r = await tx.query('update public.market_alert_rules set enabled = $2 where id = $1', [id, enabled]);
  return (r.rowCount ?? 0) > 0;
}

export async function deleteAlertRule(tx: Tx, id: string): Promise<boolean> {
  const r = await tx.query('delete from public.market_alert_rules where id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}

export interface AlertRow {
  id: string;
  watchlistId: string | null;
  areaKey: string;
  areaName: string;
  kind: string;
  severity: 'info' | 'caution' | 'critical';
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  acknowledgedAt: Date | null;
  createdAt: Date;
}

/** Insert alerts; existing dedupe keys are skipped. Returns the number of new alerts. */
export async function insertAlerts(
  tx: Tx,
  watchlistId: string,
  alerts: { dedupeKey: string; areaKey: string; areaName: string; kind: string; severity: string; title: string; detail: string; evidence: unknown }[],
): Promise<number> {
  let n = 0;
  for (const a of alerts) {
    const r = await tx.query(
      `insert into public.market_alerts (watchlist_id, area_key, area_name, kind, severity, title, detail, evidence, dedupe_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (org_id, dedupe_key) do nothing`,
      [watchlistId, a.areaKey, a.areaName, a.kind, a.severity, a.title, a.detail, a.evidence, a.dedupeKey],
    );
    n += r.rowCount ?? 0;
  }
  return n;
}

export async function listAlerts(tx: Tx, opts: { openOnly?: boolean; limit?: number } = {}): Promise<AlertRow[]> {
  const { rows } = await tx.query<AlertRow>(
    `select id, watchlist_id as "watchlistId", area_key as "areaKey", area_name as "areaName", kind, severity, title, detail, evidence,
            acknowledged_at as "acknowledgedAt", created_at as "createdAt"
       from public.market_alerts where org_id = app.current_org_id() and (not $1 or acknowledged_at is null)
      order by created_at desc, case severity when 'critical' then 0 when 'caution' then 1 else 2 end limit $2`,
    [opts.openOnly ?? false, opts.limit ?? 100],
  );
  return rows;
}

export async function acknowledgeAlert(tx: Tx, id: string): Promise<boolean> {
  const r = await tx.query('update public.market_alerts set acknowledged_at = now(), acknowledged_by = app.current_user_id() where id = $1 and acknowledged_at is null', [id]);
  return (r.rowCount ?? 0) > 0;
}
