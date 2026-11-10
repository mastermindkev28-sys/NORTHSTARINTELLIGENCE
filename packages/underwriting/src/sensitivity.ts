/**
 * Sensitivity analysis. Generic one-way and two-way grids over any deterministic model, plus
 * pre-built grids for the two questions operators ask most: "what if ARV or repairs are off?"
 * and "what if rent or the interest rate moves?".
 */
import { UnderwritingInputError, requireNumber } from './core.js';
import { calculateMao, type MaoInput } from './wholesale.js';
import { analyzeRental, type RentalInput } from './rental.js';

export interface OneWayRow<T> {
  delta: number;
  inputValue: number;
  output: T;
}

/**
 * Evaluate `model` at base × (1 + delta) for each delta. `apply` returns a new input with the
 * varied value; the base input is never mutated.
 */
export function oneWaySensitivity<I, T>(
  base: I,
  baseValue: number,
  deltas: readonly number[],
  apply: (input: I, value: number) => I,
  model: (input: I) => T,
): OneWayRow<T>[] {
  requireNumber('baseValue', baseValue);
  if (deltas.length === 0) throw new UnderwritingInputError('deltas', 'at least one delta is required');
  return deltas.map((d, i) => {
    requireNumber(`deltas[${i}]`, d, { min: -1 });
    const v = baseValue * (1 + d);
    return { delta: d, inputValue: v, output: model(apply(base, v)) };
  });
}

export interface TwoWayGrid<T> {
  rowDeltas: number[];
  colDeltas: number[];
  rowValues: number[];
  colValues: number[];
  /** cells[r][c] = model at (rowValue[r], colValue[c]). */
  cells: T[][];
}

export function twoWaySensitivity<I, T>(
  base: I,
  row: { baseValue: number; deltas: readonly number[]; apply: (input: I, v: number) => I },
  col: { baseValue: number; deltas: readonly number[]; apply: (input: I, v: number) => I },
  model: (input: I) => T,
): TwoWayGrid<T> {
  requireNumber('row.baseValue', row.baseValue);
  requireNumber('col.baseValue', col.baseValue);
  const rowValues = row.deltas.map((d) => row.baseValue * (1 + d));
  const colValues = col.deltas.map((d) => col.baseValue * (1 + d));
  const cells = rowValues.map((rv) => colValues.map((cv) => model(col.apply(row.apply(base, rv), cv))));
  return { rowDeltas: [...row.deltas], colDeltas: [...col.deltas], rowValues, colValues, cells };
}

export const DEFAULT_DELTAS: readonly number[] = [-0.1, -0.05, 0, 0.05, 0.1];

const num = (v: MaoInput['arv']): number => (typeof v === 'number' ? v : v.value);

/** MAO across ARV (rows) × repair-cost (columns) deltas. */
export function maoSensitivity(input: MaoInput, arvDeltas = DEFAULT_DELTAS, repairDeltas = DEFAULT_DELTAS) {
  return twoWaySensitivity(
    input,
    { baseValue: num(input.arv), deltas: arvDeltas, apply: (i, v) => ({ ...i, arv: v }) },
    { baseValue: num(input.repairCosts), deltas: repairDeltas, apply: (i, v) => ({ ...i, repairCosts: v }) },
    (i) => calculateMao(i).value.mao,
  );
}

/** Cash-on-cash and DSCR across rent (rows) × interest-rate (columns) deltas. */
export function rentalSensitivity(input: RentalInput, rentDeltas = DEFAULT_DELTAS, rateDeltas = DEFAULT_DELTAS) {
  const rents = input.monthlyRents.map(num);
  const totalRent = rents.reduce((a, r) => a + r, 0);
  if (!input.loan) throw new UnderwritingInputError('loan', 'rate sensitivity requires loan terms');
  const loan = input.loan;
  return twoWaySensitivity(
    input,
    {
      baseValue: totalRent,
      deltas: rentDeltas,
      apply: (i, v) => ({ ...i, monthlyRents: rents.map((r) => (totalRent === 0 ? 0 : (r / totalRent) * v)) }),
    },
    {
      baseValue: num(loan.annualInterestRate),
      deltas: rateDeltas,
      apply: (i, v) => ({ ...i, loan: { ...loan, annualInterestRate: v } }),
    },
    (i) => {
      const r = analyzeRental(i).value;
      return { cashOnCash: r.cashOnCash, dscr: r.dscr, monthlyCashFlow: r.monthlyCashFlow };
    },
  );
}
