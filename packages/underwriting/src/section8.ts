/**
 * Housing Choice Voucher (Section 8) rental analysis from an owner's perspective.
 *
 * Three figures are kept strictly separate:
 *   1. HUD benchmark: the Fair Market Rent (FMR) or Small Area FMR (SAFMR) published by HUD. It is a
 *      benchmark for the area, not a rent anyone has approved for this unit.
 *   2. PHA payment standard: set by the local public housing agency, usually 90–110% of FMR/SAFMR.
 *      If it is not supplied as a verified figure, it is estimated from the benchmark and flagged.
 *   3. Contract rent: the rent the PHA actually approves for this unit after its rent-reasonableness
 *      test and inspection. Nothing here predicts or guarantees that number.
 *
 *   Gross rent ceiling (payment standard) = Payment Standard
 *   Contract rent at the payment standard = Payment Standard − Utility Allowance (tenant-paid utilities)
 *   Underwritten contract rent            = min(Proposed Rent, Contract Rent At Standard, Comparable Market Rent)
 *
 * The cap at the payment standard is conservative: a family may rent above it by paying the difference,
 * subject to the 40%-of-income initial rent-burden limit, but that depends on household income and is
 * not modeled. This engine analyzes properties, never households: it must not be used for tenant
 * screening or eligibility decisions.
 */
import { ResultBuilder, UnderwritingInputError, nonNegative, roundCurrency, toSourced, type CalculationResult, type NumericInput } from './core';
import { analyzeRental, type LoanTerms, type OperatingExpenses, type RentalResult } from './rental';

export type HudBenchmarkKind = 'FMR' | 'SAFMR';

export interface Section8Unit {
  bedrooms: number;
  /** HUD FMR or SAFMR for this bedroom count (monthly gross rent). */
  hudBenchmark: NumericInput;
  /** PHA payment standard for this bedroom count, if known. */
  phaPaymentStandard?: NumericInput;
  /** PHA utility allowance for utilities the tenant pays. */
  utilityAllowance?: NumericInput;
  /** Contract rent the owner intends to request. */
  proposedContractRent: NumericInput;
  /** Comparable unassisted market rent (the rent-reasonableness reference). */
  comparableMarketRent: NumericInput;
}

export interface Section8Input {
  benchmarkKind: HudBenchmarkKind;
  /** HUD fiscal year of the benchmark, e.g. 2027. */
  benchmarkYear: number;
  /** When the payment standard is not supplied, it is estimated as benchmark × this rate. Default 1.0. */
  assumedPaymentStandardRate?: NumericInput;
  units: Section8Unit[];
  purchasePrice: NumericInput;
  vacancyRate: NumericInput;
  expenses: OperatingExpenses;
  loan?: LoanTerms;
  closingCosts?: NumericInput;
  initialRepairs?: NumericInput;
}

export interface Section8UnitResult {
  bedrooms: number;
  hudBenchmark: number;
  paymentStandard: number;
  paymentStandardIsEstimate: boolean;
  utilityAllowance: number;
  contractRentAtStandard: number;
  underwrittenContractRent: number;
  /** Which limit set the underwritten rent. */
  bindingLimit: 'proposed' | 'payment_standard' | 'market';
  /** Underwritten rent − comparable market rent. */
  premiumToMarket: number;
}

export interface Section8Result {
  units: Section8UnitResult[];
  benchmarkLabel: string;
  /** Rental analysis at the underwritten contract rents. */
  voucherScenario: RentalResult;
  /** Rental analysis at comparable market rents, for comparison. */
  marketScenario: RentalResult;
  monthlyRentDifference: number;
}

