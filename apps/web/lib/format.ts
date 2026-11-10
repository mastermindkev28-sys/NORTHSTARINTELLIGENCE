const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (v: number | null | undefined, cents = false) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : (cents ? usd2 : usd0).format(v));
export const pct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`);
export const ratio = (v: number | null | undefined, digits = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(digits)}×`);
export const num = (v: number | null | undefined, digits = 0) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: digits }));

export function dateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export const SOURCE_LABELS = {
  verified: 'Verified',
  third_party_estimate: 'Third-party estimate',
  user_assumption: 'User assumption',
  ai_interpretation: 'AI interpretation',
} as const;

/** Compact currency for dense grids: $143.5k, $1.25M. */
export const moneyCompact = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}k`;
  return `${sign}$${a.toFixed(0)}`;
};
