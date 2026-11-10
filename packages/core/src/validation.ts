/**
 * Request validation schemas (zod). Forms express rates as percentages (7 = 7%) because that is how
 * operators think; `toWholesaleDealInput` / `toRentalReportInput` convert to the engine's decimal
 * convention and attach provenance, so the engine never sees ambiguous units.
 */
import { z } from 'zod';
import type { InputSource, RentalReportInput, Sourced, WholesaleDealInput } from '@northstar/underwriting';

const money = z.coerce.number().finite().min(0).max(1_000_000_000);
const pct = z.coerce.number().finite().min(0).max(100);
const source = z.enum(['verified', 'user_assumption', 'third_party_estimate', 'ai_interpretation']);

export const sourcedMoney = z.object({
  value: money,
  source: source.default('user_assumption'),
  sourceRef: z.string().trim().max(200).optional(),
});

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: z.string().min(12).max(256),
  orgName: z.string().trim().min(1).max(200),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(256) });

export const compSchema = z.object({
  id: z.string().trim().min(1).max(40),
  address: z.string().trim().max(200).optional(),
  salePrice: money.positive(),
  squareFeet: z.coerce.number().int().positive().max(100_000),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  distanceMiles: z.coerce.number().min(0).max(100).optional(),
  netAdjustment: z.coerce.number().finite().min(-10_000_000).max(10_000_000).default(0),
  source: source.default('user_assumption'),
});

export const wholesaleFormSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().max(200).optional(),
    subjectSquareFeet: z.coerce.number().int().positive().max(100_000).optional(),
    subjectSquareFeetSource: source.default('user_assumption'),
    arv: sourcedMoney.optional(),
    comps: z.array(compSchema).max(25).default([]),
    valuationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    repairs: sourcedMoney,
    contractPrice: money.positive().optional(),
    assignmentFee: money,
    arvMultiplierPct: pct.positive().default(70),
    wholesalerCosts: money.default(0),
    buyer: z.object({
      acquisitionClosingPct: pct.default(1.5),
      holdingMonths: z.coerce.number().min(0).max(60).default(6),
      annualPropertyTax: money,
      annualInsurance: money,
      monthlyUtilities: money.default(0),
      loanToValuePct: pct.default(0),
      financeRehab: z.boolean().default(false),
      annualInterestRatePct: pct.default(0),
      pointsPct: pct.default(0),
      commissionPct: pct.default(5),
      sellerClosingPct: pct.default(1),
      targetProfitPct: pct.default(10),
    }),
  })
  .refine((v) => v.arv !== undefined || v.comps.length > 0, { message: 'Provide an ARV or at least one comparable sale.', path: ['arv'] })
  .refine((v) => v.comps.length === 0 || v.subjectSquareFeet !== undefined, { message: 'Subject square footage is required to use comps.', path: ['subjectSquareFeet'] })
  .refine((v) => v.buyer.loanToValuePct === 0 || v.buyer.annualInterestRatePct > 0, { message: 'Interest rate is required when financing.', path: ['buyer', 'annualInterestRatePct'] });

export type WholesaleForm = z.infer<typeof wholesaleFormSchema>;

const s = (value: number, src: InputSource, sourceRef?: string): Sourced => (sourceRef ? { value, source: src, sourceRef } : { value, source: src });
const r = (p: number) => p / 100;

