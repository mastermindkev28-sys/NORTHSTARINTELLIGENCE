import 'server-only';
import {
  DemoMarketDataSource,
  PROFILES,
  computeRegulatoryIndex,
  customProfile,
  jurisdictionStack,
  rankAreas,
  sourceRef,
  type GeoArea,
  type GeoLevel,
  type MarketDataSource,
  type MarketScoreInput,
  type MarketScoreResult,
  type MetricObservation,
  type NormalizationMode,
  type RegulatoryFactorRow,
  type RegulatoryIndexResult,
  type ScoreProfile,
} from '@northstar/market';
import { marketRepo, type Tx } from '@northstar/db';
import { env } from './env';

/** Postgres-backed source over the 0005 reference tables. */
class PgMarketDataSource implements MarketDataSource {
  readonly id = 'db';
  constructor(private tx: Tx) {}
  async listAreas(f: { level?: GeoLevel; parentKey?: string } = {}) {
    return (await marketRepo.listGeoAreas(this.tx, f)).map(toArea);
  }
  async getArea(key: string) {
    const a = await marketRepo.getGeoArea(this.tx, key);
    return a ? toArea(a) : null;
  }
  async getObservations(key: string): Promise<MetricObservation[]> {
    return (await marketRepo.getObservations(this.tx, key)).map((o) => ({
      metric: o.metric,
      value: o.value,
      period: o.period,
      periodEnd: o.periodEnd,
      source: { ...sourceRef(o.sourceId), class: o.sourceClass },
      retrievedAt: o.retrievedAt,
      measuredAt: o.measuredAt,
      ...(o.isProjection ? { isProjection: true } : {}),
      ...(o.reportingCoverage !== null ? { reportingCoverage: o.reportingCoverage } : {}),
      ...(o.note ? { note: o.note } : {}),
    }));
  }
  async getRegulatoryRows(keys: string[]): Promise<RegulatoryFactorRow[]> {
    return (await marketRepo.getRegulatoryRows(this.tx, keys)).map((r) => ({
      jurisdictionKey: r.jurisdictionKey,
      jurisdictionName: r.jurisdictionName,
      jurisdictionLevel: r.jurisdictionLevel === 'state' ? 'state' : 'city',
      factor: r.factor,
      value: r.value,
      citation: { title: r.citationTitle, ...(r.citationSection ? { section: r.citationSection } : {}), ...(r.sourceUrl ? { url: r.sourceUrl } : {}) },
      effectiveDate: r.effectiveDate,
      retrievedAt: r.retrievedAt,
      verification: r.verification,
      ...(r.notes ? { notes: r.notes } : {}),
    }));
  }
}

function toArea(a: marketRepo.GeoAreaRow): GeoArea {
  return { key: a.key, level: a.level, code: a.code, name: a.name, parentKey: a.parentKey, stateCode: a.stateCode, countyFips: a.countyFips, zcta: a.zcta, population: a.population, isDemo: a.isDemo };
}

const demo = new DemoMarketDataSource();

export function marketSource(tx: Tx): MarketDataSource {
  return env.marketDataSource === 'db' ? new PgMarketDataSource(tx) : demo;
}

/** Valuation date for live views. The engine itself never reads the clock. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ResolvedProfile {
  id: string;
  profile: ScoreProfile;
  regulatoryWeights?: Partial<Record<string, number>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "balanced" | strategy | "custom:<uuid>" (an org profile). Unknown values fall back to balanced. */
export async function resolveProfile(tx: Tx, raw: string | undefined | null): Promise<ResolvedProfile> {
  if (raw && raw.startsWith('custom:') && UUID.test(raw.slice(7))) {
    const row = await marketRepo.getScoreProfile(tx, raw.slice(7));
    if (row) {
      const base = (row.baseProfile in PROFILES ? row.baseProfile : 'balanced') as keyof typeof PROFILES;
      const p = customProfile({ id: row.id, label: row.name, base, categoryWeights: row.categoryWeights, variableEmphasis: row.variableEmphasis });
      return { id: raw, profile: p, regulatoryWeights: row.regulatoryWeights };
    }
  }
  const key = raw && raw in PROFILES ? (raw as keyof typeof PROFILES) : 'balanced';
  return { id: key, profile: PROFILES[key] };
}

export interface AreaBundle {
  score: MarketScoreResult;
  regulatory: RegulatoryIndexResult;
  observations: MetricObservation[];
}

async function inputFor(src: MarketDataSource, area: GeoArea, rp: ResolvedProfile, asOf: string) {
  const keys = await jurisdictionStack(src, area);
  const [observations, rows] = await Promise.all([src.getObservations(area.key), src.getRegulatoryRows(keys)]);
  const regulatory = computeRegulatoryIndex(rows, { asOf, jurisdictionKeys: keys, ...(rp.regulatoryWeights ? { weights: rp.regulatoryWeights } : {}) });
  const input: MarketScoreInput = { area, observations, profile: rp.profile, asOf, regulatory };
  return { input, regulatory, observations };
}

/** Score many areas in one comparison set (needed for relative mode), keeping regulatory detail per area. */
export async function scoreMany(src: MarketDataSource, areas: GeoArea[], rp: ResolvedProfile, asOf: string, mode: NormalizationMode = 'absolute'): Promise<AreaBundle[]> {
  const built = await Promise.all(areas.map((a) => inputFor(src, a, rp, asOf)));
  const ranked = rankAreas(built.map((b) => b.input), mode);
  const byKey = new Map(built.map((b) => [b.input.area.key, b]));
  return ranked.map((score) => ({ score, regulatory: byKey.get(score.area.key)!.regulatory, observations: byKey.get(score.area.key)!.observations }));
}

export async function scoreOne(src: MarketDataSource, area: GeoArea, rp: ResolvedProfile, asOf: string): Promise<AreaBundle> {
  return (await scoreMany(src, [area], rp, asOf))[0]!;
}

export function parseAreaKey(raw: string): string | null {
  const k = decodeURIComponent(raw);
  return /^(state|metro|city|zip|neighborhood):[A-Za-z0-9_-]{1,40}$/.test(k) ? k : null;
}

export const areaHref = (key: string, profile?: string) => `/app/market/area/${encodeURIComponent(key)}${profile && profile !== 'balanced' ? `?profile=${encodeURIComponent(profile)}` : ''}`;
