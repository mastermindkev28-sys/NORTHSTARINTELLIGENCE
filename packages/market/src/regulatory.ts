/**
 * Landlord Regulatory Index (LRI).
 *
 * The index is a set of individual, cited factors, each mapped to a 0–100 "operating flexibility" score with a
 * published rule, then combined with user-adjustable weights. It is deliberately not an opaque ranking: every factor,
 * its citation, effective date and verification status travel with the result.
 *
 * Factor rows are append-only (docs/LANDLORD_REGULATORY_INDEX.md §1): a change is a new row with a new effective
 * date. The row in force on `asOf` is current; rows effective after `asOf` are reported as pending changes.
 *
 * Not legal advice. Counsel must review factor rows before customer-facing use.
 */
import { MarketInputError, clamp, daysBetween, round, type Citation, type RiskFlag } from './types';

export type FactorValue = number | boolean | string | null;
export type Verification = 'official' | 'secondary' | 'unverified' | 'demo';

export interface RegulatoryFactorRow {
  /** Jurisdiction key, matching a GeoArea key (e.g. "state:42", "city:4260000"). */
  jurisdictionKey: string;
  jurisdictionName: string;
  jurisdictionLevel: 'state' | 'city';
  factor: string;
  value: FactorValue;
  citation: Citation;
  effectiveDate: string | null;
  retrievedAt: string;
  verification: Verification;
  notes?: string;
}

type FactorKind = 'days' | 'months' | 'hours' | 'boolean' | 'enum';

export interface RegulatoryFactorDefinition {
  key: string;
  label: string;
  group: 'eviction' | 'rent' | 'deposit' | 'notice' | 'compliance';
  kind: FactorKind;
  defaultWeight: number;
  /** Explains how the value maps to a score, shown in the UI next to the score. */
  rule: string;
  score: (v: FactorValue) => number;
  display: (v: FactorValue) => string;
}

const linear = (v: number, worst: number, best: number) => clamp(((v - worst) / (best - worst)) * 100, 0, 100);
const num = (key: string, v: FactorValue): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new MarketInputError(key, `expected a number, received ${String(v)}`);
  return v;
};
const bool = (key: string, v: FactorValue): boolean => {
  if (typeof v !== 'boolean') throw new MarketInputError(key, `expected true/false, received ${String(v)}`);
  return v;
};
const yesNo = (v: FactorValue) => (v === true ? 'Required' : v === false ? 'Not required' : '—');

export const RENT_REGULATION_VALUES = ['preempted', 'none', 'statewide_cap', 'local_control'] as const;
const RENT_REGULATION_LABELS: Record<(typeof RENT_REGULATION_VALUES)[number], string> = {
  preempted: 'Local rent control preempted by state',
  none: 'No rent regulation',
  statewide_cap: 'Statewide rent increase cap',
  local_control: 'Local rent control or stabilization',
};

