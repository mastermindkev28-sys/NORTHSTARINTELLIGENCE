/**
 * Financing scenario comparison: run the same rental under several loan structures side by side.
 */
import { UnderwritingInputError, type CalculationResult } from './core.js';
import { analyzeRental, type LoanTerms, type RentalInput, type RentalResult } from './rental.js';

export interface FinancingScenario {
  id: string;
  label: string;
  /** null = all cash. */
  loan: LoanTerms | null;
}

export interface ScenarioComparisonRow {
  id: string;
  label: string;
  result: CalculationResult<RentalResult>;
}

export function compareFinancingScenarios(base: Omit<RentalInput, 'loan'>, scenarios: FinancingScenario[]): ScenarioComparisonRow[] {
  if (scenarios.length === 0) throw new UnderwritingInputError('scenarios', 'at least one scenario is required');
  const ids = new Set<string>();
  return scenarios.map((s) => {
    if (ids.has(s.id)) throw new UnderwritingInputError('scenarios', `duplicate scenario id "${s.id}"`);
    ids.add(s.id);
    const input: RentalInput = s.loan ? { ...base, loan: s.loan } : { ...base };
    return { id: s.id, label: s.label, result: analyzeRental(input) };
  });
}
