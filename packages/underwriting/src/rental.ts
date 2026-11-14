import { interestOnlyPayment, monthlyPayment } from "./finance";
import { CalculationInputError, Trace, requireNonNegative, requirePositiveInt, requireRate } from "./trace";

export interface RentalFinancing {
  /** Provide either loanAmount or downPaymentRate (decimal of purchase price). */
  loanAmount?: number;
  downPaymentRate?: number;
  annualRate: number;
  termMonths: number;
  interestOnly?: boolean;
  points?: number;
  lenderFees?: number;
}

export interface RentalInputs {
  purchasePrice: number;
  closingCosts?: number;
  /** Up-front rehab paid in cash. */
  rehabCost?: number;
  /** Value used for cap rate on value (defaults to purchase price + rehab). */
  marketValue?: number;
  monthlyRent: number;
  otherMonthlyIncome?: number;
  vacancyRate: number;
  annualPropertyTax: number;
  annualInsurance: number;
  monthlyHoa?: number;
  monthlyUtilities?: number;
  /** Property management fee as a decimal of effective gross income. */
  managementRate?: number;
  /** Repairs & maintenance reserve as a decimal of effective gross income. */
  maintenanceRate?: number;
  /** Capital expenditure reserve as a decimal of gross scheduled income. */
  capexRate?: number;
  otherAnnualExpenses?: number;
  financing?: RentalFinancing;
}

export interface OperatingExpenses {
  propertyTax: number;
  insurance: number;
  hoa: number;
  utilities: number;
  management: number;
  maintenance: number;
  capex: number;
  other: number;
  total: number;
}

export interface RentalResult {
  grossScheduledIncome: number;
  vacancyLoss: number;
  effectiveGrossIncome: number;
  operatingExpenses: OperatingExpenses;
  netOperatingIncome: number;
  loanAmount: number;
  annualDebtService: number;
  annualCashFlow: number;
  monthlyCashFlow: number;
  totalCashInvested: number;
  /** NOI ÷ purchase price. */
  capRate: number;
  /** NOI ÷ (purchase price + rehab + closing). */
  yieldOnCost: number;
  capRateOnValue: number;
  /** Annual pre-tax cash flow ÷ total cash invested. Null when no cash is invested. */
  cashOnCash: number | null;
  /** NOI ÷ annual debt service. Null when unlevered. */
  dscr: number | null;
  grossRentMultiplier: number;
  /** (OpEx + debt service) ÷ GSI. */
  breakEvenOccupancy: number;
  operatingExpenseRatio: number;
  /** Monthly rent ÷ (purchase price + rehab). */
  rentToCostRatio: number;
  warnings: string[];
  trace: Trace;
}

export function annualDebtServiceFor(loanAmount: number, f: RentalFinancing): number {
  if (loanAmount === 0) return 0;
  return 12 * (f.interestOnly ? interestOnlyPayment(loanAmount, f.annualRate) : monthlyPayment(loanAmount, f.annualRate, f.termMonths));
}

export function resolveLoanAmount(purchasePrice: number, f: RentalFinancing | undefined): number {
  if (!f) return 0;
  requireRate("financing.annualRate", f.annualRate);
  requirePositiveInt("financing.termMonths", f.termMonths);
  if (f.loanAmount !== undefined) {
    requireNonNegative("financing.loanAmount", f.loanAmount);
    return f.loanAmount;
  }
  if (f.downPaymentRate === undefined) throw new CalculationInputError("financing requires loanAmount or downPaymentRate");
  requireRate("financing.downPaymentRate", f.downPaymentRate);
  return purchasePrice * (1 - f.downPaymentRate);
}

export function computeOperatingExpenses(i: RentalInputs, gsi: number, egi: number): OperatingExpenses {
  const e = {
    propertyTax: i.annualPropertyTax,
    insurance: i.annualInsurance,
    hoa: (i.monthlyHoa ?? 0) * 12,
    utilities: (i.monthlyUtilities ?? 0) * 12,
    management: egi * (i.managementRate ?? 0),
    maintenance: egi * (i.maintenanceRate ?? 0),
    capex: gsi * (i.capexRate ?? 0),
    other: i.otherAnnualExpenses ?? 0,
  };
  return { ...e, total: Object.values(e).reduce((a, b) => a + b, 0) };
}

export function validateRentalInputs(i: RentalInputs): void {
  requireNonNegative("purchasePrice", i.purchasePrice);
  if (i.purchasePrice === 0) throw new CalculationInputError("purchasePrice must be > 0");
  requireNonNegative("monthlyRent", i.monthlyRent);
  requireRate("vacancyRate", i.vacancyRate);
  requireNonNegative("annualPropertyTax", i.annualPropertyTax);
  requireNonNegative("annualInsurance", i.annualInsurance);
  for (const k of ["closingCosts", "rehabCost", "otherMonthlyIncome", "monthlyHoa", "monthlyUtilities", "otherAnnualExpenses", "marketValue"] as const) {
    const v = i[k];
    if (v !== undefined) requireNonNegative(k, v);
  }
  for (const k of ["managementRate", "maintenanceRate", "capexRate"] as const) {
    const v = i[k];
    if (v !== undefined) requireRate(k, v, { max: 0.5 });
  }
}

