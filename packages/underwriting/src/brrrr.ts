/**
 * BRRRR (Buy, Rehab, Rent, Refinance, Repeat) analysis.
 *
 *   Total project cost      = Purchase + Rehab + Acquisition Closing + Holding + Acquisition Financing Costs
 *   Cash in before refi     = Total Project Cost − Acquisition Loan
 *   Refinance loan          = Appraised Value (ARV) × Refinance LTV
 *   Cash out at refinance   = Refinance Loan − Refinance Closing Costs − Acquisition Loan Payoff
 *   Cash left in deal       = Cash In Before Refi − Cash Out At Refinance   (≤ 0 means all capital recovered)
 *   Capital recovered       = Cash Out At Refinance ÷ Cash In Before Refi
 *   Post-refi cash flow     = Stabilized NOI − Refinance Debt Service
 *
 * The acquisition loan is assumed to be repaid in full from refinance proceeds (interest-only bridge or
 * hard-money financing, which is the usual structure). Interest paid during the hold belongs in
 * `holdingCosts` or `acquisitionFinancingCosts`.
 */
import { ResultBuilder, nonNegative, rate, roundCurrency, toSourced, type CalculationResult, type NumericInput } from './core';
import { analyzeRental, type OperatingExpenses } from './rental';

export interface BrrrrInput {
  purchasePrice: NumericInput;
  rehabCost: NumericInput;
  acquisitionClosingCosts?: NumericInput;
  /** Taxes, insurance, utilities, and interest during rehab and lease-up. */
  holdingCosts?: NumericInput;
  /** Points and fees on the acquisition loan. */
  acquisitionFinancingCosts?: NumericInput;
  /** Principal of the acquisition (bridge/hard-money) loan; omit for an all-cash purchase. */
  acquisitionLoan?: NumericInput;
  /** Appraised after-repair value used by the refinance lender. */
  afterRepairValue: NumericInput;
  refinanceLtv: NumericInput;
  refinanceRate: NumericInput;
  refinanceTermMonths: number;
  refinanceClosingCosts?: NumericInput;
  /** Months from acquisition to refinance; lenders commonly require 6 to 12 months of seasoning. */
  monthsToRefinance?: number;
  monthlyRents: NumericInput[];
  otherMonthlyIncome?: NumericInput;
  vacancyRate: NumericInput;
  expenses: OperatingExpenses;
}

export interface BrrrrResult {
  totalProjectCost: number;
  cashInvestedBeforeRefinance: number;
  refinanceLoan: number;
  cashOutAtRefinance: number;
  cashLeftInDeal: number;
  /** Share of pre-refinance cash returned at refinance; null when no cash was invested. */
  capitalRecoveredRate: number | null;
  equityAfterRefinance: number;
  netOperatingIncome: number;
  monthlyDebtService: number;
  annualCashFlow: number;
  monthlyCashFlow: number;
  dscr: number | null;
  /** Cap rate on appraised value. */
  capRateOnValue: number;
  /** Return on all-in cost (NOI ÷ total project cost). */
  yieldOnCost: number;
  /** Annual cash flow ÷ cash left in deal; null when no cash remains (return is unbounded). */
  cashOnCash: number | null;
}

