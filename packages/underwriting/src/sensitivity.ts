import { CalculationInputError } from "./trace.js";

/** Set a numeric value at a dotted path on a deep clone of `base`. */
export function withValue<T extends object>(base: T, path: string, value: number): T {
  const clone = structuredClone(base) as Record<string, unknown>;
  const keys = path.split(".");
  let node: Record<string, unknown> = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i] as string;
    const next = node[k];
    if (next === null || typeof next !== "object") throw new CalculationInputError(`Path "${path}" not found at "${k}"`);
    node = next as Record<string, unknown>;
  }
  const leaf = keys[keys.length - 1] as string;
  if (typeof node[leaf] !== "number" && node[leaf] !== undefined) throw new CalculationInputError(`Path "${path}" is not numeric`);
  node[leaf] = value;
  return clone as T;
}

export interface SensitivityPoint {
  input: number;
  output: number | null;
}

export function sensitivity1D<T extends object>(base: T, path: string, values: readonly number[], evaluate: (input: T) => number | null): SensitivityPoint[] {
  return values.map((v) => ({ input: v, output: evaluate(withValue(base, path, v)) }));
}

export interface SensitivityGrid {
  rowPath: string;
  colPath: string;
  rows: number[];
  cols: number[];
  /** outputs[r][c] */
  outputs: (number | null)[][];
}

export function sensitivity2D<T extends object>(
  base: T,
  rowPath: string,
  rowValues: readonly number[],
  colPath: string,
  colValues: readonly number[],
  evaluate: (input: T) => number | null,
): SensitivityGrid {
  const outputs = rowValues.map((rv) => colValues.map((cv) => evaluate(withValue(withValue(base, rowPath, rv), colPath, cv))));
  return { rowPath, colPath, rows: [...rowValues], cols: [...colValues], outputs };
}

export interface TornadoVariable {
  path: string;
  label: string;
  low: number;
  high: number;
}

export interface TornadoBar {
  path: string;
  label: string;
  low: number;
  high: number;
  outputAtLow: number | null;
  outputAtHigh: number | null;
  swing: number;
}

/** One-at-a-time sensitivity, sorted by absolute output swing (largest first). */
export function tornado<T extends object>(base: T, variables: readonly TornadoVariable[], evaluate: (input: T) => number | null): TornadoBar[] {
  return variables
    .map((v) => {
      const outputAtLow = evaluate(withValue(base, v.path, v.low));
      const outputAtHigh = evaluate(withValue(base, v.path, v.high));
      const swing = outputAtLow === null || outputAtHigh === null ? 0 : Math.abs(outputAtHigh - outputAtLow);
      return { path: v.path, label: v.label, low: v.low, high: v.high, outputAtLow, outputAtHigh, swing };
    })
    .sort((a, b) => b.swing - a.swing);
}
