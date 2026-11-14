import { describe, expect, it } from "vitest";
import {
  FEDERAL_WINDOW, areaCodeState, applicableWindow, checkOutboundContent, classifyInbound, evaluateOutreach, findProhibitedTargetingAttributes,
  isWithinContactWindow, nextContactWindowStart, resolveConsent, screenFairHousing, type ConsentRecord, type OutreachRequest,
} from "./index";

describe("classifyInbound", () => {
  it.each(["STOP", "stop", "Stop.", "STOPALL", "unsubscribe", "Cancel", "END", "quit", "REVOKE", "opt out", "STOP please"])("treats %s as opt-out", (msg) => {
    expect(classifyInbound(msg).intent).toBe("opt_out");
  });
  it.each(["Please stop texting me", "don't contact me again", "Take me off your list", "wrong number", "No more texts", "leave me alone"])(
    "detects natural-language revocation: %s",
    (msg) => {
      const r = classifyInbound(msg);
      expect(r.intent).toBe("opt_out");
      expect(r.matchType).toBe("phrase");
      expect(r.needsReview).toBe(true);
    },
  );
  it("recognizes opt-in and help", () => {
    expect(classifyInbound("START").intent).toBe("opt_in");
    expect(classifyInbound("help").intent).toBe("help");
  });
  it("does not misread ordinary seller replies", () => {
    expect(classifyInbound("Yes I might sell, the roof needs work").intent).toBe("none");
    expect(classifyInbound("When can you stop by to see the house?").intent).toBe("none");
  });
  it("flags hostile messages for review", () => {
    expect(classifyInbound("I'm calling my attorney").needsReview).toBe(true);
  });
});

describe("quiet hours", () => {
  // 2026-11-16 is a Monday; US is on standard time (CST = UTC−6, EST = UTC−5).
  it("platform window is 8am–8pm in recipient local time (stricter than the federal 9pm)", () => {
    expect(isWithinContactWindow(new Date("2026-11-16T15:00:00Z"), { state: "IL" })).toBe(true); // 9:00 CST
    expect(isWithinContactWindow(new Date("2026-11-16T13:30:00Z"), { state: "IL" })).toBe(false); // 7:30 CST
    expect(isWithinContactWindow(new Date("2026-11-17T01:59:00Z"), { state: "IL" })).toBe(true); // 19:59 CST
    expect(isWithinContactWindow(new Date("2026-11-17T02:00:00Z"), { state: "IL" })).toBe(false); // 20:00 CST
    expect(FEDERAL_WINDOW.endMinute).toBe(21 * 60);
    expect(applicableWindow("fl").endMinute).toBe(20 * 60);
  });
  it("applies the strictest window across area-code, property, and mailing states", () => {
    const at = new Date("2026-11-16T13:30:00Z"); // 8:30 EST
    expect(isWithinContactWindow(at, { states: ["NY"] })).toBe(true);
    expect(isWithinContactWindow(at, { states: ["NY", "CT"] })).toBe(false); // CT conservative 9am start
    expect(isWithinContactWindow(at, { states: ["NY"], phoneE164: "+12035550142" })).toBe(false); // 203 = CT area code
    expect(areaCodeState("+13055550100")).toBe("FL");
    expect(areaCodeState("+13125550100")).toBeNull();
  });
  it("uses the most restrictive zone for multi-zone states", () => {
    const at = new Date("2026-11-16T13:30:00Z"); // 8:30 EST but 7:30 CST (FL panhandle)
    expect(isWithinContactWindow(at, { state: "FL" })).toBe(false);
    expect(isWithinContactWindow(at, { state: "FL", timeZone: "America/New_York" })).toBe(true);
  });
  it("computes the next permitted time", () => {
    const next = nextContactWindowStart(new Date("2026-11-16T13:31:00Z"), { state: "IL" });
    expect(next?.toISOString()).toBe("2026-11-16T14:00:00.000Z");
  });
  it("handles DST transitions using IANA zones", () => {
    // 2026-07-15: CDT = UTC−5. 13:30Z = 8:30 CDT.
    expect(isWithinContactWindow(new Date("2026-07-15T13:30:00Z"), { state: "IL" })).toBe(true);
  });
  it("organization overrides can only narrow the window", () => {
    const w = applicableWindow("IL", { startMinute: 6 * 60, endMinute: 19 * 60, prohibitedWeekdays: [0] });
    expect(w.startMinute).toBe(8 * 60);
    expect(w.endMinute).toBe(19 * 60);
    expect(isWithinContactWindow(new Date("2026-11-15T17:00:00Z"), { state: "IL" }, { prohibitedWeekdays: [0] })).toBe(false); // Sunday
  });
  it("unknown location requires the time to be valid in all US zones", () => {
    expect(isWithinContactWindow(new Date("2026-11-16T14:00:00Z"), {})).toBe(false); // 4am Hawaii
    expect(isWithinContactWindow(new Date("2026-11-16T19:00:00Z"), {})).toBe(true); // 9am HST, 2pm EST
  });
});

