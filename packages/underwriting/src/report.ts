/**
 * Deal-level reports. These compose the primitive calculators into the analyses an acquisitions team runs
 * on every lead, and package the result with assumptions grouped by provenance, warnings, formulas, and a
 * reproducibility fingerprint of the inputs.
 */
import {
  DISCLAIMER,
  ENGINE_VERSION,
  ResultBuilder,
  UnderwritingInputError,
  valueOf,
  type Assumption,
  type CalculationResult,
  type InputSource,
  type NumericInput,
  type TraceStep,
  type UnderwritingWarning,
} from './core.js';
import { calculateArv, type ArvResult, type ComparableSale } from './arv.js';
import {
  calculateClosingCosts,
  calculateDispositionCosts,
  calculateFinancingCosts,
  calculateHoldingCosts,
  estimateRenovation,
  type RenovationLineItem,
} from './costs.js';
import { analyzeFlip, type FlipResult } from './flip.js';
import { analyzeAssignment, calculateDetailedMao, calculateMao, type AssignmentResult } from './wholesale.js';
import { maoSensitivity, rentalSensitivity, type TwoWayGrid } from './sensitivity.js';
import { analyzeRental, projectRental, type ProjectionResult, type RentalInput, type RentalResult } from './rental.js';

/** Stable JSON (sorted keys) so the fingerprint does not depend on property order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** FNV-1a 64-bit hash, hex. Pure JS so reports can be fingerprinted in any runtime. Not a security hash. */
export function fingerprint(value: unknown): string {
  const text = stableStringify(value);
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

export interface ReportBase {
  kind: string;
  engineVersion: string;
  inputsFingerprint: string;
  assumptionsBySource: Record<InputSource, Assumption[]>;
  trace: TraceStep[];
  warnings: UnderwritingWarning[];
  disclaimer: string;
}

function groupAssumptions(list: Assumption[]): Record<InputSource, Assumption[]> {
  const out: Record<InputSource, Assumption[]> = {
    verified: [],
    third_party_estimate: [],
    user_assumption: [],
    ai_interpretation: [],
  };
  for (const a of list) out[a.source].push(a);
  return out;
}

function sortWarnings(w: UnderwritingWarning[]): UnderwritingWarning[] {
  const rank = { critical: 0, caution: 1, info: 2 } as const;
  return [...w].sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ---------------------------------------------------------------------------------------------
// Wholesale / flip deal report
// ---------------------------------------------------------------------------------------------

export interface WholesaleDealInput {
  /** Either supply ARV directly or comps to derive it. */
  arv?: NumericInput;
  subjectSquareFeet?: NumericInput;
  comps?: ComparableSale[];
  valuationDate?: string;

  /** Either a repair total or itemized line items. */
  repairCosts?: NumericInput;
  repairLineItems?: RenovationLineItem[];
  repairContingencyRate?: NumericInput;

  /** Proposed seller contract price. Defaults to the computed MAO. */
  contractPrice?: NumericInput;
  assignmentFee: NumericInput;
  arvMultiplier?: NumericInput;
  wholesalerCosts?: NumericInput;

  /** End-buyer (flipper) assumptions used for the cost-stack MAO and the buyer's view. */
  buyer: {
    acquisitionClosingRate: NumericInput;
    holdingMonths: NumericInput;
    annualPropertyTax: NumericInput;
    annualInsurance: NumericInput;
    monthlyUtilities?: NumericInput;
    loanToValue?: NumericInput;
    financeRehab?: boolean;
    annualInterestRate?: NumericInput;
    points?: NumericInput;
    commissionRate: NumericInput;
    sellerClosingRate: NumericInput;
    targetProfitRate: NumericInput;
  };
}

export interface WholesaleDealReport extends ReportBase {
  kind: 'wholesale_deal';
  summary: {
    arv: number;
    repairCosts: number;
    maoRuleOfThumb: number;
    maoCostStack: number;
    /** The lower of the two MAOs: the recommended ceiling. */
    recommendedMaxOffer: number;
    contractPrice: number;
    assignmentFee: number;
    buyerPrice: number;
    buyerProjectedProfit: number;
    buyerMargin: number;
    viableForBuyer: boolean;
  };
  arvAnalysis: ArvResult | null;
  costStack: {
    acquisition: number;
    holding: number;
    financing: number;
    disposition: number;
    targetProfit: number;
  };
  assignment: AssignmentResult;
  buyerFlip: FlipResult;
  sensitivity: TwoWayGrid<number>;
}

export function buildWholesaleDealReport(input: WholesaleDealInput): WholesaleDealReport {
  const b = new ResultBuilder();
  const by = input.buyer;

  // 1. ARV
  let arv: NumericInput;
  let arvAnalysis: ArvResult | null = null;
  if (input.comps && input.comps.length > 0) {
    if (input.subjectSquareFeet === undefined) {
      throw new UnderwritingInputError('subjectSquareFeet', 'is required when comps are supplied');
    }
    const arvArgs: Parameters<typeof calculateArv>[0] = { subjectSquareFeet: input.subjectSquareFeet, comps: input.comps };
    if (input.valuationDate !== undefined) arvArgs.asOfDate = input.valuationDate;
    arvAnalysis = b.absorb(calculateArv(arvArgs), 'ARV');
    arv = arvAnalysis.arv;
    if (input.arv === undefined) b.derived('arv');
    if (input.arv !== undefined) {
      const override = valueOf(input.arv);
      b.warn('arv_override', 'info', `ARV of ${override} was supplied and overrides the comp-derived ${arvAnalysis.arv}.`);
      arv = input.arv;
      b.input('arv', 'After-repair value (override)', input.arv, { gt: 0 });
    }
  } else if (input.arv !== undefined) {
    arv = input.arv;
    b.input('arv', 'After-repair value', input.arv, { gt: 0 });
  } else {
    throw new UnderwritingInputError('arv', 'provide either arv or comps');
  }
  const arvV = valueOf(arv);

  // 2. Repairs
  let repairs: number;
  if (input.repairLineItems && input.repairLineItems.length > 0) {
    const renoArgs: Parameters<typeof estimateRenovation>[0] = { lineItems: input.repairLineItems };
    if (input.repairContingencyRate !== undefined) renoArgs.contingencyRate = input.repairContingencyRate;
    repairs = b.absorb(estimateRenovation(renoArgs), 'Renovation').total;
    b.derived('repairCosts');
  } else if (input.repairCosts !== undefined) {
    repairs = b.input('repairCosts', 'Estimated repairs', input.repairCosts, { min: 0 });
  } else {
    throw new UnderwritingInputError('repairCosts', 'provide either repairCosts or repairLineItems');
  }

  // 3. Rule-of-thumb MAO
  const maoArgs = {
    arv: arvV,
    repairCosts: repairs,
    assignmentFee: input.assignmentFee,
    ...(input.arvMultiplier !== undefined ? { arvMultiplier: input.arvMultiplier } : {}),
  };
  const ruleMao = b.absorb(calculateMao(maoArgs), 'Rule-of-thumb MAO');

  // 4. Buyer cost stack, estimated at the buyer's max purchase price from the rule of thumb.
  //    Base prices and dollar totals below are computed here, not user assumptions.
  b.derived('basePrice', 'purchasePrice', 'salePrice', 'buyerAcquisitionCosts', 'holdingCosts', 'financingCosts', 'dispositionCosts', 'financedRehab', 'acquisitionCosts', 'buyerOtherCosts', 'buyerPrice', 'contractPrice', 'buyerMinMarginRate');
  const buyerPriceEstimate = Math.max(0, ruleMao.buyerMaxPrice);
  const acq = b.absorb(
    calculateClosingCosts({ basePrice: buyerPriceEstimate, percentageCosts: { buyerClosing: by.acquisitionClosingRate } }, 'Buyer acquisition'),
    'Cost stack',
  ).total;
  const holdArgs: Parameters<typeof calculateHoldingCosts>[0] = {
    holdingMonths: by.holdingMonths,
    annualPropertyTax: by.annualPropertyTax,
    annualInsurance: by.annualInsurance,
  };
  if (by.monthlyUtilities !== undefined) holdArgs.monthlyUtilities = by.monthlyUtilities;
  const hold = b.absorb(calculateHoldingCosts(holdArgs), 'Cost stack').total;
  let fin = 0;
  if (by.loanToValue !== undefined && valueOf(by.loanToValue) > 0) {
    if (by.annualInterestRate === undefined) throw new UnderwritingInputError('buyer.annualInterestRate', 'is required when loanToValue > 0');
    const finArgs: Parameters<typeof calculateFinancingCosts>[0] = {
      purchasePrice: buyerPriceEstimate,
      loanToValue: by.loanToValue,
      annualInterestRate: by.annualInterestRate,
      holdingMonths: by.holdingMonths,
      paymentType: 'interest_only',
    };
    if (by.financeRehab) finArgs.financedRehab = repairs;
    if (by.points !== undefined) finArgs.points = by.points;
    fin = b.absorb(calculateFinancingCosts(finArgs), 'Cost stack').totalFinancingCost;
  }
  const disp = b.absorb(
    calculateDispositionCosts({ salePrice: arvV, commissionRate: by.commissionRate, sellerClosingRate: by.sellerClosingRate }),
    'Cost stack',
  ).total;
  const detailed = b.absorb(
    calculateDetailedMao({
      arv: arvV,
      repairCosts: repairs,
      buyerAcquisitionCosts: acq,
      holdingCosts: hold,
      financingCosts: fin,
      dispositionCosts: disp,
      targetProfit: by.targetProfitRate,
      targetProfitIsRate: true,
      assignmentFee: input.assignmentFee,
    }),
    'Cost-stack MAO',
  );

  const recommended = Math.min(ruleMao.mao, detailed.mao);
  b.step('Recommended max offer', 'min(Rule-of-thumb MAO, Cost-stack MAO)', { ruleMao: ruleMao.mao, stackMao: detailed.mao }, recommended);

  // 5. Assignment at the proposed contract price.
  const contract = input.contractPrice !== undefined ? valueOf(input.contractPrice) : recommended;
  if (input.contractPrice !== undefined) b.input('proposedContractPrice', 'Proposed seller contract price', input.contractPrice, { gt: 0 });
  if (contract <= 0) {
    b.warn('deal_not_viable', 'critical', 'No positive offer price satisfies the assumptions.');
  }
  const fee = valueOf(input.assignmentFee);
  const buyerPrice = contract + fee;
  if (input.contractPrice !== undefined && contract > recommended) {
    b.warn('contract_above_mao', 'critical', `Proposed contract price exceeds the recommended max offer by ${Math.round(contract - recommended)}.`);
  }
  const buyerOther = acq + hold + fin + disp;
  const assignArgs: Parameters<typeof analyzeAssignment>[0] = {
    contractPrice: Math.max(contract, 0.01),
    buyerPrice: Math.max(buyerPrice, 0.01),
    arv: arvV,
    repairCosts: repairs,
    buyerOtherCosts: buyerOther,
    buyerMinMarginRate: by.targetProfitRate,
  };
  if (input.wholesalerCosts !== undefined) assignArgs.wholesalerCosts = input.wholesalerCosts;
  const assignment = b.absorb(analyzeAssignment(assignArgs), 'Assignment');

  const buyerFlip = b.absorb(
    analyzeFlip({
      purchasePrice: Math.max(buyerPrice, 0.01),
      repairCosts: repairs,
      acquisitionCosts: acq,
      holdingCosts: hold,
      financingCosts: fin,
      dispositionCosts: disp,
      salePrice: arvV,
      holdingMonths: Math.max(valueOf(by.holdingMonths), 0.0001),
    }),
    'End-buyer flip',
  );

  const sensitivity = maoSensitivity(maoArgs);
  const built = b.build(null);
  return {
    kind: 'wholesale_deal',
    engineVersion: ENGINE_VERSION,
    inputsFingerprint: fingerprint(input),
    summary: {
      arv: arvV,
      repairCosts: repairs,
      maoRuleOfThumb: ruleMao.mao,
      maoCostStack: detailed.mao,
      recommendedMaxOffer: recommended,
      contractPrice: contract,
      assignmentFee: fee,
      buyerPrice,
      buyerProjectedProfit: assignment.buyerProjectedProfit,
      buyerMargin: assignment.buyerMargin,
      viableForBuyer: assignment.viableForBuyer,
    },
    arvAnalysis,
    costStack: { acquisition: acq, holding: hold, financing: fin, disposition: disp, targetProfit: detailed.targetProfit },
    assignment,
    buyerFlip,
    sensitivity,
    assumptionsBySource: groupAssumptions(built.assumptions),
    trace: built.trace,
    warnings: sortWarnings(built.warnings),
    disclaimer: DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------------------------
// Rental report
// ---------------------------------------------------------------------------------------------

export interface RentalReportInput {
  rental: RentalInput;
  projection?: { years: number; annualRentGrowth: NumericInput; annualExpenseGrowth: NumericInput; annualAppreciation: NumericInput };
}

export interface RentalReport extends ReportBase {
  kind: 'rental';
  analysis: RentalResult;
  projection: ProjectionResult | null;
  sensitivity: TwoWayGrid<{ cashOnCash: number | null; dscr: number | null; monthlyCashFlow: number }> | null;
}

export function buildRentalReport(input: RentalReportInput): RentalReport {
  const b = new ResultBuilder();
  const analysis = b.absorb(analyzeRental(input.rental));
  let projection: ProjectionResult | null = null;
  if (input.projection) {
    const p: CalculationResult<ProjectionResult> = projectRental({ rental: input.rental, ...input.projection });
    projection = b.absorb({ ...p, trace: p.trace.filter((t) => !t.label.startsWith('Year 1')) }, 'Projection');
  }
  const sensitivity = input.rental.loan ? rentalSensitivity(input.rental) : null;
  const built = b.build(null);
  return {
    kind: 'rental',
    engineVersion: ENGINE_VERSION,
    inputsFingerprint: fingerprint(input),
    analysis,
    projection,
    sensitivity,
    assumptionsBySource: groupAssumptions(built.assumptions),
    trace: built.trace,
    warnings: sortWarnings(built.warnings),
    disclaimer: DISCLAIMER,
  };
}
