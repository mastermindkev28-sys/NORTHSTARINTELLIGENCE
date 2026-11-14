/**
 * Currency helpers. Underwriting math runs in IEEE-754 doubles (required for amortization / IRR),
 * and results are rounded to cents only at defined output boundaries using half-away-from-zero,
 * matching common financial presentation. Never round intermediate values.
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`Cannot round non-finite value: ${value}`);
  const factor = 10 ** decimals;
  // Number.EPSILON nudge corrects binary representation error (e.g., 1.005 -> 1.01).
  const scaled = Math.abs(value) * factor * (1 + Number.EPSILON);
  return (Math.sign(value) * Math.round(scaled)) / factor;
}

export const roundCents = (value: number): number => roundTo(value, 2);

export const toCents = (dollars: number): number => Math.round(roundCents(dollars) * 100);
export const fromCents = (cents: number): number => cents / 100;

export function formatUsd(value: number, opts: { cents?: boolean } = {}): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(value);
}

export function formatPercent(ratio: number, decimals = 2): string {
  return `${roundTo(ratio * 100, decimals).toFixed(decimals)}%`;
}
