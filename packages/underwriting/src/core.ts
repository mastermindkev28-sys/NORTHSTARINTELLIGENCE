/**
 * Core primitives for the Northstar underwriting engine.
 *
 * Design rules (see docs/UNDERWRITING_METHODOLOGY.md):
 *  1. Every function is pure and deterministic: same inputs -> same outputs, no I/O, no clock, no randomness.
 *  2. Every input carries provenance so reports can distinguish verified facts from assumptions.
 *  3. Every result carries a trace of the formulas used and the values that went into them.
 *  4. Invalid input throws UnderwritingInputError. We never silently coerce or invent values.
 *  5. Intermediate math runs at full IEEE-754 double precision; rounding to cents happens only at
 *     presentation boundaries via `roundCurrency`, so chained calculations do not accumulate rounding error.
 */

export const ENGINE_VERSION = '1.1.0';

/** Where a number came from. Mirrors the five classes required by the operating brief, section 11. */
export type InputSource =
  | 'verified' // confirmed against a primary record (deed, closing statement, signed contract, lender quote)
  | 'user_assumption' // entered by the operator as their own estimate or policy
  | 'third_party_estimate' // supplied by a data provider (AVM, rent estimate, contractor bid)
  | 'ai_interpretation'; // extracted or inferred by an AI model and not yet human-verified

export type ResultSource = 'calculated';

export interface Sourced<T = number> {
  value: T;
  source: InputSource;
  /** Human-readable description of the source, e.g. "ATTOM AVM", "Seller call 2026-11-02". */
  sourceRef?: string;
  /** ISO-8601 timestamp the value was retrieved or asserted. */
  asOf?: string;
  note?: string;
}

/** A numeric input that may be passed bare (treated as a user assumption) or with full provenance. */
export type NumericInput = number | Sourced<number>;

export interface TraceStep {
  label: string;
  /** Formula in plain notation using the named variables, e.g. "ARV × 70% − Repairs − Fee". */
  formula: string;
  /** Named values substituted into the formula. */
  inputs: Record<string, number>;
  value: number;
}

export interface Assumption {
  key: string;
  label: string;
  value: number;
  source: InputSource;
  sourceRef?: string;
  asOf?: string;
  note?: string;
}

export type WarningSeverity = 'info' | 'caution' | 'critical';

export interface UnderwritingWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
}

export interface CalculationResult<T> {
  source: ResultSource;
  engineVersion: string;
  value: T;
  trace: TraceStep[];
  assumptions: Assumption[];
  warnings: UnderwritingWarning[];
}

export class UnderwritingInputError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'UnderwritingInputError';
    this.field = field;
  }
}

// ---------------------------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------------------------

export function sourced(
  value: number,
  source: InputSource,
  meta: Omit<Sourced, 'value' | 'source'> = {},
): Sourced<number> {
  return { value, source, ...meta };
}

export function toSourced(input: NumericInput): Sourced<number> {
  return typeof input === 'number' ? { value: input, source: 'user_assumption' } : input;
}

export function valueOf(input: NumericInput): number {
  return typeof input === 'number' ? input : input.value;
}

interface NumberRule {
  min?: number;
  max?: number;
  integer?: boolean;
  /** Exclusive lower bound. */
  gt?: number;
}

/** Validate a numeric input and return its raw value. Throws on NaN, Infinity, or out-of-range values. */
export function requireNumber(field: string, input: NumericInput | undefined, rule: NumberRule = {}): number {
  if (input === undefined || input === null) {
    throw new UnderwritingInputError(field, 'is required');
  }
  if (typeof input !== 'number' && (typeof input !== 'object' || !('value' in input))) {
    throw new UnderwritingInputError(field, 'must be a number or a sourced value');
  }
  const v = valueOf(input);
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new UnderwritingInputError(field, `must be a finite number (received ${String(v)})`);
  }
  if (rule.min !== undefined && v < rule.min) {
    throw new UnderwritingInputError(field, `must be ≥ ${rule.min} (received ${v})`);
  }
  if (rule.gt !== undefined && v <= rule.gt) {
    throw new UnderwritingInputError(field, `must be > ${rule.gt} (received ${v})`);
  }
  if (rule.max !== undefined && v > rule.max) {
    throw new UnderwritingInputError(field, `must be ≤ ${rule.max} (received ${v})`);
  }
  if (rule.integer && !Number.isInteger(v)) {
    throw new UnderwritingInputError(field, `must be a whole number (received ${v})`);
  }
  return v;
}

