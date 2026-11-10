import { describe, expect, it } from 'vitest';
import {
  ENGINE_VERSION,
  UnderwritingInputError,
  analyzeBrrrr,
  analyzeLeaseOption,
  analyzeRentRoll,
  analyzeSection8,
  analyzeSellerFinance,
  analyzeSmallMultifamily,
  analyzeSubjectTo,
  analyzeWrap,
  sourced,
  type BrrrrInput,
  type RentRollInput,
} from '../src/index';

const expenses = { annualPropertyTax: 2400, annualInsurance: 1200, managementRate: 0.08, maintenanceRate: 0.05, capexRate: 0.05 };
const codes = (r: { warnings: { code: string }[] }) => r.warnings.map((w) => w.code);

describe('ENGINE_VERSION', () => {
  it('is bumped for the strategy engines', () => expect(ENGINE_VERSION).toBe('1.1.0'));
});

describe('analyzeBrrrr', () => {
  const input: BrrrrInput = {
    purchasePrice: 100_000,
    rehabCost: 40_000,
    acquisitionClosingCosts: 3000,
    holdingCosts: 5000,
    acquisitionFinancingCosts: 2000,
    acquisitionLoan: 110_000,
    afterRepairValue: 200_000,
    refinanceLtv: 0.75,
    refinanceRate: 0.07,
    refinanceTermMonths: 360,
    refinanceClosingCosts: 4000,
    monthsToRefinance: 7,
    monthlyRents: [1800],
    vacancyRate: 0.05,
    expenses,
  };
  const r = analyzeBrrrr(input);
  it('computes capital recycling (hand-checked)', () => {
    expect(r.value.totalProjectCost).toBe(150_000);
    expect(r.value.cashInvestedBeforeRefinance).toBe(40_000);
    expect(r.value.refinanceLoan).toBe(150_000);
    expect(r.value.cashOutAtRefinance).toBe(36_000);
    expect(r.value.cashLeftInDeal).toBe(4000);
    expect(r.value.capitalRecoveredRate).toBeCloseTo(0.9, 12);
    expect(r.value.equityAfterRefinance).toBe(50_000);
  });
  it('computes stabilized operations on the refinance loan', () => {
    // NOI matches the rental reference case (same rents and expenses); 150k at 7%/30y = 997.95/mo.
    expect(r.value.netOperatingIncome).toBe(13_118.4);
    expect(r.value.monthlyDebtService).toBe(997.95);
    expect(r.value.annualCashFlow).toBe(1142.96);
    expect(r.value.cashOnCash!).toBeCloseTo(1142.96 / 4000, 3);
    expect(r.value.yieldOnCost).toBeCloseTo(13_118.4 / 150_000, 10);
    expect(r.value.capRateOnValue).toBeCloseTo(0.065592, 10);
  });
  it('flags an unappraised ARV and does not record calculated loan as an assumption', () => {
    expect(codes(r)).toContain('brrrr_arv_unverified');
    expect(r.assumptions.find((a) => a.key === 'loanAmount')).toBeUndefined();
    expect(r.assumptions.find((a) => a.key === 'purchasePrice')!.value).toBe(100_000);
  });
  it('reports unbounded return and no CoC when all capital is recovered', () => {
    const all = analyzeBrrrr({ ...input, refinanceLtv: 0.8, afterRepairValue: sourced(220_000, 'verified', { sourceRef: 'Appraisal' }) });
    expect(all.value.cashLeftInDeal).toBeLessThanOrEqual(0);
    expect(all.value.cashOnCash).toBeNull();
    expect(codes(all)).toContain('brrrr_all_capital_recovered');
    expect(codes(all)).not.toContain('brrrr_arv_unverified');
  });
  it('flags a short refinance, high LTV, early seasoning and value below cost', () => {
    const bad = analyzeBrrrr({ ...input, afterRepairValue: 130_000, refinanceLtv: 0.85, monthsToRefinance: 3 });
    expect(bad.value.cashOutAtRefinance).toBeLessThan(0);
    expect(codes(bad)).toEqual(expect.arrayContaining(['brrrr_refi_short', 'brrrr_high_ltv', 'brrrr_seasoning', 'brrrr_value_below_cost']));
  });
  it('notes unknown seasoning and handles all-cash purchases', () => {
    const { acquisitionLoan: _a, monthsToRefinance: _m, ...cash } = input;
    const c = analyzeBrrrr(cash);
    expect(c.value.cashInvestedBeforeRefinance).toBe(150_000);
    expect(c.value.cashOutAtRefinance).toBe(146_000);
    expect(codes(c)).toContain('brrrr_seasoning_unknown');
  });
  it('rejects invalid input', () => {
    expect(() => analyzeBrrrr({ ...input, refinanceLtv: 75 })).toThrow(UnderwritingInputError);
    expect(() => analyzeBrrrr({ ...input, afterRepairValue: 0 })).toThrow(UnderwritingInputError);
  });
});

