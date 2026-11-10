/**
 * Cost calculators: renovation, acquisition/closing, holding, financing, and disposition.
 * Returned money values are rounded to cents; full-precision values are preserved in the trace.
 */
import {
  ResultBuilder,
  UnderwritingInputError,
  nonNegative,
  rate,
  requireNumber,
  roundCurrency,
  type CalculationResult,
  type NumericInput,
} from './core';
import { amortizingPayment, interestOnlyPayment } from './finance';

// ---------------------------------------------------------------------------------------------
// Renovation
// ---------------------------------------------------------------------------------------------

export interface RenovationLineItem {
  category: string;
  description?: string;
  quantity: NumericInput;
  unitCost: NumericInput;
}

export interface RenovationInput {
  lineItems: RenovationLineItem[];
  /** Contingency as a decimal of the subtotal. Default 0.10. */
  contingencyRate?: NumericInput;
  /** Optional subject sqft so a cost/sqft figure can be reported. */
  squareFeet?: NumericInput;
}

export interface RenovationResult {
  subtotal: number;
  contingency: number;
  total: number;
  costPerSqft: number | null;
  byCategory: Record<string, number>;
  lines: { category: string; description?: string; quantity: number; unitCost: number; extended: number }[];
}

export function estimateRenovation(input: RenovationInput): CalculationResult<RenovationResult> {
  const b = new ResultBuilder();
  if (!Array.isArray(input.lineItems)) {
    throw new UnderwritingInputError('lineItems', 'must be an array');
  }
  const contingencyRate = b.input('contingencyRate', 'Renovation contingency', input.contingencyRate ?? 0.1, rate);
  const byCategory: Record<string, number> = {};
  const lines = input.lineItems.map((li, i) => {
    if (!li.category) throw new UnderwritingInputError(`lineItems[${i}].category`, 'is required');
    const qty = requireNumber(`lineItems[${i}].quantity`, li.quantity, nonNegative);
    const unit = requireNumber(`lineItems[${i}].unitCost`, li.unitCost, nonNegative);
    const extended = qty * unit;
    byCategory[li.category] = (byCategory[li.category] ?? 0) + extended;
    const line: RenovationResult['lines'][number] = { category: li.category, quantity: qty, unitCost: unit, extended };
    if (li.description !== undefined) line.description = li.description;
    return line;
  });
  const subtotal = b.step('Renovation subtotal', 'Σ(Quantity × Unit Cost)', { lineItems: lines.length }, lines.reduce((a, l) => a + l.extended, 0));
  const contingency = b.step('Contingency', 'Subtotal × Contingency Rate', { subtotal, contingencyRate }, subtotal * contingencyRate);
  const total = b.step('Renovation total', 'Subtotal + Contingency', { subtotal, contingency }, subtotal + contingency);
  let costPerSqft: number | null = null;
  if (input.squareFeet !== undefined) {
    const sqft = b.input('squareFeet', 'Subject living area (sqft)', input.squareFeet, { gt: 0 });
    costPerSqft = b.step('Renovation cost per sqft', 'Total ÷ Sqft', { total, sqft }, total / sqft);
  }
  if (lines.length === 0) b.warn('renovation_empty', 'info', 'No renovation line items were provided; total is $0.');
  if (contingencyRate < 0.05 && lines.length > 0) {
    b.warn('renovation_low_contingency', 'caution', 'Contingency below 5% leaves little margin for unknown conditions.');
  }
  for (const k of Object.keys(byCategory)) byCategory[k] = roundCurrency(byCategory[k]!);
  return b.build({
    subtotal: roundCurrency(subtotal),
    contingency: roundCurrency(contingency),
    total: roundCurrency(total),
    costPerSqft: costPerSqft === null ? null : roundCurrency(costPerSqft),
    byCategory,
    lines,
  });
}

// ---------------------------------------------------------------------------------------------
// Closing / acquisition costs
// ---------------------------------------------------------------------------------------------

export interface ClosingCostInput {
  /** Price the percentage-based costs apply to (purchase price on acquisition, sale price on disposition). */
  basePrice: NumericInput;
  /** Percentage-based costs, decimals of basePrice (e.g. { titleInsurance: 0.005, transferTax: 0.01 }). */
  percentageCosts?: Record<string, NumericInput>;
  /** Flat-dollar costs (e.g. { escrowFee: 650, recording: 125 }). */
  fixedCosts?: Record<string, NumericInput>;
}

export interface ClosingCostResult {
  percentageTotal: number;
  fixedTotal: number;
  total: number;
  /** Total as a decimal of basePrice. */
  effectiveRate: number;
  items: Record<string, number>;
}