export const REGULATORY_FACTORS: readonly RegulatoryFactorDefinition[] = [
  { key: 'nonpayment_notice_days', label: 'Notice before filing for nonpayment', group: 'eviction', kind: 'days', defaultWeight: 3, rule: '3 days → 100, 30 days → 0, linear', score: (v) => linear(num('nonpayment_notice_days', v), 30, 3), display: (v) => `${v} days` },
  { key: 'eviction_timeline_days', label: 'Typical filing-to-possession timeline', group: 'eviction', kind: 'days', defaultWeight: 3, rule: '21 days → 100, 120 days → 0, linear', score: (v) => linear(num('eviction_timeline_days', v), 120, 21), display: (v) => `${v} days` },
  { key: 'pre_filing_diversion_required', label: 'Mandatory pre-filing diversion', group: 'eviction', kind: 'boolean', defaultWeight: 1.5, rule: 'Not required → 100, required → 40', score: (v) => (bool('pre_filing_diversion_required', v) ? 40 : 100), display: yesNo },
  { key: 'just_cause_required', label: 'Just-cause / good-cause termination', group: 'eviction', kind: 'boolean', defaultWeight: 2.5, rule: 'Not required → 100, required → 25', score: (v) => (bool('just_cause_required', v) ? 25 : 100), display: yesNo },
  {
    key: 'rent_regulation', label: 'Rent control / stabilization', group: 'rent', kind: 'enum', defaultWeight: 3,
    rule: 'Preempted → 100, none → 85, statewide cap → 40, local control → 0',
    score: (v) => {
      const s = { preempted: 100, none: 85, statewide_cap: 40, local_control: 0 }[String(v) as (typeof RENT_REGULATION_VALUES)[number]];
      if (s === undefined) throw new MarketInputError('rent_regulation', `unknown value ${String(v)}`);
      return s;
    },
    display: (v) => RENT_REGULATION_LABELS[v as (typeof RENT_REGULATION_VALUES)[number]] ?? String(v),
  },
  { key: 'rent_increase_notice_days', label: 'Rent increase notice', group: 'rent', kind: 'days', defaultWeight: 1, rule: '30 days → 100, 120 days → 0, linear', score: (v) => linear(num('rent_increase_notice_days', v), 120, 30), display: (v) => `${v} days` },
  { key: 'security_deposit_cap_months', label: 'Security deposit cap', group: 'deposit', kind: 'months', defaultWeight: 1, rule: 'No cap → 100; otherwise 0.5 mo → 0, 3 mo → 100, linear', score: (v) => (v === null ? 100 : linear(num('security_deposit_cap_months', v), 0.5, 3)), display: (v) => (v === null ? 'No statutory cap' : `${v} month${v === 1 ? '' : 's'} of rent`) },
  { key: 'deposit_return_days', label: 'Deposit return deadline', group: 'deposit', kind: 'days', defaultWeight: 0.5, rule: '14 days → 0, 45 days → 100, linear', score: (v) => linear(num('deposit_return_days', v), 14, 45), display: (v) => `${v} days` },
  { key: 'termination_notice_days', label: 'Termination / nonrenewal notice (shortest tier)', group: 'notice', kind: 'days', defaultWeight: 1, rule: '15 days → 100, 120 days → 0, linear', score: (v) => linear(num('termination_notice_days', v), 120, 15), display: (v) => `${v} days` },
  { key: 'entry_notice_hours', label: 'Landlord entry notice', group: 'notice', kind: 'hours', defaultWeight: 0.5, rule: 'No statutory notice (0 h) → 100, 48 h → 30, linear', score: (v) => linear(num('entry_notice_hours', v), 48 / 0.7, 0), display: (v) => (v === 0 ? 'No statutory requirement' : `${v} hours`) },
  { key: 'rental_registration_required', label: 'Rental registration', group: 'compliance', kind: 'boolean', defaultWeight: 0.5, rule: 'Not required → 100, required → 70', score: (v) => (bool('rental_registration_required', v) ? 70 : 100), display: yesNo },
  { key: 'rental_license_required', label: 'Rental license (rent collection or eviction conditioned on it)', group: 'compliance', kind: 'boolean', defaultWeight: 1, rule: 'Not required → 100, required → 50', score: (v) => (bool('rental_license_required', v) ? 50 : 100), display: yesNo },
  { key: 'periodic_inspection_required', label: 'Periodic rental inspection', group: 'compliance', kind: 'boolean', defaultWeight: 0.5, rule: 'Not required → 100, required → 55', score: (v) => (bool('periodic_inspection_required', v) ? 55 : 100), display: yesNo },
  { key: 'lead_certification_required', label: 'Lead-safe certification (pre-1978)', group: 'compliance', kind: 'boolean', defaultWeight: 0.5, rule: 'Not required → 100, required → 70', score: (v) => (bool('lead_certification_required', v) ? 70 : 100), display: yesNo },
];

