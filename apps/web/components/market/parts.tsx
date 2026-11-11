import Link from 'next/link';
import type { ConfidenceLabel, FlagSeverity, MetricUnit, RiskFlag, Verification } from '@northstar/market';
import { Badge, cx } from '@/components/ui';
import { IconBell, IconBook, IconCompare, IconEye, IconGlobe, IconScale, IconSliders } from '@/components/icons';

export function scoreTone(s: number | null): 'positive' | 'signal' | 'caution' | 'critical' | 'neutral' {
  if (s === null) return 'neutral';
  return s >= 70 ? 'positive' : s >= 55 ? 'signal' : s >= 40 ? 'caution' : 'critical';
}

const textColor = { positive: 'text-positive', signal: 'text-signal', caution: 'text-caution', critical: 'text-critical', neutral: 'text-muted' } as const;

/** Score with a glowing bar. null renders as "Insufficient data", never as zero. */
export function ScoreBar({ score, provisional, size = 'md' }: { score: number | null; provisional?: number; size?: 'sm' | 'md' | 'lg' }) {
  const t = scoreTone(score);
  const w = score ?? provisional ?? 0;
  const color = `var(--color-${t === 'neutral' ? 'muted' : t})`;
  return (
    <div className={cx('flex items-center gap-2.5', size === 'lg' && 'flex-col items-start gap-2')}>
      <span className={cx('num tabular-nums font-medium', textColor[t], size === 'lg' ? 'text-[40px] leading-none tracking-[-0.04em]' : size === 'sm' ? 'w-7 text-[12px]' : 'w-8 text-[14px]')}>
        {score === null ? '—' : score.toFixed(size === 'lg' ? 1 : 0)}
      </span>
      <span className={cx('relative overflow-hidden rounded-full bg-graphite-3/80', size === 'lg' ? 'h-1.5 w-full' : size === 'sm' ? 'h-1 w-12' : 'h-[5px] w-24')} aria-hidden>
        <span
          className={cx('absolute inset-y-0 left-0 rounded-full', score === null && 'bg-muted/25')}
          style={{ width: `${Math.max(0, Math.min(100, w))}%`, ...(score === null ? {} : { background: `linear-gradient(90deg, color-mix(in oklab, ${color} 35%, transparent), ${color})`, boxShadow: `0 0 8px ${color}` }) }}
        />
      </span>
    </div>
  );
}

/** Category score as a heat-tinted cell. */
export function CategoryCell({ score }: { score: number | null }) {
  const t = scoreTone(score);
  if (score === null) return <span className="num inline-flex h-6 min-w-9 items-center justify-center rounded-[5px] border border-dashed border-line-strong px-1.5 text-[11px] text-faint" title="Insufficient data (coverage below 60%)">n/a</span>;
  const color = `var(--color-${t === 'neutral' ? 'muted' : t})`;
  const alpha = 6 + Math.round((Math.max(0, Math.min(100, score)) / 100) * 16);
  return (
    <span className={cx('num inline-flex h-6 min-w-9 items-center justify-center rounded-[5px] px-1.5 text-[12px] font-medium', textColor[t])} style={{ background: `color-mix(in oklab, ${color} ${alpha}%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} ${alpha + 8}%, transparent)` }}>
      {Math.round(score)}
    </span>
  );
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
    { k: 'explore', href: '/app/market', label: 'Explore', Icon: IconGlobe },
    { k: 'compare', href: '/app/market/compare', label: 'Compare', Icon: IconCompare },
    { k: 'regulatory', href: '/app/market/regulatory', label: 'Landlord Regulatory Index', Icon: IconScale },
    { k: 'property', href: '/app/market/property', label: 'Undervaluation evidence', Icon: IconEye },
    { k: 'watchlists', href: '/app/market/watchlists', label: 'Monitoring', Icon: IconBell },
    { k: 'profiles', href: '/app/market/profiles', label: 'Score profiles', Icon: IconSliders },
    { k: 'sources', href: '/app/market/sources', label: 'Sources & method', Icon: IconBook },
  ] as const;
  return (
    <nav className="-mt-2 mb-6 flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-xl border border-line/80 bg-void/50 p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.3)]" aria-label="Market Intelligence">
      {tabs.map((t) => {
        const on = active === t.k;
        return (
          <Link key={t.k} href={t.href} aria-current={on ? 'page' : undefined} className={cx('flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] transition-all', on ? 'bg-graphite-3 text-arctic shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_0_0_1px_rgb(86_137_255/0.25),0_4px_14px_-6px_rgb(86_137_255/0.6)]' : 'text-muted hover:bg-graphite-2/60 hover:text-titanium')}>
            <span className={on ? 'text-signal' : 'text-faint'}><t.Icon size={13} /></span>
            {t.label}
          </Link>
        );
      })}
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
