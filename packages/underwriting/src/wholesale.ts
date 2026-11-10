/**
 * Maximum Allowable Offer (MAO) and assignment-fee analysis for wholesale and flip acquisitions.
 */
import {
  ResultBuilder,
  nonNegative,
  rate,
  roundCurrency,
  type CalculationResult,
  type NumericInput,
} from './core';

// ---------------------------------------------------------------------------------------------
// Rule-of-thumb MAO
// ---------------------------------------------------------------------------------------------

export interface MaoInput {
  arv: NumericInput;
  repairCosts: NumericInput;
  /** Fraction of ARV the end buyer will pay all-in. Industry rule of thumb is 0.70; it is an assumption. */
  arvMultiplier?: NumericInput;
  /** Wholesaler's target assignment fee, subtracted from the offer. Default 0. */
  assignmentFee?: NumericInput;
  /** Other deductions (e.g. known liens the buyer must clear). */
  otherDeductions?: NumericInput;
}

export interface MaoResult {
  mao: number;
  buyerMaxPrice: number;
  arvMultiplier: number;
}

/** MAO = ARV × Multiplier − Repairs − Assignment Fee − Other Deductions. Negative MAO means no viable offer. */
export function calculateMao(input: MaoInput): CalculationResult<MaoResult> {
  const b = new ResultBuilder();
  const arv = b.input('arv', 'After-repair value', input.arv, { gt: 0 });
  const repairs = b.input('repairCosts', 'Estimated repairs', input.repairCosts, nonNegative);
  const mult = b.input('arvMultiplier', 'ARV multiplier (buyer all-in ceiling)', input.arvMultiplier ?? 0.7, { gt: 0, max: 1 });
  const fee = b.optional('assignmentFee', 'Target assignment fee', input.assignmentFee, nonNegative);
  const other = b.optional('otherDeductions', 'Other deductions', input.otherDeductions, nonNegative);
  const buyerMax = b.step('End-buyer max purchase price', 'ARV × Multiplier − Repairs − Other', { arv, mult, repairs, other }, arv * mult - repairs - other);
  const mao = b.step('Maximum allowable offer', 'Buyer Max Price − Assignment Fee', { buyerMax, fee }, buyerMax - fee);
  if (mao <= 0) b.warn('mao_non_positive', 'critical', 'MAO is zero or negative: the deal does not work at these assumptions.');
  if (repairs > arv * 0.5) b.warn('mao_heavy_rehab', 'caution', 'Repairs exceed 50% of ARV; estimate risk is elevated.');
  return b.build({ mao: roundCurrency(mao), buyerMaxPrice: roundCurrency(buyerMax), arvMultiplier: mult });
}

// ---------------------------------------------------------------------------------------------
// Detailed (cost-stack) MAO
// ---------------------------------------------------------------------------------------------

export interface DetailedMaoInput {
  arv: NumericInput;
  repairCosts: NumericInput;
  /** Buyer's acquisition closing costs, in dollars. */
  buyerAcquisitionCosts: NumericInput;
  holdingCosts: NumericInput;
  financingCosts: NumericInput;
  dispositionCosts: NumericInput;
  /** Buyer's required profit: either a dollar amount or a decimal of ARV. */
  targetProfit: NumericInput;
  targetProfitIsRate?: boolean;
  assignmentFee?: NumericInput;
}

export interface DetailedMaoResult {
  mao: number;
  buyerMaxPrice: number;
  totalCostStack: number;
  targetProfit: number;
  /** MAO as a fraction of ARV, for comparison with the rule-of-thumb multiplier. */
  impliedMultiplier: number;
}

/**
 * Cost-stack MAO, working backward from ARV:
 *   Buyer Max = ARV − Repairs − Acquisition − Holding − Financing − Disposition − Target Profit
 *   MAO       = Buyer Max − Assignment Fee
 * All cost inputs are dollar amounts (pre-computed via the cost calculators).
 */
