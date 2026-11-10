/**
 * Creative-finance structures: seller financing, subject-to, wrap-around, and lease option.
 *
 * These calculators quantify cash flow and balances only. Every structure here carries legal,
 * title, lending-compliance, and contractual risk that arithmetic cannot assess, so each result
 * includes review flags (as warnings) that must be cleared by a qualified attorney or title company
 * before any offer is made.
 *
 * Existing-loan terms (balance, rate, payment, arrears) must come from verified documents such as a
 * current mortgage statement or lender payoff letter. Recorded mortgage data (the original amount on
 * a recorded deed of trust) is NOT a current balance, payment, rate, or arrears figure; inputs that are
 * not marked `verified` raise a critical warning.
 */
import {
  ResultBuilder,
  UnderwritingInputError,
  nonNegative,
  rate,
  roundCurrency,
  toSourced,
  type CalculationResult,
  type NumericInput,
} from './core';
import { amortizingPayment, interestOnlyPayment, remainingBalance } from './finance';

const LEGAL_REVIEW =
  'Creative-finance terms require review by a real estate attorney and title company licensed in the property\'s state before any offer.';

function requireVerified(b: ResultBuilder, code: string, label: string, ...inputs: (NumericInput | undefined)[]): void {
  const unverified = inputs.some((i) => i !== undefined && toSourced(i).source !== 'verified');
  if (unverified) {
    b.warn(
      code,
      'critical',
      `${label} is not verified. Use a current mortgage statement or lender payoff letter; recorded mortgage data does not establish the current balance, rate, payment, or arrears.`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Seller financing
// ---------------------------------------------------------------------------------------------

export interface SellerFinanceInput {
  purchasePrice: NumericInput;
  downPayment: NumericInput;
  annualInterestRate: NumericInput;
  /** Amortization period in months (payments are computed on this schedule). */
  amortizationMonths: number;
  /** Months until the remaining balance is due as a balloon; omit for a fully amortizing note. */
  balloonMonths?: number;
  interestOnly?: boolean;
  closingCosts?: NumericInput;
}

export interface SellerFinanceResult {
  noteAmount: number;
  monthlyPayment: number;
  balloonMonth: number | null;
  balloonPayment: number;
  totalPaymentsBeforeBalloon: number;
  totalInterest: number;
  cashToClose: number;
}

export function analyzeSellerFinance(input: SellerFinanceInput): CalculationResult<SellerFinanceResult> {
  const b = new ResultBuilder();
  const price = b.input('purchasePrice', 'Purchase price', input.purchasePrice, { gt: 0 });
  const down = b.input('downPayment', 'Down payment to seller', input.downPayment, { min: 0, max: price });
  const r = b.input('sellerNoteRate', 'Seller note interest rate', input.annualInterestRate, rate);
  const amort = b.input('amortizationMonths', 'Amortization (months)', input.amortizationMonths, { gt: 0, integer: true });
  const closing = b.optional('closingCosts', 'Buyer closing costs', input.closingCosts, nonNegative);
  let balloonAt: number | null = null;
  if (input.balloonMonths !== undefined) {
    balloonAt = b.input('balloonMonths', 'Balloon due (months)', input.balloonMonths, { gt: 0, integer: true });
    if (balloonAt >= amort && !input.interestOnly) balloonAt = null;
  }
  const note = b.step('Seller note amount', 'Price − Down Payment', { price, down }, price - down);
  const pmt = input.interestOnly
    ? b.step('Monthly payment (interest-only)', 'Note × Rate ÷ 12', { note, r }, interestOnlyPayment(note, r))
    : b.step('Monthly payment', 'N × r ÷ (1 − (1 + r)^−n)', { note, r, amort }, amortizingPayment(note, r, amort));
  if (input.interestOnly && balloonAt === null) {
    throw new UnderwritingInputError('balloonMonths', 'an interest-only seller note requires a balloon date');
  }
  const paymentsMade = balloonAt ?? amort;
  const balloon = balloonAt === null ? 0 : input.interestOnly ? note : remainingBalance(note, r, amort, balloonAt);
  if (balloonAt !== null) b.step('Balloon payment', 'Remaining balance after Balloon Months', { note, r, amort, balloonAt }, balloon);
  const totalPayments = pmt * paymentsMade;
  const totalInterest = b.step('Total interest to seller', 'Payments + Balloon − Note', { totalPayments, balloon, note }, totalPayments + balloon - note);
  const cash = b.step('Cash to close', 'Down Payment + Closing Costs', { down, closing }, down + closing);

  if (balloonAt !== null) {
    b.warn('creative_balloon_risk', balloonAt <= 36 ? 'critical' : 'caution', `A balloon of ${roundCurrency(balloon).toLocaleString('en-US')} is due in month ${balloonAt}. Plan refinance or sale well ahead; failure to pay can mean default and loss of the property.`);
  }
  b.warn('creative_title_review', 'caution', 'Confirm there are no existing liens senior to the seller note; an underlying mortgage makes this a wrap and triggers due-on-sale risk.');
  b.warn('creative_legal_review', 'caution', LEGAL_REVIEW);
  return b.build({
    noteAmount: roundCurrency(note),
    monthlyPayment: roundCurrency(pmt),
    balloonMonth: balloonAt,
    balloonPayment: roundCurrency(balloon),
    totalPaymentsBeforeBalloon: roundCurrency(totalPayments),
    totalInterest: roundCurrency(totalInterest),
    cashToClose: roundCurrency(cash),
  });
}

// ---------------------------------------------------------------------------------------------
// Subject-to (acquire title with the existing loan left in place)
// ---------------------------------------------------------------------------------------------

export interface ExistingLoan {
  /** Current principal balance from a mortgage statement or payoff letter. */
  balance: NumericInput;
  annualInterestRate: NumericInput;
  /** Monthly principal and interest. */
  monthlyPrincipalAndInterest: NumericInput;
  /** Monthly escrow for taxes and insurance, if escrowed. */
  monthlyEscrow?: NumericInput;
  /** Past-due amount to reinstate the loan. */
  arrears?: NumericInput;
}

export interface SubjectToInput {
  purchasePrice: NumericInput;
  existingLoan: ExistingLoan;
  /** Cash paid to the seller at closing. */
  cashToSeller?: NumericInput;
  closingCosts?: NumericInput;
  repairs?: NumericInput;
  /** Market value (third-party estimate or appraisal). */
  marketValue: NumericInput;
  monthlyRent: NumericInput;
  /** Operating expenses not paid through escrow (management, maintenance, vacancy reserve, HOA). */
  monthlyOperatingExpenses: NumericInput;
}

export interface SubjectToResult {
  /** Price − existing loan balance: the seller's equity being purchased. */
  sellerEquity: number;
  /** Market value − existing balance at entry. */
  equityAtEntry: number;
  cashRequired: number;
  monthlyHousingPayment: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCash: number | null;
  /** Purchase price ÷ market value. */
  priceToValue: number;
}

export function analyzeSubjectTo(input: SubjectToInput): CalculationResult<SubjectToResult> {
  const b = new ResultBuilder();
  const price = b.input('purchasePrice', 'Purchase price', input.purchasePrice, { gt: 0 });
  const l = input.existingLoan;
  const bal = b.input('existingLoanBalance', 'Existing loan balance', l.balance, nonNegative);
  b.input('existingLoanRate', 'Existing loan rate', l.annualInterestRate, rate);
  const pi = b.input('existingLoanPI', 'Existing monthly principal & interest', l.monthlyPrincipalAndInterest, nonNegative);
  const escrow = b.optional('existingLoanEscrow', 'Existing monthly escrow', l.monthlyEscrow, nonNegative);
  const arrears = b.optional('existingLoanArrears', 'Arrears to reinstate', l.arrears, nonNegative);
  const toSeller = b.optional('cashToSeller', 'Cash to seller', input.cashToSeller, nonNegative);
  const closing = b.optional('closingCosts', 'Closing costs', input.closingCosts, nonNegative);
  const repairs = b.optional('repairs', 'Repairs', input.repairs, nonNegative);
  const value = b.input('marketValue', 'Market value', input.marketValue, { gt: 0 });
  const rent = b.input('monthlyRent', 'Monthly rent', input.monthlyRent, nonNegative);
  const opex = b.input('monthlyOperatingExpenses', 'Monthly operating expenses (non-escrow)', input.monthlyOperatingExpenses, nonNegative);

  const sellerEquity = b.step('Seller equity purchased', 'Price − Existing Balance', { price, bal }, price - bal);
  const equityAtEntry = b.step('Equity at entry', 'Market Value − Existing Balance − Arrears', { value, bal, arrears }, value - bal - arrears);
  const cash = b.step('Cash required', 'Cash To Seller + Arrears + Closing + Repairs', { toSeller, arrears, closing, repairs }, toSeller + arrears + closing + repairs);
  const housing = b.step('Monthly housing payment', 'P&I + Escrow', { pi, escrow }, pi + escrow);
  const mcf = b.step('Monthly cash flow', 'Rent − Housing Payment − Operating Expenses', { rent, housing, opex }, rent - housing - opex);
  const acf = mcf * 12;
  const coc = cash > 0 ? b.step('Cash-on-cash return', 'Annual Cash Flow ÷ Cash Required', { acf, cash }, acf / cash) : null;

  requireVerified(b, 'creative_loan_terms_unverified', 'The existing loan\'s balance, rate, payment, or arrears', l.balance, l.annualInterestRate, l.monthlyPrincipalAndInterest, l.arrears);
  b.warn('creative_due_on_sale', 'critical', 'The existing loan almost certainly contains a due-on-sale clause. Transferring title can allow the lender to call the full balance due. The seller remains liable on the loan.');
  b.warn('creative_insurance_escrow', 'caution', 'Hazard insurance, escrow, and loan servicing must be updated with the lender\'s and insurer\'s knowledge; misrepresentation can void coverage.');
  if (sellerEquity < 0) b.warn('creative_price_below_balance', 'critical', 'Purchase price is below the existing loan balance.');
  if (mcf < 0) b.warn('creative_negative_cash_flow', 'critical', 'Monthly cash flow is negative.');
  if (arrears > 0) b.warn('creative_arrears', 'caution', 'The loan is in arrears; obtain a reinstatement quote in writing. Foreclosure timelines may already be running.');
  b.warn('creative_legal_review', 'caution', LEGAL_REVIEW);

  return b.build({
    sellerEquity: roundCurrency(sellerEquity),
    equityAtEntry: roundCurrency(equityAtEntry),
    cashRequired: roundCurrency(cash),
    monthlyHousingPayment: roundCurrency(housing),
    monthlyCashFlow: roundCurrency(mcf),
    annualCashFlow: roundCurrency(acf),
    cashOnCash: coc,
    priceToValue: price / value,
  });
}

// ---------------------------------------------------------------------------------------------
// Wrap-around (sell on a new note while the underlying loan stays in place)
// ---------------------------------------------------------------------------------------------

export interface WrapInput {
  underlyingBalance: NumericInput;
  underlyingRate: NumericInput;
  underlyingRemainingMonths: number;
  /** Price to the end buyer. */
  wrapPrice: NumericInput;
  buyerDownPayment: NumericInput;
  wrapRate: NumericInput;
  wrapAmortizationMonths: number;
  wrapBalloonMonths?: number;
  /** Monthly loan servicing fee paid by the wrap seller. */
  monthlyServicingFee?: NumericInput;
}

export interface WrapResult {
  wrapNoteAmount: number;
  wrapMonthlyPayment: number;
  underlyingMonthlyPayment: number;
  monthlySpread: number;
  rateSpread: number;
  /** Wrap note balance minus underlying balance at the wrap balloon (or wrap payoff). */
  equityInNoteAtBalloon: number;
  underlyingBalanceAtBalloon: number;
  wrapBalanceAtBalloon: number;
}

export function analyzeWrap(input: WrapInput): CalculationResult<WrapResult> {
  const b = new ResultBuilder();
  const uBal = b.input('underlyingBalance', 'Underlying loan balance', input.underlyingBalance, nonNegative);
  const uRate = b.input('underlyingRate', 'Underlying loan rate', input.underlyingRate, rate);
  const uMonths = b.input('underlyingRemainingMonths', 'Underlying remaining term (months)', input.underlyingRemainingMonths, { gt: 0, integer: true });
  const price = b.input('wrapPrice', 'Wrap sale price', input.wrapPrice, { gt: 0 });
  const down = b.input('buyerDownPayment', 'Buyer down payment', input.buyerDownPayment, { min: 0, max: price });
  const wRate = b.input('wrapRate', 'Wrap note rate', input.wrapRate, rate);
  const wAmort = b.input('wrapAmortizationMonths', 'Wrap amortization (months)', input.wrapAmortizationMonths, { gt: 0, integer: true });
  const fee = b.optional('monthlyServicingFee', 'Monthly servicing fee', input.monthlyServicingFee, nonNegative);
  const horizon = input.wrapBalloonMonths === undefined ? wAmort : b.input('wrapBalloonMonths', 'Wrap balloon (months)', input.wrapBalloonMonths, { gt: 0, integer: true });

  const note = b.step('Wrap note amount', 'Wrap Price − Buyer Down Payment', { price, down }, price - down);
  const wPmt = b.step('Wrap monthly payment', 'N × r ÷ (1 − (1 + r)^−n)', { note, wRate, wAmort }, amortizingPayment(note, wRate, wAmort));
  const uPmt = b.step('Underlying monthly payment', 'B × r ÷ (1 − (1 + r)^−n)', { uBal, uRate, uMonths }, amortizingPayment(uBal, uRate, uMonths));
  const spread = b.step('Monthly spread', 'Wrap Payment − Underlying Payment − Servicing', { wPmt, uPmt, fee }, wPmt - uPmt - fee);
  const rateSpread = wRate - uRate;
  const uAt = remainingBalance(uBal, uRate, uMonths, Math.min(horizon, uMonths));
  const wAt = remainingBalance(note, wRate, wAmort, Math.min(horizon, wAmort));
  const equityAt = b.step('Equity in note at horizon', 'Wrap Balance − Underlying Balance', { wAt, uAt }, wAt - uAt);

  requireVerified(b, 'creative_loan_terms_unverified', 'The underlying loan\'s balance or rate', input.underlyingBalance, input.underlyingRate);
  b.warn('creative_due_on_sale', 'critical', 'The underlying loan likely contains a due-on-sale clause; the lender may call the loan when title transfers.');
  b.warn('creative_lending_compliance', 'critical', 'Seller-financed sales to consumers can fall under Dodd-Frank (TILA/ability-to-repay), the SAFE Act, and state installment-sale laws. Use a licensed residential mortgage loan originator and a third-party servicer where required.');
  if (note < uBal) b.warn('creative_wrap_underwater', 'critical', 'The wrap note is smaller than the underlying balance.');
  if (spread < 0) b.warn('creative_negative_spread', 'critical', 'The wrap payment does not cover the underlying payment and servicing.');
  if (input.wrapBalloonMonths !== undefined) b.warn('creative_balloon_risk', 'caution', `The buyer owes a balloon in month ${horizon}; the underlying loan must be paid off at that time.`);
  b.warn('creative_legal_review', 'caution', LEGAL_REVIEW);

  return b.build({
    wrapNoteAmount: roundCurrency(note),
    wrapMonthlyPayment: roundCurrency(wPmt),
    underlyingMonthlyPayment: roundCurrency(uPmt),
    monthlySpread: roundCurrency(spread),
    rateSpread,
    equityInNoteAtBalloon: roundCurrency(equityAt),
    underlyingBalanceAtBalloon: roundCurrency(uAt),
    wrapBalanceAtBalloon: roundCurrency(wAt),
  });
}

// ---------------------------------------------------------------------------------------------
// Lease option (lease with an option to purchase), from the owner's perspective
// ---------------------------------------------------------------------------------------------

export interface LeaseOptionInput {
  optionFee: NumericInput;
  monthlyRent: NumericInput;
  /** Portion of each month's rent credited toward the purchase price. */
  monthlyRentCredit?: NumericInput;
  strikePrice: NumericInput;
  termMonths: number;
  /** Owner's monthly carrying cost (debt service, taxes, insurance, reserves). */
  ownerMonthlyCost: NumericInput;
  currentValue: NumericInput;
  annualAppreciation: NumericInput;
  /** Whether the option fee is credited toward the price at exercise. Default true. */
  optionFeeCredited?: boolean;
}

export interface LeaseOptionResult {
  monthlyCashFlow: number;
  totalCashFlowOverTerm: number;
  totalRentCredits: number;
  netPriceAtExercise: number;
  projectedValueAtExercise: number;
  /** Projected value − strike price: the tenant-buyer's projected equity at exercise. */
  buyerProjectedEquity: number;
  /** Owner's total receipts if exercised: option fee + cash flow + net price. */
  ownerTotalIfExercised: number;
  /** Owner's total if not exercised: option fee + cash flow (property retained). */
  ownerTotalIfNotExercised: number;
}

export function analyzeLeaseOption(input: LeaseOptionInput): CalculationResult<LeaseOptionResult> {
  const b = new ResultBuilder();
  const fee = b.input('optionFee', 'Option fee', input.optionFee, nonNegative);
  const rent = b.input('monthlyRent', 'Monthly rent', input.monthlyRent, nonNegative);
  const credit = b.optional('monthlyRentCredit', 'Monthly rent credit', input.monthlyRentCredit, { min: 0, max: rent });
  const strike = b.input('strikePrice', 'Option strike price', input.strikePrice, { gt: 0 });
  const term = b.input('termMonths', 'Option term (months)', input.termMonths, { gt: 0, integer: true, max: 120 });
  const cost = b.input('ownerMonthlyCost', 'Owner monthly carrying cost', input.ownerMonthlyCost, nonNegative);
  const value = b.input('currentValue', 'Current value', input.currentValue, { gt: 0 });
  const ap = b.input('annualAppreciation', 'Annual appreciation', input.annualAppreciation, { min: -0.5, max: 0.5 });

  const mcf = b.step('Monthly cash flow', 'Rent − Owner Carrying Cost', { rent, cost }, rent - cost);
  const totalCf = mcf * term;
  const credits = b.step('Total rent credits', 'Monthly Credit × Term', { credit, term }, credit * term);
  const feeCredit = input.optionFeeCredited === false ? 0 : fee;
  const netPrice = b.step('Net price at exercise', 'Strike − Rent Credits − Credited Option Fee', { strike, credits, feeCredit }, strike - credits - feeCredit);
  const projected = b.step('Projected value at exercise', 'Value × (1 + Appreciation)^(Term ÷ 12)', { value, ap, term }, value * Math.pow(1 + ap, term / 12));
  const buyerEquity = projected - strike;
  const ifEx = fee + totalCf + netPrice;
  const ifNot = fee + totalCf;

  if (mcf < 0) b.warn('creative_negative_cash_flow', 'critical', 'Rent does not cover the owner\'s carrying cost.');
  if (strike < value) b.warn('creative_strike_below_value', 'caution', 'The strike price is below current value.');
  b.warn('creative_lease_option_recharacterization', 'caution', 'Some states treat lease options with large option fees or rent credits as executory contracts or equitable mortgages, with foreclosure-like protections and disclosure duties.');
  b.warn('creative_projection', 'info', 'Projected value extrapolates a constant appreciation assumption and is not a forecast.');
  b.warn('creative_legal_review', 'caution', LEGAL_REVIEW);

  return b.build({
    monthlyCashFlow: roundCurrency(mcf),
    totalCashFlowOverTerm: roundCurrency(totalCf),
    totalRentCredits: roundCurrency(credits),
    netPriceAtExercise: roundCurrency(netPrice),
    projectedValueAtExercise: roundCurrency(projected),
    buyerProjectedEquity: roundCurrency(buyerEquity),
    ownerTotalIfExercised: roundCurrency(ifEx),
    ownerTotalIfNotExercised: roundCurrency(ifNot),
  });
}