const now = new Date("2026-11-16T16:00:00Z"); // Monday 10:00 CST
const ewc: ConsentRecord = {
  id: "c1", channel: "sms", kind: "express_written", capturedAt: "2026-11-01T12:00:00Z", source: "web_form:https://example.test/sell",
  disclosureText: "By submitting, I agree to receive marketing texts from Example Homes at the number provided, including by automated means. Consent is not a condition of purchase. Reply STOP to opt out.",
};

describe("consent resolution", () => {
  it("express written requires disclosure text", () => {
    expect(resolveConsent([ewc], "sms", now).hasExpressWritten).toBe(true);
    expect(resolveConsent([{ ...ewc, disclosureText: undefined }], "sms", now).hasExpressWritten).toBe(false);
    expect(resolveConsent([ewc], "voice", now).hasExpressWritten).toBe(false);
  });
  it("revocation after grant revokes", () => {
    const r = resolveConsent([{ ...ewc, revokedAt: "2026-11-10T00:00:00Z" }], "sms", now);
    expect(r.revoked).toBe(true);
  });
  it("re-grant after revocation restores consent", () => {
    const r = resolveConsent([{ ...ewc, revokedAt: "2026-11-10T00:00:00Z" }, { ...ewc, id: "c2", capturedAt: "2026-11-12T00:00:00Z" }], "sms", now);
    expect(r.revoked).toBe(false);
    expect(r.hasExpressWritten).toBe(true);
  });
  it("inquiry EBR expires after 90 days", () => {
    const inq: ConsentRecord = { id: "i", channel: "sms", kind: "inquiry", capturedAt: "2026-07-01T00:00:00Z", source: "web_form" };
    expect(resolveConsent([inq], "sms", now).hasActiveInquiry).toBe(false);
    expect(resolveConsent([{ ...inq, capturedAt: "2026-10-01T00:00:00Z" }], "sms", now).hasActiveInquiry).toBe(true);
  });
});

