/**
 * Market monitoring: snapshot a scored area, compare against the previous snapshot, and emit alerts with evidence
 * (variable, old value, new value, source, date). Pure functions; persistence and scheduling live in the app layer.
 */
import type { MarketScoreResult } from './score';
import type { RegulatoryIndexResult } from './regulatory';
import { hasMetric } from './metrics';
import { CATEGORY_KEYS, MarketInputError, round, type CategoryKey, type FlagSeverity } from './types';

export interface MarketSnapshot {
  areaKey: string;
  areaName: string;
  profileId: string;
  asOf: string;
  methodologyVersion: string;
  overall: number | null;
  confidence: number;
  categories: Partial<Record<CategoryKey, number | null>>;
  flags: { code: string; severity: FlagSeverity; title: string }[];
  metrics: Record<string, { value: number; period: string; source: string }>;
  regulatory: Record<string, { display: string; effectiveDate: string | null }>;
  pending: { factor: string; label: string; effectiveDate: string; value: string }[];
}

export function snapshotOf(score: MarketScoreResult, reg?: RegulatoryIndexResult | null): MarketSnapshot {
  const metrics: MarketSnapshot['metrics'] = {};
  for (const c of score.categories) for (const v of c.variables) if (v.value !== null && v.source) metrics[v.metric] = { value: v.value, period: v.period ?? '', source: v.source.name };
  const regulatory: MarketSnapshot['regulatory'] = {};
  for (const f of reg?.factors ?? []) if (f.status === 'current') regulatory[f.key] = { display: f.display, effectiveDate: f.row?.effectiveDate ?? null };
  return {
    areaKey: score.area.key,
    areaName: score.area.name,
    profileId: score.profile.id,
    asOf: score.asOf,
    methodologyVersion: score.methodologyVersion,
    overall: score.overall,
    confidence: score.confidence,
    categories: Object.fromEntries(score.categories.map((c) => [c.key, c.score])),
    flags: score.flags.filter((f) => f.category !== 'data_quality' || f.severity !== 'info').map((f) => ({ code: f.code, severity: f.severity, title: f.title })),
    metrics,
    regulatory,
    pending: (reg?.pending ?? []).map((p) => ({ factor: p.factor, label: p.label, effectiveDate: p.effectiveDate, value: p.value })),
  };
}

export type AlertRule =
  | { kind: 'score_change'; minPoints: number }
  | { kind: 'category_change'; category: CategoryKey; minPoints: number }
  | { kind: 'new_risk_flag'; minSeverity: FlagSeverity }
  | { kind: 'metric_threshold'; metric: string; op: 'above' | 'below'; value: number }
  | { kind: 'regulatory_change' }
  | { kind: 'confidence_drop'; minDrop: number };

export const ALERT_RULE_KINDS = ['score_change', 'category_change', 'new_risk_flag', 'metric_threshold', 'regulatory_change', 'confidence_drop'] as const;

export interface MarketAlert {
  /** Stable per (area, rule, change) so re-running monitoring never duplicates an alert. */
  dedupeKey: string;
  areaKey: string;
  areaName: string;
  kind: AlertRule['kind'];
  severity: FlagSeverity;
  title: string;
  detail: string;
  evidence: { variable?: string; oldValue?: number | string | null; newValue?: number | string | null; source?: string; asOf: string; previousAsOf?: string };
}

const SEV: Record<FlagSeverity, number> = { info: 0, caution: 1, critical: 2 };

