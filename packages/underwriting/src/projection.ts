import { irr, remainingBalance } from "./finance";
import { annualDebtServiceFor, computeOperatingExpenses, resolveLoanAmount, validateRentalInputs, type RentalInputs } from "./rental";
import { CalculationInputError, requireRate } from "./trace";

export interface ProjectionInputs {
  rental: RentalInputs;
  years: number;
  annualRentGrowth: number;
  /** Growth applied to fixed expenses (tax, insurance, HOA, utilities, other). Percentage-based expenses track income. */
  annualExpenseGrowth: number;
  annualAppreciation: number;
  /** Selling costs at exit as a decimal of sale price. */
  saleCostRate: number;
}

export interface ProjectionYear {
  year: number;
  grossScheduledIncome: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  debtService: number;
  cashFlow: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
}

export interface ProjectionResult {
  years: ProjectionYear[];
  saleProceeds: number;
  totalCashFlow: number;
  totalProfit: number;
  equityMultiple: number | null;
  irr: number | null;
  cashFlows: number[];
}

/** Multi-year hold projection with sale at the end of the final year. Annual periods; growth compounds yearly. */
export function projectHold(p: ProjectionInputs): ProjectionResult {
  const r = p.rental;
  validateRentalInputs(r);
  if (!Number.isInteger(p.years) || p.years < 1 || p.years > 40) throw new CalculationInputError("years must be an integer 1–40");
  requireRate("annualRentGrowth", Math.abs(p.annualRentGrowth), { max: 0.5 });
  requireRate("annualExpenseGrowth", Math.abs(p.annualExpenseGrowth), { max: 0.5 });
  requireRate("annualAppreciation", Math.abs(p.annualAppreciation), { max: 0.5 });
  requireRate("saleCostRate", p.saleCostRate, { max: 0.2 });

  const loanAmount = resolveLoanAmount(r.purchasePrice, r.financing);
  const debtService = r.financing ? annualDebtServiceFor(loanAmount, r.financing) : 0;
  const financingFees = r.financing ? loanAmount * (r.financing.points ?? 0) + (r.financing.lenderFees ?? 0) : 0;
  const initialCash = r.purchasePrice - loanAmount + (r.closingCosts ?? 0) + (r.rehabCost ?? 0) + financingFees;
  const startValue = r.marketValue ?? r.purchasePrice + (r.rehabCost ?? 0);

  const rows: ProjectionYear[] = [];
  const cashFlows = [-initialCash];
  for (let year = 1; year <= p.years; year++) {
    const incomeGrowth = (1 + p.annualRentGrowth) ** (year - 1);
    const expenseGrowth = (1 + p.annualExpenseGrowth) ** (year - 1);
    const grown: RentalInputs = {
      ...r,
      monthlyRent: r.monthlyRent * incomeGrowth,
      otherMonthlyIncome: (r.otherMonthlyIncome ?? 0) * incomeGrowth,
      annualPropertyTax: r.annualPropertyTax * expenseGrowth,
      annualInsurance: r.annualInsurance * expenseGrowth,
      monthlyHoa: (r.monthlyHoa ?? 0) * expenseGrowth,
      monthlyUtilities: (r.monthlyUtilities ?? 0) * expenseGrowth,
      otherAnnualExpenses: (r.otherAnnualExpenses ?? 0) * expenseGrowth,
    };
    const gsi = (grown.monthlyRent + (grown.otherMonthlyIncome ?? 0)) * 12;
    const egi = gsi * (1 - r.vacancyRate);
    const opex = computeOperatingExpenses(grown, gsi, egi).total;
    const noi = egi - opex;
    const cashFlow = noi - debtService;
    const propertyValue = startValue * (1 + p.annualAppreciation) ** year;
    const loanBalance = !r.financing || loanAmount === 0 ? 0
      : r.financing.interestOnly ? loanAmount
      : remainingBalance(loanAmount, r.financing.annualRate, r.financing.termMonths, Math.min(year * 12, r.financing.termMonths));
    rows.push({ year, grossScheduledIncome: gsi, effectiveGrossIncome: egi, operatingExpenses: opex, netOperatingIncome: noi, debtService, cashFlow, propertyValue, loanBalance, equity: propertyValue - loanBalance });
    cashFlows.push(cashFlow);
  }
  const last = rows[rows.length - 1] as ProjectionYear;
  const saleProceeds = last.propertyValue * (1 - p.saleCostRate) - last.loanBalance;
  cashFlows[cashFlows.length - 1] = (cashFlows[cashFlows.length - 1] as number) + saleProceeds;
  const totalCashFlow = rows.reduce((s, y) => s + y.cashFlow, 0);
  const totalProfit = totalCashFlow + saleProceeds - initialCash;
  return {
    years: rows,
    saleProceeds,
    totalCashFlow,
    totalProfit,
    equityMultiple: initialCash > 0 ? (totalCashFlow + saleProceeds) / initialCash : null,
    irr: irr(cashFlows),
    cashFlows,
  };
}
