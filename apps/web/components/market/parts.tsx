import Link from 'next/link';
import type { ConfidenceLabel, FlagSeverity, MetricUnit, RiskFlag, Verification } from '@northstar/market';
import { Badge, cx } from '@/components/ui';

export function scoreTone(s: number | null): 'positive' | 'signal' | 'caution' | 'critical' | 'neutral' {
  if (s === null) return 'neutral';
  return s >= 70 ? 'positive' : s >= 55 ? 'signal' : s >= 40 ? 'caution' : 'critical';
}

const barColor = { positive: 'bg-positive', signal: 'bg-signal', caution: 'bg-caution', critical: 'bg-critical', neutral: 'bg-muted/40' } as const;
const textColor = { positive: 'text-positive', signal: 'text-signal', caution: 'text-caution', critical: 'text-critical', neutral: 'text-muted' } as const;

/** Score with a thin bar. null renders as "Insufficient data", never as zero. */
export function ScoreBar({ score, provisional, size = 'md' }: { score: number | null; provisional?: number; size?: 'sm' | 'md' | 'lg' }) {
  const t = scoreTone(score);
  const w = score ?? provisional ?? 0;
  return (
    <div className={cx('flex items-center gap-2', size === 'lg' && 'flex-col items-start gap-2')}>
      <span className={cx('num tabular-nums', textColor[t], size === 'lg' ? 'text-[40px] font-medium leading-none' : size === 'sm' ? 'w-8 text-[12px]' : 'w-10 text-[13px]')}>
        {score === null ? '—' : score.toFixed(size === 'lg' ? 1 : 0)}
      </span>
      <span className={cx('relative overflow-hidden rounded-full bg-graphite-2', size === 'lg' ? 'h-1.5 w-full' : size === 'sm' ? 'h-1 w-12' : 'h-1 w-20')} aria-hidden>
        <span className={cx('absolute inset-y-0 left-0 rounded-full', score === null ? 'bg-muted/25' : barColor[t])} style={{ width: `${Math.max(0, Math.min(100, w))}%` }} />
      </span>
    </div>
  );
}

export function CategoryCell({ score }: { score: number | null }) {
  const t = scoreTone(score);
  return <span className={cx('num text-[12px]', score === null ? 'text-muted/60' : textColor[t])} title={score === null ? 'Insufficient data (coverage below 60%)' : undefined}>{score === null ? 'n/a' : Math.round(score)}</span>;
}

const CONF: Record<ConfidenceLabel, { label: string; tone: 'positive' | 'signal' | 'caution' | 'critical' }> = {
  high: { label: 'High', tone: 'positive' },
  moderate: { label: 'Moderate', tone: 'signal' },
  low: { label: 'Low', tone: 'caution' },
  very_low: { label: 'Very low', tone: 'critical' },
};

export function ConfidenceBadge({ label, value }: { label: ConfidenceLabel; value?: number }) {
  return <Badge tone={CONF[label].tone}>{CONF[label].label}{value !== undefined && <span className="opacity-70"> {Math.round(value * 100)}%</span>}</Badge>;
}

const SEV_TONE: Record<FlagSeverity, 'critical' | 'caution' | 'neutral'> = { critical: 'critical', caution: 'caution', info: 'neutral' };

export function FlagCounts({ flags }: { flags: RiskFlag[] }) {
  const crit = flags.filter((f) => f.severity === 'critical').length;
  const caution = flags.filter((f) => f.severity === 'caution').length;
  if (!crit && !caution) return <span className="text-[12px] text-muted/60">None</span>;
  return (
    <span className="flex gap-1">
      {crit > 0 && <Badge tone="critical">{crit} critical</Badge>}
      {caution > 0 && <Badge tone="caution">{caution}</Badge>}
    </span>
  );
}

