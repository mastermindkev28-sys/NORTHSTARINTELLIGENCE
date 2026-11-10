/**
 * Buy-and-hold rental analysis: NOI, cash flow, cap rate, cash-on-cash, DSCR, and multi-year projections.
 *
 * Definitions follow common US residential/small-multifamily practice:
 *   GPR  (Gross Potential Rent)     = Σ monthly unit rents × 12
 *   EGI  (Effective Gross Income)   = GPR − Vacancy & Credit Loss + Other Income
 *   NOI  (Net Operating Income)     = EGI − Operating Expenses (excludes debt service, capex reserves optional)
 *   Cap Rate                        = NOI ÷ Purchase Price
 *   Cash Flow (pre-tax)             = NOI − Annual Debt Service
 *   Cash-on-Cash                    = Annual Pre-tax Cash Flow ÷ Total Cash Invested
 *   DSCR                            = NOI ÷ Annual Debt Service
 */
import {
  ResultBuilder,
  UnderwritingInputError,
  nonNegative,
  rate,
  roundCurrency,
  type CalculationResult,
  type NumericInput,
} from './core';
import { amortizingPayment, interestOnlyPayment, irr, remainingBalance } from './finance';

export interface OperatingExpenses {
  annualPropertyTax: NumericInput;
  annualInsurance: NumericInput;
  /** Property management fee as a decimal of EGI. */
  managementRate?: NumericInput;
  /** Maintenance/repairs reserve as a decimal of GPR. */
  maintenanceRate?: NumericInput;
  /** Capital expenditure reserve as a decimal of GPR. */
  capexRate?: NumericInput;
  monthlyHoa?: NumericInput;
  monthlyUtilities?: NumericInput;
  annualOther?: NumericInput;
}

export interface LoanTerms {
  /** Loan amount; or provide downPaymentRate. */
  loanAmount?: NumericInput;
  /** Down payment as a decimal of purchase price. */
  downPaymentRate?: NumericInput;
  annualInterestRate: NumericInput;
  termMonths: number;
  interestOnly?: boolean;
  points?: NumericInput;
}

export interface RentalInput {
  purchasePrice: NumericInput;
  /** Monthly rent per unit. */
  monthlyRents: NumericInput[];
  otherMonthlyIncome?: NumericInput;
  vacancyRate: NumericInput;
  expenses: OperatingExpenses;
  /** Omit for an all-cash purchase. */
  loan?: LoanTerms;
  closingCosts?: NumericInput;
  initialRepairs?: NumericInput;
}

export interface RentalResult {
  grossPotentialRent: number;
  vacancyLoss: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  expenseBreakdown: Record<string, number>;
  netOperatingIncome: number;
  loanAmount: number;
  monthlyDebtService: number;
  annualDebtService: number;
  annualCashFlow: number;
  monthlyCashFlow: number;
  totalCashInvested: number;
  capRate: number;
  cashOnCash: number | null;
  /** null for all-cash purchases (no debt service). */
  dscr: number | null;
  grossRentMultiplier: number;
  expenseRatio: number;
  /** (OpEx + Debt Service) ÷ Gross Potential Income. */
  breakEvenOccupancy: number;
  /** Monthly rent ÷ all-in price (the "1% rule" screen). */
  rentToPrice: number;
}

