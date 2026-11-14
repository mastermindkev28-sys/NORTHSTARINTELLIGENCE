import { beforeEach, describe, expect, it } from "vitest";
import { contextForRole, FixedClock, type TenantContext } from "@northstar/core";
import { SandboxMessaging } from "@northstar/integrations";
import { DemoPropertyProvider, PropertyDataRegistry } from "@northstar/providers";
import { InMemoryWorkflowStore, WorkflowEngine } from "@northstar/workflows";
import { AGENT_SPECS, createNorthstarWorkflows, EVENTS, extractQualification, InMemoryDomainRepository, MockStructuredModel, type QualificationExtraction } from "./index";

const ORG = "11111111-1111-4111-8111-111111111111";

/** Simulated extraction that behaves like a well-behaved model on the test transcript. */
function simulatedExtraction(input: string): QualificationExtraction {
  const has = (s: string) => input.toLowerCase().includes(s.toLowerCase());
  return {
    motivation: has("moving out of state") ? { summary: "Relocating out of state", level: "high", evidence: "moving out of state", confidence: 0.9 } : { summary: "", level: "unknown", evidence: "", confidence: 0 },
    timeline: has("2 months") ? { value: "within_90_days", evidence: "in 2 months", confidence: 0.85 } : { value: "unknown", evidence: "", confidence: 0 },
    condition: has("roof leaks") ? { value: "moderate_repairs", repairsMentioned: ["roof"], evidence: "the roof leaks", confidence: 0.8 } : { value: "unknown", repairsMentioned: [], evidence: "", confidence: 0 },
    occupancy: { value: "unknown", evidence: "", confidence: 0 },
    askingPrice: has("150k") ? { value: 150000, evidence: "I'd take 150k", confidence: 0.9 } : { value: null, evidence: "", confidence: 0 },
    decisionMakers: { value: "", evidence: "", confidence: 0 },
    appointment: { requested: has("come see it"), preferredTimes: [] },
    sellerQuestions: [],
    sentiment: "positive",
    needsHuman: has("lawyer"),
    needsHumanReason: has("lawyer") ? "Seller mentioned a lawyer" : "",
  };
}

describe("extractQualification guards", () => {
  it("never calls the model on an opt-out", async () => {
    const model = new MockStructuredModel(() => { throw new Error("should not be called"); });
    expect(await extractQualification(model, [{ role: "seller", text: "Stop texting me" }])).toEqual({ optOut: true });
    expect(model.calls).toHaveLength(0);
  });
  it("discards values without verbatim evidence (hallucination guard)", async () => {
    const model = new MockStructuredModel(() => ({
      ...simulatedExtraction(""),
      timeline: { value: "asap", evidence: "I need to sell this week", confidence: 0.9 },
      askingPrice: { value: 200000, evidence: "200k", confidence: 0.9 },
      condition: { value: "major_repairs", repairsMentioned: ["foundation"], evidence: "the roof leaks", confidence: 0.6 },
    }));
    const r = await extractQualification(model, [{ role: "team", text: "Hi" }, { role: "seller", text: "Yes, the roof leaks a bit." }]);
    if ("extraction" in r) {
      expect(r.extraction.timeline.value).toBe("unknown");
      expect(r.extraction.askingPrice.value).toBeNull();
      expect(r.extraction.condition.value).toBe("major_repairs"); // evidence present verbatim
      expect(r.rejectedFields).toEqual(["timeline", "askingPrice"]);
    } else throw new Error("expected extraction");
  });
  it("does not accept a price the seller never said even if the quote exists", async () => {
    const model = new MockStructuredModel(() => ({ ...simulatedExtraction(""), askingPrice: { value: 175000, evidence: "I'd take 150k", confidence: 0.9 } }));
    const r = await extractQualification(model, [{ role: "seller", text: "I'd take 150k" }]);
    expect("extraction" in r && r.extraction.askingPrice.value).toBeNull();
  });
});

