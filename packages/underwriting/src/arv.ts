import type { SourceRef } from "@northstar/core";
import { CalculationInputError, Trace, requireNonNegative } from "./trace";

export interface CompAdjustment {
  label: string;
  /** Dollar adjustment applied to the comp's sale price (positive if the comp is inferior to the subject). */
  amount: number;
}

export interface ComparableSale {
  id: string;
  address?: string;
  salePrice: number;
  /** ISO date (YYYY-MM-DD) of the recorded sale. */
  saleDate: string;
  livingAreaSqft: number;
  distanceMiles?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  /** Explicit, user- or analyst-entered adjustments. Never auto-generated. */
  adjustments?: CompAdjustment[];
  source?: SourceRef;
}

export interface ArvSubject {
  livingAreaSqft: number;
  bedrooms?: number;
  bathrooms?: number;
}

export type CompWeighting = "equal" | "inverse_distance" | "recency_distance";

export interface ArvOptions {
  /** Valuation date (ISO). Comps after this date are excluded. */
  asOf: string;
  maxDistanceMiles?: number;
  maxAgeMonths?: number;
  /** Comps whose living area differs from the subject by more than this fraction are excluded. */
  sqftTolerance?: number;
  /** Minimum comps for a "sufficient" grade. */
  minComps?: number;
  weighting?: CompWeighting;
  /** Drop comps whose $/sqft lies outside 1.5× IQR (only when ≥ 4 comps remain). */
  trimOutliers?: boolean;
}

export interface IncludedComp {
  id: string;
  adjustedPrice: number;
  pricePerSqft: number;
  monthsAgo: number;
  weight: number;
  impliedValue: number;
}

export interface ExcludedComp {
  id: string;
  reason: string;
}

export type ConfidenceGrade = "high" | "medium" | "low" | "insufficient";

export interface ArvResult {
  /** Point estimate rounded to the nearest $100. Null when no comps survive filtering. */
  arv: number | null;
  low: number | null;
  high: number | null;
  medianArv: number | null;
  weightedPricePerSqft: number | null;
  medianPricePerSqft: number | null;
  /** Coefficient of variation of included comps' $/sqft (stdev / mean). */
  dispersion: number | null;
  confidence: number;
  grade: ConfidenceGrade;
  included: IncludedComp[];
  excluded: ExcludedComp[];
  warnings: string[];
  trace: Trace;
}

const DAYS_PER_MONTH = 30.4375;

export function monthsBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to))
    throw new CalculationInputError(`Invalid date: ${fromIso} / ${toIso}`);
  return (to - from) / (86_400_000 * DAYS_PER_MONTH);
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lower = s[base] as number;
  const upper = s[base + 1];
  return upper === undefined ? lower : lower + rest * (upper - lower);
}

const roundHundred = (v: number) => Math.round(v / 100) * 100;

/**
 * Sales-comparison ARV using adjusted price per square foot.
 *
 *   adjustedPrice_i = salePrice_i + Σ adjustments_i
 *   ppsf_i          = adjustedPrice_i / sqft_i
 *   ARV             = (Σ w_i · ppsf_i / Σ w_i) × subjectSqft
 *
 * Confidence is a transparent heuristic (see UNDERWRITING_METHODOLOGY.md §ARV) — not a statistical interval.
 */
