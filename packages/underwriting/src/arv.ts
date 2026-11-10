/**
 * After-Repair Value (ARV) from comparable sales.
 *
 * Method (transparent, reproducible):
 *   1. For each comp: Adjusted Price = Sale Price + Σ dollar adjustments (adjustments bring the comp in line
 *      with the subject: positive when the subject is superior, negative when inferior).
 *   2. Adjusted $/sqft = Adjusted Price / Comp Sqft.
 *   3. Indicated value per comp = Adjusted $/sqft × Subject Sqft.
 *   4. ARV = weighted mean of indicated values (weights default to 1). Median and range are reported too.
 *
 * This is a deterministic comparable-sales calculation, not an appraisal.
 */
import {
  ResultBuilder,
  UnderwritingInputError,
  requireNumber,
  roundCurrency,
  toSourced,
  type CalculationResult,
  type NumericInput,
  type Sourced,
} from './core';

export interface ComparableSale {
  id: string;
  address?: string;
  salePrice: NumericInput;
  squareFeet: NumericInput;
  /** ISO date of sale. Used for staleness warnings only. */
  saleDate?: string;
  /** Distance to subject in miles. Used for warnings only. */
  distanceMiles?: number;
  /** Dollar adjustments, keyed by reason (e.g. { bathroom: 5000, garage: -8000 }). */
  adjustments?: Record<string, number>;
  /** Relative weight, default 1. Must be > 0. */
  weight?: number;
}

export interface ArvInput {
  subjectSquareFeet: NumericInput;
  comps: ComparableSale[];
  /** Valuation date used for staleness warnings; required to keep the function clock-free. */
  asOfDate?: string;
  /** Comps older than this many days trigger a caution. Default 180. */
  maxCompAgeDays?: number;
  /** Comps further than this trigger a caution. Default 1 mile. */
  maxDistanceMiles?: number;
}

export interface CompBreakdown {
  id: string;
  address?: string;
  salePrice: number;
  totalAdjustment: number;
  adjustedPrice: number;
  adjustedPricePerSqft: number;
  indicatedValue: number;
  weight: number;
  source: Sourced['source'];
}

export interface ArvResult {
  arv: number;
  median: number;
  low: number;
  high: number;
  weightedPricePerSqft: number;
  /** Coefficient of variation of indicated values (stdev / mean): dispersion signal for confidence. */
  dispersion: number;
  compCount: number;
  comps: CompBreakdown[];
}

const DAY_MS = 86_400_000;

