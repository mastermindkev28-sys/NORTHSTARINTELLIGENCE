/**
 * Northstar Market Score: transparent geographic opportunity scoring.
 *
 *   variable score   = metric value mapped onto 0–100 by its catalog reference range (or percentile in a comparison set)
 *   category score   = weighted mean of variable scores (catalog weight × strategy emphasis)
 *   overall score    = weighted mean of category scores (strategy category weights)
 *
 * Missing data (rule: it lowers confidence and never raises a score):
 *   - A missing variable is imputed at min(50, mean of the observed variables in its category). So a gap can only pull a
 *     category toward neutral-or-worse, never above what the observed data supports, and never above neutral.
 *   - Category coverage = observed weight ÷ total weight. Below 60% the category shows "insufficient data" (null score).
 *   - Overall coverage is the weighted mean of category coverage. Below 60% the overall score is withheld.
 *
 * Confidence per variable = source quality × freshness × geographic resolution × reporting coverage. It is reported,
 * never used to inflate a score. Risk flags are returned beside the score and never averaged into it.
 */
import { getMetric, metricsInCategory, normalizeAbsolute, type MetricDefinition, type MetricUnit } from './metrics';
import { computeRiskFlags } from './risks';
import { normalizedCategoryWeights, type ScoreProfile } from './strategies';
import { sourceRef } from './sources';
import type { RegulatoryIndexResult } from './regulatory';
import {
  CATEGORY_KEYS,
  GEO_LEVEL_LABELS,
  METHODOLOGY_VERSION,
  MarketInputError,
  daysBetween,
  levelIndex,
  round,
  type CategoryKey,
  type GeoArea,
  type GeoLevel,
  type MetricObservation,
  type RiskFlag,
  type SourceClass,
  type SourceRef,
} from './types';

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  growth: 'Growth fundamentals',
  affordability: 'Affordability and undervaluation',
  regulatory: 'Landlord regulatory climate',
  rental_economics: 'Rental investment economics',
  public_safety: 'Public safety indicators',
  environmental_risk: 'Property and environmental risk',
};

export const SUFFICIENCY = 0.6;

const SOURCE_QUALITY: Record<SourceClass, number> = { official: 1, licensed: 0.9, third_party: 0.75, user: 0.6, demo: 0.8 };

export type VariableStatus = 'observed' | 'missing';

export interface VariableResult {
  metric: string;
  label: string;
  unit: MetricUnit;
  /** Effective weight within the category (catalog weight × strategy emphasis). */
  weight: number;
  status: VariableStatus;
  value: number | null;
  /** 0–100; for missing variables, the conservative imputed value. */
  score: number;
  confidence: number;
  period: string | null;
  periodEnd: string | null;
  ageDays: number | null;
  stale: boolean;
  source: SourceRef | null;
  measuredAt: GeoLevel | null;
  inherited: boolean;
  reportingCoverage: number | null;
  reference: readonly [number, number];
  normalization: 'absolute' | 'relative';
}

export interface CategoryResult {
  key: CategoryKey;
  label: string;
  /** Share of the overall score (0..1) under the active profile. */
  weight: number;
  /** null when coverage is below the sufficiency threshold. */
  score: number | null;
  scoreProvisional: number;
  coverage: number;
  confidence: number;
  sufficient: boolean;
  variables: VariableResult[];
}

export type ConfidenceLabel = 'high' | 'moderate' | 'low' | 'very_low';

export interface MarketScoreResult {
  methodologyVersion: string;
  asOf: string;
  area: GeoArea;
  profile: { id: string; label: string };
  /** null when overall coverage is below the sufficiency threshold. */
  overall: number | null;
  overallProvisional: number;
  coverage: number;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  categories: CategoryResult[];
  flags: RiskFlag[];
  /** Forecast observations, shown separately and never scored. */
  projections: MetricObservation[];
  isDemo: boolean;
}

export interface MarketScoreInput {
  area: GeoArea;
  observations: MetricObservation[];
  profile: ScoreProfile;
  asOf: string;
  regulatory?: RegulatoryIndexResult | null;
  /** Optional per-metric 0–100 scores from a comparison set (relative mode). Overrides absolute normalization. */
  relativeScores?: Partial<Record<string, number>>;
}

