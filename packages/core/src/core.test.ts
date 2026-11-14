import { describe, expect, it } from "vitest";
import {
  NorthstarError,
  ROLE_PERMISSIONS,
  assertSameTenant,
  authorize,
  canonicalJson,
  contextForRole,
  isRetryable,
  redact,
  roundCents,
  roundTo,
  sourced,
  stableHash,
} from "./index";

describe("money rounding", () => {
  it("rounds half away from zero, correcting binary representation", () => {
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(2.675)).toBe(2.68);
    expect(roundCents(-1.005)).toBe(-1.01);
    expect(roundCents(1234.5649)).toBe(1234.56);
    expect(roundTo(0.125, 2)).toBe(0.13);
  });
  it("rejects non-finite values", () => {
    expect(() => roundCents(Number.NaN)).toThrow(RangeError);
    expect(() => roundCents(Infinity)).toThrow(RangeError);
  });
});

describe("provenance", () => {
  it("requires confidence for estimates and AI interpretations", () => {
    expect(() => sourced(250000, "third_party_estimate")).toThrow(/confidence/);
    expect(() => sourced("motivated", "ai_generated")).toThrow(/confidence/);
    expect(sourced(250000, "third_party_estimate", { confidence: 0.7 }).confidence).toBe(0.7);
    expect(sourced(40000, "user_assumption").origin).toBe("user_assumption");
  });
  it("rejects out-of-range confidence", () => {
    expect(() => sourced(1, "verified", { confidence: 1.2 })).toThrow();
  });
});

describe("authorization", () => {
  const org = "11111111-1111-1111-1111-111111111111";
  it("enforces role permissions", () => {
    const viewer = contextForRole(org, { type: "user", id: "u1" }, "viewer");
    expect(() => authorize(viewer, "leads.read")).not.toThrow();
    expect(() => authorize(viewer, "leads.write")).toThrow(NorthstarError);
    const acq = contextForRole(org, { type: "user", id: "u2" }, "acquisitions");
    expect(() => authorize(acq, "offers.approve")).toThrow(/offers.approve/);
  });
  it("only owners manage billing", () => {
    expect(ROLE_PERMISSIONS.owner.has("billing.manage")).toBe(true);
    expect(ROLE_PERMISSIONS.admin.has("billing.manage")).toBe(false);
  });
  it("reports cross-tenant access as not found", () => {
    const ctx = contextForRole(org, { type: "user", id: "u1" }, "owner");
    expect(() => assertSameTenant(ctx, "22222222-2222-2222-2222-222222222222")).toThrow(
      /not found/i,
    );
  });
});

describe("errors", () => {
  it("classifies retryability", () => {
    expect(isRetryable(new NorthstarError("VALIDATION_FAILED", "bad"))).toBe(false);
    expect(
      isRetryable(new NorthstarError("PROVIDER_UNAVAILABLE", "down", { retryable: true })),
    ).toBe(true);
    expect(isRetryable(new Error("socket hang up"))).toBe(true);
  });
});

describe("hashing and redaction", () => {
  it("canonical JSON is key-order independent", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } })).toBe(
      canonicalJson({ a: { c: [3, { e: 2, f: 1 }], d: 2 }, b: 1 }),
    );
    expect(stableHash({ x: 1, y: undefined })).toBe(stableHash({ x: 1 }));
  });
  it("redacts PII and secrets recursively", () => {
    expect(redact({ phone: "+15555550100", nested: { apiKey: "k", ok: 1 } })).toEqual({
      phone: "[REDACTED]",
      nested: { apiKey: "[REDACTED]", ok: 1 },
    });
  });
});
