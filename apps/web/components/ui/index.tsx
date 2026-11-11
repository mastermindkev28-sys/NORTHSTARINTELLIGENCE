import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export type Tone = 'neutral' | 'signal' | 'positive' | 'caution' | 'critical';

export const toneText: Record<Tone, string> = { neutral: 'text-muted', signal: 'text-signal', positive: 'text-positive', caution: 'text-caution', critical: 'text-critical' };
export const toneBg: Record<Tone, string> = { neutral: 'bg-muted', signal: 'bg-signal', positive: 'bg-positive', caution: 'bg-caution', critical: 'bg-critical' };
export const toneVar: Record<Tone, string> = { neutral: 'var(--color-muted)', signal: 'var(--color-signal)', positive: 'var(--color-positive)', caution: 'var(--color-caution)', critical: 'var(--color-critical)' };

/* ───────────────────────── Buttons ───────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'text-white bg-[linear-gradient(180deg,#6893ff,#4a7af5)] shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_0_0_1px_rgb(86_137_255/0.6),0_6px_18px_-6px_rgb(86_137_255/0.7)] hover:brightness-110 disabled:opacity-40 disabled:shadow-none',
  secondary: 'bg-graphite-2/70 text-titanium border border-line-strong hover:border-muted/60 hover:bg-graphite-3/70 disabled:opacity-50',
  ghost: 'text-muted hover:text-titanium hover:bg-graphite-2/70',
  danger: 'bg-critical/10 text-critical border border-critical/30 hover:bg-critical/20',
};
const buttonBase = 'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-[13px] font-medium tracking-[-0.005em] transition-all duration-150 disabled:cursor-not-allowed active:translate-y-px';

export function Button({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button {...props} className={cx(buttonBase, buttonStyles[variant], className)} />;
}

export function ButtonLink({ href, variant = 'primary', className, children }: { href: string; variant?: ButtonVariant; className?: string; children: ReactNode }) {
  return <Link href={href} className={cx(buttonBase, buttonStyles[variant], className)}>{children}</Link>;
}

/* ───────────────────────── Form controls ───────────────────────── */

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string | undefined; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[11.5px] font-medium tracking-[0.01em] text-muted">
        {label}
      </label>
      {children}
      {error ? <p className="text-[11.5px] text-critical" role="alert">{error}</p> : hint ? <p className="text-[11px] leading-snug text-faint">{hint}</p> : null}
    </div>
  );
}

export const inputBase =
  'h-9 w-full rounded-md border border-line bg-void/60 px-3 text-[13px] text-titanium shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] placeholder:text-faint transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-signal/80 focus:outline-none focus:shadow-[0_0_0_3px_rgb(86_137_255/0.18)] aria-[invalid=true]:border-critical/70';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, props.type === 'number' && 'num text-right', className)} />;
}

const chevron = "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238392a8' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")] bg-[length:10px_6px] bg-[right_10px_center] bg-no-repeat";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(inputBase, chevron, 'appearance-none pr-8', className)}>
      {children}
    </select>
  );
}

/** Classes for a native <select> styled like Select, for server forms that render raw markup. */
export const selectClass = cx(inputBase, chevron, 'appearance-none pr-8');

/* ───────────────────────── Surfaces ───────────────────────── */

