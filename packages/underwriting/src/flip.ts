import { annualizeReturn } from "./finance";
import {
  closingCosts,
  dispositionCosts,
  holdingCosts,
  shortTermFinancingCosts,
  sizeShortTermLoan,
} from "./costs";
import { CalculationInputError, Trace, requireNonNegative, requireRate } from "./trace";

export interface MaoRuleInputs {
  arv: number;
  repairCost: number;
  /** Fraction of ARV an end buyer will pay before repairs (the "70% rule" uses 0.70). */
  arvFactor?: number;
  /** Wholesaler's target assignment fee, subtracted to get the wholesaler's maximum contract price. */
  assignmentFee?: number;
}

/** Rule-of-thumb MAO: ARV × factor − repairs − assignment fee. A screening heuristic, not an appraisal. */
export function maoRuleOfThumb(i: MaoRuleInputs, trace = new Trace()): number {
  const { arv, repairCost, arvFactor = 0.7, assignmentFee = 0 } = i;
  requireNonNegative("arv", arv);
  requireNonNegative("repairCost", repairCost);
  requireRate("arvFactor", arvFactor);
  requireNonNegative("assignmentFee", assignmentFee);
  return trace.record({
    key: "mao_rule",
    label: "MAO (rule of thumb)",
    formula: "ARV × factor − repairs − assignment fee",
    inputs: { arv, arvFactor, repairCost, assignmentFee },
    result: arv * arvFactor - repairCost - assignmentFee,
    unit: "usd",
  });
}

export interface MaoCostInputs {
  arv: number;
  repairCost: number;
  /** End buyer's required profit: either a fixed amount or a fraction of ARV. */
  targetProfit: { type: "amount"; value: number } | { type: "arv_rate"; value: number };
  buyerClosingRate?: number;
  buyerClosingFixed?: number;
  holdingCost: number;
  financingCost: number;
  dispositionCost: number;
  assignmentFee?: number;
}

/**
 * Cost-based MAO — works backward from ARV through every cost an end buyer bears.
 * Purchase-price-dependent closing costs are solved algebraically:
 *   P = (ARV − repairs − profit − holding − financing − disposition − fixedClosing − fee) / (1 + closingRate)
 */
export function maoCostBased(i: MaoCostInputs, trace = new Trace()): number {
  const {
    arv,
    repairCost,
    holdingCost,
    financingCost,
    dispositionCost,
    buyerClosingRate = 0,
    buyerClosingFixed = 0,
    assignmentFee = 0,
  } = i;
  for (const [k, v] of Object.entries({
    arv,
    repairCost,
    holdingCost,
    financingCost,
    dispositionCost,
    buyerClosingFixed,
    assignmentFee,
  }))
    requireNonNegative(k, v);
  requireRate("buyerClosingRate", buyerClosingRate, { max: 0.2 });
  const profit =
    i.targetProfit.type === "amount" ? i.targetProfit.value : arv * i.targetProfit.value;
  requireNonNegative("targetProfit", profit);
  const numerator =
    arv -
    repairCost -
    profit -
    holdingCost -
    financingCost -
    dispositionCost -
    buyerClosingFixed -
    assignmentFee;
  return trace.record({
    key: "mao_cost",
    label: "MAO (cost-based)",
    formula:
      "(ARV − repairs − profit − holding − financing − disposition − fixed closing − fee) ÷ (1 + closing rate)",
    inputs: {
      arv,
      repairCost,
      profit,
      holdingCost,
      financingCost,
      dispositionCost,
      buyerClosingFixed,
      assignmentFee,
      buyerClosingRate,
    },
    result: numerator / (1 + buyerClosingRate),
    unit: "usd",
  });
}