export function estimateArv(
  subject: ArvSubject,
  comps: readonly ComparableSale[],
  options: ArvOptions,
): ArvResult {
  requireNonNegative("subject.livingAreaSqft", subject.livingAreaSqft);
  if (subject.livingAreaSqft === 0)
    throw new CalculationInputError("subject.livingAreaSqft must be > 0");

  const {
    asOf,
    maxDistanceMiles = 1,
    maxAgeMonths = 6,
    sqftTolerance = 0.25,
    minComps = 3,
    weighting = "recency_distance",
    trimOutliers = true,
  } = options;

  const trace = new Trace();
  const warnings: string[] = [];
  const excluded: ExcludedComp[] = [];
  let candidates: Omit<IncludedComp, "weight" | "impliedValue">[] = [];
  const distances = new Map<string, number | undefined>();

  for (const comp of comps) {
    if (!(comp.salePrice > 0) || !(comp.livingAreaSqft > 0)) {
      excluded.push({ id: comp.id, reason: "Missing or invalid sale price / living area" });
      continue;
    }
    const monthsAgo = monthsBetween(comp.saleDate, asOf);
    if (monthsAgo < 0) {
      excluded.push({ id: comp.id, reason: "Sale date is after the valuation date" });
      continue;
    }
    if (monthsAgo > maxAgeMonths) {
      excluded.push({
        id: comp.id,
        reason: `Sold ${monthsAgo.toFixed(1)} months ago (limit ${maxAgeMonths})`,
      });
      continue;
    }
    if (comp.distanceMiles !== undefined && comp.distanceMiles > maxDistanceMiles) {
      excluded.push({
        id: comp.id,
        reason: `${comp.distanceMiles.toFixed(2)} mi away (limit ${maxDistanceMiles})`,
      });
      continue;
    }
    const sizeDiff =
      Math.abs(comp.livingAreaSqft - subject.livingAreaSqft) / subject.livingAreaSqft;
    if (sizeDiff > sqftTolerance) {
      excluded.push({
        id: comp.id,
        reason: `Living area differs by ${(sizeDiff * 100).toFixed(0)}% (limit ${(sqftTolerance * 100).toFixed(0)}%)`,
      });
      continue;
    }
    const adjustedPrice =
      comp.salePrice + (comp.adjustments ?? []).reduce((s, a) => s + a.amount, 0);
    if (adjustedPrice <= 0) {
      excluded.push({ id: comp.id, reason: "Adjusted price is not positive" });
      continue;
    }
    distances.set(comp.id, comp.distanceMiles);
    candidates.push({
      id: comp.id,
      adjustedPrice,
      pricePerSqft: adjustedPrice / comp.livingAreaSqft,
      monthsAgo,
    });
  }

  if (trimOutliers && candidates.length >= 4) {
    const ppsf = candidates.map((c) => c.pricePerSqft);
    const q1 = quantile(ppsf, 0.25);
    const q3 = quantile(ppsf, 0.75);
    const iqr = q3 - q1;
    const lo = q1 - 1.5 * iqr;
    const hi = q3 + 1.5 * iqr;
    const kept: typeof candidates = [];
    for (const c of candidates) {
      if (c.pricePerSqft < lo || c.pricePerSqft > hi) {
        excluded.push({
          id: c.id,
          reason: `Statistical outlier: $${c.pricePerSqft.toFixed(0)}/sqft outside [${lo.toFixed(0)}, ${hi.toFixed(0)}]`,
        });
      } else kept.push(c);
    }
    candidates = kept;
  }

  if (candidates.length === 0) {
    warnings.push("No comparable sales met the selection criteria. ARV cannot be estimated.");
    return {
      arv: null,
      low: null,
      high: null,
      medianArv: null,
      weightedPricePerSqft: null,
      medianPricePerSqft: null,
      dispersion: null,
      confidence: 0,
      grade: "insufficient",
      included: [],
      excluded,
      warnings,
      trace,
    };
  }

  const rawWeights = candidates.map((c) => {
    const d = Math.max(distances.get(c.id) ?? maxDistanceMiles, 0.1);
    if (weighting === "equal") return 1;
    if (weighting === "inverse_distance") return 1 / d;
    return (1 / d) * (1 / (1 + c.monthsAgo / 6));
  });
  const weightSum = rawWeights.reduce((a, b) => a + b, 0);
  const included: IncludedComp[] = candidates.map((c, i) => ({
    ...c,
    weight: (rawWeights[i] as number) / weightSum,
    impliedValue: c.pricePerSqft * subject.livingAreaSqft,
  }));

  const ppsfValues = included.map((c) => c.pricePerSqft);
  const weightedPpsf = included.reduce((s, c) => s + c.weight * c.pricePerSqft, 0);
  const medianPpsf = median(ppsfValues);
  const mean = ppsfValues.reduce((a, b) => a + b, 0) / ppsfValues.length;
  const variance =
    ppsfValues.length > 1
      ? ppsfValues.reduce((s, v) => s + (v - mean) ** 2, 0) / (ppsfValues.length - 1)
      : 0;
  const dispersion = mean > 0 ? Math.sqrt(variance) / mean : 0;

  trace.record({
    key: "weighted_ppsf",
    label: "Weighted adjusted price per sq ft",
    formula: "Σ(wᵢ · adjustedPriceᵢ / sqftᵢ)",
    inputs: { comps: included.length, weighting },
    result: weightedPpsf,
    unit: "usd_per_sqft",
  });
  const arvRaw = weightedPpsf * subject.livingAreaSqft;
  const arv = trace.record({
    key: "arv",
    label: "After-repair value",
    formula: "Weighted $/sqft × subject sq ft (rounded to $100)",
    inputs: { weightedPricePerSqft: weightedPpsf, subjectSqft: subject.livingAreaSqft },
    result: roundHundred(arvRaw),
    unit: "usd",
  });

  // Transparent confidence heuristic.
  const n = included.length;
  const countScore = Math.min(n / 5, 1);
  const dispersionScore =
    n < 2
      ? 0.5
      : dispersion <= 0.08
        ? 1
        : dispersion >= 0.3
          ? 0.3
          : 1 - ((dispersion - 0.08) / 0.22) * 0.7;
  const avgMonths = included.reduce((s, c) => s + c.monthsAgo, 0) / n;
  const recencyScore = Math.max(0, 1 - avgMonths / (maxAgeMonths * 1.5));
  const knownDistances = included
    .map((c) => distances.get(c.id))
    .filter((d): d is number => d !== undefined);
  const distanceScore =
    knownDistances.length === 0
      ? 0.5
      : Math.max(
          0,
          1 -
            knownDistances.reduce((a, b) => a + b, 0) /
              knownDistances.length /
              (maxDistanceMiles * 1.5),
        );
  let confidence =
    0.4 * countScore + 0.35 * dispersionScore + 0.15 * recencyScore + 0.1 * distanceScore;
  if (n < minComps) {
    confidence = Math.min(confidence, 0.35);
    warnings.push(`Only ${n} comparable sale(s) qualified; at least ${minComps} are recommended.`);
  }
  if (dispersion > 0.2)
    warnings.push(
      `High price dispersion among comps (CV ${(dispersion * 100).toFixed(0)}%). Review comp selection and adjustments.`,
    );
  if (knownDistances.length < n)
    warnings.push(
      "Some comps have no distance information; distance weighting assumed the maximum radius.",
    );
  confidence = Math.round(confidence * 100) / 100;
  const grade: ConfidenceGrade =
    n < minComps
      ? "insufficient"
      : confidence >= 0.75
        ? "high"
        : confidence >= 0.55
          ? "medium"
          : "low";

  const impliedValues = included.map((c) => c.impliedValue);
  return {
    arv,
    low: roundHundred(Math.min(...impliedValues)),
    high: roundHundred(Math.max(...impliedValues)),
    medianArv: roundHundred(medianPpsf * subject.livingAreaSqft),
    weightedPricePerSqft: weightedPpsf,
    medianPricePerSqft: medianPpsf,
    dispersion,
    confidence,
    grade,
    included,
    excluded,
    warnings,
    trace,
  };
}