export const nonNegative = { min: 0 } as const;
export const positive = { gt: 0 } as const;
/** Rates are decimals: 0.07 means 7%. Upper bound guards against "7" being passed for 7%. */
export const rate = { min: 0, max: 1 } as const;

// ---------------------------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------------------------

/**
 * Round half away from zero to `decimals` places, using exponent shifting to avoid the
 * classic binary representation error (e.g. 1.005 -> 1.01, not 1.00).
 */
export function roundTo(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const shifted = Math.round(Number(`${Math.abs(value)}e${decimals}`));
  const result = sign * Number(`${shifted}e-${decimals}`);
  return Object.is(result, -0) ? 0 : result;
}

export const roundCurrency = (value: number): number => roundTo(value, 2);
export const roundRate = (value: number): number => roundTo(value, 6);

/** Safe division: returns null instead of Infinity/NaN when the denominator is zero. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

// ---------------------------------------------------------------------------------------------
// Result builder
// ---------------------------------------------------------------------------------------------

export class ResultBuilder {
  readonly trace: TraceStep[] = [];
  readonly assumptions: Assumption[] = [];
  readonly warnings: UnderwritingWarning[] = [];
  private readonly seen = new Set<string>();

  /** Record an input as an assumption with its provenance and return its validated value. */
  input(key: string, label: string, input: NumericInput | undefined, rule: NumberRule = {}): number {
    const v = requireNumber(key, input, rule);
    if (!this.seen.has(key)) {
      this.seen.add(key);
      const s = toSourced(input as NumericInput);
      const a: Assumption = { key, label, value: v, source: s.source };
      if (s.sourceRef !== undefined) a.sourceRef = s.sourceRef;
      if (s.asOf !== undefined) a.asOf = s.asOf;
      if (s.note !== undefined) a.note = s.note;
      this.assumptions.push(a);
    }
    return v;
  }

  /** Optional input: returns `fallback` (default 0) when undefined, without recording an assumption. */
  optional(
    key: string,
    label: string,
    input: NumericInput | undefined,
    rule: NumberRule = {},
    fallback = 0,
  ): number {
    if (input === undefined) return fallback;
    return this.input(key, label, input, rule);
  }

  /**
   * Mark keys whose values are computed upstream in this analysis, so that sub-calculations do not
   * re-record them as user assumptions when absorbed.
   */
  derived(...keys: string[]): void {
    for (const k of keys) this.seen.add(k);
  }

  step(label: string, formula: string, inputs: Record<string, number>, value: number): number {
    this.trace.push({ label, formula, inputs, value });
    return value;
  }

  warn(code: string, severity: WarningSeverity, message: string): void {
    if (!this.warnings.some((w) => w.code === code)) this.warnings.push({ code, severity, message });
  }

  /** Merge a sub-result's trace, assumptions, and warnings into this builder. */
  absorb<T>(sub: CalculationResult<T>, prefix?: string): T {
    for (const t of sub.trace) this.trace.push(prefix ? { ...t, label: `${prefix}: ${t.label}` } : t);
    for (const a of sub.assumptions) {
      if (!this.seen.has(a.key)) {
        this.seen.add(a.key);
        this.assumptions.push(a);
      }
    }
    for (const w of sub.warnings) this.warn(w.code, w.severity, w.message);
    return sub.value;
  }

  build<T>(value: T): CalculationResult<T> {
    return {
      source: 'calculated',
      engineVersion: ENGINE_VERSION,
      value,
      trace: this.trace,
      assumptions: this.assumptions,
      warnings: this.warnings,
    };
  }
}

export const DISCLAIMER =
  'Estimates only. Results are deterministic calculations on the stated inputs and assumptions; they are ' +
  'not appraisals, guaranteed valuations, or predictions of investment outcomes. Verify all inputs ' +
  'independently before making an offer or financial commitment.';