describe('analyzeSellerFinance', () => {
  it('computes payment, balloon and interest (independently computed)', () => {
    const r = analyzeSellerFinance({ purchasePrice: 200_000, downPayment: 20_000, annualInterestRate: 0.06, amortizationMonths: 360, balloonMonths: 60, closingCosts: 2500 });
    expect(r.value.noteAmount).toBe(180_000);
    expect(r.value.monthlyPayment).toBe(1079.19);
    expect(r.value.balloonPayment).toBe(167_497.84);
    expect(r.value.totalInterest).toBe(52_249.3);
    expect(r.value.cashToClose).toBe(22_500);
    expect(r.warnings.find((w) => w.code === 'creative_balloon_risk')!.severity).toBe('caution');
    const short = analyzeSellerFinance({ purchasePrice: 200_000, downPayment: 20_000, annualInterestRate: 0.06, amortizationMonths: 360, balloonMonths: 36 });
    expect(short.warnings.find((w) => w.code === 'creative_balloon_risk')!.severity).toBe('critical');
    expect(codes(r)).toContain('creative_legal_review');
  });
  it('treats a balloon at or after amortization as fully amortizing', () => {
    const r = analyzeSellerFinance({ purchasePrice: 100_000, downPayment: 0, annualInterestRate: 0, amortizationMonths: 120, balloonMonths: 120 });
    expect(r.value.balloonMonth).toBeNull();
    expect(r.value.monthlyPayment).toBeCloseTo(833.33, 2);
    expect(r.value.totalInterest).toBe(0);
  });
  it('supports interest-only notes and requires a balloon for them', () => {
    const r = analyzeSellerFinance({ purchasePrice: 100_000, downPayment: 10_000, annualInterestRate: 0.06, amortizationMonths: 360, interestOnly: true, balloonMonths: 84 });
    expect(r.value.monthlyPayment).toBe(450);
    expect(r.value.balloonPayment).toBe(90_000);
    expect(() => analyzeSellerFinance({ purchasePrice: 100_000, downPayment: 0, annualInterestRate: 0.06, amortizationMonths: 360, interestOnly: true })).toThrow(UnderwritingInputError);
  });
  it('rejects a down payment above price', () => {
    expect(() => analyzeSellerFinance({ purchasePrice: 100, downPayment: 101, annualInterestRate: 0.05, amortizationMonths: 12 })).toThrow(UnderwritingInputError);
  });
});