export function toWholesaleDealInput(f: WholesaleForm): WholesaleDealInput {
  const out: WholesaleDealInput = {
    repairCosts: s(f.repairs.value, f.repairs.source, f.repairs.sourceRef),
    assignmentFee: f.assignmentFee,
    arvMultiplier: r(f.arvMultiplierPct),
    wholesalerCosts: f.wholesalerCosts,
    buyer: {
      acquisitionClosingRate: r(f.buyer.acquisitionClosingPct),
      holdingMonths: f.buyer.holdingMonths,
      annualPropertyTax: f.buyer.annualPropertyTax,
      annualInsurance: f.buyer.annualInsurance,
      monthlyUtilities: f.buyer.monthlyUtilities,
      loanToValue: r(f.buyer.loanToValuePct),
      financeRehab: f.buyer.financeRehab,
      annualInterestRate: r(f.buyer.annualInterestRatePct),
      points: r(f.buyer.pointsPct),
      commissionRate: r(f.buyer.commissionPct),
      sellerClosingRate: r(f.buyer.sellerClosingPct),
      targetProfitRate: r(f.buyer.targetProfitPct),
    },
  };
  if (f.arv) out.arv = s(f.arv.value, f.arv.source, f.arv.sourceRef);
  if (f.subjectSquareFeet !== undefined) out.subjectSquareFeet = s(f.subjectSquareFeet, f.subjectSquareFeetSource);
  if (f.valuationDate) out.valuationDate = f.valuationDate;
  if (f.contractPrice !== undefined) out.contractPrice = f.contractPrice;
  if (f.comps.length > 0) {
    out.comps = f.comps.map((c) => {
      const comp: NonNullable<WholesaleDealInput['comps']>[number] = {
        id: c.id,
        salePrice: s(c.salePrice, c.source),
        squareFeet: c.squareFeet,
      };
      if (c.address) comp.address = c.address;
      if (c.saleDate) comp.saleDate = c.saleDate;
      if (c.distanceMiles !== undefined) comp.distanceMiles = c.distanceMiles;
      if (c.netAdjustment !== 0) comp.adjustments = { net: c.netAdjustment };
      return comp;
    });
  }
  return out;
}

export const rentalFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  purchasePrice: sourcedMoney,
  monthlyRents: z.array(money).min(1).max(500),
  rentSource: source.default('user_assumption'),
  vacancyPct: pct,
  annualPropertyTax: money,
  annualInsurance: money,
  managementPct: pct.default(0),
  maintenancePct: pct.default(0),
  capexPct: pct.default(0),
  monthlyHoa: money.default(0),
  closingCosts: money.default(0),
  initialRepairs: money.default(0),
  financing: z.discriminatedUnion('type', [
    z.object({ type: z.literal('cash') }),
    z.object({
      type: z.literal('loan'),
      downPaymentPct: pct,
      annualInterestRatePct: pct.positive(),
      termYears: z.coerce.number().int().min(1).max(40),
      interestOnly: z.boolean().default(false),
      pointsPct: pct.default(0),
    }),
  ]),
  projection: z
    .object({ years: z.coerce.number().int().min(1).max(30), rentGrowthPct: z.coerce.number().min(-20).max(20), expenseGrowthPct: z.coerce.number().min(-20).max(20), appreciationPct: z.coerce.number().min(-20).max(20) })
    .optional(),
});

export type RentalForm = z.infer<typeof rentalFormSchema>;

export function toRentalReportInput(f: RentalForm): RentalReportInput {
  const out: RentalReportInput = {
    rental: {
      purchasePrice: s(f.purchasePrice.value, f.purchasePrice.source, f.purchasePrice.sourceRef),
      monthlyRents: f.monthlyRents.map((m) => s(m, f.rentSource)),
      vacancyRate: r(f.vacancyPct),
      expenses: {
        annualPropertyTax: f.annualPropertyTax,
        annualInsurance: f.annualInsurance,
        managementRate: r(f.managementPct),
        maintenanceRate: r(f.maintenancePct),
        capexRate: r(f.capexPct),
        monthlyHoa: f.monthlyHoa,
      },
      closingCosts: f.closingCosts,
      initialRepairs: f.initialRepairs,
    },
  };
  if (f.financing.type === 'loan') {
    out.rental.loan = {
      downPaymentRate: r(f.financing.downPaymentPct),
      annualInterestRate: r(f.financing.annualInterestRatePct),
      termMonths: f.financing.termYears * 12,
      interestOnly: f.financing.interestOnly,
      points: r(f.financing.pointsPct),
    };
  }
  if (f.projection) {
    out.projection = {
      years: f.projection.years,
      annualRentGrowth: r(f.projection.rentGrowthPct),
      annualExpenseGrowth: r(f.projection.expenseGrowthPct),
      annualAppreciation: r(f.projection.appreciationPct),
    };
  }
  return out;
}

/** Flatten zod issues into { "buyer.annualInterestRatePct": "message" } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = i.path.join('.') || '_';
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