export function Panel({
  title, eyebrow, actions, children, className, flush, accent, code, bodyClassName,
}: {
  title?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
  /** Remove body padding so tables run edge to edge. */
  flush?: boolean;
  /** Signal Blue hairline across the top edge for the primary panel on a screen. */
  accent?: boolean;
  /** Short index code shown before the eyebrow, e.g. "02". */
  code?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx('panel fade-in', accent && 'panel-accent', className)}>
      {(title || actions || eyebrow) && (
        <header className="flex items-center justify-between gap-4 border-b border-line/80 px-5 py-3.5">
          <div className="min-w-0">
            {eyebrow && (
              <div className="eyebrow mb-1 flex items-center gap-2">
                {code && <span className="text-signal">{code}</span>}
                {code && <span className="h-px w-3 bg-line-strong" />}
                <span className="truncate">{eyebrow}</span>
              </div>
            )}
            {title && <h2 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-titanium">{title}</h2>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cx(flush ? 'py-3' : 'p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/* ───────────────────────── Status ───────────────────────── */

const badgeTones: Record<Tone, string> = {
  neutral: 'bg-graphite-2/80 text-muted border-line-strong/70',
  signal: 'bg-signal/10 text-signal-bright border-signal/30',
  positive: 'bg-positive/10 text-positive border-positive/25',
  caution: 'bg-caution/10 text-caution border-caution/25',
  critical: 'bg-critical/10 text-critical border-critical/30',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex h-[20px] items-center gap-1.5 whitespace-nowrap rounded-[5px] border px-1.5 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.08em]', badgeTones[tone], className)}>
      {dot && <span className={cx('size-1.5 rounded-full', toneBg[tone])} />}
      {children}
    </span>
  );
}

/** Live status indicator: a dot with a soft halo; `live` pulses. */
export function StatusDot({ tone = 'positive', live }: { tone?: Tone; live?: boolean }) {
  return (
    <span className={cx('relative inline-flex size-2 shrink-0', toneText[tone])}>
      {live && <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-40 [animation-duration:2.4s]" />}
      <span className="relative inline-flex size-2 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
    </span>
  );
}

export function Stat({ label, value, sub, tone, size = 'md' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; size?: 'md' | 'lg' | 'xl' }) {
  const color = tone ? (tone === 'neutral' ? 'text-titanium' : toneText[tone]) : 'text-titanium';
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="eyebrow truncate">{label}</div>
      <div className={cx('num font-medium leading-none tracking-[-0.03em]', color, size === 'xl' ? 'text-[40px]' : size === 'lg' ? 'text-[28px]' : 'text-[20px]')}>{value}</div>
      {sub && <div className="truncate text-[11.5px] text-muted">{sub}</div>}
    </div>
  );
}

/** Headline metric tile with optional trend sparkline and accent glow. */
export function KpiCard({ label, value, sub, tone, trend, icon, accent }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; trend?: number[]; icon?: ReactNode; accent?: boolean }) {
  const color = tone && tone !== 'neutral' ? toneText[tone] : 'text-arctic';
  return (
    <div className={cx('panel fade-in group overflow-hidden p-5', accent && 'panel-accent glow-signal')}>
      <div className="flex items-start justify-between gap-3">
        <div className="eyebrow">{label}</div>
        {icon && <div className="text-faint transition-colors group-hover:text-signal">{icon}</div>}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={cx('num text-[30px] font-medium leading-none tracking-[-0.04em]', color)}>{value}</div>
          {sub && <div className="mt-2 truncate text-[11.5px] text-muted">{sub}</div>}
        </div>
        {trend && trend.length > 1 && <TrendLine values={trend} tone={tone ?? 'signal'} />}
      </div>
    </div>
  );
}

/** Area sparkline for a short series. */
export function TrendLine({ values, tone = 'signal', width = 96, height = 32 }: { values: number[]; tone?: Tone; width?: number; height?: number }) {
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const id = `tl-${tone}-${values.join('-').slice(0, 24)}`;
  const last = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={toneVar[tone === 'neutral' ? 'signal' : tone]} stopOpacity="0.35" />
          <stop offset="1" stopColor={toneVar[tone === 'neutral' ? 'signal' : tone]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={toneVar[tone === 'neutral' ? 'signal' : tone]} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={toneVar[tone === 'neutral' ? 'signal' : tone]} />
    </svg>
  );
}

/** Radial gauge for a 0–100 score. null renders an empty dashed ring ("insufficient data"), never zero. */
export function ScoreRing({ score, size = 44, stroke = 4, tone, label, sublabel }: { score: number | null; size?: number; stroke?: number; tone?: Tone; label?: ReactNode; sublabel?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = score === null ? 0 : Math.max(0, Math.min(100, score));
  const t: Tone = tone ?? (score === null ? 'neutral' : score >= 70 ? 'positive' : score >= 55 ? 'signal' : score >= 40 ? 'caution' : 'critical');
  const big = size >= 96;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-graphite-3)" strokeWidth={stroke} strokeDasharray={score === null ? '2 4' : undefined} />
        {score !== null && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={toneVar[t]} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${(v / 100) * c} ${c}`}
            style={{ filter: `drop-shadow(0 0 ${big ? 6 : 3}px ${toneVar[t]})`, animation: 'sweep 900ms cubic-bezier(0.2,0.7,0.2,1) both', ['--sweep-from' as string]: `${(v / 100) * c}`, strokeDashoffset: 0 }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className={cx('num font-medium tracking-[-0.04em]', score === null ? 'text-faint' : toneText[t], big ? 'text-[34px]' : size >= 60 ? 'text-[18px]' : 'text-[13px]')}>
          {label ?? (score === null ? '—' : Math.round(score))}
        </span>
        {sublabel && <span className="eyebrow mt-1.5 text-[9px]">{sublabel}</span>}
      </div>
    </div>
  );
}

/** Horizontal meter with tick marks. */
export function Meter({ value, max = 100, tone = 'signal', className, ticks = true }: { value: number; max?: number; tone?: Tone; className?: string; ticks?: boolean }) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cx('relative h-1.5 overflow-hidden rounded-full bg-graphite-3/80', className)} aria-hidden>
      <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500" style={{ width: `${w}%`, background: `linear-gradient(90deg, color-mix(in oklab, ${toneVar[tone]} 45%, transparent), ${toneVar[tone]})`, boxShadow: `0 0 10px ${toneVar[tone]}` }} />
      {ticks && <div className="scanline absolute inset-0 opacity-60" />}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="mb-1 flex size-11 items-center justify-center rounded-xl border border-line-strong bg-graphite-2/60 text-signal shadow-[0_0_24px_-6px_rgb(86_137_255/0.5)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>
      </div>
      <div className="text-[14px] font-semibold">{title}</div>
      <p className="max-w-md text-[13px] text-muted">{body}</p>
      {action}
    </div>
  );
}

export function DemoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-caution/20 bg-[linear-gradient(90deg,rgb(233_180_76/0.09),rgb(233_180_76/0.02))] px-3.5 py-2.5 text-[12px] leading-relaxed text-caution/90">
      <Badge tone="caution" dot className="mt-px shrink-0">Demo data</Badge>
      <span>{children}</span>
    </div>
  );
}

/** Segmented tabs used inside panel headers and toolbars. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex rounded-lg border border-line bg-void/60 p-0.5 text-[12px]" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className={cx('rounded-md px-2.5 py-1 transition-colors', value === o.value ? 'bg-graphite-3 text-titanium shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]' : 'text-muted hover:text-titanium')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
