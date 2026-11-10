import type { Assumption, InputSource, TraceStep, TwoWayGrid, UnderwritingWarning } from '@northstar/underwriting';
import { Badge, cx } from '@/components/ui';
import { SOURCE_LABELS } from '@/lib/format';

export function WarningList({ warnings, limit }: { warnings: UnderwritingWarning[]; limit?: number }) {
  if (warnings.length === 0) return <p className="text-[12.5px] text-positive">No warnings on these inputs.</p>;
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

export function SensitivityGrid<T>({ grid, rowLabel, colLabel, format, tone }: { grid: TwoWayGrid<T>; rowLabel: string; colLabel: string; format: (v: T) => string; tone?: (v: T) => 'good' | 'bad' | 'neutral' }) {
  const d = (x: number) => (x === 0 ? 'Base' : `${x > 0 ? '+' : ''}${Math.round(x * 100)}%`);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11.5px]">
        <thead>
          <tr>
            <th className="eyebrow pb-1.5 pr-2 text-left font-normal">{rowLabel} ↓ / {colLabel} →</th>
            {grid.colDeltas.map((c) => <th key={c} className="num whitespace-nowrap pb-1.5 pl-3 text-right font-normal text-muted">{d(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {grid.cells.map((row, i) => (
            <tr key={i} className="border-t border-line/60">
              <td className="num py-1.5 pr-2 text-muted">{d(grid.rowDeltas[i]!)}</td>
              {row.map((cell, j) => {
                const base = grid.rowDeltas[i] === 0 && grid.colDeltas[j] === 0;
                const t = tone?.(cell);
                return (
                  <td key={j} className={cx('num whitespace-nowrap py-1.5 pl-3 text-right', base && 'font-semibold text-signal', !base && t === 'bad' && 'text-critical', !base && t === 'good' && 'text-titanium')}>
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
    <table className="w-full text-[12.5px]">
      <thead><tr className="text-left text-muted"><th className="pb-2 font-normal">Input</th><th className="pb-2 font-normal">Classification</th><th className="pb-2 font-normal">Reference</th><th className="pb-2 text-right font-normal">Value</th></tr></thead>
      <tbody>
        {order.flatMap((src) =>
          (groups[src] ?? []).map((a) => (
            <tr key={a.key} className="border-t border-line/60">
              <td className="py-1.5 pr-2">{a.label}</td>
              <td className="py-1.5 pr-2"><Badge tone={SOURCE_TONE[src]}>{SOURCE_LABELS[src]}</Badge></td>
              <td className="py-1.5 pr-2 text-muted">{a.sourceRef ?? '—'}</td>
              <td className="num py-1.5 text-right">{fmt(a)}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

export function TraceTable({ trace }: { trace: TraceStep[] }) {
  return (
    <ol className="flex flex-col divide-y divide-line/60 text-[12.5px]">
      {trace.map((t, i) => (
        <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-baseline gap-3 py-2">
          <span className="num text-[10.5px] text-muted">{String(i + 1).padStart(2, '0')}</span>
          <div className="min-w-0">
            <div>{t.label}</div>
            <div className="num mt-0.5 truncate text-[11.5px] text-muted" title={t.formula}>{t.formula}</div>
          </div>
          <span className="num text-right">{Math.abs(t.value) < 10 && !Number.isInteger(t.value) ? t.value.toFixed(4) : t.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        </li>
      ))}
    </ol>
  );
}
