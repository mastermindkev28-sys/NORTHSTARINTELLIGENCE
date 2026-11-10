/**
 * Three independent scores, by design never combined.
 *
 *  1. Property signal score: how much public-record activity is attached to a property (filings,
 *     violations, scheduled sales). It describes records about a property, not a person.
 *  2. Data confidence score: how much the underlying data can be trusted (source quality, freshness,
 *     completeness, match confidence, conflicts).
 *  3. Strategy fit score: how well a property matches one investor's buy box for one strategy.
 *
 * There is intentionally no function here that blends these into a single "opportunity" number: a
 * property with strong signals and poor data is a research task, not an opportunity, and a single
 * number would hide that. Every score returns its factors so a user can see exactly why.
 *
 * All functions are pure. The caller supplies `asOf`; nothing reads the clock.
 */
import type { InvestmentStrategy } from '@northstar/core/strategies';
import type { EventStatus, SignalType } from './types';

export const SCORE_VERSION = '1.0.0';

export interface ScoreFactor {
  key: string;
  label: string;
  /** Points this factor contributed (may be 0 for factors shown for context). */
  contribution: number;
  detail: string;
}

const DAY_MS = 86_400_000;

function parseDate(field: string, v: string): number {
  if (!/^\d{4}-\d{2}-\d{2}/.test(v)) throw new Error(`${field}: must be an ISO date (received ${v})`);
  const t = Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v);
  if (Number.isNaN(t)) throw new Error(`${field}: invalid date ${v}`);
  return t;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------------------------
// 1. Property signal score
// ---------------------------------------------------------------------------------------------

/** Base weights per signal type. Zero-weight types are shown as context but add nothing. */
export const SIGNAL_WEIGHTS: Record<SignalType, { weight: number; label: string }> = {
  sheriff_sale_scheduled: { weight: 35, label: 'Sheriff sale scheduled' },
  foreclosure_filing: { weight: 30, label: 'Foreclosure filing' },
  tax_sale_listed: { weight: 30, label: 'Listed for tax sale' },
  lis_pendens: { weight: 25, label: 'Lis pendens recorded' },
  tax_delinquency: { weight: 20, label: 'Property tax delinquency' },
  unsafe_building: { weight: 20, label: 'Unsafe or dangerous building designation' },
  vacancy_indicator: { weight: 20, label: 'Vacancy indicator' },
  probate_filing: { weight: 20, label: 'Probate filing associated with the property' },
  code_violation: { weight: 10, label: 'Open code violation' },
  absentee_owner: { weight: 8, label: 'Owner mailing address differs from property' },
  long_ownership: { weight: 6, label: 'Long ownership tenure' },
  recent_sale: { weight: 0, label: 'Recent sale' },
  permit_activity: { weight: 0, label: 'Recent permit activity' },
};

/** Multiplier by lifecycle status. Closed-out events contribute nothing but remain visible. */
export const STATUS_MULTIPLIER: Record<EventStatus, number> = {
  active: 1,
  scheduled: 1,
  postponed: 0.8,
  completed: 0.2,
  resolved: 0,
  dismissed: 0,
  withdrawn: 0,
  cancelled: 0,
  expired: 0,
};

/** Half-life for recency decay of past events. */
export const SIGNAL_HALF_LIFE_DAYS = 365;
/** Each additional event of the same type adds this share of its weight (diminishing returns). */
export const REPEAT_SHARE = 0.25;
/** Saturation constant: score = 100 × (1 − e^(−points / K)). */
export const SIGNAL_SATURATION = 60;

export interface SignalEventInput {
  id: string;
  eventType: SignalType;
  status: EventStatus;
  /** Date the event occurred or was filed. */
  eventDate?: string;
  /** Future date for scheduled events. */
  scheduledDate?: string;
}

export type SignalBand = 'none' | 'low' | 'moderate' | 'high';

export interface PropertySignalScore {
  kind: 'property_signal';
  version: string;
  score: number;
  band: SignalBand;
  points: number;
  factors: ScoreFactor[];
  asOf: string;
}

