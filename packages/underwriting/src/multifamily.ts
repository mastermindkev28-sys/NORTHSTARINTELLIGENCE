/**
 * Small multifamily (2–20 units) rent-roll analysis and in-place vs pro-forma underwriting.
 *
 *   In-place GPR        = Σ current rent of occupied units × 12 (vacant/down units contribute 0)
 *   Market GPR          = Σ market rent of all units × 12
 *   Loss to lease       = Σ (market − current) over occupied units × 12
 *   Physical occupancy  = occupied units ÷ total units
 *   Economic occupancy  = In-place GPR ÷ Market GPR
 *
 * Rent rolls supplied by sellers are unverified until reconciled against leases and bank deposits;
 * the analysis says so whenever any unit's rent is not marked `verified`.
 */
import { ResultBuilder, UnderwritingInputError, nonNegative, roundCurrency, toSourced, type CalculationResult, type NumericInput } from './core';
import { analyzeRental, type LoanTerms, type OperatingExpenses, type RentalResult } from './rental';

export type UnitStatus = 'occupied' | 'notice' | 'vacant' | 'down';

export interface RentRollUnit {
  unitId: string;
  bedrooms: number;
  /** Current contract rent (0 or omitted for vacant/down units). */
  currentRent?: NumericInput;
  marketRent: NumericInput;
  status: UnitStatus;
  /** ISO date (YYYY-MM-DD) the lease ends; omitted for month-to-month or vacant. */
  leaseEnd?: string;
}

export interface RentRollInput {
  units: RentRollUnit[];
  /** ISO date of the rent roll; used for lease-expiration buckets (keeps the calculation deterministic). */
  asOf: string;
}

export interface RentRollResult {
  unitCount: number;
  occupiedUnits: number;
  physicalOccupancy: number;
  economicOccupancy: number;
  inPlaceMonthlyRent: number;
  marketMonthlyRent: number;
  inPlaceGpr: number;
  marketGpr: number;
  lossToLease: number;
  averageInPlaceRent: number | null;
  /** Leases expiring within 12 months of `asOf`, plus month-to-month occupied units. */
  expiringWithin12Months: number;
  monthToMonth: number;
  unverifiedUnits: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  return (ty - fy) * 12 + (tm - fm) + (td - fd) / 31;
}

export function analyzeRentRoll(input: RentRollInput): CalculationResult<RentRollResult> {
  const b = new ResultBuilder();
  if (!Array.isArray(input.units) || input.units.length === 0) throw new UnderwritingInputError('units', 'at least one unit is required');
  if (!DATE.test(input.asOf)) throw new UnderwritingInputError('asOf', 'must be an ISO date (YYYY-MM-DD)');
  const ids = new Set<string>();
  let occupied = 0;
  let inPlace = 0;
  let market = 0;
  let ltl = 0;
  let expiring = 0;
  let mtm = 0;
  let unverified = 0;
  let below = 0;
  input.units.forEach((u, i) => {
    const p = `units[${i}]`;
    if (!u.unitId) throw new UnderwritingInputError(`${p}.unitId`, 'is required');
    if (ids.has(u.unitId)) throw new UnderwritingInputError(`${p}.unitId`, `duplicate unit id ${u.unitId}`);
    ids.add(u.unitId);
    if (!['occupied', 'notice', 'vacant', 'down'].includes(u.status)) throw new UnderwritingInputError(`${p}.status`, 'invalid status');
    b.input(`${p}.bedrooms`, `Unit ${u.unitId} bedrooms`, u.bedrooms, { min: 0, max: 8, integer: true });
    const mkt = b.input(`${p}.marketRent`, `Unit ${u.unitId} market rent`, u.marketRent, nonNegative);
    market += mkt;
    const isOccupied = u.status === 'occupied' || u.status === 'notice';
    if (!isOccupied) return;
    if (u.currentRent === undefined) throw new UnderwritingInputError(`${p}.currentRent`, 'is required for occupied units');
    const cur = b.input(`${p}.currentRent`, `Unit ${u.unitId} current rent`, u.currentRent, nonNegative);
    if (toSourced(u.currentRent).source !== 'verified') unverified++;
    occupied++;
    inPlace += cur;
    ltl += mkt - cur;
    if (mkt > 0 && cur < mkt * 0.9) below++;
    if (u.leaseEnd === undefined) {
      mtm++;
      expiring++;
    } else {
      if (!DATE.test(u.leaseEnd)) throw new UnderwritingInputError(`${p}.leaseEnd`, 'must be an ISO date (YYYY-MM-DD)');
      if (monthsBetween(input.asOf, u.leaseEnd) <= 12) expiring++;
    }
  });
  const n = input.units.length;
  const inPlaceGpr = b.step('In-place GPR', 'Σ Occupied Current Rent × 12', { inPlace }, inPlace * 12);
  const marketGpr = b.step('Market GPR', 'Σ Market Rent × 12', { market }, market * 12);
  const lossToLease = b.step('Loss to lease', 'Σ (Market − Current) over occupied × 12', { ltl }, ltl * 12);
  const physical = b.step('Physical occupancy', 'Occupied Units ÷ Total Units', { occupied, n }, occupied / n);
  const economic = marketGpr > 0 ? b.step('Economic occupancy', 'In-place GPR ÷ Market GPR', { inPlaceGpr, marketGpr }, inPlaceGpr / marketGpr) : 0;

  if (unverified > 0) b.warn('rent_roll_unverified', 'caution', `${unverified} occupied unit rent(s) are not verified. Reconcile the rent roll against signed leases and 3–12 months of bank deposits.`);
  if (physical < 0.85) b.warn('rent_roll_low_occupancy', 'caution', `Physical occupancy is ${(physical * 100).toFixed(0)}%.`);
  if (occupied > 0 && expiring / occupied > 0.5) b.warn('rent_roll_rollover', 'caution', `${expiring} of ${occupied} occupied leases expire within 12 months or are month-to-month.`);
  if (below > 0) b.warn('rent_roll_below_market', 'info', `${below} unit(s) rent more than 10% below market. Upside depends on lease terms and local rent regulation.`);
  if (n > 4) b.warn('rent_roll_commercial_financing', 'info', 'Properties with 5+ units are typically financed with commercial loans underwritten on NOI and DSCR.');

  return b.build({
    unitCount: n,
    occupiedUnits: occupied,
    physicalOccupancy: physical,
    economicOccupancy: economic,
    inPlaceMonthlyRent: roundCurrency(inPlace),
    marketMonthlyRent: roundCurrency(market),
    inPlaceGpr: roundCurrency(inPlaceGpr),
    marketGpr: roundCurrency(marketGpr),
    lossToLease: roundCurrency(lossToLease),
    averageInPlaceRent: occupied > 0 ? roundCurrency(inPlace / occupied) : null,
    expiringWithin12Months: expiring,
    monthToMonth: mtm,
    unverifiedUnits: unverified,
  });
}