export function validateAlertRule(r: AlertRule): AlertRule {
  switch (r.kind) {
    case 'score_change':
      if (!(r.minPoints > 0 && r.minPoints <= 100)) throw new MarketInputError('minPoints', 'must be between 0 and 100');
      return r;
    case 'category_change':
      if (!CATEGORY_KEYS.includes(r.category)) throw new MarketInputError('category', `unknown category "${String(r.category)}"`);
      if (!(r.minPoints > 0 && r.minPoints <= 100)) throw new MarketInputError('minPoints', 'must be between 0 and 100');
      return r;
    case 'new_risk_flag':
      if (!(r.minSeverity in SEV)) throw new MarketInputError('minSeverity', 'must be info, caution or critical');
      return r;
    case 'metric_threshold':
      if (!hasMetric(r.metric)) throw new MarketInputError('metric', `"${r.metric}" is not in the metric catalog`);
      if (!Number.isFinite(r.value)) throw new MarketInputError('value', 'must be a finite number');
      if (r.op !== 'above' && r.op !== 'below') throw new MarketInputError('op', 'must be above or below');
      return r;
    case 'regulatory_change':
      return r;
    case 'confidence_drop':
      if (!(r.minDrop > 0 && r.minDrop <= 1)) throw new MarketInputError('minDrop', 'must be between 0 and 1');
      return r;
    default:
      throw new MarketInputError('kind', 'unknown alert rule kind');
  }
}

export function ruleLabel(r: AlertRule): string {
  switch (r.kind) {
    case 'score_change': return `Overall score moves ≥ ${r.minPoints} pts`;
    case 'category_change': return `${r.category.replace(/_/g, ' ')} moves ≥ ${r.minPoints} pts`;
    case 'new_risk_flag': return `New ${r.minSeverity}+ risk flag`;
    case 'metric_threshold': return `${r.metric.replace(/_/g, ' ')} ${r.op} ${r.value}`;
    case 'regulatory_change': return 'Regulatory factor changes or is scheduled to change';
    case 'confidence_drop': return `Confidence drops ≥ ${Math.round(r.minDrop * 100)} pts`;
  }
}