/** Stabilized year-one rental analysis. All figures are annual unless named monthly. */
export function analyzeRental(i: RentalInputs): RentalResult {
  validateRentalInputs(i);
  const trace = new Trace();
  const warnings: string[] = [];
  const closing = i.closingCosts ?? 0;
  const rehab = i.rehabCost ?? 0;

  const gsi = trace.record({ key: "gsi", label: "Gross scheduled income", formula: "(monthly rent + other income) × 12", inputs: { monthlyRent: i.monthlyRent, otherMonthlyIncome: i.otherMonthlyIncome ?? 0 }, result: (i.monthlyRent + (i.otherMonthlyIncome ?? 0)) * 12, unit: "usd" });
  const vacancyLoss = trace.record({ key: "vacancy_loss", label: "Vacancy & credit loss", formula: "GSI × vacancy rate", inputs: { gsi, vacancyRate: i.vacancyRate }, result: gsi * i.vacancyRate, unit: "usd" });
  const egi = trace.record({ key: "egi", label: "Effective gross income", formula: "GSI − vacancy loss", inputs: { gsi, vacancyLoss }, result: gsi - vacancyLoss, unit: "usd" });
  const opex = computeOperatingExpenses(i, gsi, egi);
  trace.record({ key: "opex", label: "Operating expenses", formula: "tax + insurance + HOA + utilities + mgmt%·EGI + maint%·EGI + capex%·GSI + other", inputs: { ...opex }, result: opex.total, unit: "usd" });
  const noi = trace.record({ key: "noi", label: "Net operating income", formula: "EGI − operating expenses", inputs: { egi, opex: opex.total }, result: egi - opex.total, unit: "usd" });

  const loanAmount = resolveLoanAmount(i.purchasePrice, i.financing);
  const debtService = i.financing ? annualDebtServiceFor(loanAmount, i.financing) : 0;
  trace.record({ key: "debt_service", label: "Annual debt service", formula: i.financing?.interestOnly ? "loan × rate" : "12 × PMT(loan, rate/12, term)", inputs: { loanAmount, annualRate: i.financing?.annualRate ?? 0, termMonths: i.financing?.termMonths ?? 0 }, result: debtService, unit: "usd" });
  const annualCashFlow = trace.record({ key: "cash_flow", label: "Annual pre-tax cash flow", formula: "NOI − debt service", inputs: { noi, debtService }, result: noi - debtService, unit: "usd" });

  const financingFees = i.financing ? loanAmount * (i.financing.points ?? 0) + (i.financing.lenderFees ?? 0) : 0;
  const totalCashInvested = trace.record({ key: "cash_invested", label: "Total cash invested", formula: "purchase − loan + closing + rehab + points + lender fees", inputs: { purchasePrice: i.purchasePrice, loanAmount, closing, rehab, financingFees }, result: i.purchasePrice - loanAmount + closing + rehab + financingFees, unit: "usd" });

  const capRate = trace.record({ key: "cap_rate", label: "Cap rate (on price)", formula: "NOI ÷ purchase price", inputs: { noi, purchasePrice: i.purchasePrice }, result: noi / i.purchasePrice, unit: "ratio" });
  const allInCost = i.purchasePrice + rehab + closing;
  const yieldOnCost = trace.record({ key: "yield_on_cost", label: "Yield on cost", formula: "NOI ÷ (purchase + rehab + closing)", inputs: { noi, allInCost }, result: noi / allInCost, unit: "ratio" });
  const value = i.marketValue ?? i.purchasePrice + rehab;
  const capRateOnValue = noi / value;
  const cashOnCash = totalCashInvested > 0 ? annualCashFlow / totalCashInvested : null;
  trace.record({ key: "cash_on_cash", label: "Cash-on-cash return", formula: "annual cash flow ÷ total cash invested", inputs: { annualCashFlow, totalCashInvested }, result: cashOnCash, unit: "ratio" });
  const dscr = debtService > 0 ? noi / debtService : null;
  trace.record({ key: "dscr", label: "Debt service coverage ratio", formula: "NOI ÷ annual debt service", inputs: { noi, debtService }, result: dscr, unit: "ratio" });
  const grm = gsi > 0 ? i.purchasePrice / gsi : Infinity;
  const breakEvenOccupancy = gsi > 0 ? (opex.total + debtService) / gsi : Infinity;
  const operatingExpenseRatio = egi > 0 ? opex.total / egi : Infinity;
  const rentToCostRatio = i.monthlyRent / (i.purchasePrice + rehab);

  if (dscr !== null && dscr < 1.0) warnings.push(`DSCR ${dscr.toFixed(2)} < 1.00: NOI does not cover debt service.`);
  else if (dscr !== null && dscr < 1.2) warnings.push(`DSCR ${dscr.toFixed(2)} is below the 1.20 minimum many DSCR lenders require.`);
  if (annualCashFlow < 0) warnings.push("Negative cash flow at the stated assumptions.");
  if (i.managementRate === undefined || i.managementRate === 0) warnings.push("No property management expense assumed; self-management has a real cost.");
  if (i.capexRate === undefined || i.capexRate === 0) warnings.push("No capital expenditure reserve assumed.");
  if (cashOnCash === null) warnings.push("No cash invested (100% financed); cash-on-cash return is undefined.");

  return {
    grossScheduledIncome: gsi, vacancyLoss, effectiveGrossIncome: egi, operatingExpenses: opex, netOperatingIncome: noi,
    loanAmount, annualDebtService: debtService, annualCashFlow, monthlyCashFlow: annualCashFlow / 12, totalCashInvested,
    capRate, yieldOnCost, capRateOnValue, cashOnCash, dscr, grossRentMultiplier: grm, breakEvenOccupancy, operatingExpenseRatio,
    rentToCostRatio, warnings, trace,
  };
}
