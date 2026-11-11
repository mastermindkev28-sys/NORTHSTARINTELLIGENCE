/**
 * Property-level undervaluation evidence (addendum §3; research methodology §3).
 *
 * Five separate signals, never merged into one label:
 *   1. below_comps          price below an adjusted value from ≥ 3 eligible comparable sales (distance and date limits)
 *   2. below_avm            price below a third-party AVM; each AVM shown separately; never sufficient alone
 *   3. below_neighborhood   price per sq ft below the median of recent arm's-length area sales (sample size shown)
 *   4. distress             active public-record distress events (tax sale, lis pendens, sheriff sale, ...)
 *   5. seller_requested     the seller's own asking price, recorded as a statement, not a valuation
 *
 * The overall classification can be "potentially below market" ONLY when signal 1 is supported. An AVM or a single comp
 * can never produce it. Assessed value is reported as a tax measure and never used as market value.
 */
import { calculateArv, type ComparableSale } from '@northstar/underwriting';
import { MarketInputError, daysBetween, round } from './types';

export interface UvComp {
  id: string;
  address?: string;
  salePrice: number;
  squareFeet: number;
  saleDate: string;
  distanceMiles: number;
  adjustments?: Record<string, number>;
  armsLength?: boolean;
}

export interface UvAvm {
  provider: string;
  value: number;
  asOf: string;
  /** Provider-reported confidence or FSD, if any (0..1 meaning varies by provider; displayed only). */
  providerConfidence?: number;
}

export interface UvDistressEvent {
  type: 'tax_delinquency' | 'tax_sale' | 'lis_pendens' | 'sheriff_sale' | 'probate' | 'code_violation' | 'vacancy' | 'other';
  status: 'active' | 'postponed' | 'resolved' | 'dismissed';
  eventDate: string;
  source: string;
}

export interface UndervaluationInput {
  asOf: string;
  subjectSquareFeet: number;
  /** The price being tested: list price, offer price, or contract price. */
  price: number;
  priceBasis: 'list_price' | 'offer_price' | 'contract_price';
  comps?: UvComp[];
  avms?: UvAvm[];
  neighborhood?: { medianPricePerSqft: number; sampleSize: number; windowDays: number; areaName: string; source: string };
  distressEvents?: UvDistressEvent[];
  sellerAskingPrice?: { value: number; statedAt: string; context?: string };
  /** Tax assessment. Reported separately; never used as market value. */
  assessedValue?: { value: number; year: number; jurisdiction: string };
  options?: { minComps?: number; maxCompAgeDays?: number; maxDistanceMiles?: number; minDiscount?: number; minNeighborhoodSample?: number };
}

export type SignalStatus = 'supported' | 'not_supported' | 'insufficient_evidence' | 'indicative' | 'present' | 'absent' | 'statement';

export interface UvSignal {
  key: 'below_comps' | 'below_avm' | 'below_neighborhood' | 'distress' | 'seller_requested';
  label: string;
  status: SignalStatus;
  discountPct: number | null;
  summary: string;
  evidence: Record<string, unknown>;
}

export type UvClassification = 'potentially_below_market' | 'not_below_market' | 'indicators_only' | 'insufficient_evidence';

export interface UndervaluationResult {
  classification: UvClassification;
  headline: string;
  signals: UvSignal[];
  compValue: { value: number; low: number; high: number; dispersion: number; compCount: number; excluded: { id: string; reason: string }[] } | null;
  confidence: 'high' | 'moderate' | 'low';
  taxMeasures: { assessedValue: number; year: number; jurisdiction: string; note: string } | null;
}

const pct = (price: number, value: number) => round((1 - price / value) * 100, 1);