const FACTOR_BY_KEY = new Map(REGULATORY_FACTORS.map((f) => [f.key, f]));

export function getFactor(key: string): RegulatoryFactorDefinition {
  const f = FACTOR_BY_KEY.get(key);
  if (!f) throw new MarketInputError('factor', `"${key}" is not a known regulatory factor`);
  return f;
}

export interface ResolvedFactor {
  key: string;
  label: string;
  group: RegulatoryFactorDefinition['group'];
  rule: string;
  weight: number;
  status: 'current' | 'missing';
  value: FactorValue;
  display: string;
  /** 0–100; for missing factors this is the conservative imputed value used in the index. */
  score: number;
  row: RegulatoryFactorRow | null;
  /** True when a state rule overrides a local row (e.g. rent control preemption). */
  preemptedByState?: boolean;
}

export interface PendingChange {
  factor: string;
  label: string;
  jurisdictionName: string;
  value: string;
  effectiveDate: string;
  citation: Citation;
  verification: Verification;
}

export interface RegulatoryIndexResult {
  /** 0–100, or null when coverage is below the sufficiency threshold. */
  index: number | null;
  /** Index including conservative imputation, always computed (for transparency). */
  indexProvisional: number;
  /** Share of total factor weight backed by a current row (0..1). */
  coverage: number;
  sufficient: boolean;
  factors: ResolvedFactor[];
  pending: PendingChange[];
  flags: RiskFlag[];
  jurisdictions: string[];
}

export const SUFFICIENCY_THRESHOLD = 0.6;

/** The row in force on asOf for one jurisdiction and factor: latest effective date ≤ asOf (null date = in force). */
function currentRow(rows: RegulatoryFactorRow[], asOf: string): RegulatoryFactorRow | null {
  let best: RegulatoryFactorRow | null = null;
  for (const r of rows) {
    if (r.effectiveDate && daysBetween(r.effectiveDate, asOf) < 0) continue;
    if (!best || (r.effectiveDate ?? '') > (best.effectiveDate ?? '')) best = r;
  }
  return best;
}

/**
 * Compute the LRI for a jurisdiction stack (state first, then city). Local rows override state rows for the same
 * factor, except that a state preemption of rent regulation always wins.
 */
