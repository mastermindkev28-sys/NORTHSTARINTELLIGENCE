import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-signal text-white hover:bg-signal-deep disabled:bg-signal/40',
  secondary: 'bg-graphite-2 text-titanium border border-line hover:border-muted disabled:opacity-50',
  ghost: 'text-muted hover:text-titanium hover:bg-graphite-2',
  danger: 'bg-critical/10 text-critical border border-critical/30 hover:bg-critical/20',
};

export function Button({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cx('inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed', buttonStyles[variant], className)}
    />
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string | undefined; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? <p className="text-[12px] text-critical" role="alert">{error}</p> : hint ? <p className="text-[11.5px] text-muted/80">{hint}</p> : null}
    </div>
  );
}

const inputBase = 'h-9 w-full rounded-md border border-line bg-obsidian px-3 text-sm text-titanium placeholder:text-muted/60 transition-colors focus:border-signal focus:outline-none aria-[invalid=true]:border-critical';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, props.type === 'number' && 'num text-right', className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(inputBase, 'appearance-none pr-8', className)}>
      {children}
    </select>
  );
}

export function Panel({ title, eyebrow, actions, children, className }: { title?: ReactNode; eyebrow?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('panel fade-in', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <div>
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            {title && <h2 className="text-[14px] font-semibold text-titanium">{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

type Tone = 'neutral' | 'signal' | 'positive' | 'caution' | 'critical';
const tones: Record<Tone, string> = {
  neutral: 'bg-graphite-2 text-muted border-line',
  signal: 'bg-signal/10 text-signal border-signal/30',
  positive: 'bg-positive/10 text-positive border-positive/30',
  caution: 'bg-caution/10 text-caution border-caution/30',
  critical: 'bg-critical/10 text-critical border-critical/30',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider', tones[tone], className)}>{children}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  const color = tone === 'positive' ? 'text-positive' : tone === 'critical' ? 'text-critical' : tone === 'caution' ? 'text-caution' : tone === 'signal' ? 'text-signal' : 'text-titanium';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="eyebrow">{label}</div>
      <div className={cx('num text-[22px] font-medium leading-none', color)}>{value}</div>
      {sub && <div className="text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="text-[14px] font-semibold">{title}</div>
      <p className="max-w-md text-[13px] text-muted">{body}</p>
      {action}
    </div>
  );
}

export function DemoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-caution/30 bg-caution/5 px-3 py-2 text-[12px] text-caution">
      <Badge tone="caution">Demo data</Badge>
      <span>{children}</span>
    </div>
  );
}