export function confidenceLabel(c: number): ConfidenceLabel {
  return c >= 0.8 ? 'high' : c >= 0.6 ? 'moderate' : c >= 0.4 ? 'low' : 'very_low';
}

/** Freshness multiplier: 1 within the window, then declining linearly to a floor of 0.4 at 2.2× the window. */
export function freshnessFactor(ageDays: number, windowDays: number): number {
  if (ageDays <= windowDays) return 1;
  return Math.max(0.4, 1 - (0.5 * (ageDays - windowDays)) / windowDays);
}

/** Resolution multiplier: 0.85 for each level the data is coarser than the area being scored (floor 0.5). */
export function resolutionFactor(areaLevel: GeoLevel, measuredAt: GeoLevel): number {
  const diff = levelIndex(areaLevel) - levelIndex(measuredAt);
  return diff <= 0 ? 1 : Math.max(0.5, 0.85 ** diff);
}

/**
 * Choose the observation to score for one metric: historical only (no projections), period ended on or before asOf,
 * finest geographic level first, then most recent.
 */
export function pickObservation(obs: MetricObservation[], asOf: string): MetricObservation | null {
  let best: MetricObservation | null = null;
  for (const o of obs) {
    if (o.isProjection) continue;
    if (daysBetween(o.periodEnd, asOf) < 0) continue;
    if (!best) { best = o; continue; }
    const lo = levelIndex(o.measuredAt), lb = levelIndex(best.measuredAt);
    if (lo > lb || (lo === lb && o.periodEnd > best.periodEnd)) best = o;
  }
  return best;
}

function validateObservation(o: MetricObservation, i: number) {
  getMetric(o.metric);
  if (typeof o.value !== 'number' || !Number.isFinite(o.value)) throw new MarketInputError(`observations[${i}].value`, `must be a finite number (received ${String(o.value)})`);
  if (!o.source?.id) throw new MarketInputError(`observations[${i}].source`, 'is required');
  if (o.reportingCoverage !== undefined && !(o.reportingCoverage >= 0 && o.reportingCoverage <= 1)) throw new MarketInputError(`observations[${i}].reportingCoverage`, 'must be between 0 and 1');
  daysBetween(o.periodEnd, o.retrievedAt);
}