export function analyzeBrrrr(input: BrrrrInput): CalculationResult<BrrrrResult> {
  const b = new ResultBuilder();
  const price = b.input('purchasePrice', 'Purchase price', input.purchasePrice, { gt: 0 });
  const rehab = b.input('rehabCost', 'Rehab cost', input.rehabCost, nonNegative);
  const acqClosing = b.optional('acquisitionClosingCosts', 'Acquisition closing costs', input.acquisitionClosingCosts, nonNegative);
  const holding = b.optional('holdingCosts', 'Holding costs to refinance', input.holdingCosts, nonNegative);
  const acqFin = b.optional('acquisitionFinancingCosts', 'Acquisition financing costs', input.acquisitionFinancingCosts, nonNegative);
  const acqLoan = b.optional('acquisitionLoan', 'Acquisition loan', input.acquisitionLoan, nonNegative);
  const arv = b.input('afterRepairValue', 'Appraised after-repair value', input.afterRepairValue, { gt: 0 });
  const ltv = b.input('refinanceLtv', 'Refinance loan-to-value', input.refinanceLtv, rate);
  const refiClosing = b.optional('refinanceClosingCosts', 'Refinance closing costs', input.refinanceClosingCosts, nonNegative);
  b.input('refinanceTermMonths', 'Refinance term (months)', input.refinanceTermMonths, { gt: 0, integer: true });

  const totalCost = b.step(
    'Total project cost',
    'Purchase + Rehab + Acquisition Closing + Holding + Acquisition Financing',
    { price, rehab, acqClosing, holding, acqFin },
    price + rehab + acqClosing + holding + acqFin,
  );
  const cashIn = b.step('Cash invested before refinance', 'Total Project Cost − Acquisition Loan', { totalCost, acqLoan }, totalCost - acqLoan);
  const refiLoan = b.step('Refinance loan', 'ARV × Refinance LTV', { arv, ltv }, arv * ltv);
  const cashOut = b.step(
    'Cash out at refinance',
    'Refinance Loan − Refinance Closing − Acquisition Loan Payoff',
    { refiLoan, refiClosing, acqLoan },
    refiLoan - refiClosing - acqLoan,
  );
  const cashLeft = b.step('Cash left in deal', 'Cash In Before Refi − Cash Out', { cashIn, cashOut }, cashIn - cashOut);
  const recovered = cashIn > 0 ? b.step('Capital recovered', 'Cash Out ÷ Cash In Before Refi', { cashOut, cashIn }, cashOut / cashIn) : null;
  const equity = b.step('Equity after refinance', 'ARV − Refinance Loan', { arv, refiLoan }, arv - refiLoan);

  // Stabilized operations on the refinanced loan. Purchase price for the rental sub-analysis is the
  // appraised value so its cap rate is value-based; its cash-invested figure is not used here.
  b.derived('purchasePrice', 'loanAmount');
  const ops = b.absorb(
    analyzeRental({
      purchasePrice: arv,
      monthlyRents: input.monthlyRents,
      otherMonthlyIncome: input.otherMonthlyIncome,
      vacancyRate: input.vacancyRate,
      expenses: input.expenses,
      loan: { loanAmount: refiLoan, annualInterestRate: input.refinanceRate, termMonths: input.refinanceTermMonths },
    }),
    'Stabilized',
  );
  const noi = ops.netOperatingIncome;
  const yieldOnCost = b.step('Yield on cost', 'NOI ÷ Total Project Cost', { noi, totalCost }, noi / totalCost);
  const coc = cashLeft > 0 ? b.step('Cash-on-cash on cash left in deal', 'Annual Cash Flow ÷ Cash Left In Deal', { cashFlow: ops.annualCashFlow, cashLeft }, ops.annualCashFlow / cashLeft) : null;

  if (cashOut < 0) {
    b.warn('brrrr_refi_short', 'critical', `Refinance proceeds fall ${roundCurrency(-cashOut).toLocaleString('en-US')} short of paying off the acquisition loan and refinance costs; more cash is required at refinance.`);
  }
  if (cashLeft <= 0) b.warn('brrrr_all_capital_recovered', 'info', 'All invested capital is recovered at refinance; cash-on-cash is unbounded and not reported.');
  if (ltv > 0.8) b.warn('brrrr_high_ltv', 'caution', `Refinance LTV of ${(ltv * 100).toFixed(0)}% exceeds the 75–80% most cash-out lenders allow on investment property.`);
  if (toSourced(input.afterRepairValue).source !== 'verified') {
    b.warn('brrrr_arv_unverified', 'caution', 'The after-repair value is not from an appraisal. Refinance proceeds depend on the lender\'s appraisal, which may be lower.');
  }
  const months = input.monthsToRefinance;
  if (months !== undefined) {
    b.input('monthsToRefinance', 'Months to refinance', months, { min: 0, integer: true });
    if (months < 6) b.warn('brrrr_seasoning', 'caution', `Refinance at ${months} months: many lenders require 6–12 months of seasoning or cap the loan at purchase price plus documented rehab.`);
  } else {
    b.warn('brrrr_seasoning_unknown', 'info', 'Confirm the lender\'s seasoning rules; some cap cash-out at purchase price plus documented rehab until 6–12 months after acquisition.');
  }
  if (arv < totalCost) b.warn('brrrr_value_below_cost', 'critical', 'Appraised value is below total project cost: the project destroys equity.');

  return b.build({
    totalProjectCost: roundCurrency(totalCost),
    cashInvestedBeforeRefinance: roundCurrency(cashIn),
    refinanceLoan: roundCurrency(refiLoan),
    cashOutAtRefinance: roundCurrency(cashOut),
    cashLeftInDeal: roundCurrency(cashLeft),
    capitalRecoveredRate: recovered,
    equityAfterRefinance: roundCurrency(equity),
    netOperatingIncome: noi,
    monthlyDebtService: ops.monthlyDebtService,
    annualCashFlow: ops.annualCashFlow,
    monthlyCashFlow: ops.monthlyCashFlow,
    dscr: ops.dscr,
    capRateOnValue: ops.capRate,
    yieldOnCost,
    cashOnCash: coc,
  });
}
