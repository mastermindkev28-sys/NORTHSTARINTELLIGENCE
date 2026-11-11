/**
 * Ranking and comparison across a set of areas, plus historical trend summaries.
 *
 * Absolute mode scores each area against the catalog reference ranges (stable over time, used for monitoring).
 * Relative mode scores each variable as a percentile within the comparison set (research methodology §2.2 rule 1);
 * raw values are always shown beside percentiles.
 */
import { getMetric, normalizeAbsolute } from './metrics';
import { computeMarketScore, pickObservation, type MarketScoreInput, type MarketScoreResult } from './score';
import { MarketInputError, daysBetween, round, type MetricObservation } from './types';

export type NormalizationMode = 'absolute' | 'relative';

/** Direction-aware percentile ranks (0 worst … 100 best), ties share the average rank. */
export function percentileScores(values: Map<string, number>, metric: string): Map<string, number> {
  const def = getMetric(metric);
  const entries = [...values.entries()].map(([k, v]) => ({ k, s: normalizeAbsolute(def, v), raw: v }));
  const out = new Map<string, number>();
  if (entries.length < 3) {
    // Percentiles of fewer than three areas are not meaningful; fall back to absolute scores.
    for (const e of entries) out.set(e.k, e.s);
    return out;
  }
  // Rank on the direction-adjusted raw value so clamped reference ranges do not create artificial ties.
  const [worst, best] = def.reference;
  const sign = best >= worst ? 1 : -1;
  entries.sort((a, b) => sign * (a.raw - b.raw));
  let i = 0;
  while (i < entries.length) {
    let j = i;
    while (j + 1 < entries.length && entries[j + 1]!.raw === entries[i]!.raw) j++;
    const pct = (((i + j) / 2) / (entries.length - 1)) * 100;
    for (let t = i; t <= j; t++) out.set(entries[t]!.k, pct);
    i = j + 1;
  }
  return out;
}

export function rankAreas(inputs: MarketScoreInput[], mode: NormalizationMode = 'absolute'): MarketScoreResult[] {
  assertSameAsOf(inputs);
  let relative: Map<string, Partial<Record<string, number>>> | null = null;
  if (mode === 'relative') {
    relative = new Map(inputs.map((i) => [i.area.key, {}]));
    const metrics = new Set(inputs.flatMap((i) => i.observations.map((o) => o.metric)));
    for (const m of metrics) {
      const values = new Map<string, number>();
      for (const i of inputs) {
        const o = pickObservation(i.observations.filter((x) => x.metric === m), i.asOf);
        if (o) values.set(i.area.key, o.value);
      }
      for (const [k, s] of percentileScores(values, m)) relative.get(k)![m] = s;
    }
  }
  const results = inputs.map((i) => computeMarketScore(relative ? { ...i, relativeScores: relative.get(i.area.key)! } : i));
  return results.sort((a, b) => {
    if (a.overall === null && b.overall === null) return b.overallProvisional - a.overallProvisional;
    if (a.overall === null) return 1;
    if (b.overall === null) return -1;
    return b.overall - a.overall || b.confidence - a.confidence || a.area.name.localeCompare(b.area.name);
  });
}

export interface TrendSummary {
  metric: string;
  points: { period: string; periodEnd: string; value: number; isProjection: boolean }[];
  latest: number | null;
  latestPeriod: string | null;
  /** Change from the earliest to the latest historical point, in the metric's own unit. */
  change: number | null;
  /** Compound annual growth rate between the earliest and latest historical points (positive series only). */
  cagr: number | null;
  direction: 'rising' | 'falling' | 'flat' | 'unknown';
  hasProjection: boolean;
}

/** Summarize a metric's history; projections are kept in `points` but excluded from latest/change/CAGR. */
export function summarizeTrend(metric: string, obs: MetricObservation[]): TrendSummary {
  getMetric(metric);
  const pts = obs
    .filter((o) => o.metric === metric)
    .map((o) => ({ period: o.period, periodEnd: o.periodEnd, value: o.value, isProjection: !!o.isProjection }))
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const hist = pts.filter((p) => !p.isProjection);
  const first = hist[0];
  const last = hist[hist.length - 1];
  let change: number | null = null, cagr: number | null = null;
  let direction: TrendSummary['direction'] = 'unknown';
  if (first && last && hist.length >= 2) {
    change = round(last.value - first.value, 3);
    const years = daysBetween(first.periodEnd, last.periodEnd) / 365.25;
    if (first.value > 0 && last.value > 0 && years > 0) cagr = round((last.value / first.value) ** (1 / years) - 1, 4);
    const tol = Math.max(Math.abs(first.value) * 0.01, 1e-9);
    direction = Math.abs(change) <= tol ? 'flat' : change > 0 ? 'rising' : 'falling';
  }
  return { metric, points: pts, latest: last?.value ?? null, latestPeriod: last?.period ?? null, change, cagr, direction, hasProjection: pts.some((p) => p.isProjection) };
}

export function assertSameAsOf(inputs: MarketScoreInput[]): void {
  const s = new Set(inputs.map((i) => i.asOf));
  if (s.size > 1) throw new MarketInputError('asOf', 'all areas in a comparison must share one valuation date');
}
