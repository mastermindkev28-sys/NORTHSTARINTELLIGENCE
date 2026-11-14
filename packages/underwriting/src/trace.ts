/**
 * Calculation trace: every underwriting output records the formula, the exact inputs, and the result,
 * so any number in a report can be independently reproduced.
 */
export interface TraceStep {
  /** Stable machine key, e.g. "noi". */
  key: string;
  label: string;
  /** Human-readable formula, e.g. "EGI − Operating Expenses". */
  formula: string;
  inputs: Record<string, number | string | boolean | null>;
  result: number | null;
  unit: "usd" | "ratio" | "months" | "years" | "sqft" | "usd_per_sqft" | "count";
}

export class Trace {
  readonly steps: TraceStep[] = [];
  record<T extends number | null>(step: Omit<TraceStep, "result"> & { result: T }): T {
    this.steps.push(step);
    return step.result;
  }
  merge(other: Trace | TraceStep[]): void {
    this.steps.push(...(Array.isArray(other) ? other : other.steps));
  }
}

export class CalculationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculationInputError";
  }
}

export function requireFinite(name: string, value: number): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CalculationInputError(`${name} must be a finite number (received ${String(value)})`);
  }
}

export function requireNonNegative(name: string, value: number): void {
  requireFinite(name, value);
  if (value < 0) throw new CalculationInputError(`${name} must be ≥ 0 (received ${value})`);
}

export function requireRate(name: string, value: number, { max = 1 }: { max?: number } = {}): void {
  requireFinite(name, value);
  if (value < 0 || value > max) {
    throw new CalculationInputError(`${name} must be a decimal rate between 0 and ${max} (received ${value})`);
  }
}

export function requirePositiveInt(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new CalculationInputError(`${name} must be a positive integer (received ${value})`);
  }
}

export const METHODOLOGY_VERSION = "2026.11.1";