/** Evaluate one rule. With no previous snapshot, only level-based rules (threshold, flags, pending law) can fire. */
export function evaluateRule(rule: AlertRule, prev: MarketSnapshot | null, curr: MarketSnapshot): MarketAlert[] {
  const base = { areaKey: curr.areaKey, areaName: curr.areaName, kind: rule.kind };
  const ev = (e: Omit<MarketAlert['evidence'], 'asOf' | 'previousAsOf'>) => ({ ...e, asOf: curr.asOf, ...(prev ? { previousAsOf: prev.asOf } : {}) });
  const out: MarketAlert[] = [];
  switch (rule.kind) {
    case 'score_change': {
      if (!prev || prev.overall === null || curr.overall === null) break;
      const d = round(curr.overall - prev.overall, 1);
      if (Math.abs(d) >= rule.minPoints) out.push({ ...base, dedupeKey: `${curr.areaKey}:score:${prev.asOf}:${curr.asOf}:${curr.profileId}`, severity: d < 0 ? 'caution' : 'info', title: `Market Score ${d > 0 ? 'up' : 'down'} ${Math.abs(d)} pts`, detail: `${curr.areaName}: ${prev.overall} → ${curr.overall} (${curr.profileId}).`, evidence: ev({ variable: 'overall', oldValue: prev.overall, newValue: curr.overall }) });
      break;
    }
    case 'category_change': {
      const a = prev?.categories[rule.category], b = curr.categories[rule.category];
      if (a === undefined || a === null || b === undefined || b === null) break;
      const d = round(b - a, 1);
      if (Math.abs(d) >= rule.minPoints) out.push({ ...base, dedupeKey: `${curr.areaKey}:cat:${rule.category}:${prev!.asOf}:${curr.asOf}`, severity: d < 0 ? 'caution' : 'info', title: `${rule.category.replace(/_/g, ' ')} ${d > 0 ? 'up' : 'down'} ${Math.abs(d)} pts`, detail: `${curr.areaName}: ${a} → ${b}.`, evidence: ev({ variable: rule.category, oldValue: a, newValue: b }) });
      break;
    }
    case 'new_risk_flag': {
      const had = new Set(prev?.flags.map((f) => f.code) ?? []);
      for (const f of curr.flags) {
        if (SEV[f.severity] < SEV[rule.minSeverity] || had.has(f.code)) continue;
        out.push({ ...base, dedupeKey: `${curr.areaKey}:flag:${f.code}:${curr.asOf}`, severity: f.severity, title: `New risk flag: ${f.title}`, detail: `${curr.areaName}`, evidence: ev({ variable: f.code, oldValue: null, newValue: f.severity }) });
      }
      break;
    }
    case 'metric_threshold': {
      const c = curr.metrics[rule.metric];
      if (!c) break;
      const hit = (v: number) => (rule.op === 'above' ? v > rule.value : v < rule.value);
      const p = prev?.metrics[rule.metric];
      if (hit(c.value) && !(p && hit(p.value))) out.push({ ...base, dedupeKey: `${curr.areaKey}:metric:${rule.metric}:${rule.op}:${rule.value}:${c.period}`, severity: 'caution', title: `${rule.metric.replace(/_/g, ' ')} crossed ${rule.op} ${rule.value}`, detail: `${curr.areaName}: ${p ? `${p.value} (${p.period}) → ` : ''}${c.value} (${c.period}).`, evidence: ev({ variable: rule.metric, oldValue: p?.value ?? null, newValue: c.value, source: c.source }) });
      break;
    }
    case 'regulatory_change': {
      if (prev) {
        for (const [k, v] of Object.entries(curr.regulatory)) {
          const o = prev.regulatory[k];
          if (o && o.display !== v.display) out.push({ ...base, dedupeKey: `${curr.areaKey}:reg:${k}:${v.effectiveDate ?? ''}:${v.display}`, severity: 'caution', title: `Regulatory change: ${k.replace(/_/g, ' ')}`, detail: `${curr.areaName}: ${o.display} → ${v.display}${v.effectiveDate ? ` (effective ${v.effectiveDate})` : ''}.`, evidence: ev({ variable: k, oldValue: o.display, newValue: v.display }) });
        }
      }
      const known = new Set(prev?.pending.map((p) => `${p.factor}:${p.effectiveDate}`) ?? []);
      for (const p of curr.pending) {
        if (known.has(`${p.factor}:${p.effectiveDate}`)) continue;
        out.push({ ...base, dedupeKey: `${curr.areaKey}:pending:${p.factor}:${p.effectiveDate}`, severity: 'caution', title: `Scheduled change: ${p.label}`, detail: `${curr.areaName}: ${p.value}, effective ${p.effectiveDate}.`, evidence: ev({ variable: p.factor, oldValue: null, newValue: p.value }) });
      }
      break;
    }
    case 'confidence_drop': {
      if (!prev) break;
      const d = prev.confidence - curr.confidence;
      if (d >= rule.minDrop) out.push({ ...base, dedupeKey: `${curr.areaKey}:conf:${prev.asOf}:${curr.asOf}`, severity: 'info', title: `Data confidence down ${Math.round(d * 100)} pts`, detail: `${curr.areaName}: ${Math.round(prev.confidence * 100)}% → ${Math.round(curr.confidence * 100)}%. Check for stale or missing sources.`, evidence: ev({ variable: 'confidence', oldValue: prev.confidence, newValue: curr.confidence }) });
      break;
    }
  }
  return out;
}

export function evaluateRules(rules: AlertRule[], prev: MarketSnapshot | null, curr: MarketSnapshot): MarketAlert[] {
  const seen = new Set<string>();
  return rules.flatMap((r) => evaluateRule(validateAlertRule(r), prev, curr)).filter((a) => (seen.has(a.dedupeKey) ? false : (seen.add(a.dedupeKey), true)));
}

/** Default rules applied to a new watchlist entry. */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { kind: 'score_change', minPoints: 5 },
  { kind: 'new_risk_flag', minSeverity: 'caution' },
  { kind: 'regulatory_change' },
  { kind: 'confidence_drop', minDrop: 0.1 },
];