export function computeMarketScore(input: MarketScoreInput): MarketScoreResult {
  const { area, profile, asOf } = input;
  daysBetween(asOf, asOf);
  input.observations.forEach(validateObservation);

  const observations = [...input.observations];
  if (input.regulatory) {
    const reg = input.regulatory;
    if (reg.index !== null) {
      const dates = reg.factors.map((f) => f.row?.retrievedAt).filter((d): d is string => !!d).sort();
      const anyDemo = reg.factors.some((f) => f.row?.verification === 'demo');
      const anyLocal = reg.factors.some((f) => f.row?.jurisdictionLevel === 'city');
      observations.push({
        metric: 'landlord_regulatory_index',
        value: reg.index,
        period: `In force ${asOf.slice(0, 10)}`,
        periodEnd: asOf,
        retrievedAt: dates[dates.length - 1] ?? asOf,
        source: anyDemo ? sourceRef('demo') : sourceRef('northstar_lri'),
        measuredAt: anyLocal ? 'city' : 'state',
      });
    }
  }

  const byMetric = new Map<string, MetricObservation[]>();
  for (const o of observations) {
    const list = byMetric.get(o.metric) ?? [];
    list.push(o);
    byMetric.set(o.metric, list);
  }

  const shares = normalizedCategoryWeights(profile);
  const categories: CategoryResult[] = CATEGORY_KEYS.map((key) => {
    const defs = metricsInCategory(key)
      .map((d) => ({ d, w: d.weight * (profile.variableEmphasis[d.key] ?? 1) }))
      .filter((x) => x.w > 0);
    const vars: VariableResult[] = defs.map(({ d, w }) => variableResult(d, w, pickObservation(byMetric.get(d.key) ?? [], asOf), area, asOf, input.relativeScores?.[d.key]));
    const totalW = vars.reduce((s, v) => s + v.weight, 0);
    const observed = vars.filter((v) => v.status === 'observed');
    const obsW = observed.reduce((s, v) => s + v.weight, 0);
    const obsMean = obsW > 0 ? observed.reduce((s, v) => s + v.score * v.weight, 0) / obsW : 50;
    const imputed = Math.min(50, obsMean);
    for (const v of vars) if (v.status === 'missing') v.score = round(imputed, 1);
    const provisional = totalW > 0 ? vars.reduce((s, v) => s + v.score * v.weight, 0) / totalW : 50;
    const coverage = totalW > 0 ? obsW / totalW : 0;
    const confidence = totalW > 0 ? vars.reduce((s, v) => s + v.confidence * v.weight, 0) / totalW : 0;
    const sufficient = coverage >= SUFFICIENCY;
    return {
      key,
      label: CATEGORY_LABELS[key],
      weight: round(shares[key], 4),
      score: sufficient ? round(provisional, 1) : null,
      scoreProvisional: round(provisional, 1),
      coverage: round(coverage, 3),
      confidence: round(confidence, 3),
      sufficient,
      variables: vars,
    };
  });

  let overallP = 0, cov = 0, conf = 0;
  for (const c of categories) {
    const s = shares[c.key];
    if (s === 0) continue;
    overallP += s * (c.sufficient ? c.scoreProvisional : Math.min(50, c.scoreProvisional));
    cov += s * c.coverage;
    conf += s * c.confidence;
  }

  const flags = computeRiskFlags({ area, categories, regulatory: input.regulatory ?? null, asOf });
  const projections = input.observations.filter((o) => o.isProjection);
  const isDemo = area.isDemo || input.observations.some((o) => o.source.class === 'demo');

  return {
    methodologyVersion: METHODOLOGY_VERSION,
    asOf,
    area,
    profile: { id: profile.id, label: profile.label },
    overall: cov >= SUFFICIENCY ? round(overallP, 1) : null,
    overallProvisional: round(overallP, 1),
    coverage: round(cov, 3),
    confidence: round(conf, 3),
    confidenceLabel: confidenceLabel(conf),
    categories,
    flags,
    projections,
    isDemo,
  };
}

function variableResult(d: MetricDefinition, weight: number, o: MetricObservation | null, area: GeoArea, asOf: string, relative: number | undefined): VariableResult {
  const base = { metric: d.key, label: d.label, unit: d.unit, weight, reference: d.reference, normalization: relative !== undefined ? 'relative' : 'absolute' } as const;
  if (!o) {
    return { ...base, status: 'missing', value: null, score: NaN, confidence: 0, period: null, periodEnd: null, ageDays: null, stale: false, source: null, measuredAt: null, inherited: false, reportingCoverage: null };
  }
  const age = daysBetween(o.periodEnd, asOf);
  const cov = o.reportingCoverage ?? null;
  const confidence = SOURCE_QUALITY[o.source.class] * freshnessFactor(age, d.freshnessDays) * resolutionFactor(area.level, o.measuredAt) * (cov === null ? 1 : Math.min(1, cov / 0.9));
  const score = relative !== undefined ? Math.min(100, Math.max(0, relative)) : normalizeAbsolute(d, o.value);
  return {
    ...base,
    status: 'observed',
    value: o.value,
    score: round(score, 1),
    confidence: round(confidence, 3),
    period: o.period,
    periodEnd: o.periodEnd,
    ageDays: age,
    stale: age > 2 * d.freshnessDays,
    source: o.source,
    measuredAt: o.measuredAt,
    inherited: levelIndex(o.measuredAt) < levelIndex(area.level),
    reportingCoverage: cov,
  };
}

/** Plain-language label for where a value was measured, e.g. "Metro area (inherited)". */
export function measuredAtLabel(v: Pick<VariableResult, 'measuredAt' | 'inherited'>): string {
  if (!v.measuredAt) return '—';
  return `${GEO_LEVEL_LABELS[v.measuredAt]}${v.inherited ? ' (inherited)' : ''}`;
}