function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function calculateArv(input: ArvInput): CalculationResult<ArvResult> {
  const b = new ResultBuilder();
  const subjectSqft = b.input('subjectSquareFeet', 'Subject living area (sqft)', input.subjectSquareFeet, {
    gt: 0,
  });
  if (!Array.isArray(input.comps) || input.comps.length === 0) {
    throw new UnderwritingInputError('comps', 'at least one comparable sale is required');
  }
  const ids = new Set<string>();
  const maxAge = input.maxCompAgeDays ?? 180;
  const maxDist = input.maxDistanceMiles ?? 1;
  const asOf = input.asOfDate ? Date.parse(input.asOfDate) : undefined;
  if (input.asOfDate && Number.isNaN(asOf)) {
    throw new UnderwritingInputError('asOfDate', 'must be an ISO-8601 date');
  }

  const breakdown: CompBreakdown[] = input.comps.map((c, i) => {
    const f = `comps[${i}]`;
    if (!c.id) throw new UnderwritingInputError(`${f}.id`, 'is required');
    if (ids.has(c.id)) throw new UnderwritingInputError(`${f}.id`, `duplicate comp id "${c.id}"`);
    ids.add(c.id);
    const price = requireNumber(`${f}.salePrice`, c.salePrice, { gt: 0 });
    const sqft = requireNumber(`${f}.squareFeet`, c.squareFeet, { gt: 0 });
    const weight = c.weight === undefined ? 1 : requireNumber(`${f}.weight`, c.weight, { gt: 0 });
    let totalAdj = 0;
    for (const [reason, amt] of Object.entries(c.adjustments ?? {})) {
      totalAdj += requireNumber(`${f}.adjustments.${reason}`, amt);
    }
    const adjusted = price + totalAdj;
    if (adjusted <= 0) {
      throw new UnderwritingInputError(`${f}.adjustments`, 'adjusted price must remain positive');
    }
    const ppsf = adjusted / sqft;
    const indicated = ppsf * subjectSqft;
    b.step(
      `Comp ${c.id} indicated value`,
      '(Sale Price + Adjustments) ÷ Comp Sqft × Subject Sqft',
      { salePrice: price, adjustments: totalAdj, compSqft: sqft, subjectSqft },
      indicated,
    );

    if (Math.abs(totalAdj) / price > 0.25) {
      b.warn(
        `comp_heavy_adjustment_${c.id}`,
        'caution',
        `Comp ${c.id} carries net adjustments of ${Math.round((totalAdj / price) * 100)}% of sale price; it may not be comparable.`,
      );
    }
    if (c.distanceMiles !== undefined && c.distanceMiles > maxDist) {
      b.warn(`comp_distance_${c.id}`, 'caution', `Comp ${c.id} is ${c.distanceMiles} mi from the subject (limit ${maxDist} mi).`);
    }
    if (asOf !== undefined && c.saleDate) {
      const sold = Date.parse(c.saleDate);
      if (Number.isNaN(sold)) throw new UnderwritingInputError(`${f}.saleDate`, 'must be an ISO-8601 date');
      const age = Math.floor((asOf - sold) / DAY_MS);
      if (age > maxAge) b.warn(`comp_stale_${c.id}`, 'caution', `Comp ${c.id} sold ${age} days before the valuation date (limit ${maxAge}).`);
      if (age < 0) b.warn(`comp_future_${c.id}`, 'critical', `Comp ${c.id} sale date is after the valuation date.`);
    }

    const s = toSourced(c.salePrice);
    if (s.source === 'ai_interpretation') {
      b.warn(`comp_unverified_${c.id}`, 'caution', `Comp ${c.id} sale price is AI-extracted and unverified.`);
    }

    const row: CompBreakdown = {
      id: c.id,
      salePrice: price,
      totalAdjustment: totalAdj,
      adjustedPrice: adjusted,
      adjustedPricePerSqft: ppsf,
      indicatedValue: indicated,
      weight,
      source: s.source,
    };
    if (c.address !== undefined) row.address = c.address;
    return row;
  });

  const totalWeight = breakdown.reduce((a, c) => a + c.weight, 0);
  const arv = breakdown.reduce((a, c) => a + c.indicatedValue * c.weight, 0) / totalWeight;
  const weightedPpsf = breakdown.reduce((a, c) => a + c.adjustedPricePerSqft * c.weight, 0) / totalWeight;
  const values = breakdown.map((c) => c.indicatedValue).sort((x, y) => x - y);
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const dispersion = mean === 0 ? 0 : Math.sqrt(variance) / mean;

  b.step('ARV (weighted mean of indicated values)', 'Σ(Indicated Value × Weight) ÷ Σ Weight', { totalWeight }, arv);

  if (breakdown.length < 3) {
    b.warn('comp_count_low', 'caution', `Only ${breakdown.length} comparable sale(s); three or more are recommended.`);
  }
  if (dispersion > 0.15) {
    b.warn('comp_dispersion_high', 'caution', `Indicated values vary widely (CV ${(dispersion * 100).toFixed(1)}%); ARV confidence is low.`);
  }

  return b.build({
    arv: roundCurrency(arv),
    median: roundCurrency(median(values)),
    low: roundCurrency(values[0]!),
    high: roundCurrency(values[values.length - 1]!),
    weightedPricePerSqft: roundCurrency(weightedPpsf),
    dispersion: Math.round(dispersion * 10_000) / 10_000,
    compCount: breakdown.length,
    comps: breakdown,
  });
}