describe('analyzeSubjectTo', () => {
  const base = {
    purchasePrice: 180_000,
    existingLoan: {
      balance: sourced(150_000, 'verified', { sourceRef: 'Mortgage statement 2026-10' }),
      annualInterestRate: sourced(0.035, 'verified'),
      monthlyPrincipalAndInterest: sourced(850, 'verified'),
      monthlyEscrow: 350,
    },
    cashToSeller: 5000,
    closingCosts: 2000,
    repairs: 3000,
    marketValue: 220_000,
    monthlyRent: 1900,
    monthlyOperatingExpenses: 300,
  };
  it('computes equity, cash required and cash flow', () => {
    const r = analyzeSubjectTo(base);
    expect(r.value.sellerEquity).toBe(30_000);
    expect(r.value.equityAtEntry).toBe(70_000);
    expect(r.value.cashRequired).toBe(10_000);
    expect(r.value.monthlyHousingPayment).toBe(1200);
    expect(r.value.monthlyCashFlow).toBe(400);
    expect(r.value.cashOnCash).toBeCloseTo(0.48, 12);
    expect(r.value.priceToValue).toBeCloseTo(180 / 220, 12);
  });
  it('always flags due-on-sale; verified terms do not raise the unverified flag', () => {
    const r = analyzeSubjectTo(base);
    expect(r.warnings.find((w) => w.code === 'creative_due_on_sale')!.severity).toBe('critical');
    expect(codes(r)).not.toContain('creative_loan_terms_unverified');
  });
  it('treats recorded or estimated loan data as unverified', () => {
    const r = analyzeSubjectTo({
      ...base,
      existingLoan: { ...base.existingLoan, balance: sourced(150_000, 'third_party_estimate', { sourceRef: 'Recorded mortgage, original amount' }), arrears: 6000 },
    });
    const w = r.warnings.find((x) => x.code === 'creative_loan_terms_unverified')!;
    expect(w.severity).toBe('critical');
    expect(w.message).toMatch(/recorded mortgage data does not establish/);
    expect(codes(r)).toContain('creative_arrears');
    expect(r.value.cashRequired).toBe(16_000);
  });
  it('flags negative cash flow and price below balance', () => {
    const r = analyzeSubjectTo({ ...base, purchasePrice: 140_000, monthlyRent: 1000 });
    expect(codes(r)).toEqual(expect.arrayContaining(['creative_negative_cash_flow', 'creative_price_below_balance']));
  });
});

describe('analyzeWrap', () => {
  const input = {
    underlyingBalance: sourced(120_000, 'verified'),
    underlyingRate: sourced(0.035, 'verified'),
    underlyingRemainingMonths: 300,
    wrapPrice: 200_000,
    buyerDownPayment: 10_000,
    wrapRate: 0.08,
    wrapAmortizationMonths: 360,
    wrapBalloonMonths: 84,
    monthlyServicingFee: 35,
  };
  it('computes spread and balances at the balloon (independently computed)', () => {
    const r = analyzeWrap(input);
    expect(r.value.wrapNoteAmount).toBe(190_000);
    expect(r.value.wrapMonthlyPayment).toBe(1394.15);
    expect(r.value.underlyingMonthlyPayment).toBe(600.75);
    expect(r.value.monthlySpread).toBe(758.4);
    expect(r.value.rateSpread).toBeCloseTo(0.045, 12);
    expect(r.value.underlyingBalanceAtBalloon).toBe(96_171.82);
    expect(r.value.wrapBalanceAtBalloon).toBe(175_707.12);
    expect(r.value.equityInNoteAtBalloon).toBe(79_535.3);
  });
  it('flags lending-compliance and due-on-sale risk on every wrap', () => {
    const r = analyzeWrap(input);
    expect(codes(r)).toEqual(expect.arrayContaining(['creative_due_on_sale', 'creative_lending_compliance', 'creative_balloon_risk']));
  });
  it('flags an underwater wrap and negative spread', () => {
    const r = analyzeWrap({ ...input, wrapPrice: 110_000, wrapRate: 0.02 });
    expect(codes(r)).toEqual(expect.arrayContaining(['creative_wrap_underwater', 'creative_negative_spread']));
    expect(codes(analyzeWrap({ ...input, underlyingBalance: 120_000 }))).toContain('creative_loan_terms_unverified');
  });
});