export function computeRegulatoryIndex(
  rows: RegulatoryFactorRow[],
  opts: { asOf: string; jurisdictionKeys: string[]; weights?: Partial<Record<string, number>>; pendingWindowDays?: number },
): RegulatoryIndexResult {
  const { asOf, jurisdictionKeys } = opts;
  const window = opts.pendingWindowDays ?? 365;
  const relevant = rows.filter((r) => jurisdictionKeys.includes(r.jurisdictionKey));
  for (const r of relevant) getFactor(r.factor);

  const resolved: ResolvedFactor[] = [];
  for (const def of REGULATORY_FACTORS) {
    const w = opts.weights?.[def.key] ?? def.defaultWeight;
    if (!(w >= 0) || !Number.isFinite(w)) throw new MarketInputError(`weights.${def.key}`, 'must be a finite number ≥ 0');
    let chosen: RegulatoryFactorRow | null = null;
    let preempted = false;
    for (const jk of jurisdictionKeys) {
      const cur = currentRow(relevant.filter((r) => r.jurisdictionKey === jk && r.factor === def.key), asOf);
      if (!cur) continue;
      if (chosen && def.key === 'rent_regulation' && chosen.jurisdictionLevel === 'state' && chosen.value === 'preempted') {
        preempted = true;
        continue;
      }
      chosen = cur;
    }
    resolved.push({
      key: def.key,
      label: def.label,
      group: def.group,
      rule: def.rule,
      weight: w,
      status: chosen ? 'current' : 'missing',
      value: chosen ? chosen.value : null,
      display: chosen ? def.display(chosen.value) : 'No cited source yet',
      score: chosen ? round(def.score(chosen.value), 1) : NaN,
      row: chosen,
      ...(preempted ? { preemptedByState: true } : {}),
    });
  }

  const totalW = resolved.reduce((s, f) => s + f.weight, 0);
  const present = resolved.filter((f) => f.status === 'current' && f.weight > 0);
  const presentW = present.reduce((s, f) => s + f.weight, 0);
  const observedMean = presentW > 0 ? present.reduce((s, f) => s + f.score * f.weight, 0) / presentW : 50;
  const imputed = Math.min(50, observedMean);
  for (const f of resolved) if (f.status === 'missing') f.score = round(imputed, 1);
  const indexProvisional = totalW > 0 ? round(resolved.reduce((s, f) => s + f.score * f.weight, 0) / totalW, 1) : 0;
  const coverage = totalW > 0 ? presentW / totalW : 0;
  const sufficient = coverage >= SUFFICIENCY_THRESHOLD;

  const pending: PendingChange[] = [];
  for (const r of relevant) {
    if (!r.effectiveDate) continue;
    const d = daysBetween(asOf, r.effectiveDate);
    if (d > 0 && d <= window) {
      const def = getFactor(r.factor);
      pending.push({ factor: r.factor, label: def.label, jurisdictionName: r.jurisdictionName, value: def.display(r.value), effectiveDate: r.effectiveDate, citation: r.citation, verification: r.verification });
    }
  }
  pending.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  const flags: RiskFlag[] = [];
  const get = (k: string) => resolved.find((f) => f.key === k)!;
  if (get('rent_regulation').value === 'local_control') flags.push({ code: 'reg.rent_control', severity: 'critical', category: 'regulatory', title: 'Local rent control or stabilization', detail: 'Rent increases are limited by local ordinance. Model rent growth under the cap.', evidence: { value: 'local_control' } });
  if (get('rent_regulation').value === 'statewide_cap') flags.push({ code: 'reg.rent_cap', severity: 'caution', category: 'regulatory', title: 'Statewide rent increase cap', detail: 'Annual rent increases are capped by state law.', evidence: { value: 'statewide_cap' } });
  if (get('just_cause_required').value === true) flags.push({ code: 'reg.just_cause', severity: 'caution', category: 'regulatory', title: 'Just-cause termination required', detail: 'Non-renewal or termination needs a listed cause. Factor this into turnover and repositioning plans.', evidence: { value: 'required' } });
  const tl = get('eviction_timeline_days').value;
  if (typeof tl === 'number' && tl > 90) flags.push({ code: 'reg.long_eviction', severity: 'caution', category: 'regulatory', title: 'Long eviction timeline', detail: `Typical filing-to-possession is about ${tl} days.`, evidence: { metric: 'eviction_timeline_days', value: tl, threshold: 90 } });
  for (const p of pending) flags.push({ code: `reg.pending.${p.factor}`, severity: 'caution', category: 'regulatory', title: `Pending change: ${p.label}`, detail: `${p.jurisdictionName}: ${p.value}, effective ${p.effectiveDate}.`, evidence: { value: p.value, threshold: p.effectiveDate } });
  const weak = present.filter((f) => f.row && (f.row.verification === 'secondary' || f.row.verification === 'unverified'));
  if (weak.length) flags.push({ code: 'reg.unverified_factors', severity: 'info', category: 'data_quality', title: 'Some factors not verified against official text', detail: weak.map((f) => f.label).join('; ') });
  if (!sufficient) flags.push({ code: 'reg.insufficient', severity: 'caution', category: 'data_quality', title: 'Regulatory coverage below threshold', detail: `Only ${Math.round(coverage * 100)}% of factor weight has a cited source. The index is withheld.` });

  return { index: sufficient ? indexProvisional : null, indexProvisional, coverage: round(coverage, 3), sufficient, factors: resolved, pending, flags, jurisdictions: jurisdictionKeys };
}