export function calculateClosingCosts(input: ClosingCostInput, label = 'Closing costs'): CalculationResult<ClosingCostResult> {
  const b = new ResultBuilder();
  const base = b.input('basePrice', `${label}: base price`, input.basePrice, nonNegative);
  const items: Record<string, number> = {};
  let pct = 0;
  for (const [k, v] of Object.entries(input.percentageCosts ?? {})) {
    const r = b.input(`${label}.${k}`, `${label}: ${k} (rate)`, v, rate);
    items[k] = base * r;
    pct += base * r;
  }
  let fixed = 0;
  for (const [k, v] of Object.entries(input.fixedCosts ?? {})) {
    const amt = b.input(`${label}.${k}`, `${label}: ${k}`, v, nonNegative);
    items[k] = (items[k] ?? 0) + amt;
    fixed += amt;
  }
  b.step(`${label}: percentage-based`, 'Σ(Base Price × Rate)', { basePrice: base }, pct);
  b.step(`${label}: fixed`, 'Σ Fixed Fees', {}, fixed);
  const total = b.step(`${label}: total`, 'Percentage-based + Fixed', { pct, fixed }, pct + fixed);
  for (const k of Object.keys(items)) items[k] = roundCurrency(items[k]!);
  return b.build({
    percentageTotal: roundCurrency(pct),
    fixedTotal: roundCurrency(fixed),
    total: roundCurrency(total),
    effectiveRate: base === 0 ? 0 : total / base,
    items,
  });
}

// ---------------------------------------------------------------------------------------------
// Holding costs
// ---------------------------------------------------------------------------------------------

export interface HoldingCostInput {
  holdingMonths: NumericInput;
  annualPropertyTax: NumericInput;
  annualInsurance: NumericInput;
  monthlyUtilities?: NumericInput;
  monthlyHoa?: NumericInput;
  monthlyMaintenance?: NumericInput;
  monthlyOther?: NumericInput;
}

export interface HoldingCostResult {
  monthlyTotal: number;
  total: number;
  months: number;
}

export function calculateHoldingCosts(input: HoldingCostInput): CalculationResult<HoldingCostResult> {
  const b = new ResultBuilder();
  const months = b.input('holdingMonths', 'Holding period (months)', input.holdingMonths, nonNegative);
  const tax = b.input('annualPropertyTax', 'Annual property tax', input.annualPropertyTax, nonNegative);
  const ins = b.input('annualInsurance', 'Annual insurance', input.annualInsurance, nonNegative);
  const util = b.optional('monthlyUtilities', 'Monthly utilities', input.monthlyUtilities, nonNegative);
  const hoa = b.optional('monthlyHoa', 'Monthly HOA', input.monthlyHoa, nonNegative);
  const maint = b.optional('monthlyMaintenance', 'Monthly maintenance', input.monthlyMaintenance, nonNegative);
  const other = b.optional('monthlyOther', 'Other monthly holding costs', input.monthlyOther, nonNegative);
  const monthly = b.step(
    'Monthly holding cost',
    'Tax ÷ 12 + Insurance ÷ 12 + Utilities + HOA + Maintenance + Other',
    { tax, ins, util, hoa, maint, other },
    tax / 12 + ins / 12 + util + hoa + maint + other,
  );
  const total = b.step('Total holding cost', 'Monthly Holding Cost × Months', { monthly, months }, monthly * months);
  return b.build({ monthlyTotal: roundCurrency(monthly), total: roundCurrency(total), months });
}

// ---------------------------------------------------------------------------------------------
// Financing costs (short-term / acquisition financing)
// ---------------------------------------------------------------------------------------------

export interface FinancingInput {
  purchasePrice: NumericInput;
  /** Loan-to-purchase ratio (decimal). Mutually exclusive with loanAmount. */
  loanToValue?: NumericInput;
  loanAmount?: NumericInput;
  /** Portion of renovation financed by the lender (added to the loan), default 0. */
  financedRehab?: NumericInput;
  annualInterestRate: NumericInput;
  /** Origination points as a decimal of loan amount (2 points = 0.02). */
  points?: NumericInput;
  lenderFees?: NumericInput;
  holdingMonths: NumericInput;
  /** 'interest_only' (typical hard money) or 'amortizing'. */
  paymentType?: 'interest_only' | 'amortizing';
  /** Required for amortizing loans. */
  termMonths?: number;
}

export interface FinancingResult {
  loanAmount: number;
  downPayment: number;
  pointsCost: number;
  lenderFees: number;
  monthlyPayment: number;
  interestPaid: number;
  /** Points + fees + interest over the holding period. */
  totalFinancingCost: number;
}

