import { z } from "zod";

export const LeadSource = z.enum([
  "web_form", "ppc", "seo", "direct_mail", "cold_call", "sms_campaign", "driving_for_dollars",
  "referral", "list_import", "ppl_vendor", "crm_sync", "manual", "other",
]);
export type LeadSource = z.infer<typeof LeadSource>;

export const AddressInput = z.object({
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  state: z.string().trim().length(2),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/),
});
export type AddressInput = z.infer<typeof AddressInput>;

export const Timeline = z.enum(["asap", "within_30_days", "within_90_days", "within_6_months", "flexible", "unknown"]);
export const Condition = z.enum(["turnkey", "light_repairs", "moderate_repairs", "major_repairs", "teardown", "unknown"]);
export const Occupancy = z.enum(["owner_occupied", "tenant_occupied", "vacant", "unknown"]);

/** Raw inbound lead from any source (webhook, CSV, CRM sync, manual entry). Everything optional except source. */
export const LeadInput = z.object({
  source: LeadSource,
  sourceDetail: z.string().max(200).optional(),
  externalId: z.string().max(200).optional(),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phones: z.array(z.string().trim().max(40)).max(10).default([]),
  email: z.string().trim().max(254).optional(),
  propertyAddress: AddressInput.optional(),
  mailingAddress: AddressInput.optional(),
  askingPrice: z.number().nonnegative().optional(),
  timeline: Timeline.optional(),
  condition: Condition.optional(),
  occupancy: Occupancy.optional(),
  /** Free-text seller notes / form message. Analyzed for motivation signals; never for protected characteristics. */
  notes: z.string().max(10_000).optional(),
  /** Marketing/list tags supplied by the source (e.g., "pre-foreclosure", "absentee"). */
  tags: z.array(z.string().max(60)).max(50).default([]),
  receivedAt: z.string().datetime({ offset: true }).optional(),
  /** Consent evidence captured at intake, if the source supplies it. */
  consent: z
    .object({
      sms: z.boolean().default(false),
      voice: z.boolean().default(false),
      disclosureText: z.string().max(5000).optional(),
      capturedAt: z.string().datetime({ offset: true }).optional(),
      ipAddress: z.string().max(64).optional(),
      pageUrl: z.string().max(2000).optional(),
    })
    .optional(),
});
export type LeadInput = z.input<typeof LeadInput>;
export type ParsedLeadInput = z.output<typeof LeadInput>;