export function calculateDetailedMao(input: DetailedMaoInput): CalculationResult<DetailedMaoResult> {
  const b = new ResultBuilder();
  const arv = b.input('arv', 'After-repair value', input.arv, { gt: 0 });
  const repairs = b.input('repairCosts', 'Estimated repairs', input.repairCosts, nonNegative);
  const acq = b.input('buyerAcquisitionCosts', 'Buyer acquisition costs', input.buyerAcquisitionCosts, nonNegative);
  const hold = b.input('holdingCosts', 'Holding costs', input.holdingCosts, nonNegative);
  const fin = b.input('financingCosts', 'Financing costs', input.financingCosts, nonNegative);
  const disp = b.input('dispositionCosts', 'Disposition costs', input.dispositionCosts, nonNegative);
  let profit: number;
  if (input.targetProfitIsRate) {
    const pr = b.input('targetProfitRate', 'Target profit (% of ARV)', input.targetProfit, rate);
    profit = b.step('Target profit', 'ARV × Target Profit Rate', { arv, pr }, arv * pr);
  } else {
    profit = b.input('targetProfit', 'Target profit', input.targetProfit, nonNegative);
  }
  const fee = b.optional('assignmentFee', 'Target assignment fee', input.assignmentFee, nonNegative);
  const stack = b.step('Total cost stack', 'Repairs + Acquisition + Holding + Financing + Disposition', { repairs, acq, hold, fin, disp }, repairs + acq + hold + fin + disp);
  const buyerMax = b.step('End-buyer max purchase price', 'ARV − Cost Stack − Target Profit', { arv, stack, profit }, arv - stack - profit);
  const mao = b.step('Maximum allowable offer', 'Buyer Max Price − Assignment Fee', { buyerMax, fee }, buyerMax - fee);
  if (mao <= 0) b.warn('mao_non_positive', 'critical', 'MAO is zero or negative: the deal does not work at these assumptions.');
  return b.build({
    mao: roundCurrency(mao),
    buyerMaxPrice: roundCurrency(buyerMax),
    totalCostStack: roundCurrency(stack),
    targetProfit: roundCurrency(profit),
    impliedMultiplier: mao / arv,
  });
}

// ---------------------------------------------------------------------------------------------
// Assignment-fee analysis
// ---------------------------------------------------------------------------------------------

export interface AssignmentInput {
  /** Price under contract with the seller. */
  contractPrice: NumericInput;
  /** Price the end buyer pays the wholesaler-assigned contract (contract price + assignment fee). */
  buyerPrice: NumericInput;
  arv: NumericInput;
  repairCosts: NumericInput;
  /** End buyer's other all-in costs (closing, holding, financing, selling). */
  buyerOtherCosts?: NumericInput;
  /** Wholesaler's own costs (marketing, earnest money not refunded, title fees). */
  wholesalerCosts?: NumericInput;
  /** Minimum profit margin (decimal of ARV) an end buyer typically requires. Default 0.10. */
  buyerMinMarginRate?: NumericInput;
}

export interface AssignmentResult {
  assignmentFee: number;
  wholesalerNet: number;
  buyerAllIn: number;
  buyerProjectedProfit: number;
  buyerMargin: number;
  /** Highest fee that still leaves the end buyer at their minimum margin. */
  maxSupportableFee: number;
  viableForBuyer: boolean;
}

export function analyzeAssignment(input: AssignmentInput): CalculationResult<AssignmentResult> {
  const b = new ResultBuilder();
  const contract = b.input('contractPrice', 'Seller contract price', input.contractPrice, { gt: 0 });
  const buyerPrice = b.input('buyerPrice', 'End-buyer price', input.buyerPrice, { gt: 0 });
  const arv = b.input('arv', 'After-repair value', input.arv, { gt: 0 });
  const repairs = b.input('repairCosts', 'Estimated repairs', input.repairCosts, nonNegative);
  const buyerOther = b.optional('buyerOtherCosts', 'End-buyer other costs', input.buyerOtherCosts, nonNegative);
  const wCosts = b.optional('wholesalerCosts', 'Wholesaler costs', input.wholesalerCosts, nonNegative);
  const minMargin = b.input('buyerMinMarginRate', 'End-buyer minimum margin (% of ARV)', input.buyerMinMarginRate ?? 0.1, rate);

  const fee = b.step('Assignment fee', 'Buyer Price − Contract Price', { buyerPrice, contract }, buyerPrice - contract);
  if (fee < 0) b.warn('assignment_negative_fee', 'critical', 'End-buyer price is below the seller contract price.');
  const net = b.step('Wholesaler net', 'Assignment Fee − Wholesaler Costs', { fee, wCosts }, fee - wCosts);
  const allIn = b.step('End-buyer all-in cost', 'Buyer Price + Repairs + Other Costs', { buyerPrice, repairs, buyerOther }, buyerPrice + repairs + buyerOther);
  const profit = b.step('End-buyer projected profit', 'ARV − All-in Cost', { arv, allIn }, arv - allIn);
  const margin = b.step('End-buyer margin', 'Profit ÷ ARV', { profit, arv }, profit / arv);
  const maxFee = b.step(
    'Max supportable assignment fee',
    'ARV − ARV × Min Margin − Repairs − Other Costs − Contract Price',
    { arv, minMargin, repairs, buyerOther, contract },
    arv - arv * minMargin - repairs - buyerOther - contract,
  );
  const viable = margin >= minMargin;
  if (!viable) b.warn('assignment_buyer_margin_thin', 'critical', 'End-buyer margin is below their minimum; the assignment is unlikely to sell at this price.');
  return b.build({
    assignmentFee: roundCurrency(fee),
    wholesalerNet: roundCurrency(net),
    buyerAllIn: roundCurrency(allIn),
    buyerProjectedProfit: roundCurrency(profit),
    buyerMargin: margin,
    maxSupportableFee: roundCurrency(maxFee),
    viableForBuyer: viable,
  });
}