export function analyzeRental(input: RentalInput): CalculationResult<RentalResult> {
  const b = new ResultBuilder();
  const price = b.input('purchasePrice', 'Purchase price', input.purchasePrice, { gt: 0 });
  if (!Array.isArray(input.monthlyRents) || input.monthlyRents.length === 0) {
    throw new UnderwritingInputError('monthlyRents', 'at least one unit rent is required');
  }
  const rents = input.monthlyRents.map((r, i) => b.input(`monthlyRents[${i}]`, `Unit ${i + 1} monthly rent`, r, nonNegative));
  const otherMonthly = b.optional('otherMonthlyIncome', 'Other monthly income', input.otherMonthlyIncome, nonNegative);
  const vacancy = b.input('vacancyRate', 'Vacancy & credit loss', input.vacancyRate, rate);
  const closing = b.optional('closingCosts', 'Acquisition closing costs', input.closingCosts, nonNegative);
  const repairs = b.optional('initialRepairs', 'Initial repairs', input.initialRepairs, nonNegative);

  const monthlyRent = rents.reduce((a, r) => a + r, 0);
  const gpr = b.step('Gross potential rent', 'Σ Unit Rents × 12', { monthlyRent }, monthlyRent * 12);
  const vacancyLoss = b.step('Vacancy & credit loss', 'GPR × Vacancy Rate', { gpr, vacancy }, gpr * vacancy);
  const otherAnnual = otherMonthly * 12;
  const egi = b.step('Effective gross income', 'GPR − Vacancy + Other Income × 12', { gpr, vacancyLoss, otherAnnual }, gpr - vacancyLoss + otherAnnual);

  const e = input.expenses;
  const tax = b.input('annualPropertyTax', 'Annual property tax', e.annualPropertyTax, nonNegative);
  const ins = b.input('annualInsurance', 'Annual insurance', e.annualInsurance, nonNegative);
  const mgmtRate = b.optional('managementRate', 'Management fee (% of EGI)', e.managementRate, rate);
  const maintRate = b.optional('maintenanceRate', 'Maintenance reserve (% of GPR)', e.maintenanceRate, rate);
  const capexRate = b.optional('capexRate', 'CapEx reserve (% of GPR)', e.capexRate, rate);
  const hoa = b.optional('monthlyHoa', 'Monthly HOA', e.monthlyHoa, nonNegative);
  const util = b.optional('monthlyUtilities', 'Monthly owner-paid utilities', e.monthlyUtilities, nonNegative);
  const otherExp = b.optional('annualOtherExpenses', 'Other annual expenses', e.annualOther, nonNegative);
  const breakdown: Record<string, number> = {
    propertyTax: tax,
    insurance: ins,
    management: egi * mgmtRate,
    maintenance: gpr * maintRate,
    capex: gpr * capexRate,
    hoa: hoa * 12,
    utilities: util * 12,
    other: otherExp,
  };
  const opex = b.step(
    'Operating expenses',
    'Tax + Insurance + EGI × Mgmt + GPR × (Maint + CapEx) + (HOA + Utilities) × 12 + Other',
    breakdown,
    Object.values(breakdown).reduce((a, v) => a + v, 0),
  );
  const noi = b.step('Net operating income', 'EGI − Operating Expenses', { egi, opex }, egi - opex);

  let loanAmount = 0;
  let monthlyDs = 0;
  let pointsCost = 0;
  if (input.loan) {
    const l = input.loan;
    if (l.loanAmount !== undefined && l.downPaymentRate !== undefined) {
      throw new UnderwritingInputError('loan', 'provide either loanAmount or downPaymentRate, not both');
    }
    if (l.loanAmount !== undefined) {
      loanAmount = b.input('loanAmount', 'Loan amount', l.loanAmount, nonNegative);
    } else {
      const dp = b.input('downPaymentRate', 'Down payment (% of price)', l.downPaymentRate, rate);
      loanAmount = b.step('Loan amount', 'Price × (1 − Down Payment %)', { price, dp }, price * (1 - dp));
    }
    const r = b.input('annualInterestRate', 'Annual interest rate', l.annualInterestRate, rate);
    const pts = b.optional('points', 'Loan points', l.points, rate);
    pointsCost = loanAmount * pts;
    if (l.interestOnly) {
      monthlyDs = b.step('Monthly debt service (interest-only)', 'Loan × Rate ÷ 12', { loanAmount, r }, interestOnlyPayment(loanAmount, r));
    } else {
      monthlyDs = b.step('Monthly debt service', 'L × r ÷ (1 − (1 + r)^−n)', { loanAmount, r, termMonths: l.termMonths }, amortizingPayment(loanAmount, r, l.termMonths));
    }
  }
  const annualDs = b.step('Annual debt service', 'Monthly Debt Service × 12', { monthlyDs }, monthlyDs * 12);
  const cashFlow = b.step('Annual pre-tax cash flow', 'NOI − Annual Debt Service', { noi, annualDs }, noi - annualDs);
  const cashInvested = b.step(
    'Total cash invested',
    'Price − Loan + Closing Costs + Points + Initial Repairs',
    { price, loanAmount, closing, pointsCost, repairs },
    price - loanAmount + closing + pointsCost + repairs,
  );
  const capRate = b.step('Cap rate', 'NOI ÷ Purchase Price', { noi, price }, noi / price);
  const coc = cashInvested > 0 ? b.step('Cash-on-cash return', 'Annual Cash Flow ÷ Cash Invested', { cashFlow, cashInvested }, cashFlow / cashInvested) : null;
  const dscr = annualDs > 0 ? b.step('Debt service coverage ratio', 'NOI ÷ Annual Debt Service', { noi, annualDs }, noi / annualDs) : null;
  const gpi = gpr + otherAnnual;
  const grm = gpr > 0 ? price / gpr : 0;
  b.step('Gross rent multiplier', 'Price ÷ GPR', { price, gpr }, grm);
  const expenseRatio = egi > 0 ? opex / egi : 0;
  const breakEvenOcc = gpi > 0 ? b.step('Break-even occupancy', '(OpEx + Debt Service) ÷ Gross Potential Income', { opex, annualDs, gpi }, (opex + annualDs) / gpi) : 1;
  const rentToPrice = monthlyRent / (price + repairs);

  if (dscr !== null && dscr < 1) b.warn('rental_dscr_below_1', 'critical', `DSCR ${dscr.toFixed(2)} < 1.00: NOI does not cover debt service.`);
  else if (dscr !== null && dscr < 1.25) b.warn('rental_dscr_below_lender', 'caution', `DSCR ${dscr.toFixed(2)} is below the 1.25 many lenders require.`);
  if (cashFlow < 0) b.warn('rental_negative_cash_flow', 'critical', 'Annual pre-tax cash flow is negative.');
  if (vacancy === 0) b.warn('rental_zero_vacancy', 'caution', 'Vacancy is 0%; most markets warrant a non-zero vacancy assumption.');
  if (maintRate === 0 && capexRate === 0) b.warn('rental_no_reserves', 'caution', 'No maintenance or CapEx reserve is included.');
  if (mgmtRate === 0) b.warn('rental_self_managed', 'info', 'No management fee: assumes owner self-management.');

  for (const k of Object.keys(breakdown)) breakdown[k] = roundCurrency(breakdown[k]!);
  return b.build({
    grossPotentialRent: roundCurrency(gpr),
    vacancyLoss: roundCurrency(vacancyLoss),
    effectiveGrossIncome: roundCurrency(egi),
    operatingExpenses: roundCurrency(opex),
    expenseBreakdown: breakdown,
    netOperatingIncome: roundCurrency(noi),
    loanAmount: roundCurrency(loanAmount),
    monthlyDebtService: roundCurrency(monthlyDs),
    annualDebtService: roundCurrency(annualDs),
    annualCashFlow: roundCurrency(cashFlow),
    monthlyCashFlow: roundCurrency(cashFlow / 12),
    totalCashInvested: roundCurrency(cashInvested),
    capRate,
    cashOnCash: coc,
    dscr,
    grossRentMultiplier: grm,
    expenseRatio,
    breakEvenOccupancy: breakEvenOcc,
    rentToPrice,
  });
}

