import { interestPaidOver } from "./finance";
import { CalculationInputError, Trace, requireNonNegative, requireRate } from "./trace";

export interface ClosingCostInputs {
  price: number;
  /** Percentage-of-price closing costs (title, escrow, recording, transfer tax), decimal. */
  rate?: number;
  /** Fixed closing costs in dollars. */
  fixed?: number;
}

export function closingCosts({ price, rate = 0, fixed = 0 }: ClosingCostInputs, trace = new Trace()): number {
  requireNonNegative("price", price);
  requireRate("closing cost rate", rate, { max: 0.2 });
  requireNonNegative("fixed closing costs", fixed);
  return trace.record({
    key: "closing_costs", label: "Closing costs", formula: "price × rate + fixed",
    inputs: { price, rate, fixed }, result: price * rate + fixed, unit: "usd",
  });
}

export interface HoldingCostInputs {
  months: number;
  annualPropertyTax?: number;
  annualInsurance?: number;
  monthlyUtilities?: number;
  monthlyHoa?: number;
  monthlyOther?: number;
}

export function holdingCosts(i: HoldingCostInputs, trace = new Trace()): { monthly: number; total: number } {
  const { months, annualPropertyTax = 0, annualInsurance = 0, monthlyUtilities = 0, monthlyHoa = 0, monthlyOther = 0 } = i;
  for (const [k, v] of Object.entries({ months, annualPropertyTax, annualInsurance, monthlyUtilities, monthlyHoa, monthlyOther })) {
    requireNonNegative(k, v);
  }
  const monthly = annualPropertyTax / 12 + annualInsurance / 12 + monthlyUtilities + monthlyHoa + monthlyOther;
  trace.record({
    key: "holding_monthly", label: "Monthly holding cost", formula: "tax/12 + insurance/12 + utilities + HOA + other",
    inputs: { annualPropertyTax, annualInsurance, monthlyUtilities, monthlyHoa, monthlyOther }, result: monthly, unit: "usd",
  });
  const total = trace.record({
    key: "holding_total", label: "Total holding costs", formula: "monthly holding cost × months held",
    inputs: { monthly, months }, result: monthly * months, unit: "usd",
  });
  return { monthly, total };
}

export interface LoanSizingInputs {
  purchasePrice: number;
  rehabCost: number;
  arv: number;
  /** Max loan-to-cost on (purchase + financed rehab). */
  maxLtc: number;
  /** Max loan-to-ARV. */
  maxLtv: number;
  financeRehab: boolean;
}

/** Short-term (hard money / private) loan sizing: min(LTC × cost basis, LTV × ARV). */
export function sizeShortTermLoan(i: LoanSizingInputs, trace = new Trace()): number {
  requireNonNegative("purchasePrice", i.purchasePrice);
  requireNonNegative("rehabCost", i.rehabCost);
  requireNonNegative("arv", i.arv);
  requireRate("maxLtc", i.maxLtc);
  requireRate("maxLtv", i.maxLtv);
  const basis = i.purchasePrice + (i.financeRehab ? i.rehabCost : 0);
  return trace.record({
    key: "loan_amount", label: "Loan amount", formula: "min(maxLTC × (purchase + financed rehab), maxLTV × ARV)",
    inputs: { basis, maxLtc: i.maxLtc, arv: i.arv, maxLtv: i.maxLtv }, result: Math.min(basis * i.maxLtc, i.arv * i.maxLtv), unit: "usd",
  });
}

export interface ShortTermFinancingInputs {
  loanAmount: number;
  annualRate: number;
  /** Origination points as a decimal of the loan amount (2 points = 0.02). */
  points?: number;
  /** Fixed lender fees (underwriting, processing, draw fees). */
  lenderFees?: number;
  months: number;
  interestOnly?: boolean;
  termMonths?: number;
}

export function shortTermFinancingCosts(i: ShortTermFinancingInputs, trace = new Trace()): { points: number; interest: number; fees: number; total: number } {
  const { loanAmount, annualRate, points = 0, lenderFees = 0, months, interestOnly = true, termMonths } = i;
  requireNonNegative("loanAmount", loanAmount);
  requireRate("points", points, { max: 0.1 });
  requireNonNegative("lenderFees", lenderFees);
  if (!interestOnly && termMonths === undefined) throw new CalculationInputError("termMonths required for amortizing financing");
  const pointsCost = loanAmount * points;
  const interest = interestPaidOver(loanAmount, annualRate, months, { interestOnly, termMonths });
  trace.record({
    key: "financing_interest", label: "Interest during hold",
    formula: interestOnly ? "loan × rate / 12 × months" : "Σ amortization interest over hold months",
    inputs: { loanAmount, annualRate, months, interestOnly }, result: interest, unit: "usd",
  });
  const total = trace.record({
    key: "financing_total", label: "Total financing costs", formula: "loan × points + lender fees + interest",
    inputs: { loanAmount, points, lenderFees, interest }, result: pointsCost + lenderFees + interest, unit: "usd",
  });
  return { points: pointsCost, interest, fees: lenderFees, total };
}

export interface DispositionCostInputs {
  salePrice: number;
  /** Total brokerage commission rate, decimal. */
  commissionRate?: number;
  /** Seller-side closing costs rate (title, transfer tax), decimal. */
  sellerClosingRate?: number;
  sellerConcessions?: number;
  fixed?: number;
}

export function dispositionCosts(i: DispositionCostInputs, trace = new Trace()): number {
  const { salePrice, commissionRate = 0, sellerClosingRate = 0, sellerConcessions = 0, fixed = 0 } = i;
  requireNonNegative("salePrice", salePrice);
  requireRate("commissionRate", commissionRate, { max: 0.15 });
  requireRate("sellerClosingRate", sellerClosingRate, { max: 0.15 });
  requireNonNegative("sellerConcessions", sellerConcessions);
  requireNonNegative("fixed", fixed);
  return trace.record({
    key: "disposition_costs", label: "Disposition costs",
    formula: "sale price × (commission + seller closing) + concessions + fixed",
    inputs: { salePrice, commissionRate, sellerClosingRate, sellerConcessions, fixed },
    result: salePrice * (commissionRate + sellerClosingRate) + sellerConcessions + fixed, unit: "usd",
  });
}