describe("evaluateOutreach", () => {
  const base: OutreachRequest = {
    channel: "sms", purpose: "marketing", automated: true, recipient: { phoneE164: "+13125550142", location: { state: "IL" } },
    consents: [ewc], suppressed: false, dnc: { national: false, scrubbedAt: "2026-11-10T00:00:00Z" }, now,
  };
  it("allows compliant automated marketing", () => {
    expect(evaluateOutreach(base).verdict).toBe("allow");
  });
  it("blocks suppressed recipients", () => {
    expect(evaluateOutreach({ ...base, suppressed: true }).reasons[0]?.code).toBe("SUPPRESSED");
  });
  it("blocks automated marketing without express written consent", () => {
    const d = evaluateOutreach({ ...base, consents: [] });
    expect(d.verdict).toBe("block");
    expect(d.reasons[0]?.code).toBe("EXPRESS_WRITTEN_CONSENT_REQUIRED");
  });
  it("blocks AI voice without express written consent for voice", () => {
    const d = evaluateOutreach({ ...base, channel: "voice", purpose: "informational", artificialVoice: true });
    expect(d.reasons[0]?.code).toBe("EXPRESS_WRITTEN_CONSENT_REQUIRED");
  });
  it("blocks manual marketing to DNC numbers without consent or inquiry", () => {
    const d = evaluateOutreach({ ...base, automated: false, consents: [], dnc: { national: true, scrubbedAt: "2026-11-10T00:00:00Z" } });
    expect(d.reasons[0]?.code).toBe("DNC_LISTED");
  });
  it("blocks when the DNC scrub is stale or missing", () => {
    expect(evaluateOutreach({ ...base, automated: false, consents: [], dnc: { national: "unknown" } }).reasons[0]?.code).toBe("DNC_SCRUB_STALE");
    expect(evaluateOutreach({ ...base, automated: false, consents: [], dnc: { national: false, scrubbedAt: "2026-09-01T00:00:00Z" } }).reasons[0]?.code).toBe("DNC_SCRUB_STALE");
  });
  it("routes manual no-consent outreach to review", () => {
    expect(evaluateOutreach({ ...base, automated: false, consents: [] }).verdict).toBe("require_review");
  });
  it("defers during quiet hours with next allowed time", () => {
    const d = evaluateOutreach({ ...base, now: new Date("2026-11-17T04:00:00Z") }); // 22:00 CST
    expect(d.verdict).toBe("defer");
    expect(d.nextAllowedAt?.toISOString()).toBe("2026-11-17T14:00:00.000Z");
  });
  it("allows an immediate conversational reply even late in the evening, never after opt-out", () => {
    const late = new Date("2026-11-17T04:00:00Z");
    expect(evaluateOutreach({ ...base, purpose: "conversational_reply", minutesSinceInbound: 2, now: late }).verdict).toBe("allow");
    expect(evaluateOutreach({ ...base, purpose: "conversational_reply", minutesSinceInbound: 2, now: late, consents: [{ ...ewc, revokedAt: "2026-11-15T00:00:00Z" }] }).verdict).toBe("block");
  });
  it("enforces the 3-per-24h frequency cap across numbers and channels", () => {
    const attempts = ["2026-11-15T17:00:00Z", "2026-11-16T01:00:00Z", "2026-11-16T14:30:00Z"];
    const d = evaluateOutreach({ ...base, recentAttempts: attempts });
    expect(d.verdict).toBe("defer");
    expect(d.reasons.at(-1)?.code).toBe("FREQUENCY_CAP");
    expect(d.nextAllowedAt?.toISOString()).toBe("2026-11-16T17:00:00.000Z");
    expect(evaluateOutreach({ ...base, recentAttempts: attempts.slice(1) }).verdict).toBe("allow");
  });
  it("never sends automated or AI-voice outreach to skip-traced numbers", () => {
    expect(evaluateOutreach({ ...base, numberSource: "skip_trace" }).reasons[0]?.code).toBe("NON_CONSENSUAL_NUMBER_SOURCE");
    expect(evaluateOutreach({ ...base, numberSource: "consumer_provided" }).verdict).toBe("allow");
  });
  it("a marketing revocation on one channel blocks marketing on all channels (FCC 26-67)", () => {
    const voiceRevoked: ConsentRecord = { ...ewc, id: "v", channel: "voice", revokedAt: "2026-11-15T00:00:00Z" };
    const d = evaluateOutreach({ ...base, consents: [ewc, voiceRevoked] });
    expect(d.verdict).toBe("block");
    expect(d.reasons[0]?.code).toBe("CONSENT_REVOKED");
  });
  it("does not send when the recipient's location is unknown", () => {
    const d = evaluateOutreach({ ...base, recipient: { phoneE164: "+13125550142", location: {} } });
    expect(d.verdict).toBe("require_review");
    expect(d.reasons.at(-1)?.code).toBe("LOCATION_UNKNOWN");
  });
  it("requires review for non-compliant content", () => {
    const d = evaluateOutreach({ ...base, content: { body: "Hi! Want to sell your house? Our offer is $150k cash.", businessName: "Example Homes", isFirstMessageInThread: true, aiGenerated: true } });
    expect(d.verdict).toBe("require_review");
    const codes = d.contentIssues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["MISSING_SENDER_ID", "MISSING_OPT_OUT_INSTRUCTIONS", "MISSING_AI_DISCLOSURE", "PROHIBITED_CLAIM"]));
  });
  it("accepts compliant first-message content", () => {
    const d = evaluateOutreach({ ...base, content: { body: "Hi Jane, this is the automated assistant for Example Homes following up on your request about 1 Main St. Is now a good time? Reply STOP to opt out.", businessName: "Example Homes", isFirstMessageInThread: true, aiGenerated: true } });
    expect(d.verdict).toBe("allow");
  });
});

describe("fair housing", () => {
  it("flags discriminatory language", () => {
    expect(screenFairHousing("Great home, perfect for empty nesters, adults only").map((f) => f.category)).toContain("familial_status");
    expect(screenFairHousing("Quiet Christian neighborhood")[0]?.category).toBe("religion");
    expect(screenFairHousing("No section 8")[0]?.category).toBe("source_of_income");
    expect(screenFairHousing("3 bed 2 bath, new roof, close to the park")).toEqual([]);
  });
  it("blocks prohibited targeting attributes", () => {
    expect(findProhibitedTargetingAttributes(["equity_percent", "Owner Ethnicity", "has-children"])).toEqual(["children", "ethnicity"]);
  });
  it("blocks fair housing issues in outbound content", () => {
    const r = checkOutboundContent({ body: "We buy homes in white neighborhoods", channel: "email", businessName: "X", isFirstMessageInThread: false, aiGenerated: false });
    expect(r.issues.some((i) => i.code === "FAIR_HOUSING_REVIEW")).toBe(true);
  });
});
