import { NorthstarError } from "@northstar/core";
import { assessCompleteness, type CompletenessResult } from "./completeness";
import { findDuplicates, type DuplicateResult, type LeadIdentity } from "./dedupe";
import {
  normalizeAddress,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  type NormalizedAddress,
  type NormalizedPhone,
} from "./normalize";
import { LeadInput, type ParsedLeadInput } from "./schema";
import { scoreLead, type LeadScore, type ScoringContext } from "./scoring";

export interface ProcessedLead {
  input: ParsedLeadInput;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phones: NormalizedPhone[];
  invalidPhones: string[];
  email: string | null;
  propertyAddress: NormalizedAddress | null;
  mailingAddress: NormalizedAddress | null;
  /** True if mailing address differs from property address (absentee owner indicator). */
  absentee: boolean | null;
  duplicates: DuplicateResult;
  score: LeadScore;
  completeness: CompletenessResult;
  identity: Omit<LeadIdentity, "id">;
}

export interface IntakeOptions {
  existing?: readonly LeadIdentity[];
  scoring?: Omit<ScoringContext, "hasValidPhone" | "hasValidEmail" | "phoneLineType">;
}

/** Validate → normalize → dedupe → score → assess completeness. Pure and deterministic given its inputs. */
export function processLeadIntake(raw: unknown, opts: IntakeOptions = {}): ProcessedLead {
  const parsed = LeadInput.safeParse(raw);
  if (!parsed.success) {
    throw new NorthstarError("VALIDATION_FAILED", "Invalid lead payload", {
      details: { issues: parsed.error.issues },
    });
  }
  const input = parsed.data;
  const phones: NormalizedPhone[] = [];
  const invalidPhones: string[] = [];
  for (const p of input.phones) {
    const n = normalizePhone(p);
    if (n?.valid) {
      if (!phones.some((x) => x.e164 === n.e164)) phones.push(n);
    } else invalidPhones.push(p);
  }
  // Prefer mobile numbers first (SMS-capable per numbering plan; confirm with carrier lookup before texting).
  phones.sort((a, b) => Number(b.lineType === "mobile") - Number(a.lineType === "mobile"));
  const email = normalizeEmail(input.email);
  const firstName = normalizeName(input.firstName);
  const lastName = normalizeName(input.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;
  const propertyAddress = input.propertyAddress ? normalizeAddress(input.propertyAddress) : null;
  const mailingAddress = input.mailingAddress ? normalizeAddress(input.mailingAddress) : null;
  const absentee =
    propertyAddress && mailingAddress ? propertyAddress.key !== mailingAddress.key : null;

  const identity: Omit<LeadIdentity, "id"> = {
    source: input.source,
    externalId: input.externalId ?? null,
    phonesE164: phones.map((p) => p.e164),
    email,
    addressKey: propertyAddress?.key ?? null,
    zip5: propertyAddress?.zip5 ?? null,
    fullName,
  };
  const duplicates = findDuplicates({ id: "__incoming__", ...identity }, opts.existing ?? []);
  const score = scoreLead(input, {
    ...opts.scoring,
    hasValidPhone: phones.length > 0,
    phoneLineType: phones[0]?.lineType,
    hasValidEmail: !!email,
  });
  const completeness = assessCompleteness(input, { hasValidPhone: phones.length > 0 });
  return {
    input,
    firstName,
    lastName,
    fullName,
    phones,
    invalidPhones,
    email,
    propertyAddress,
    mailingAddress,
    absentee,
    duplicates,
    score,
    completeness,
    identity,
  };
}
