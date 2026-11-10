/**
 * Fix-and-flip project analysis: total project cost, profit, ROI, and annualized return.
 */
import {
  ResultBuilder,
  nonNegative,
  roundCurrency,
  type CalculationResult,
  type NumericInput,
} from './core.js';
import { annualizeReturn } from './finance.js';

export interface FlipInput {
  purchasePrice: NumericInput;
  repairCosts: NumericInput;
  acquisitionCosts: NumericInput;
  holdingCosts: NumericInput;
  financingCosts: NumericInput;
  dispositionCosts: NumericInput;
  salePrice: NumericInput;
  holdingMonths: NumericInput;
  /** Investor cash in the deal (down payment + unfinanced costs). If omitted, assumes all-cash. */
  cashInvested?: NumericInput;
}

export interface FlipResult {
  totalProjectCost: number;
  netProfit: number;
  /** Net profit ÷ total project cost. */
  returnOnCost: number;
  /** Net profit ÷ cash invested. */
  returnOnCash: number | null;
  annualizedReturnOnCash: number | null;
  profitMarginOnSale: number;
  /** Sale price at which net profit is exactly zero, holding all dollar costs constant. */
  breakEvenSalePrice: number;
}

export function analyzeFlip(input: FlipInput): CalculationResult<FlipResult> {
  const b = new ResultBuilder();
  const price = b.input('purchasePrice', 'Purchase price', input.purchasePrice, { gt: 0 });
  const repairs = b.input('repairCosts', 'Repairs', input.repairCosts, nonNegative);
  const acq = b.input('acquisitionCosts', 'Acquisition closing costs', input.acquisitionCosts, nonNegative);
  const hold = b.input('holdingCosts', 'Holding costs', input.holdingCosts, nonNegative);
  const fin = b.input('financingCosts', 'Financing costs', input.financingCosts, nonNegative);
  const disp = b.input('dispositionCosts', 'Disposition costs', input.dispositionCosts, nonNegative);
  const sale = b.input('salePrice', 'Projected sale price', input.salePrice, { gt: 0 });
  const months = b.input('holdingMonths', 'Holding period (months)', input.holdingMonths, { gt: 0 });

  const totalCost = b.step(
    'Total project cost',
    'Purchase + Repairs + Acquisition + Holding + Financing + Disposition',
    { price, repairs, acq, hold, fin, disp },
    price + repairs + acq + hold + fin + disp,
  );
  const profit = b.step('Net profit', 'Sale Price − Total Project Cost', { sale, totalCost }, sale - totalCost);
  const roc = b.step('Return on cost', 'Net Profit ÷ Total Project Cost', { profit, totalCost }, profit / totalCost);
  const cash =
    input.cashInvested === undefined
      ? b.step('Cash invested (all-cash assumption)', 'Total Project Cost − Disposition (paid from proceeds)', { totalCost, disp }, totalCost - disp)
      : b.input('cashInvested', 'Cash invested', input.cashInvested, nonNegative);
  const rocash = cash > 0 ? b.step('Return on cash', 'Net Profit ÷ Cash Invested', { profit, cash }, profit / cash) : null;
  const annualized = rocash === null ? null : annualizeReturn(rocash, months);
  if (annualized !== null) b.step('Annualized return on cash', '(1 + ROI)^(12 ÷ Months) − 1', { roi: rocash ?? 0, months }, annualized);
  const margin = b.step('Profit margin on sale', 'Net Profit ÷ Sale Price', { profit, sale }, profit / sale);
  const breakEven = b.step('Break-even sale price', 'Total Project Cost', { totalCost }, totalCost);

  if (profit < 0) b.warn('flip_loss', 'critical', 'Projected net profit is negative.');
  else if (margin < 0.1) b.warn('flip_thin_margin', 'caution', 'Profit margin on sale is below 10%; little cushion for overruns or price softening.');
  if (cash === 0) b.warn('flip_no_cash', 'info', 'Cash invested is zero; return on cash is undefined.');

  return b.build({
    totalProjectCost: roundCurrency(totalCost),
    netProfit: roundCurrency(profit),
    returnOnCost: roc,
    returnOnCash: rocash,
    annualizedReturnOnCash: annualized,
    profitMarginOnSale: margin,
    breakEvenSalePrice: roundCurrency(breakEven),
  });
}
