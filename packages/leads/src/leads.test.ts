import { describe, expect, it } from "vitest";
import { NorthstarError } from "@northstar/core";
import {
  assessCompleteness, findDuplicates, jaroWinkler, LeadInput, normalizeAddress, normalizeEmail, normalizeName,
  normalizePhone, processLeadIntake, scoreLead, ALLOWED_SCORING_SIGNALS, type LeadIdentity,
} from "./index.js";

describe("normalization", () => {
  it("phones to E.164", () => {
    expect(normalizePhone("(312) 555-0142")?.e164).toBe("+13125550142");
    expect(normalizePhone("1-312-555-0142")?.e164).toBe("+13125550142");
    expect(normalizePhone("555-0123")?.valid).toBe(false);
    expect(normalizePhone("abc")).toBeNull();
  });
  it("emails", () => {
    expect(normalizeEmail("  Jane.Doe@Example.COM ")).toBe("jane.doe@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
  it("names", () => {
    expect(normalizeName("  mary-ann   o'neil ")).toBe("Mary-Ann O'neil");
    expect(normalizeName("   ")).toBeNull();
  });
  it("addresses produce equal keys for equivalent input", () => {
    const a = normalizeAddress({ line1: "123 North Main Street Apt 4", city: "Springfield", state: "il", zip: "62701-1234" });
    const b = normalizeAddress({ line1: "123 N. Main St.", line2: "Apartment 4", city: "SPRINGFIELD ", state: "IL", zip: "62701" });
    expect(a.key).toBe("123 N MAIN ST|APT 4|SPRINGFIELD|IL|62701");
    expect(b.key).toBe(a.key);
  });
});

describe("similarity", () => {
  it("jaro-winkler reference values", () => {
    expect(jaroWinkler("martha", "marhta")).toBeCloseTo(0.9611, 4);
    expect(jaroWinkler("dixon", "dicksonx")).toBeCloseTo(0.8133, 4);
    expect(jaroWinkler("abc", "abc")).toBe(1);
    expect(jaroWinkler("", "abc")).toBe(0);
  });
});

describe("duplicate detection", () => {
  const existing: LeadIdentity[] = [
    { id: "L1", source: "ppc", externalId: "ext-9", phonesE164: ["+13125550142"], email: "a@x.com", addressKey: "1 MAIN ST||CHICAGO|IL|60601", zip5: "60601", fullName: "John Smith" },
    { id: "L2", phonesE164: ["+13125550199"], addressKey: "9 OAK AVE||CHICAGO|IL|60602", zip5: "60602", fullName: "Maria Garcia" },
  ];
  it("same phone + address is a certain duplicate", () => {
    const r = findDuplicates({ id: "new", phonesE164: ["+13125550142"], addressKey: "1 MAIN ST||CHICAGO|IL|60601" }, existing);
    expect(r.verdict).toBe("duplicate");
    expect(r.candidates[0]?.leadId).toBe("L1");
    expect(r.candidates[0]?.score).toBe(1);
  });
  it("same external ID from the same source is a duplicate", () => {
    expect(findDuplicates({ id: "n", source: "ppc", externalId: "ext-9", phonesE164: [] }, existing).verdict).toBe("duplicate");
    expect(findDuplicates({ id: "n", source: "seo", externalId: "ext-9", phonesE164: [] }, existing).verdict).toBe("unique");
  });
  it("single shared phone is a possible duplicate, not an automatic merge", () => {
    const r = findDuplicates({ id: "n", phonesE164: ["+13125550199"] }, existing);
    expect(r.verdict).toBe("possible_duplicate");
  });
  it("name similarity alone never forces a merge", () => {
    const r = findDuplicates({ id: "n", phonesE164: [], fullName: "Jon Smith", zip5: "60601" }, existing);
    expect(r.verdict).not.toBe("duplicate");
  });
  it("unrelated lead is unique", () => {
    expect(findDuplicates({ id: "n", phonesE164: ["+12175550123"], fullName: "Pat Lee" }, existing).verdict).toBe("unique");
  });
});

describe("scoring", () => {
  const parse = (x: unknown) => LeadInput.parse(x);
  it("scores a motivated inbound seller as hot with explanations", () => {
    const s = scoreLead(
      parse({ source: "web_form", notes: "Behind on my mortgage and the house has water damage. Need to sell fast.", timeline: "asap", condition: "major_repairs", occupancy: "vacant", askingPrice: 120000 }),
      { estimatedValue: 200000, hasValidPhone: true, phoneLineType: "fixed_line_or_mobile", requestedContact: true },
    );
    expect(s.tier).toBe("hot");
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.factors.find((f) => f.signal === "motivation_keywords")?.explanation).toMatch(/foreclosure/);
    for (const f of s.factors) expect(ALLOWED_SCORING_SIGNALS).toContain(f.signal);
  });
  it("uncontactable list lead is cold", () => {
    const s = scoreLead(parse({ source: "list_import" }), { hasValidPhone: false });
    expect(s.tier).toBe("cold");
  });
  it("is not influenced by seller name (fair housing guardrail)", () => {
    const base = { source: "web_form", timeline: "within_30_days", condition: "moderate_repairs" } as const;
    const a = scoreLead(parse({ ...base, firstName: "Mohammed", lastName: "Nguyen" }), { hasValidPhone: true });
    const b = scoreLead(parse({ ...base, firstName: "Emily", lastName: "Walsh" }), { hasValidPhone: true });
    expect(a).toEqual(b);
  });
  it("caps keyword points so verbose notes cannot dominate", () => {
    const s = scoreLead(parse({ source: "manual", notes: "foreclosure probate tax lien divorce relocating tired landlord mold vacant need to sell fast" }), { hasValidPhone: true });
    expect(s.factors.find((f) => f.signal === "motivation_keywords")?.points).toBe(30);
  });
  it("penalizes asking above value", () => {
    const s = scoreLead(parse({ source: "manual", askingPrice: 260000 }), { estimatedValue: 200000, hasValidPhone: true });
    expect(s.factors.find((f) => f.signal === "price_to_value")?.points).toBeLessThan(0);
  });
});

describe("completeness", () => {
  it("lists missing fields and neutral questions in priority order", () => {
    const r = assessCompleteness(LeadInput.parse({ source: "ppc", firstName: "Ann" }), { hasValidPhone: true });
    expect(r.missing[0]).toBe("property_address");
    expect(r.nextQuestions[0]).toMatch(/address/);
    expect(r.readyForUnderwriting).toBe(false);
  });
});

describe("processLeadIntake", () => {
  it("end-to-end intake", () => {
    const r = processLeadIntake({
      source: "ppc", firstName: " jane ", lastName: "DOE", phones: ["(312) 555-0142", "bad", "312.555.0142"],
      email: "Jane@Example.com", propertyAddress: { line1: "1 Main Street", city: "Chicago", state: "IL", zip: "60601" },
      mailingAddress: { line1: "50 Lake Shore Dr", city: "Miami", state: "FL", zip: "33101" },
      notes: "Inherited this house, it needs a new roof", timeline: "within_90_days",
    }, { existing: [{ id: "L1", phonesE164: ["+13125550142"], addressKey: "1 MAIN ST||CHICAGO|IL|60601" }] });
    expect(r.fullName).toBe("Jane Doe");
    expect(r.phones).toHaveLength(1);
    expect(r.invalidPhones).toEqual(["bad"]);
    expect(r.email).toBe("jane@example.com");
    expect(r.absentee).toBe(true);
    expect(r.duplicates.verdict).toBe("duplicate");
    expect(r.score.factors.some((f) => f.signal === "motivation_keywords")).toBe(true);
  });
  it("rejects invalid payloads with a validation error", () => {
    expect(() => processLeadIntake({ source: "nope" })).toThrow(NorthstarError);
    expect(() => processLeadIntake({ source: "ppc", propertyAddress: { line1: "x", city: "y", state: "Illinois", zip: "1" } })).toThrow(/Invalid lead payload/);
  });
});