describe("end-to-end acquisition loop (demo data, simulated model, sandbox messaging)", () => {
  let repo: InMemoryDomainRepository;
  let messaging: SandboxMessaging;
  let engine: WorkflowEngine;
  let store: InMemoryWorkflowStore;
  let clock: FixedClock;
  let system: TenantContext;
  const manager = contextForRole(ORG, { type: "user", id: "user-manager" }, "manager");

  beforeEach(() => {
    clock = new FixedClock("2026-11-16T16:00:00Z"); // Monday 10:00 CST
    repo = new InMemoryDomainRepository();
    repo.settings.set(ORG, { businessName: "Alpha Homes", underwriting: { arvFactor: 0.7, targetAssignmentFee: 10_000, holdMonths: 6, endBuyerProfitRate: 0.15 } });
    messaging = new SandboxMessaging();
    store = new InMemoryWorkflowStore();
    engine = new WorkflowEngine({ store, clock, jitter: () => 1 });
    const model = new MockStructuredModel((req) => simulatedExtraction(req.input));
    const properties = new PropertyDataRegistry({ providers: [new DemoPropertyProvider(() => clock.now())], environment: "test" });
    for (const wf of createNorthstarWorkflows({ repo, model, properties, messaging, clock })) engine.register(wf);
    system = contextForRole(ORG, { type: "system", id: "webhook:web_form" }, "owner");
  });

  const leadPayload = {
    source: "web_form", firstName: "jane", lastName: "doe", phones: ["(312) 555-0142"],
    propertyAddress: { line1: "1 Main Street", city: "Chicago", state: "IL", zip: "60601" },
    notes: "Inherited this house", condition: "moderate_repairs",
    consent: { sms: true, disclosureText: "By submitting, I agree to receive automated marketing texts from Alpha Homes at the number provided. Consent is not a condition of purchase. Reply STOP to opt out.", capturedAt: "2026-11-16T15:55:00Z", pageUrl: "https://alpha.example/sell" },
  };

  it("intake → research → underwriting → approval; first touch sent; reply qualifies; STOP suppresses", async () => {
    const { runs } = await engine.emit(system, EVENTS.leadReceived, { lead: leadPayload }, { idempotencyKey: "webform-1" });
    expect(runs).toHaveLength(1);
    await engine.drain();

    const [lead] = await repo.listLeads(ORG);
    expect(lead?.fullName).toBe("Jane Doe");
    expect(lead?.phones).toEqual(["+13125550142"]);
    expect(lead?.status).toBe("contacting");
    expect(lead?.comps.length).toBeGreaterThan(0);
    expect(lead?.underwriting?.methodologyVersion).toBeDefined();

    // First touch went out with sender ID, AI disclosure, and opt-out language.
    expect(messaging.sent).toHaveLength(1);
    expect(messaging.sent[0]?.body).toMatch(/automated assistant for Alpha Homes.*Reply STOP/);

    // Underwriting suspended for human approval of the negotiation ceiling (if the deal pencils).
    const pending = await store.listApprovals(ORG, "pending");
    if (lead?.underwriting?.decision === "pursue" || lead?.underwriting?.decision === "negotiate") {
      expect(pending).toHaveLength(1);
      await engine.decideApproval(manager, pending[0]!.id, "approved", "Comps verified");
      await engine.drain();
      expect((await repo.getLead(ORG, lead.id))?.status).toBe("offer_pending");
      expect((await repo.getLead(ORG, lead.id))?.approvedOfferCeiling).toBe(lead.underwriting.recommendedMaxOffer);
    }

    // Seller replies; AI extracts facts with provenance; next question is asked.
    await engine.emit(system, EVENTS.messageReceived, { leadId: lead!.id, body: "Yes. Honestly the roof leaks and we're moving out of state in 2 months. I'd take 150k." }, { idempotencyKey: "sms-in-1" });
    await engine.drain();
    const afterReply = await repo.getLead(ORG, lead!.id);
    expect(afterReply?.askingPrice?.value).toBe(150000);
    expect(afterReply?.askingPrice?.origin).toBe("ai_generated");
    expect(afterReply?.askingPrice?.confidence).toBe(0.9);
    expect(afterReply?.timeline?.value).toBe("within_90_days");
    expect(afterReply?.missingFields).toContain("occupancy");
    expect(messaging.sent.at(-1)?.body).toMatch(/lived in by you, rented/);
    // The newly stated asking price triggered re-underwriting against it, without demoting the stage.
    expect(afterReply?.underwriting?.spreadToAsking).toBe((afterReply?.underwriting?.recommendedMaxOffer ?? 0) - 150000);
    expect(afterReply?.underwriting?.assumptions.find((a) => a.key === "askingPrice")?.value).toBe(150000);
    if (lead?.approvedOfferCeiling != null || (await repo.getLead(ORG, lead!.id))?.approvedOfferCeiling != null) expect(afterReply?.status).toBe("offer_pending");

    // Seller opts out; suppression applied; one confirmation; future outreach blocked.
    const sentBefore = messaging.sent.length;
    await engine.emit(system, EVENTS.messageReceived, { leadId: lead!.id, body: "STOP" }, { idempotencyKey: "sms-in-2" });
    await engine.drain();
    expect(await repo.isSuppressed(ORG, "+13125550142")).toBe(true);
    expect(messaging.sent.length).toBe(sentBefore + 1);
    expect(messaging.sent.at(-1)?.body).toMatch(/unsubscribed/);
    await engine.emit(system, EVENTS.outreachRequested, { leadId: lead!.id }, { idempotencyKey: "retry-outreach" });
    await engine.drain();
    expect(messaging.sent.length).toBe(sentBefore + 1);
    const lastOutbound = (await repo.listMessages(ORG, lead!.id)).filter((m) => m.direction === "outbound").at(-1);
    expect(lastOutbound?.complianceReasons).toContain("SUPPRESSED");

    // Usage was metered for billing.
    const metrics = [...repo.usage.values()].map((u) => u.metric);
    expect(metrics).toEqual(expect.arrayContaining(["lead_processed", "property_lookup", "comps_lookup", "sms_segment", "ai_input_tokens"]));
  });

  it("defers first touch during quiet hours and sends when the window opens", async () => {
    clock.set("2026-11-17T04:00:00Z"); // 22:00 CST
    await engine.emit(system, EVENTS.leadReceived, { lead: leadPayload }, { idempotencyKey: "late-lead" });
    await engine.drain();
    expect(messaging.sent).toHaveLength(0);
    const [lead] = await repo.listLeads(ORG);
    expect((await repo.listMessages(ORG, lead!.id))[0]?.complianceReasons).toContain("QUIET_HOURS");
    clock.set("2026-11-17T14:00:00Z"); // 08:00 CST
    await engine.drain();
    expect(messaging.sent).toHaveLength(1);
  });

  it("does not text without consent: inquiry-only lead with unknown DNC status is blocked", async () => {
    await engine.emit(system, EVENTS.leadReceived, { lead: { ...leadPayload, consent: undefined } }, { idempotencyKey: "no-consent" });
    await engine.drain();
    expect(messaging.sent).toHaveLength(0);
    const [lead] = await repo.listLeads(ORG);
    const out = (await repo.listMessages(ORG, lead!.id)).find((m) => m.direction === "outbound");
    expect(out?.status).toBe("blocked");
    expect(out?.complianceReasons[0]).toBe("EXPRESS_WRITTEN_CONSENT_REQUIRED");
  });

  it("routes to review when the recipient's location cannot be determined", async () => {
    await engine.emit(system, EVENTS.leadReceived, { lead: { ...leadPayload, propertyAddress: undefined } }, { idempotencyKey: "no-location" });
    await engine.drain();
    expect(messaging.sent).toHaveLength(0);
    expect((await repo.listTasks(ORG)).some((t) => t.kind === "compliance_review")).toBe(true);
  });

  it("escalates sensitive conversations to a human", async () => {
    await engine.emit(system, EVENTS.leadReceived, { lead: { ...leadPayload, propertyAddress: undefined } }, { idempotencyKey: "esc" });
    await engine.drain();
    const [lead] = await repo.listLeads(ORG);
    await engine.emit(system, EVENTS.messageReceived, { leadId: lead!.id, body: "My lawyer says I shouldn't sell for less than it's worth" }, { idempotencyKey: "esc-in" });
    await engine.drain();
    expect((await repo.listTasks(ORG)).some((t) => t.kind === "escalation")).toBe(true);
    expect(messaging.sent.at(-1)?.body).toMatch(/member of our team/);
  });

  it("flags duplicates instead of re-contacting", async () => {
    await engine.emit(system, EVENTS.leadReceived, { lead: leadPayload }, { idempotencyKey: "d1" });
    await engine.drain();
    await engine.emit(system, EVENTS.leadReceived, { lead: { ...leadPayload, source: "ppc" } }, { idempotencyKey: "d2" });
    await engine.drain();
    const leads = await repo.listLeads(ORG);
    expect(leads.map((l) => l.status)).toContain("duplicate");
    expect((await repo.listTasks(ORG)).some((t) => t.kind === "duplicate_review")).toBe(true);
    expect(messaging.sent).toHaveLength(1);
  });

  it("agent specs declare least-privilege permissions", () => {
    expect(AGENT_SPECS).toHaveLength(10);
    for (const spec of AGENT_SPECS) {
      expect(spec.permissions).not.toContain("offers.approve");
      expect(spec.permissions).not.toContain("billing.manage");
    }
  });
});
