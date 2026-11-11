/**
 * Market data source abstraction. The web app depends on this interface, so moving from the bundled demo dataset to
 * Postgres-backed reference tables (migration 0005, filled by ingest jobs) is a configuration change.
 */
import { demoDataset } from './demo';
import { PILOT_JURISDICTIONS, PILOT_REGULATORY_ROWS } from './regulatory-seed';
import { computeRegulatoryIndex, type RegulatoryFactorRow, type RegulatoryIndexResult } from './regulatory';
import { computeMarketScore, type MarketScoreResult } from './score';
import type { ScoreProfile } from './strategies';
import type { GeoArea, GeoLevel, MetricObservation } from './types';

export interface MarketDataSource {
  readonly id: string;
  listAreas(filter?: { level?: GeoLevel; parentKey?: string }): Promise<GeoArea[]>;
  getArea(key: string): Promise<GeoArea | null>;
  getObservations(key: string): Promise<MetricObservation[]>;
  /** Factor rows for every jurisdiction in the area's stack (state, then city/metro). */
  getRegulatoryRows(jurisdictionKeys: string[]): Promise<RegulatoryFactorRow[]>;
}

/** Bundled demo dataset plus the real, cited pilot jurisdictions (regulatory factors only, no metrics yet). */
export class DemoMarketDataSource implements MarketDataSource {
  readonly id = 'demo';
  private areas: GeoArea[];
  private rows: RegulatoryFactorRow[];
  constructor() {
    const d = demoDataset();
    this.areas = [...d.areas, ...PILOT_JURISDICTIONS];
    this.rows = [...d.regulatory, ...PILOT_REGULATORY_ROWS];
  }
  async listAreas(filter: { level?: GeoLevel; parentKey?: string } = {}) {
    return this.areas.filter((a) => (!filter.level || a.level === filter.level) && (!filter.parentKey || a.parentKey === filter.parentKey));
  }
  async getArea(key: string) {
    return this.areas.find((a) => a.key === key) ?? null;
  }
  async getObservations(key: string) {
    return demoDataset().observations.get(key) ?? [];
  }
  async getRegulatoryRows(keys: string[]) {
    return this.rows.filter((r) => keys.includes(r.jurisdictionKey));
  }
}

/** State first, then each finer ancestor up to the area itself (excluding ZIP/neighborhood, which carry no law). */
export async function jurisdictionStack(src: MarketDataSource, area: GeoArea): Promise<string[]> {
  const chain: GeoArea[] = [];
  let cur: GeoArea | null = area;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentKey ? await src.getArea(cur.parentKey) : null;
  }
  return chain.filter((a) => a.level === 'state' || a.level === 'metro' || a.level === 'city').map((a) => a.key);
}

export interface ScoredArea {
  score: MarketScoreResult;
  regulatory: RegulatoryIndexResult;
  observations: MetricObservation[];
}

export async function scoreArea(
  src: MarketDataSource,
  area: GeoArea,
  opts: { profile: ScoreProfile; asOf: string; regulatoryWeights?: Partial<Record<string, number>> },
): Promise<ScoredArea> {
  const keys = await jurisdictionStack(src, area);
  const [observations, rows] = await Promise.all([src.getObservations(area.key), src.getRegulatoryRows(keys)]);
  const regulatory = computeRegulatoryIndex(rows, { asOf: opts.asOf, jurisdictionKeys: keys, ...(opts.regulatoryWeights ? { weights: opts.regulatoryWeights } : {}) });
  const score = computeMarketScore({ area, observations, profile: opts.profile, asOf: opts.asOf, regulatory });
  return { score, regulatory, observations };
}