export interface FlipInputs {
  purchasePrice: number;
  arv: number;
  rehabCost: number;
  holdMonths: number;
  acquisition: { closingRate?: number; closingFixed?: number };
  holding: {
    annualPropertyTax?: number;
    annualInsurance?: number;
    monthlyUtilities?: number;
    monthlyHoa?: number;
    monthlyOther?: number;
  };
  disposition: {
    commissionRate?: number;
    sellerClosingRate?: number;
    sellerConcessions?: number;
    fixed?: number;
  };
  financing?: {
    maxLtc: number;
    maxLtv: number;
    financeRehab: boolean;
    annualRate: number;
    points?: number;
    lenderFees?: number;
    /** Override computed loan sizing. */
    loanAmount?: number;
  };
}

export interface FlipResult {
  loanAmount: number;
  acquisitionCosts: number;
  holdingCosts: number;
  financingCosts: number;
  dispositionCosts: number;
  totalProjectCost: number;
  netProfit: number;
  cashRequired: number;
  /** Net profit ÷ cash required. Null when no cash is required. */
  cashOnCashReturn: number | null;
  annualizedReturn: number | null;
  profitMarginOnArv: number;
  trace: Trace;
}

export function analyzeFlip(i: FlipInputs): FlipResult {
  const trace = new Trace();
  requireNonNegative("purchasePrice", i.purchasePrice);
  requireNonNegative("arv", i.arv);
  requireNonNegative("rehabCost", i.rehabCost);
  if (!(i.holdMonths > 0)) throw new CalculationInputError("holdMonths must be > 0");

  const acquisitionCosts = closingCosts(
    { price: i.purchasePrice, rate: i.acquisition.closingRate, fixed: i.acquisition.closingFixed },
    trace,
  );
  const holding = holdingCosts({ months: i.holdMonths, ...i.holding }, trace).total;

  let loanAmount = 0;
  let financing = 0;
  let financedRehab = 0;
  if (i.financing) {
    loanAmount =
      i.financing.loanAmount ??
      sizeShortTermLoan(
        {
          purchasePrice: i.purchasePrice,
          rehabCost: i.rehabCost,
          arv: i.arv,
          maxLtc: i.financing.maxLtc,
          maxLtv: i.financing.maxLtv,
          financeRehab: i.financing.financeRehab,
        },
        trace,
      );
    financing = shortTermFinancingCosts(
      {
        loanAmount,
        annualRate: i.financing.annualRate,
        points: i.financing.points,
        lenderFees: i.financing.lenderFees,
        months: i.holdMonths,
        interestOnly: true,
      },
      trace,
    ).total;
    // Loan proceeds above the purchase price fund rehab (draws), capped at the rehab budget.
    financedRehab = i.financing.financeRehab
      ? Math.min(Math.max(loanAmount - i.purchasePrice, 0), i.rehabCost)
      : 0;
  }
  const disposition = dispositionCosts({ salePrice: i.arv, ...i.disposition }, trace);

  const totalProjectCost = trace.record({
    key: "total_project_cost",
    label: "Total project cost",
    formula: "purchase + rehab + acquisition + holding + financing + disposition",
    inputs: {
      purchasePrice: i.purchasePrice,
      rehabCost: i.rehabCost,
      acquisitionCosts,
      holding,
      financing,
      disposition,
    },
    result: i.purchasePrice + i.rehabCost + acquisitionCosts + holding + financing + disposition,
    unit: "usd",
  });
  const netProfit = trace.record({
    key: "net_profit",
    label: "Net profit",
    formula: "ARV − total project cost",
    inputs: { arv: i.arv, totalProjectCost },
    result: i.arv - totalProjectCost,
    unit: "usd",
  });
  // Cash out of pocket before sale: everything except disposition costs (paid from sale proceeds), less loan proceeds.
  const purchaseLoanPortion = loanAmount - financedRehab;
  const cashRequired = trace.record({
    key: "cash_required",
    label: "Cash required before sale",
    formula:
      "(purchase − loan applied to purchase) + (rehab − financed rehab) + acquisition + holding + financing",
    inputs: {
      purchasePrice: i.purchasePrice,
      purchaseLoanPortion,
      rehabCost: i.rehabCost,
      financedRehab,
      acquisitionCosts,
      holding,
      financing,
    },
    result:
      i.purchasePrice -
      purchaseLoanPortion +
      (i.rehabCost - financedRehab) +
      acquisitionCosts +
      holding +
      financing,
    unit: "usd",
  });
  const cashOnCashReturn = cashRequired > 0 ? netProfit / cashRequired : null;
  trace.record({
    key: "flip_coc",
    label: "Return on cash",
    formula: "net profit ÷ cash required",
    inputs: { netProfit, cashRequired },
    result: cashOnCashReturn,
    unit: "ratio",
  });
  const annualizedReturn =
    cashOnCashReturn === null ? null : annualizeReturn(cashOnCashReturn, i.holdMonths);
  const profitMarginOnArv = i.arv > 0 ? netProfit / i.arv : 0;
  return {
    loanAmount,
    acquisitionCosts,
    holdingCosts: holding,
    financingCosts: financing,
    dispositionCosts: disposition,
    totalProjectCost,
    netProfit,
    cashRequired,
    cashOnCashReturn,
    annualizedReturn,
    profitMarginOnArv,
    trace,
  };
}