// ---------------------------------------------------------------------------------------------
// Multi-year projection
// ---------------------------------------------------------------------------------------------

export interface ProjectionInput {
  rental: RentalInput;
  years: number;
  annualRentGrowth: NumericInput;
  annualExpenseGrowth: NumericInput;
  annualAppreciation: NumericInput;
  /** Selling costs at exit as a decimal of sale value, used for IRR. Default 0.08. */
  exitCostRate?: NumericInput;
}

export interface ProjectionYear {
  year: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  debtService: number;
  cashFlow: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
  cumulativeCashFlow: number;
}

export interface ProjectionResult {
  years: ProjectionYear[];
  totalCashFlow: number;
  netSaleProceeds: number;
  /** IRR of [−cash invested, CF1, …, CFn + net sale proceeds]; null when undefined. */
  irr: number | null;
  equityMultiple: number | null;
}

export function projectRental(input: ProjectionInput): CalculationResult<ProjectionResult> {
  const b = new ResultBuilder();
  const base = b.absorb(analyzeRental(input.rental), 'Year 1');
  const years = b.input('projectionYears', 'Projection horizon (years)', input.years, { gt: 0, max: 40, integer: true });
  const rg = b.input('annualRentGrowth', 'Annual rent growth', input.annualRentGrowth, { min: -0.5, max: 0.5 });
  const eg = b.input('annualExpenseGrowth', 'Annual expense growth', input.annualExpenseGrowth, { min: -0.5, max: 0.5 });
  const ap = b.input('annualAppreciation', 'Annual appreciation', input.annualAppreciation, { min: -0.5, max: 0.5 });
  const exitRate = b.input('exitCostRate', 'Exit selling costs', input.exitCostRate ?? 0.08, rate);
  const price = typeof input.rental.purchasePrice === 'number' ? input.rental.purchasePrice : input.rental.purchasePrice.value;
  const loan = input.rental.loan;
  const rateV = loan ? (typeof loan.annualInterestRate === 'number' ? loan.annualInterestRate : loan.annualInterestRate.value) : 0;

  // Year-1 figures are taken at cent precision; growth is applied from there.
  const egi1 = base.effectiveGrossIncome;
  const opex1 = base.operatingExpenses;
  const ds = base.annualDebtService;
  const rows: ProjectionYear[] = [];
  let cumulative = 0;
  for (let y = 1; y <= years; y++) {
    const egi = egi1 * Math.pow(1 + rg, y - 1);
    const opex = opex1 * Math.pow(1 + eg, y - 1);
    const noi = egi - opex;
    const cf = noi - ds;
    cumulative += cf;
    const value = price * Math.pow(1 + ap, y);
    const balance = !loan
      ? 0
      : loan.interestOnly
        ? base.loanAmount
        : remainingBalance(base.loanAmount, rateV, loan.termMonths, Math.min(y * 12, loan.termMonths));
    rows.push({
      year: y,
      effectiveGrossIncome: roundCurrency(egi),
      operatingExpenses: roundCurrency(opex),
      netOperatingIncome: roundCurrency(noi),
      debtService: roundCurrency(ds),
      cashFlow: roundCurrency(cf),
      propertyValue: roundCurrency(value),
      loanBalance: roundCurrency(balance),
      equity: roundCurrency(value - balance),
      cumulativeCashFlow: roundCurrency(cumulative),
    });
  }
  const last = rows[rows.length - 1]!;
  // Rounded to cents so the IRR can be reproduced exactly from the reported figures.
  const netSale = roundCurrency(b.step(
    'Net sale proceeds at exit',
    'Value × (1 − Exit Cost Rate) − Loan Balance',
    { value: last.propertyValue, exitRate, balance: last.loanBalance },
    last.propertyValue * (1 - exitRate) - last.loanBalance,
  ));
  const flows = [-base.totalCashInvested, ...rows.map((r) => r.cashFlow)];
  flows[flows.length - 1] = (flows[flows.length - 1] ?? 0) + netSale;
  const irrV = base.totalCashInvested > 0 ? irr(flows) : null;
  if (irrV !== null) b.step('IRR', 'Rate where NPV(cash flows) = 0', { periods: flows.length }, irrV);
  const totalCf = rows.reduce((a, r) => a + r.cashFlow, 0);
  const em = base.totalCashInvested > 0 ? (totalCf + netSale) / base.totalCashInvested : null;
  if (em !== null) b.step('Equity multiple', '(Σ Cash Flow + Net Sale) ÷ Cash Invested', { totalCf, netSale }, em);
  b.warn('projection_assumptions', 'info', 'Projections extrapolate constant growth assumptions and are not forecasts.');
  return b.build({ years: rows, totalCashFlow: roundCurrency(totalCf), netSaleProceeds: roundCurrency(netSale), irr: irrV, equityMultiple: em });
}