export function scorePropertySignals(events: readonly SignalEventInput[], asOf: string): PropertySignalScore {
  const now = parseDate('asOf', asOf);
  const scored = events.map((e) => {
    const base = SIGNAL_WEIGHTS[e.eventType];
    if (!base) throw new Error(`eventType: unsupported signal type ${String(e.eventType)}`);
    const statusMult = STATUS_MULTIPLIER[e.status];
    if (statusMult === undefined) throw new Error(`status: unsupported status ${String(e.status)}`);
    let recency = 1;
    let ageDays: number | null = null;
    if (e.eventDate && !(e.status === 'scheduled' && e.scheduledDate)) {
      ageDays = Math.max(0, (now - parseDate(`${e.id}.eventDate`, e.eventDate)) / DAY_MS);
      recency = Math.pow(0.5, ageDays / SIGNAL_HALF_LIFE_DAYS);
    }
    if (e.scheduledDate && e.status === 'scheduled' && parseDate(`${e.id}.scheduledDate`, e.scheduledDate) < now) {
      // A scheduled date in the past with no status update is stale: treat as unknown outcome.
      recency = 0.5;
    }
    return { e, base, statusMult, recency, ageDays, raw: base.weight * statusMult * recency };
  });
  // Diminishing returns within a type: strongest counts fully, the rest at REPEAT_SHARE.
  const byType = new Map<SignalType, typeof scored>();
  for (const s of scored) byType.set(s.e.eventType, [...(byType.get(s.e.eventType) ?? []), s]);
  const factors: ScoreFactor[] = [];
  let points = 0;
  for (const [type, list] of [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    list.sort((a, b) => b.raw - a.raw || a.e.id.localeCompare(b.e.id));
    list.forEach((s, i) => {
      const contribution = i === 0 ? s.raw : s.raw * REPEAT_SHARE;
      points += contribution;
      const parts = [`status ${s.e.status} ×${s.statusMult}`];
      if (s.ageDays !== null) parts.push(`${Math.round(s.ageDays)} days old ×${s.recency.toFixed(2)}`);
      if (i > 0) parts.push(`repeat ×${REPEAT_SHARE}`);
      factors.push({ key: `${type}:${s.e.id}`, label: s.base.label, contribution: round1(contribution), detail: parts.join(', ') });
    });
  }
  const score = Math.round(100 * (1 - Math.exp(-points / SIGNAL_SATURATION)));
  const band: SignalBand = points <= 0 ? 'none' : score < 25 ? 'low' : score < 55 ? 'moderate' : 'high';
  return { kind: 'property_signal', version: SCORE_VERSION, score, band, points: round1(points), factors, asOf };
}

// ---------------------------------------------------------------------------------------------
// 2. Data confidence score
// ---------------------------------------------------------------------------------------------

export type SourceKind = 'official_api' | 'open_data' | 'bulk_download' | 'licensed_provider' | 'user_entered' | 'ai_extracted' | 'demo';

export const SOURCE_QUALITY: Record<SourceKind, number> = {
  official_api: 1,
  open_data: 0.9,
  bulk_download: 0.85,
  licensed_provider: 0.75,
  user_entered: 0.6,
  ai_extracted: 0.3,
  demo: 0,
};

export interface FieldEvidence {
  key: string;
  sourceKind: SourceKind;
  retrievedAt: string;
  /** True when a person verified the value against a primary record. */
  verified?: boolean;
}

export interface DataConfidenceInput {
  fields: readonly FieldEvidence[];
  /** Fields expected for a complete record. */
  requiredFields?: readonly string[];
  /** Entity-resolution confidence for the record-to-parcel link (0–1). Omit when matched by exact APN. */
  matchConfidence?: number;
  /** Number of fields where sources disagree. */
  conflicts?: number;
  /** Age at which a field counts as fully stale. Default 365 days. */
  staleAfterDays?: number;
  asOf: string;
}

export type ConfidenceBand = 'low' | 'medium' | 'high';

export interface DataConfidenceScore {
  kind: 'data_confidence';
  version: string;
  score: number;
  band: ConfidenceBand;
  factors: ScoreFactor[];
  missingFields: string[];
  demo: boolean;
}

export const DEFAULT_REQUIRED_FIELDS = ['apn', 'address', 'owner_name', 'assessed_value', 'property_type', 'living_area', 'last_sale_date'] as const;

export function scoreDataConfidence(input: DataConfidenceInput): DataConfidenceScore {
  const now = parseDate('asOf', input.asOf);
  const stale = input.staleAfterDays ?? 365;
  const required = input.requiredFields ?? DEFAULT_REQUIRED_FIELDS;
  const demo = input.fields.some((f) => f.sourceKind === 'demo');
  const present = new Set(input.fields.map((f) => f.key));
  const missing = required.filter((k) => !present.has(k));
  const n = input.fields.length;

  const quality = n === 0 ? 0 : input.fields.reduce((a, f) => a + (f.verified ? 1 : SOURCE_QUALITY[f.sourceKind]), 0) / n;
  const freshness =
    n === 0
      ? 0
      : input.fields.reduce((a, f) => {
          const age = Math.max(0, (now - parseDate(`${f.key}.retrievedAt`, f.retrievedAt)) / DAY_MS);
          return a + Math.max(0, 1 - age / stale);
        }, 0) / n;
  const completeness = required.length === 0 ? 1 : (required.length - missing.length) / required.length;
  const match = input.matchConfidence ?? 1;
  if (match < 0 || match > 1) throw new Error('matchConfidence: must be between 0 and 1');
  const conflicts = input.conflicts ?? 0;

  const factors: ScoreFactor[] = [
    { key: 'source_quality', label: 'Source quality', contribution: round1(40 * quality), detail: `average ${(quality * 100).toFixed(0)}% across ${n} field(s)` },
    { key: 'freshness', label: 'Freshness', contribution: round1(25 * freshness), detail: `stale after ${stale} days` },
    { key: 'completeness', label: 'Completeness', contribution: round1(20 * completeness), detail: missing.length ? `missing ${missing.join(', ')}` : 'all expected fields present' },
    { key: 'match_confidence', label: 'Record match confidence', contribution: round1(15 * match), detail: input.matchConfidence === undefined ? 'exact identifier match' : `${(match * 100).toFixed(0)}%` },
  ];
  if (conflicts > 0) {
    factors.push({ key: 'conflicts', label: 'Conflicting sources', contribution: -Math.min(30, conflicts * 10), detail: `${conflicts} field(s) disagree between sources` });
  }
  let score = Math.max(0, Math.min(100, Math.round(factors.reduce((a, f) => a + f.contribution, 0))));
  if (demo) {
    score = 0;
    factors.push({ key: 'demo', label: 'Demo data', contribution: 0, detail: 'record contains synthetic demo data; confidence is zero by policy' });
  }
  const band: ConfidenceBand = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
  return { kind: 'data_confidence', version: SCORE_VERSION, score, band, factors, missingFields: missing, demo };
}

// ---------------------------------------------------------------------------------------------
// 3. Strategy fit score
// ---------------------------------------------------------------------------------------------

export interface PropertyFacts {
  state?: string;
  countyFips?: string;
  postalCode?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  yearBuilt?: number;
  units?: number;
  price?: number;
}

/** Metrics produced by the underwriting engines for one strategy. Missing metrics stay undefined. */
export interface StrategyMetrics {
  capRate?: number;
  cashOnCash?: number;
  dscr?: number;
  monthlyCashFlow?: number;
  netProfit?: number;
  returnOnCost?: number;
  /** (ARV − price − rehab) ÷ ARV. */
  equitySpreadRate?: number;
  rehabCost?: number;
  pricePerUnit?: number;
  cashRequired?: number;
}

export interface BuyBox {
  id: string;
  name: string;
  strategies: readonly InvestmentStrategy[];
  geography?: { states?: readonly string[]; countyFips?: readonly string[]; postalCodes?: readonly string[] };
  propertyTypes?: readonly string[];
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  minLivingArea?: number;
  maxLivingArea?: number;
  minYearBuilt?: number;
  minUnits?: number;
  maxUnits?: number;
  minPrice?: number;
  maxPrice?: number;
  maxRehab?: number;
  minCapRate?: number;
  minCashOnCash?: number;
  minDscr?: number;
  minMonthlyCashFlow?: number;
  minNetProfit?: number;
  minReturnOnCost?: number;
  minEquitySpreadRate?: number;
  maxPricePerUnit?: number;
}

export interface InvestorProfile {
  experience: 'new' | 'some' | 'experienced' | 'professional';
  /** Liquid capital available for down payments, rehab, and reserves. */
  capitalAvailable?: number;
  financing: readonly ('cash' | 'conventional' | 'dscr' | 'hard_money' | 'private' | 'seller_finance')[];
  riskTolerance: 'low' | 'moderate' | 'high';
  holdYears?: number;
}

export type CriterionResult = 'pass' | 'fail' | 'unknown';

export interface FitCriterion {
  key: string;
  label: string;
  hard: boolean;
  result: CriterionResult;
  /** Soft criteria: credit in [0, 1]; partial credit for near misses. */
  credit: number;
  detail: string;
}

export type FitStatus = 'fit' | 'partial' | 'not_a_fit' | 'insufficient_data';

export interface StrategyFitScore {
  kind: 'strategy_fit';
  version: string;
  strategy: InvestmentStrategy;
  buyBoxId: string;
  status: FitStatus;
  /** null when status is insufficient_data. */
  score: number | null;
  criteria: FitCriterion[];
  missing: string[];
  notes: string[];
}

function inList(label: string, key: string, list: readonly string[] | undefined, value: string | undefined, norm = (s: string) => s.toUpperCase()): FitCriterion | null {
  if (!list || list.length === 0) return null;
  if (value === undefined) return { key, label, hard: true, result: 'unknown', credit: 0, detail: 'value unknown' };
  const ok = list.map(norm).includes(norm(value));
  return { key, label, hard: true, result: ok ? 'pass' : 'fail', credit: ok ? 1 : 0, detail: ok ? `${value} is in the buy box` : `${value} is outside the buy box` };
}

function bound(label: string, key: string, hard: boolean, value: number | undefined, min?: number, max?: number): FitCriterion | null {
  if (min === undefined && max === undefined) return null;
  if (value === undefined) return { key, label, hard, result: 'unknown', credit: 0, detail: 'value unknown' };
  const lowOk = min === undefined || value >= min;
  const highOk = max === undefined || value <= max;
  if (lowOk && highOk) return { key, label, hard, result: 'pass', credit: 1, detail: `${value} within ${min ?? '−'}…${max ?? '+'}` };
  // Partial credit for soft criteria within 20% of the threshold.
  let credit = 0;
  if (!hard) {
    const target = !lowOk ? min! : max!;
    const miss = Math.abs(value - target) / Math.max(Math.abs(target), 1e-9);
    credit = Math.max(0, 1 - miss / 0.2);
  }
  return { key, label, hard, result: 'fail', credit, detail: `${value} outside ${min ?? '−'}…${max ?? '+'}` };
}

export function scoreStrategyFit(
  strategy: InvestmentStrategy,
  buyBox: BuyBox,
  facts: PropertyFacts,
  metrics: StrategyMetrics,
  profile?: InvestorProfile,
): StrategyFitScore {
  const notes: string[] = [];
  const base = { kind: 'strategy_fit' as const, version: SCORE_VERSION, strategy, buyBoxId: buyBox.id };
  if (!buyBox.strategies.includes(strategy)) {
    return { ...base, status: 'not_a_fit', score: 0, criteria: [], missing: [], notes: [`Buy box "${buyBox.name}" does not include ${strategy}.`] };
  }
  const g = buyBox.geography ?? {};
  const candidates: (FitCriterion | null)[] = [
    inList('State', 'state', g.states, facts.state),
    inList('County', 'county', g.countyFips, facts.countyFips, (s) => s),
    inList('ZIP code', 'postal_code', g.postalCodes, facts.postalCode, (s) => s),
    inList('Property type', 'property_type', buyBox.propertyTypes, facts.propertyType, (s) => s.toLowerCase()),
    bound('Bedrooms', 'bedrooms', true, facts.bedrooms, buyBox.minBedrooms, buyBox.maxBedrooms),
    bound('Bathrooms', 'bathrooms', true, facts.bathrooms, buyBox.minBathrooms),
    bound('Living area', 'living_area', true, facts.livingArea, buyBox.minLivingArea, buyBox.maxLivingArea),
    bound('Year built', 'year_built', true, facts.yearBuilt, buyBox.minYearBuilt),
    bound('Units', 'units', true, facts.units, buyBox.minUnits, buyBox.maxUnits),
    bound('Price', 'price', true, facts.price, buyBox.minPrice, buyBox.maxPrice),
    bound('Rehab budget', 'rehab', false, metrics.rehabCost, undefined, buyBox.maxRehab),
    bound('Cap rate', 'cap_rate', false, metrics.capRate, buyBox.minCapRate),
    bound('Cash-on-cash', 'cash_on_cash', false, metrics.cashOnCash, buyBox.minCashOnCash),
    bound('DSCR', 'dscr', false, metrics.dscr, buyBox.minDscr),
    bound('Monthly cash flow', 'monthly_cash_flow', false, metrics.monthlyCashFlow, buyBox.minMonthlyCashFlow),
    bound('Net profit', 'net_profit', false, metrics.netProfit, buyBox.minNetProfit),
    bound('Return on cost', 'return_on_cost', false, metrics.returnOnCost, buyBox.minReturnOnCost),
    bound('Equity spread', 'equity_spread', false, metrics.equitySpreadRate, buyBox.minEquitySpreadRate),
    bound('Price per unit', 'price_per_unit', false, metrics.pricePerUnit, undefined, buyBox.maxPricePerUnit),
  ];
  const criteria = candidates.filter((c): c is FitCriterion => c !== null);
  if (profile?.capitalAvailable !== undefined && metrics.cashRequired !== undefined) {
    const ok = metrics.cashRequired <= profile.capitalAvailable;
    criteria.push({ key: 'capital', label: 'Cash required vs capital available', hard: true, result: ok ? 'pass' : 'fail', credit: ok ? 1 : 0, detail: `${metrics.cashRequired} required, ${profile.capitalAvailable} available` });
  }
  if (profile && (strategy === 'creative_finance' || strategy === 'brrrr') && profile.experience === 'new') {
    notes.push(`${strategy === 'brrrr' ? 'BRRRR' : 'Creative finance'} carries refinance and legal risk; consider an experienced partner or attorney review.`);
  }
  const missing = criteria.filter((c) => c.result === 'unknown').map((c) => c.key);
  if (criteria.length === 0) {
    return { ...base, status: 'insufficient_data', score: null, criteria, missing, notes: [...notes, 'The buy box has no criteria.'] };
  }
  if (criteria.some((c) => c.hard && c.result === 'fail')) {
    return { ...base, status: 'not_a_fit', score: 0, criteria, missing, notes };
  }
  const soft = criteria.filter((c) => !c.hard);
  const softUnknown = soft.filter((c) => c.result === 'unknown').length;
  if (criteria.some((c) => c.hard && c.result === 'unknown') || (soft.length > 0 && softUnknown * 2 > soft.length)) {
    return { ...base, status: 'insufficient_data', score: null, criteria, missing, notes };
  }
  const known = criteria.filter((c) => c.result !== 'unknown');
  const score = Math.round((100 * known.reduce((a, c) => a + c.credit, 0)) / known.length);
  const allPass = known.every((c) => c.result === 'pass');
  return { ...base, status: allPass && missing.length === 0 ? 'fit' : 'partial', score, criteria, missing, notes };
}