describe('analyzeLeaseOption', () => {
  const input = { optionFee: 5000, monthlyRent: 1800, monthlyRentCredit: 200, strikePrice: 230_000, termMonths: 24, ownerMonthlyCost: 1400, currentValue: 220_000, annualAppreciation: 0.03 };
  it('computes cash flow, credits and exercise economics', () => {
    const r = analyzeLeaseOption(input);
    expect(r.value.monthlyCashFlow).toBe(400);
    expect(r.value.totalCashFlowOverTerm).toBe(9600);
    expect(r.value.totalRentCredits).toBe(4800);
    expect(r.value.netPriceAtExercise).toBe(220_200);
    expect(r.value.projectedValueAtExercise).toBe(233_398);
    expect(r.value.buyerProjectedEquity).toBe(3398);
    expect(r.value.ownerTotalIfExercised).toBe(234_800);
    expect(r.value.ownerTotalIfNotExercised).toBe(14_600);
    expect(codes(r)).toContain('creative_lease_option_recharacterization');
  });
  it('honours a non-credited option fee and rejects a credit above rent', () => {
    expect(analyzeLeaseOption({ ...input, optionFeeCredited: false }).value.netPriceAtExercise).toBe(225_200);
    expect(() => analyzeLeaseOption({ ...input, monthlyRentCredit: 2000 })).toThrow(UnderwritingInputError);
  });
  it('flags negative cash flow and a strike below value', () => {
    const r = analyzeLeaseOption({ ...input, ownerMonthlyCost: 2000, strikePrice: 200_000 });
    expect(codes(r)).toEqual(expect.arrayContaining(['creative_negative_cash_flow', 'creative_strike_below_value']));
  });
});

describe('analyzeSection8', () => {
  const unit = { bedrooms: 3, hudBenchmark: sourced(1800, 'third_party_estimate', { sourceRef: 'HUD FMR FY2027' }), utilityAllowance: 150, proposedContractRent: 1700, comparableMarketRent: 1600 };
  const base = { benchmarkKind: 'SAFMR' as const, benchmarkYear: 2027, purchasePrice: 150_000, vacancyRate: 0.05, expenses };
  it('caps the underwritten rent at the lowest of proposed, payment standard and market', () => {
    const r = analyzeSection8({ ...base, units: [unit] });
    const u = r.value.units[0]!;
    expect(u.paymentStandard).toBe(1800);
    expect(u.paymentStandardIsEstimate).toBe(true);
    expect(u.contractRentAtStandard).toBe(1650);
    expect(u.underwrittenContractRent).toBe(1600);
    expect(u.bindingLimit).toBe('market');
    expect(u.premiumToMarket).toBe(0);
    expect(r.value.benchmarkLabel).toBe('HUD SAFMR FY2027');
    expect(r.value.voucherScenario.grossPotentialRent).toBe(19_200);
  });
  it('uses a verified PHA payment standard and binds on it when lower', () => {
    const r = analyzeSection8({ ...base, units: [{ ...unit, comparableMarketRent: 2000, phaPaymentStandard: sourced(1710, 'verified', { sourceRef: 'PHA schedule eff. 2026-10-01' }) }] });
    const u = r.value.units[0]!;
    expect(u.paymentStandardIsEstimate).toBe(false);
    expect(u.underwrittenContractRent).toBe(1560);
    expect(u.bindingLimit).toBe('payment_standard');
    expect(r.value.monthlyRentDifference).toBe(-440);
    expect(codes(r)).not.toContain('section8_payment_standard_estimated');
  });
  it('always states that benchmarks are not approved rents and forbids tenant screening use', () => {
    const r = analyzeSection8({ ...base, units: [unit] });
    expect(r.warnings.find((w) => w.code === 'section8_not_guaranteed')!.message).toMatch(/not an approved rent/);
    expect(codes(r)).toEqual(expect.arrayContaining(['section8_no_tenant_screening', 'section8_payment_standard_estimated', 'section8_above_market']));
  });
  it('does not record calculated rents as user assumptions', () => {
    const r = analyzeSection8({ ...base, units: [unit] });
    expect(r.assumptions.some((a) => a.key.startsWith('monthlyRents'))).toBe(false);
    expect(r.assumptions.find((a) => a.key === 'units[0].hudBenchmark')!.source).toBe('third_party_estimate');
  });
  it('applies an assumed payment standard rate and validates input', () => {
    const r = analyzeSection8({ ...base, assumedPaymentStandardRate: 0.9, units: [{ ...unit, comparableMarketRent: 3000, proposedContractRent: 3000 }] });
    expect(r.value.units[0]!.paymentStandard).toBe(1620);
    expect(r.value.units[0]!.underwrittenContractRent).toBe(1470);
    expect(() => analyzeSection8({ ...base, units: [] })).toThrow(UnderwritingInputError);
    expect(() => analyzeSection8({ ...base, benchmarkKind: 'XYZ' as never, units: [unit] })).toThrow(UnderwritingInputError);
  });
});