export interface AssignmentInputs {
  /** Price in the wholesaler's purchase agreement with the seller. */
  contractPrice: number;
  /** Price the end buyer pays for the assignment (contract price + assignment fee). */
  endBuyerPrice: number;
  /** End buyer's maximum price, typically the cost-based or rule MAO before assignment fee. */
  endBuyerMaxPrice: number;
  /** Wholesaler's transaction costs (earnest money not recovered, marketing, title fees). */
  wholesalerCosts?: number;
}

export interface AssignmentResult {
  assignmentFee: number;
  netToWholesaler: number;
  /** End buyer's remaining cushion: endBuyerMaxPrice − endBuyerPrice. Negative = deal unlikely to sell. */
  buyerCushion: number;
  viable: boolean;
  /** Max assignment fee the end buyer can absorb given their max price. */
  maxSupportableFee: number;
  warnings: string[];
  trace: Trace;
}

export function analyzeAssignment(i: AssignmentInputs): AssignmentResult {
  const trace = new Trace();
  const { contractPrice, endBuyerPrice, endBuyerMaxPrice, wholesalerCosts = 0 } = i;
  for (const [k, v] of Object.entries({ contractPrice, endBuyerPrice, wholesalerCosts }))
    requireNonNegative(k, v);
  const warnings: string[] = [];
  const assignmentFee = trace.record({
    key: "assignment_fee",
    label: "Assignment fee",
    formula: "end buyer price − contract price",
    inputs: { endBuyerPrice, contractPrice },
    result: endBuyerPrice - contractPrice,
    unit: "usd",
  });
  if (assignmentFee < 0) warnings.push("End buyer price is below the contract price.");
  const netToWholesaler = trace.record({
    key: "wholesaler_net",
    label: "Net to wholesaler",
    formula: "assignment fee − wholesaler costs",
    inputs: { assignmentFee, wholesalerCosts },
    result: assignmentFee - wholesalerCosts,
    unit: "usd",
  });
  const buyerCushion = trace.record({
    key: "buyer_cushion",
    label: "End buyer cushion",
    formula: "end buyer max price − end buyer price",
    inputs: { endBuyerMaxPrice, endBuyerPrice },
    result: endBuyerMaxPrice - endBuyerPrice,
    unit: "usd",
  });
  const maxSupportableFee = trace.record({
    key: "max_fee",
    label: "Max supportable assignment fee",
    formula: "end buyer max price − contract price",
    inputs: { endBuyerMaxPrice, contractPrice },
    result: endBuyerMaxPrice - contractPrice,
    unit: "usd",
  });
  if (buyerCushion < 0)
    warnings.push(
      "End buyer price exceeds the end buyer's maximum price; the assignment is unlikely to sell at this fee.",
    );
  warnings.push(
    "Assignment and wholesaling rules vary by state (licensing, disclosure, marketing of equitable interest). Confirm compliance before marketing.",
  );
  return {
    assignmentFee,
    netToWholesaler,
    buyerCushion,
    viable: assignmentFee >= 0 && buyerCushion >= 0,
    maxSupportableFee,
    warnings,
    trace,
  };
}