export function assessUndervaluation(input: UndervaluationInput): UndervaluationResult {
  const o = { minComps: 3, maxCompAgeDays: 180, maxDistanceMiles: 1, minDiscount: 0.1, minNeighborhoodSample: 10, ...input.options };
  if (!(input.price > 0)) throw new MarketInputError('price', 'must be > 0');
  if (!(input.subjectSquareFeet > 0)) throw new MarketInputError('subjectSquareFeet', 'must be > 0');
  if (o.minComps < 3) throw new MarketInputError('options.minComps', 'cannot be below 3: one or two comps never establish undervaluation');
  daysBetween(input.asOf, input.asOf);

  const signals: UvSignal[] = [];

  // 1. Comparable sales
  const comps = input.comps ?? [];
  const excluded: { id: string; reason: string }[] = [];
  const eligible: UvComp[] = [];
  for (const c of comps) {
    const age = daysBetween(c.saleDate, input.asOf);
    if (c.armsLength === false) excluded.push({ id: c.id, reason: 'not arm\'s-length' });
    else if (age < 0) excluded.push({ id: c.id, reason: 'sale date after valuation date' });
    else if (age > o.maxCompAgeDays) excluded.push({ id: c.id, reason: `sold ${age} days ago (limit ${o.maxCompAgeDays})` });
    else if (c.distanceMiles > o.maxDistanceMiles) excluded.push({ id: c.id, reason: `${c.distanceMiles} mi away (limit ${o.maxDistanceMiles})` });
    else eligible.push(c);
  }
  let compValue: UndervaluationResult['compValue'] = null;
  let compsSupported = false, compsContradict = false;
  if (eligible.length >= o.minComps) {
    const arv = calculateArv({
      subjectSquareFeet: input.subjectSquareFeet,
      comps: eligible.map((c): ComparableSale => ({ id: c.id, salePrice: { value: c.salePrice, source: 'third_party_estimate' }, squareFeet: c.squareFeet, saleDate: c.saleDate, distanceMiles: c.distanceMiles, ...(c.address ? { address: c.address } : {}), ...(c.adjustments ? { adjustments: c.adjustments } : {}) })),
      asOfDate: input.asOf,
      maxCompAgeDays: o.maxCompAgeDays,
      maxDistanceMiles: o.maxDistanceMiles,
    }).value;
    compValue = { value: arv.arv, low: arv.low, high: arv.high, dispersion: arv.dispersion, compCount: arv.compCount, excluded };
    const d = pct(input.price, arv.arv);
    const tight = arv.dispersion <= 0.15;
    compsSupported = d >= o.minDiscount * 100 && tight && input.price < arv.low * (1 + 0.02);
    compsContradict = d < o.minDiscount * 100;
    signals.push({
      key: 'below_comps', label: 'Below comparable market value',
      status: compsSupported ? 'supported' : compsContradict ? 'not_supported' : 'insufficient_evidence',
      discountPct: d,
      summary: compsSupported
        ? `${input.priceBasis.replace('_', ' ')} is ${d}% below the adjusted value of ${arv.compCount} comps and below the low end of their range.`
        : compsContradict
          ? `${input.priceBasis.replace('_', ' ')} is within ${Math.round(o.minDiscount * 100)}% of the adjusted comp value (${d}%).`
          : `Discount of ${d}% is not conclusive: comps are dispersed (CV ${round(arv.dispersion * 100, 1)}%) or the price sits inside their range.`,
      evidence: { compValue: arv.arv, low: arv.low, high: arv.high, dispersion: arv.dispersion, comps: arv.comps, excluded, method: 'Adjusted price per sq ft × subject sq ft, weighted mean (underwriting engine calculateArv)' },
    });
  } else {
    signals.push({ key: 'below_comps', label: 'Below comparable market value', status: 'insufficient_evidence', discountPct: null, summary: `${eligible.length} eligible comp${eligible.length === 1 ? '' : 's'}; at least ${o.minComps} within ${o.maxDistanceMiles} mi and ${o.maxCompAgeDays} days are required.`, evidence: { eligible: eligible.map((c) => c.id), excluded } });
  }

  // 2. AVMs (each separately; indicative only)
  for (const a of input.avms ?? []) {
    if (!(a.value > 0)) throw new MarketInputError('avms.value', 'must be > 0');
    const d = pct(input.price, a.value);
    signals.push({ key: 'below_avm', label: `Below third-party estimate (${a.provider})`, status: 'indicative', discountPct: d, summary: `${d >= 0 ? `${d}% below` : `${-d}% above`} ${a.provider} AVM as of ${a.asOf}. An AVM alone never establishes undervaluation.`, evidence: { ...a } });
  }

  // 3. Neighborhood transactions
  if (input.neighborhood) {
    const n = input.neighborhood;
    const ppsf = input.price / input.subjectSquareFeet;
    const d = pct(ppsf, n.medianPricePerSqft);
    const enough = n.sampleSize >= o.minNeighborhoodSample;
    signals.push({ key: 'below_neighborhood', label: 'Below recent neighborhood transactions', status: !enough ? 'insufficient_evidence' : d >= o.minDiscount * 100 ? 'indicative' : 'not_supported', discountPct: d, summary: enough ? `$${round(ppsf, 0)}/sq ft vs ${n.areaName} median $${round(n.medianPricePerSqft, 0)}/sq ft (${n.sampleSize} sales, ${n.windowDays} days).` : `Only ${n.sampleSize} recent sales in ${n.areaName}; ${o.minNeighborhoodSample} required.`, evidence: { ...n, subjectPricePerSqft: round(ppsf, 2) } });
  }

  // 4. Distress events
  const active = (input.distressEvents ?? []).filter((e) => e.status === 'active' || e.status === 'postponed');
  signals.push({ key: 'distress', label: 'Distressed-sale indicators', status: active.length ? 'present' : 'absent', discountPct: null, summary: active.length ? `${active.length} active public-record event${active.length === 1 ? '' : 's'}: ${active.map((e) => e.type.replace(/_/g, ' ')).join(', ')}.` : 'No active distress events on record.', evidence: { active, ignored: (input.distressEvents ?? []).filter((e) => !active.includes(e)) } });

  // 5. Seller-requested price
  if (input.sellerAskingPrice) {
    const s = input.sellerAskingPrice;
    const d = compValue ? pct(s.value, compValue.value) : null;
    signals.push({ key: 'seller_requested', label: 'Seller-requested price', status: 'statement', discountPct: d, summary: `Seller stated $${s.value.toLocaleString('en-US')} on ${s.statedAt}${d !== null ? ` (${d}% vs comp value)` : ''}. Recorded as a seller statement, not a valuation.`, evidence: { ...s } });
  }

  const others = signals.some((s) => (s.key === 'below_avm' || s.key === 'below_neighborhood') && s.discountPct !== null && s.discountPct >= o.minDiscount * 100) || active.length > 0;
  const classification: UvClassification = compsSupported ? 'potentially_below_market' : compsContradict ? 'not_below_market' : others ? 'indicators_only' : 'insufficient_evidence';
  const confidence = compsSupported && compValue && compValue.compCount >= 5 && compValue.dispersion <= 0.08 ? 'high' : compsSupported ? 'moderate' : 'low';
  const headline = {
    potentially_below_market: 'Potentially below market: supported by adjusted comparable sales',
    not_below_market: 'Not below market on comparable-sales evidence',
    indicators_only: 'Indicators only: not enough comparable-sales evidence to call this below market',
    insufficient_evidence: 'Insufficient evidence',
  }[classification];

  return {
    classification,
    headline,
    signals,
    compValue,
    confidence,
    taxMeasures: input.assessedValue ? { assessedValue: input.assessedValue.value, year: input.assessedValue.year, jurisdiction: input.assessedValue.jurisdiction, note: 'Assessed value is a tax measure. It is not current market value and is not used in any valuation signal.' } : null,
  };
}