describe('analyzeRentRoll and analyzeSmallMultifamily', () => {
  const roll: RentRollInput = {
    asOf: '2026-11-01',
    units: [
      { unitId: '1', bedrooms: 2, currentRent: sourced(1100, 'verified'), marketRent: 1300, status: 'occupied', leaseEnd: '2027-03-31' },
      { unitId: '2', bedrooms: 2, currentRent: 1250, marketRent: 1300, status: 'occupied', leaseEnd: '2028-06-30' },
      { unitId: '3', bedrooms: 1, currentRent: 950, marketRent: 1000, status: 'notice' },
      { unitId: '4', bedrooms: 1, marketRent: 1000, status: 'vacant' },
    ],
  };
  it('computes occupancy, loss to lease and rollover (hand-checked)', () => {
    const r = analyzeRentRoll(roll);
    expect(r.value.unitCount).toBe(4);
    expect(r.value.occupiedUnits).toBe(3);
    expect(r.value.physicalOccupancy).toBe(0.75);
    expect(r.value.inPlaceMonthlyRent).toBe(3300);
    expect(r.value.marketMonthlyRent).toBe(4600);
    expect(r.value.inPlaceGpr).toBe(39_600);
    expect(r.value.marketGpr).toBe(55_200);
    expect(r.value.lossToLease).toBe(3600);
    expect(r.value.economicOccupancy).toBeCloseTo(39_600 / 55_200, 12);
    expect(r.value.averageInPlaceRent).toBe(1100);
    expect(r.value.expiringWithin12Months).toBe(2);
    expect(r.value.monthToMonth).toBe(1);
    expect(r.value.unverifiedUnits).toBe(2);
    expect(codes(r)).toEqual(expect.arrayContaining(['rent_roll_unverified', 'rent_roll_low_occupancy', 'rent_roll_rollover', 'rent_roll_below_market']));
  });
  it('rejects malformed rent rolls', () => {
    expect(() => analyzeRentRoll({ ...roll, asOf: '11/01/2026' })).toThrow(UnderwritingInputError);
    expect(() => analyzeRentRoll({ ...roll, units: [roll.units[0]!, roll.units[0]!] })).toThrow(/duplicate/);
    expect(() => analyzeRentRoll({ ...roll, units: [{ unitId: '9', bedrooms: 1, marketRent: 900, status: 'occupied' }] })).toThrow(UnderwritingInputError);
    expect(() => analyzeRentRoll({ asOf: '2026-11-01', units: [] })).toThrow(UnderwritingInputError);
  });
  it('underwrites in-place and pro-forma separately', () => {
    const r = analyzeSmallMultifamily({ rentRoll: roll, purchasePrice: 400_000, vacancyRate: 0.05, expenses: { annualPropertyTax: 6000, annualInsurance: 2400 } });
    expect(r.value.inPlace.grossPotentialRent).toBe(39_600);
    expect(r.value.inPlace.vacancyLoss).toBe(792);
    expect(r.value.inPlace.netOperatingIncome).toBe(30_408);
    expect(r.value.proForma.grossPotentialRent).toBe(55_200);
    expect(r.value.proForma.netOperatingIncome).toBe(44_040);
    expect(r.value.noiUpside).toBe(13_632);
    expect(r.value.pricePerUnit).toBe(100_000);
    expect(r.assumptions.find((a) => a.key === 'vacancyRate')!.value).toBe(0.05);
    expect(r.assumptions.some((a) => a.key.startsWith('monthlyRents'))).toBe(false);
    expect(codes(r)).toContain('multifamily_pro_forma');
  });
});
