/**
 * Time-value-of-money and loan math. Pure numeric functions (no provenance) used by the higher-level
 * calculators. All rates are annual decimals (0.065 = 6.5%); periods are months unless noted.
 */
import { UnderwritingInputError, requireNumber } from './core';

/**
 * Fully amortizing monthly payment (principal + interest).
 *   P = L × r / (1 − (1 + r)^−n), where r = annualRate / 12
 * When the rate is zero the loan amortizes linearly: P = L / n.
 */
export function amortizingPayment(principal: number, annualRate: number, termMonths: number): number {
  requireNumber('principal', principal, { min: 0 });
  requireNumber('annualRate', annualRate, { min: 0, max: 1 });
  requireNumber('termMonths', termMonths, { gt: 0, integer: true });
  if (principal === 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/** Interest-only monthly payment: L × annualRate / 12. */
export function interestOnlyPayment(principal: number, annualRate: number): number {
  requireNumber('principal', principal, { min: 0 });
  requireNumber('annualRate', annualRate, { min: 0, max: 1 });
  return (principal * annualRate) / 12;
}

/** Remaining principal after `monthsPaid` scheduled payments on a fully amortizing loan. */
export function remainingBalance(
  principal: number,
  annualRate: number,
  termMonths: number,
  monthsPaid: number,
): number {
  requireNumber('monthsPaid', monthsPaid, { min: 0, integer: true });
  if (monthsPaid >= termMonths) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal - (principal / termMonths) * monthsPaid;
  const pmt = amortizingPayment(principal, annualRate, termMonths);
  const growth = Math.pow(1 + r, monthsPaid);
  return Math.max(0, principal * growth - pmt * ((growth - 1) / r));
}

export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

/** Full amortization schedule. The final payment absorbs any sub-cent residual so the balance ends at 0. */
export function amortizationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
): AmortizationRow[] {
  const pmt = amortizingPayment(principal, annualRate, termMonths);
  const r = annualRate / 12;
  const rows: AmortizationRow[] = [];
  let balance = principal;
  for (let m = 1; m <= termMonths; m++) {
    const interest = balance * r;
    let principalPaid = pmt - interest;
    if (m === termMonths) principalPaid = balance;
    balance = balance - principalPaid;
    rows.push({
      month: m,
      payment: principalPaid + interest,
      interest,
      principal: principalPaid,
      balance: Math.abs(balance) < 1e-7 ? 0 : balance,
    });
  }
  return rows;
}

/** Net present value of periodic cash flows; cashFlows[0] occurs at t=0 (undiscounted). */
export function npv(discountRate: number, cashFlows: readonly number[]): number {
  requireNumber('discountRate', discountRate, { gt: -1 });
  return cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + discountRate, t), 0);
}

/**
 * Internal rate of return via bracketed bisection, which is deterministic and always converges when a
 * sign change exists in [-0.9999, 10]. Returns null when the cash flows have no sign change (IRR undefined).
 */
export function irr(cashFlows: readonly number[], tolerance = 1e-10, maxIterations = 500): number | null {
  if (cashFlows.length < 2) {
    throw new UnderwritingInputError('cashFlows', 'requires at least two periods');
  }
  cashFlows.forEach((cf, i) => requireNumber(`cashFlows[${i}]`, cf));
  const hasPositive = cashFlows.some((c) => c > 0);
  const hasNegative = cashFlows.some((c) => c < 0);
  if (!hasPositive || !hasNegative) return null;

  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo, cashFlows);
  const fHi = npv(hi, cashFlows);
  if (Math.sign(fLo) === Math.sign(fHi)) return null;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashFlows);
    if (Math.abs(fMid) < tolerance || (hi - lo) / 2 < tolerance) return mid;
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/** Convert a holding-period return to an annualized (compound) return. */
export function annualizeReturn(totalReturn: number, months: number): number | null {
  requireNumber('months', months, { gt: 0 });
  if (totalReturn <= -1) return null;
  return Math.pow(1 + totalReturn, 12 / months) - 1;
}