export function calculateFinancingCosts(input: FinancingInput): CalculationResult<FinancingResult> {
  const b = new ResultBuilder();
  const price = b.input('purchasePrice', 'Purchase price', input.purchasePrice, nonNegative);
  if (input.loanAmount !== undefined && input.loanToValue !== undefined) {
    throw new UnderwritingInputError('loanAmount', 'provide either loanAmount or loanToValue, not both');
  }
  let baseLoan: number;
  if (input.loanAmount !== undefined) {
    baseLoan = b.input('loanAmount', 'Loan amount', input.loanAmount, nonNegative);
  } else {
    const ltv = b.input('loanToValue', 'Loan-to-purchase ratio', input.loanToValue ?? 0, rate);
    baseLoan = b.step('Base loan', 'Purchase Price × LTV', { price, ltv }, price * ltv);
  }
  if (baseLoan > price) {
    b.warn('financing_loan_exceeds_price', 'caution', 'Acquisition loan exceeds purchase price.');
  }
  const rehab = b.optional('financedRehab', 'Financed renovation', input.financedRehab, nonNegative);
  const loan = b.step('Total loan', 'Base Loan + Financed Rehab', { baseLoan, rehab }, baseLoan + rehab);
  const rateV = b.input('annualInterestRate', 'Annual interest rate', input.annualInterestRate, rate);
  const pointsRate = b.optional('points', 'Origination points', input.points, rate);
  const fees = b.optional('lenderFees', 'Lender fees', input.lenderFees, nonNegative);
  const months = b.input('holdingMonths', 'Holding period (months)', input.holdingMonths, nonNegative);
  const type = input.paymentType ?? 'interest_only';

  const down = b.step('Down payment', 'Purchase Price − Base Loan', { price, baseLoan }, Math.max(0, price - baseLoan));
  const pointsCost = b.step('Points cost', 'Total Loan × Points', { loan, pointsRate }, loan * pointsRate);

  let monthly: number;
  let interest: number;
  if (type === 'interest_only') {
    monthly = b.step('Monthly payment (interest-only)', 'Loan × Rate ÷ 12', { loan, rate: rateV }, interestOnlyPayment(loan, rateV));
    interest = b.step('Interest over hold', 'Monthly Payment × Months', { monthly, months }, monthly * months);
  } else {
    const term = requireNumber('termMonths', input.termMonths, { gt: 0, integer: true });
    monthly = b.step(
      'Monthly payment (amortizing)',
      'L × r ÷ (1 − (1 + r)^−n)',
      { loan, rate: rateV, termMonths: term },
      amortizingPayment(loan, rateV, term),
    );
    // Interest portion only: sum interest over the hold period.
    const r = rateV / 12;
    let bal = loan;
    let int = 0;
    const whole = Math.floor(months);
    for (let m = 0; m < Math.min(whole, term); m++) {
      const i = bal * r;
      int += i;
      bal -= monthly - i;
    }
    interest = b.step('Interest over hold', 'Σ monthly interest on declining balance', { months: whole }, int);
  }
  const total = b.step('Total financing cost', 'Points + Lender Fees + Interest', { pointsCost, fees, interest }, pointsCost + fees + interest);
  return b.build({
    loanAmount: roundCurrency(loan),
    downPayment: roundCurrency(down),
    pointsCost: roundCurrency(pointsCost),
    lenderFees: roundCurrency(fees),
    monthlyPayment: roundCurrency(monthly),
    interestPaid: roundCurrency(interest),
    totalFinancingCost: roundCurrency(total),
  });
}

// ---------------------------------------------------------------------------------------------
// Disposition (selling) costs
// ---------------------------------------------------------------------------------------------

export interface DispositionInput {
  salePrice: NumericInput;
  /** Total agent commission as a decimal of sale price. */
  commissionRate?: NumericInput;
  /** Seller-side closing costs as a decimal of sale price (title, transfer tax, etc.). */
  sellerClosingRate?: NumericInput;
  sellerConcessions?: NumericInput;
  otherFixed?: NumericInput;
}

export interface DispositionResult {
  commission: number;
  sellerClosing: number;
  concessions: number;
  other: number;
  total: number;
  netProceeds: number;
}

export function calculateDispositionCosts(input: DispositionInput): CalculationResult<DispositionResult> {
  const b = new ResultBuilder();
  const price = b.input('salePrice', 'Projected sale price', input.salePrice, nonNegative);
  const comm = b.optional('commissionRate', 'Agent commission rate', input.commissionRate, rate);
  const closing = b.optional('sellerClosingRate', 'Seller closing cost rate', input.sellerClosingRate, rate);
  const conc = b.optional('sellerConcessions', 'Seller concessions', input.sellerConcessions, nonNegative);
  const other = b.optional('dispositionOther', 'Other disposition costs', input.otherFixed, nonNegative);
  const commission = b.step('Commission', 'Sale Price × Commission Rate', { price, comm }, price * comm);
  const sellerClosing = b.step('Seller closing costs', 'Sale Price × Seller Closing Rate', { price, closing }, price * closing);
  const total = b.step('Total disposition cost', 'Commission + Seller Closing + Concessions + Other', { commission, sellerClosing, conc, other }, commission + sellerClosing + conc + other);
  const net = b.step('Net sale proceeds (before loan payoff)', 'Sale Price − Disposition Costs', { price, total }, price - total);
  return b.build({
    commission: roundCurrency(commission),
    sellerClosing: roundCurrency(sellerClosing),
    concessions: roundCurrency(conc),
    other: roundCurrency(other),
    total: roundCurrency(total),
    netProceeds: roundCurrency(net),
  });
}