export function analyzeSection8(input: Section8Input): CalculationResult<Section8Result> {
  const b = new ResultBuilder();
  if (!Array.isArray(input.units) || input.units.length === 0) {
    throw new UnderwritingInputError('units', 'at least one unit is required');
  }
  if (input.benchmarkKind !== 'FMR' && input.benchmarkKind !== 'SAFMR') {
    throw new UnderwritingInputError('benchmarkKind', 'must be FMR or SAFMR');
  }
  const year = b.input('benchmarkYear', 'HUD benchmark fiscal year', input.benchmarkYear, { min: 2000, max: 2100, integer: true });
  const psRate = b.optional('assumedPaymentStandardRate', 'Assumed payment standard (% of benchmark)', input.assumedPaymentStandardRate, { min: 0.5, max: 1.5 }, 1);
  const label = `HUD ${input.benchmarkKind} FY${year}`;

  let anyEstimated = false;
  let anyAboveMarket = false;
  const units: Section8UnitResult[] = input.units.map((u, i) => {
    const p = `units[${i}]`;
    const beds = b.input(`${p}.bedrooms`, `Unit ${i + 1} bedrooms`, u.bedrooms, { min: 0, max: 8, integer: true });
    const bench = b.input(`${p}.hudBenchmark`, `Unit ${i + 1} ${label} (benchmark)`, u.hudBenchmark, { gt: 0 });
    const ua = b.optional(`${p}.utilityAllowance`, `Unit ${i + 1} utility allowance`, u.utilityAllowance, nonNegative);
    const proposed = b.input(`${p}.proposedContractRent`, `Unit ${i + 1} proposed contract rent`, u.proposedContractRent, nonNegative);
    const market = b.input(`${p}.comparableMarketRent`, `Unit ${i + 1} comparable market rent`, u.comparableMarketRent, nonNegative);
    let ps: number;
    let estimated = false;
    if (u.phaPaymentStandard !== undefined) {
      ps = b.input(`${p}.phaPaymentStandard`, `Unit ${i + 1} PHA payment standard`, u.phaPaymentStandard, { gt: 0 });
      if (toSourced(u.phaPaymentStandard).source !== 'verified') estimated = true;
    } else {
      ps = b.step(`Unit ${i + 1} estimated payment standard`, 'HUD Benchmark × Assumed Payment Standard %', { bench, psRate }, bench * psRate);
      estimated = true;
    }
    anyEstimated ||= estimated;
    const atStandard = b.step(`Unit ${i + 1} contract rent at payment standard`, 'Payment Standard − Utility Allowance', { ps, ua }, Math.max(0, ps - ua));
    const underwritten = Math.min(proposed, atStandard, market);
    b.step(`Unit ${i + 1} underwritten contract rent`, 'min(Proposed, At Standard, Market)', { proposed, atStandard, market }, underwritten);
    const binding: Section8UnitResult['bindingLimit'] = underwritten === proposed ? 'proposed' : underwritten === atStandard ? 'payment_standard' : 'market';
    if (proposed > market) anyAboveMarket = true;
    return {
      bedrooms: beds,
      hudBenchmark: roundCurrency(bench),
      paymentStandard: roundCurrency(ps),
      paymentStandardIsEstimate: estimated,
      utilityAllowance: roundCurrency(ua),
      contractRentAtStandard: roundCurrency(atStandard),
      underwrittenContractRent: roundCurrency(underwritten),
      bindingLimit: binding,
      premiumToMarket: roundCurrency(underwritten - market),
    };
  });

  const common = {
    purchasePrice: input.purchasePrice,
    vacancyRate: input.vacancyRate,
    expenses: input.expenses,
    loan: input.loan,
    closingCosts: input.closingCosts,
    initialRepairs: input.initialRepairs,
  };
  // Underwritten rents are calculated above, not user assumptions.
  b.derived(...units.map((_, i) => `monthlyRents[${i}]`));
  const voucher = b.absorb(analyzeRental({ ...common, monthlyRents: units.map((u) => u.underwrittenContractRent) }), 'Voucher');
  const marketScenario = analyzeRental({ ...common, monthlyRents: input.units.map((u) => u.comparableMarketRent) }).value;
  const diff = (voucher.grossPotentialRent - marketScenario.grossPotentialRent) / 12;

  b.warn('section8_not_guaranteed', 'caution', `${label} is a HUD benchmark, not an approved rent. The PHA sets contract rent after a rent-reasonableness review and inspection; no rent or tenancy is guaranteed.`);
  if (anyEstimated) b.warn('section8_payment_standard_estimated', 'caution', 'One or more PHA payment standards are estimated or unverified. Obtain the current payment standard schedule from the local PHA.');
  if (anyAboveMarket) b.warn('section8_above_market', 'caution', 'A proposed contract rent exceeds comparable market rent; PHAs will not approve rent above rent-reasonableness comparables.');
  b.warn('section8_inspection', 'info', 'Units must pass a PHA inspection (NSPIRE-V or HQS) before assistance payments begin; budget for required repairs and possible delays.');
  b.warn('section8_no_tenant_screening', 'info', 'This analysis evaluates properties only. It must not be used for tenant screening or eligibility decisions; source-of-income protections apply in many jurisdictions.');

  return b.build({ units, benchmarkLabel: label, voucherScenario: voucher, marketScenario, monthlyRentDifference: roundCurrency(diff) });
}
