import { CalculationInputError, requireNonNegative, requirePositiveInt, requireRate } from "./trace";

/**
 * Level monthly payment for a fully amortizing loan.
 * PMT = P · r / (1 − (1 + r)^−n), r = annualRate / 12. For r = 0, PMT = P / n.
 */
export function monthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  requireNonNegative("principal", principal);
  requireRate("annualRate", annualRate);
  requirePositiveInt("termMonths", termMonths);
  if (principal === 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - (1 + r) ** -termMonths);
}

/** Monthly interest-only payment: P · annualRate / 12. */
export function interestOnlyPayment(principal: number, annualRate: number): number {
  requireNonNegative("principal", principal);
  requireRate("annualRate", annualRate);
  return (principal * annualRate) / 12;
}

/** Outstanding balance after `paymentsMade` level payments. B_k = P(1+r)^k − PMT·((1+r)^k − 1)/r. */
export function remainingBalance(
  principal: number,
  annualRate: number,
  termMonths: number,
  paymentsMade: number,
): number {
  if (!Number.isInteger(paymentsMade) || paymentsMade < 0) {
    throw new CalculationInputError("paymentsMade must be a non-negative integer");
  }
  if (paymentsMade >= termMonths) return 0;
  const pmt = monthlyPayment(principal, annualRate, termMonths);
  const r = annualRate / 12;
  if (r === 0) return principal - pmt * paymentsMade;
  const growth = (1 + r) ** paymentsMade;
  const balance = principal * growth - (pmt * (growth - 1)) / r;
  return Math.abs(balance) < 1e-7 ? 0 : balance;
}

export interface AmortizationRow {
  period: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export function amortizationSchedule(principal: number, annualRate: number, termMonths: number): AmortizationRow[] {
  const pmt = monthlyPayment(principal, annualRate, termMonths);
  const r = annualRate / 12;
  const rows: AmortizationRow[] = [];
  let balance = principal;
  for (let period = 1; period <= termMonths; period++) {
    const interest = balance * r;
    let principalPaid = pmt - interest;
    if (period === termMonths) principalPaid = balance; // absorb floating-point residue in the final payment
    balance = balance - principalPaid;
    rows.push({ period, payment: interest + principalPaid, interest, principal: principalPaid, balance: Math.abs(balance) < 1e-7 ? 0 : balance });
  }
  return rows;
}

/** Total interest paid over the first `months` payments of a loan (amortizing or interest-only). */
export function interestPaidOver(
  principal: number,
  annualRate: number,
  months: number,
  opts: { interestOnly: boolean; termMonths?: number },
): number {
  requireNonNegative("months", months);
  if (opts.interestOnly) return interestOnlyPayment(principal, annualRate) * months;
  const term = opts.termMonths;
  if (term === undefined) throw new CalculationInputError("termMonths is required for amortizing loans");
  const wholeMonths = Math.min(Math.ceil(months), term);
  const schedule = amortizationSchedule(principal, annualRate, term);
  let interest = 0;
  for (let i = 0; i < wholeMonths; i++) {
    const row = schedule[i];
    if (row) interest += row.interest;
  }
  return interest;
}

/** Net present value; cashFlows[0] occurs at t = 0. Rate is per period. */
export function npv(rate: number, cashFlows: readonly number[]): number {
  if (rate <= -1) throw new CalculationInputError("rate must be > −100%");
  return cashFlows.reduce((sum, cf, t) => sum + cf / (1 + rate) ** t, 0);
}

/**
 * Internal rate of return per period. Newton–Raphson with a bracketed bisection fallback.
 * Returns null when cash flows have no sign change (IRR undefined) or no root is found in (−99.99%, 1000%).
 */
export function irr(cashFlows: readonly number[], guess = 0.1): number | null {
  const hasPositive = cashFlows.some((c) => c > 0);
  const hasNegative = cashFlows.some((c) => c < 0);
  if (!hasPositive || !hasNegative) return null;

  const derivative = (rate: number) =>
    cashFlows.reduce((sum, cf, t) => (t === 0 ? sum : sum - (t * cf) / (1 + rate) ** (t + 1)), 0);

  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const value = npv(rate, cashFlows);
    const slope = derivative(rate);
    if (Math.abs(value) < 1e-9) return rate;
    if (slope === 0 || !Number.isFinite(slope)) break;
    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - rate) < 1e-12) return next;
    rate = next;
  }

  // Bisection fallback over a wide bracket.
  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo, cashFlows);
  const fHi = npv(hi, cashFlows);
  if (Math.sign(fLo) === Math.sign(fHi)) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashFlows);
    if (Math.abs(fMid) < 1e-9 || (hi - lo) / 2 < 1e-12) return mid;
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/** Convert a holding-period return to an annualized (compound) rate. */
export function annualizeReturn(totalReturn: number, months: number): number | null {
  if (months <= 0 || totalReturn <= -1) return null;
  return (1 + totalReturn) ** (12 / months) - 1;
}
