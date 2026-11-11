import type { Assumption, InputSource, TraceStep, TwoWayGrid, UnderwritingWarning } from '@northstar/underwriting';
import { Badge, cx } from '@/components/ui';
import { SOURCE_LABELS } from '@/lib/format';

export function WarningList({ warnings, limit }: { warnings: UnderwritingWarning[]; limit?: number }) {
  if (warnings.length === 0) return <p className="flex items-center gap-2 text-[12.5px] text-positive"><span className="size-1.5 rounded-full bg-positive shadow-[0_0_8px_var(--color-positive)]" />No warnings on these inputs.</p>;
  const shown = limit ? warnings.slice(0, limit) : warnings;
  return (
    <ul className="flex flex-col gap-2">
      {shown.map((w) => (
        <li key={w.code} className="flex gap-2 text-[12.5px] leading-snug">
          <Badge tone={w.severity === 'critical' ? 'critical' : w.severity === 'caution' ? 'caution' : 'neutral'} className="shrink-0">{w.severity}</Badge>
          <span className="text-titanium/90">{w.message}</span>
        </li>
      ))}
      {limit && warnings.length > limit && <li className="text-[12px] text-muted">+{warnings.length - limit} more</li>}
    </ul>
  );
}

/** Two-way sensitivity table rendered as a heatmap. `value` drives cell intensity when given. */
export function SensitivityGrid<T>({ grid, rowLabel, colLabel, format, tone, value }: { grid: TwoWayGrid<T>; rowLabel: string; colLabel: string; format: (v: T) => string; tone?: (v: T) => 'good' | 'bad' | 'neutral'; value?: (v: T) => number | null }) {
  const d = (x: number) => (x === 0 ? 'Base' : `${x > 0 ? '+' : ''}${Math.round(x * 100)}%`);
  const nums = value ? grid.cells.flat().map(value).filter((v): v is number => v !== null && Number.isFinite(v)) : [];
  const min = nums.length ? Math.min(...nums) : 0, max = nums.length ? Math.max(...nums) : 1;
  const heat = (cell: T) => {
    if (!value) return undefined;
    const v = value(cell);
    if (v === null || !Number.isFinite(v)) return undefined;
    const t = (v - min) / (max - min || 1);
    const bad = tone?.(cell) === 'bad';
    const color = bad ? 'var(--color-critical)' : 'var(--color-signal)';
    return { background: `color-mix(in oklab, ${color} ${Math.round(4 + t * 22)}%, transparent)` };
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-[11.5px]">
        <thead>
          <tr>
            <th className="whitespace-nowrap pb-1 pr-2 text-left font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-faint">{rowLabel} / {colLabel}</th>
            {grid.colDeltas.map((c) => <th key={c} className={cx('num whitespace-nowrap pb-1 text-center text-[10.5px] font-normal', c === 0 ? 'text-signal' : 'text-faint')}>{d(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {grid.cells.map((row, i) => (
            <tr key={i}>
              <td className={cx('num whitespace-nowrap pr-2 text-[10.5px]', grid.rowDeltas[i] === 0 ? 'text-signal' : 'text-faint')}>{d(grid.rowDeltas[i]!)}</td>
              {row.map((cell, j) => {
                const base = grid.rowDeltas[i] === 0 && grid.colDeltas[j] === 0;
                const t = tone?.(cell);
                return (
                  <td key={j} style={heat(cell)} className={cx('num whitespace-nowrap rounded-[4px] px-2 py-1.5 text-center', base ? 'font-semibold text-arctic shadow-[0_0_0_1px_var(--color-signal),0_0_14px_-2px_rgb(86_137_255/0.7)]' : t === 'bad' ? 'text-critical' : 'text-titanium/90', !value && 'bg-graphite-2/40')}>
                    {format(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Offer build-up as a horizontal waterfall: ARV minus each cost bucket lands on the offer. */
export function OfferWaterfall({ arv, steps, result, resultLabel }: { arv: number; steps: { label: string; value: number }[]; result: number; resultLabel: string }) {
  const scale = (v: number) => `${Math.max(0, Math.min(100, (v / (arv || 1)) * 100))}%`;
  let run = arv;
  const rows = steps.filter((s) => s.value > 0).map((s) => {
    const from = run - s.value;
    run = from;
    return { ...s, from };
  });
  return (
    <div className="flex flex-col gap-2">
      <Row label="After-repair value" value={arv}><div className="absolute inset-y-0 left-0 rounded-[3px] bg-[linear-gradient(90deg,rgb(220_228_238/0.18),rgb(220_228_238/0.32))]" style={{ width: '100%' }} /></Row>
      {rows.map((r) => (
        <Row key={r.label} label={r.label} value={-r.value} muted>
          <div className="absolute inset-y-0 rounded-[3px] bg-critical/35 shadow-[inset_0_0_0_1px_rgb(239_107_107/0.4)]" style={{ left: scale(r.from), width: scale(r.value) }} />
        </Row>
      ))}
      <div className="mt-1 border-t border-line pt-3">
        <Row label={resultLabel} value={result} strong>
          <div className="absolute inset-y-0 left-0 rounded-[3px] bg-[linear-gradient(90deg,rgb(86_137_255/0.35),var(--color-signal))] shadow-[0_0_14px_rgb(86_137_255/0.6)]" style={{ width: scale(Math.max(0, result)) }} />
        </Row>
      </div>
    </div>
  );
}

function Row({ label, value, children, muted, strong }: { label: string; value: number; children: React.ReactNode; muted?: boolean; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)_92px] items-center gap-3 text-[12px]">
      <span className={cx('truncate', strong ? 'font-medium text-arctic' : muted ? 'text-muted' : 'text-titanium')}>{label}</span>
      <div className="relative h-4 rounded-[3px] bg-graphite-3/40">{children}</div>
      <span className={cx('num text-right', strong ? 'font-medium text-signal-bright' : value < 0 ? 'text-muted' : 'text-titanium')}>{value < 0 ? '−' : ''}${Math.abs(Math.round(value)).toLocaleString('en-US')}</span>
    </div>
  );
}

const SOURCE_TONE: Record<InputSource, 'positive' | 'signal' | 'neutral' | 'caution'> = {
  verified: 'positive',
  third_party_estimate: 'signal',
  user_assumption: 'neutral',
  ai_interpretation: 'caution',
};

export function AssumptionsTable({ groups }: { groups: Record<InputSource, Assumption[]> }) {
  const order: InputSource[] = ['verified', 'third_party_estimate', 'user_assumption', 'ai_interpretation'];
  const fmt = (a: Assumption) => {
    const isRate = /rate|growth|appreciation|multiplier|points|pct/i.test(a.key) || /%|\(rate\)/.test(a.label);
    if (isRate) return `${(a.value * 100).toFixed(2)}%`;
    const isCount = /(holdingMonths|projectionYears|squareFeet|sqft)$/i.test(a.key) || /\((months|years|sqft)\)/i.test(a.label);
    if (isCount) return a.value.toLocaleString('en-US');
    return a.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  };
  return (
    <table className="data-table compact text-[12.5px]">
      <thead><tr className="text-left"><th>Input</th><th>Classification</th><th>Reference</th><th className="text-right">Value</th></tr></thead>
      <tbody>
        {order.flatMap((src) =>
          (groups[src] ?? []).map((a) => (
            <tr key={a.key}>
              <td>{a.label}</td>
              <td><Badge dot tone={SOURCE_TONE[src]}>{SOURCE_LABELS[src]}</Badge></td>
              <td className="text-muted">{a.sourceRef ?? '—'}</td>
              <td className="num text-right text-arctic">{fmt(a)}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

export function TraceTable({ trace }: { trace: TraceStep[] }) {
  return (
    <ol className="relative grid gap-x-8 text-[12.5px] lg:grid-cols-2">
      {trace.map((t, i) => (
        <li key={i} className="group relative grid grid-cols-[30px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line/50 py-2.5">
          <span className="num text-[10px] text-faint group-hover:text-signal">{String(i + 1).padStart(2, '0')}</span>
          <div className="min-w-0">
            <div className="text-titanium">{t.label}</div>
            <div className="num mt-0.5 truncate text-[11px] text-signal/70" title={t.formula}>{t.formula}</div>
          </div>
          <span className="num text-right text-arctic">{Math.abs(t.value) < 10 && !Number.isInteger(t.value) ? t.value.toFixed(4) : t.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        </li>
      ))}
    </ol>
  );
}