export interface SmallMultifamilyInput {
  rentRoll: RentRollInput;
  purchasePrice: NumericInput;
  otherMonthlyIncome?: NumericInput;
  /** Vacancy applied to the pro-forma (all units at market). In-place uses actual vacancy plus this as credit loss. */
  vacancyRate: NumericInput;
  /** Credit loss applied to in-place rents (default 0.02). */
  inPlaceCreditLoss?: NumericInput;
  expenses: OperatingExpenses;
  loan?: LoanTerms;
  closingCosts?: NumericInput;
  initialRepairs?: NumericInput;
}

export interface SmallMultifamilyResult {
  rentRoll: RentRollResult;
  /** Underwritten on rents actually being collected (vacant units at 0). */
  inPlace: RentalResult;
  /** Underwritten with every unit at market rent and the stated vacancy. */
  proForma: RentalResult;
  noiUpside: number;
  pricePerUnit: number;
}

export function analyzeSmallMultifamily(input: SmallMultifamilyInput): CalculationResult<SmallMultifamilyResult> {
  const b = new ResultBuilder();
  const roll = b.absorb(analyzeRentRoll(input.rentRoll), 'Rent roll');
  const price = b.input('purchasePrice', 'Purchase price', input.purchasePrice, { gt: 0 });
  const credit = b.input('inPlaceCreditLoss', 'In-place credit loss', input.inPlaceCreditLoss ?? 0.02, { min: 0, max: 1 });
  const common = {
    purchasePrice: input.purchasePrice,
    otherMonthlyIncome: input.otherMonthlyIncome,
    expenses: input.expenses,
    loan: input.loan,
    closingCosts: input.closingCosts,
    initialRepairs: input.initialRepairs,
  };
  const units = input.rentRoll.units;
  // Pro-forma vacancy is recorded here; per-unit rents are already recorded by the rent roll.
  b.input('vacancyRate', 'Pro-forma vacancy', input.vacancyRate, { min: 0, max: 1 });
  b.derived(...units.map((_, i) => `monthlyRents[${i}]`));
  const inPlaceRents = units.map((u) => (u.status === 'occupied' || u.status === 'notice') && u.currentRent !== undefined ? toSourced(u.currentRent) : 0);
  const inPlace = b.absorb(analyzeRental({ ...common, monthlyRents: inPlaceRents, vacancyRate: credit }), 'In-place');
  const proForma = analyzeRental({ ...common, monthlyRents: units.map((u) => u.marketRent), vacancyRate: input.vacancyRate });
  b.absorb(proForma, 'Pro forma');
  const upside = b.step('NOI upside', 'Pro-forma NOI − In-place NOI', { proForma: proForma.value.netOperatingIncome, inPlace: inPlace.netOperatingIncome }, proForma.value.netOperatingIncome - inPlace.netOperatingIncome);
  const ppu = price / roll.unitCount;
  b.warn('multifamily_pro_forma', 'info', 'Pro-forma figures assume every unit leases at market rent; they are a target, not current performance. Price offers on in-place income.');
  return b.build({ rentRoll: roll, inPlace, proForma: proForma.value, noiUpside: roundCurrency(upside), pricePerUnit: roundCurrency(ppu) });
}