export function FlagList({ flags, empty = 'No material risk flags.' }: { flags: RiskFlag[]; empty?: string }) {
  if (!flags.length) return <p className="text-[13px] text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {flags.map((f) => (
        <li key={f.code} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
          <Badge tone={SEV_TONE[f.severity]} className="mt-0.5 shrink-0">{f.severity}</Badge>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-titanium">{f.title}</div>
            <div className="text-[12.5px] text-muted">{f.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function VerificationBadge({ v }: { v: Verification }) {
  const tone = v === 'official' ? 'positive' : v === 'secondary' ? 'caution' : v === 'demo' ? 'caution' : 'neutral';
  return <Badge tone={tone}>{v}</Badge>;
}

export function formatMetric(v: number | null, unit: MetricUnit): string {
  if (v === null || !Number.isFinite(v)) return '—';
  switch (unit) {
    case 'pct': return `${v.toFixed(1)}%`;
    case 'ratio': return v.toFixed(2);
    case 'usd': return `$${Math.round(v).toLocaleString('en-US')}`;
    case 'usd_per_sqft': return `$${Math.round(v)}/sf`;
    case 'days': return `${Math.round(v)} d`;
    case 'per_1k': return `${v.toFixed(1)} /1k`;
    case 'per_100k': return `${Math.round(v).toLocaleString('en-US')} /100k`;
    case 'index': return v <= 1 ? v.toFixed(2) : v.toFixed(0);
    case 'count': return Math.round(v).toLocaleString('en-US');
  }
}

export function MarketTabs({ active }: { active: 'explore' | 'compare' | 'regulatory' | 'property' | 'watchlists' | 'profiles' | 'sources' }) {
  const tabs = [
    { k: 'explore', href: '/app/market', label: 'Explore' },
    { k: 'compare', href: '/app/market/compare', label: 'Compare' },
    { k: 'regulatory', href: '/app/market/regulatory', label: 'Landlord Regulatory Index' },
    { k: 'property', href: '/app/market/property', label: 'Undervaluation evidence' },
    { k: 'watchlists', href: '/app/market/watchlists', label: 'Monitoring' },
    { k: 'profiles', href: '/app/market/profiles', label: 'Score profiles' },
    { k: 'sources', href: '/app/market/sources', label: 'Sources & method' },
  ] as const;
  return (
    <nav className="-mt-3 mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Market Intelligence">
      {tabs.map((t) => (
        <Link key={t.k} href={t.href} aria-current={active === t.k ? 'page' : undefined} className={cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] transition-colors', active === t.k ? 'border-signal text-titanium' : 'border-transparent text-muted hover:text-titanium')}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function ProfileOptions({ custom }: { custom: { id: string; name: string }[] }) {
  return (
    <>
      <optgroup label="Strategy profiles">
        <option value="balanced">Balanced (baseline)</option>
        <option value="wholesale">Wholesale</option>
        <option value="fix_and_flip">Fix and flip</option>
        <option value="buy_and_hold">Buy and hold</option>
        <option value="brrrr">BRRRR</option>
        <option value="creative_finance">Creative finance</option>
        <option value="section_8">Section 8</option>
        <option value="small_multifamily">Small multifamily</option>
        <option value="land">Land</option>
        <option value="commercial">Commercial</option>
      </optgroup>
      {custom.length > 0 && (
        <optgroup label="Your profiles">
          {custom.map((p) => <option key={p.id} value={`custom:${p.id}`}>{p.name}</option>)}
        </optgroup>
      )}
    </>
  );
}

/** Tiny inline sparkline for a handful of points. Projections draw dashed. */
export function Sparkline({ points, width = 96, height = 24 }: { points: { value: number; isProjection: boolean }[]; width?: number; height?: number }) {
  if (points.length < 2) return <span className="text-[11px] text-muted/60">—</span>;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * (width - 4) + 2, height - 2 - ((p.value - min) / span) * (height - 4)] as const);
  const hist = xy.filter((_, i) => !points[i]!.isProjection);
  const lastHist = hist[hist.length - 1];
  const proj = lastHist ? [lastHist, ...xy.filter((_, i) => points[i]!.isProjection)] : [];
  const path = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={path(hist)} fill="none" stroke="var(--color-signal)" strokeWidth="1.5" />
      {proj.length > 1 && <path d={path(proj)} fill="none" stroke="var(--color-muted)" strokeWidth="1.25" strokeDasharray="3 2" />}
      {lastHist && <circle cx={lastHist[0]} cy={lastHist[1]} r="2" fill="var(--color-signal)" />}
    </svg>
  );
}
