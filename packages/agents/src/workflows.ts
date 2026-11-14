import { z } from "zod";
import { newId, sourced, systemClock, type Clock } from "@northstar/core";
import { classifyInbound, evaluateOutreach, OPT_OUT_CONFIRMATION, type ConsentRecord, type OutreachDecision } from "@northstar/compliance";
import type { MessagingPort } from "@northstar/integrations";
import { LeadInput, processLeadIntake } from "@northstar/leads";
import type { PropertyDataRegistry } from "@northstar/providers";
import { underwriteWholesaleDeal, type WholesaleDealInput } from "@northstar/underwriting";
import type { AnyWorkflowDefinition, WorkflowDefinition } from "@northstar/workflows";
import type { StructuredModel } from "./llm";
import { extractQualification } from "./qualification";
import type { DomainRepository, LeadRecord, MessageRecord } from "./repository";

export interface WorkflowDeps {
  repo: DomainRepository;
  model: StructuredModel;
  properties: PropertyDataRegistry;
  messaging: MessagingPort;
  clock?: Clock;
}

export const EVENTS = {
  leadReceived: "lead.received",
  researchRequested: "property.research_requested",
  underwritingRequested: "underwriting.requested",
  outreachRequested: "conversation.outreach_requested",
  messageReceived: "message.received",
} as const;

const LeadIdPayload = z.object({ leadId: z.string().uuid() });

/** Deterministic, compliance-reviewed message templates. The AI never free-writes outbound seller messages in v1. */
export const TEMPLATES = {
  firstTouch: (business: string, firstName: string | null, street: string | null) =>
    `Hi${firstName ? ` ${firstName}` : ""}, this is the automated assistant for ${business} following up on your request${street ? ` about ${street}` : ""}. Is now a good time for a few quick questions? Reply STOP to opt out.`,
  question: (q: string) => q,
  handoff: () => "Thanks — a member of our team will follow up with you personally.",
  appointment: () => "Thanks! A member of our team will reach out to confirm a time that works for you.",
} as const;

export function createNorthstarWorkflows(deps: WorkflowDeps): AnyWorkflowDefinition[] {
  const { repo, model, properties, messaging } = deps;
  const clock = deps.clock ?? systemClock;
  const nowIso = () => clock.now().toISOString();

  async function gateAndSend(orgId: string, lead: LeadRecord, body: string, purpose: "marketing" | "conversational_reply", idempotencyKey: string, opts: { isFirstMessage: boolean; minutesSinceInbound?: number | null }): Promise<OutreachDecision> {
    const settings = await repo.getSettings(orgId);
    const phone = lead.phones[0] ?? null;
    const msgs = phone ? await repo.listMessages(orgId, lead.id) : [];
    const recentAttempts = msgs.filter((m) => m.direction === "outbound" && m.status === "sent").map((m) => m.at);
    const decision = evaluateOutreach({
      channel: "sms", purpose, automated: true, numberSource: lead.numberSource,
      recipient: { phoneE164: phone, location: { states: [lead.property?.state, lead.mailingState].filter((s): s is string => !!s) } },
      consents: phone ? await repo.listConsents(orgId, phone) : [], suppressed: phone ? await repo.isSuppressed(orgId, phone) : false,
      dnc: phone ? await repo.latestDnc(orgId, phone) : { national: "unknown" }, minutesSinceInbound: opts.minutesSinceInbound ?? null, recentAttempts,
      now: clock.now(), orgContactWindow: settings.contactWindow,
      content: { body, businessName: settings.businessName, isFirstMessageInThread: opts.isFirstMessage, aiGenerated: false },
    });
    const record: MessageRecord = {
      id: newId(), organizationId: orgId, leadId: lead.id, direction: "outbound", body, aiGenerated: false, authorType: "agent",
      status: decision.verdict === "allow" ? "sent" : decision.verdict === "defer" ? "deferred" : decision.verdict === "require_review" ? "pending_review" : "blocked",
      complianceVerdict: decision.verdict, complianceReasons: decision.reasons.map((r) => r.code), at: nowIso(),
    };
    if (decision.verdict === "allow" && phone) {
      await messaging.sendSms({ to: phone, body, idempotencyKey }, "allow");
      await repo.recordUsage(orgId, "sms_segment", Math.ceil(body.length / 153), idempotencyKey);
    }
    await repo.appendMessage(record);
    if (decision.verdict === "require_review") {
      await repo.createTask({ id: newId(), organizationId: orgId, leadId: lead.id, kind: "compliance_review", status: "open", createdAt: nowIso(), title: "Outbound message requires review", detail: decision.reasons.map((r) => r.message).join(" ") });
    }
    return decision;
  }

  const leadIntake: WorkflowDefinition<{ lead: unknown }> = {
    id: "lead.intake", version: 1, description: "Lead Intelligence Agent: validate, normalize, dedupe, score, route",
    triggers: [EVENTS.leadReceived], permissions: ["leads.read", "leads.write"], maxAttempts: 5,
    payloadSchema: z.object({ lead: z.unknown() }),
    async handler({ event, step, tenant }) {
      const orgId = tenant.organizationId;
      const existing = await step.run("load-identities", () => repo.listLeadIdentities(orgId));
      const processed = await step.run("process", () => {
        const p = processLeadIntake(event.payload.lead, { existing });
        return { ...p, input: LeadInput.parse(event.payload.lead) };
      });
      const leadId = await step.run("persist", async () => {
        const id = newId();
        const dup = processed.duplicates.verdict === "duplicate" ? processed.duplicates.candidates[0]?.leadId ?? null : null;
        const at = nowIso();
        const ai = (v: string | undefined) => (v ? sourced(v, "user_assumption", { source: { system: `lead_source:${processed.input.source}`, retrievedAt: at } }) : null);
        await repo.insertLead({
          id, organizationId: orgId, status: dup ? "duplicate" : "new", source: processed.input.source, externalId: processed.input.externalId ?? null,
          firstName: processed.firstName, lastName: processed.lastName, fullName: processed.fullName, phones: processed.phones.map((p) => p.e164), email: processed.email,
          numberSource: processed.input.source === "list_import" ? "purchased_list" : "consumer_provided",
          property: processed.propertyAddress, mailingState: processed.mailingAddress?.state ?? null,
          score: processed.score.score, tier: processed.score.tier, scoreFactors: processed.score.factors, completeness: processed.completeness.completeness, missingFields: processed.completeness.missing,
          askingPrice: processed.input.askingPrice !== undefined ? sourced(processed.input.askingPrice, "user_assumption", { source: { system: `lead_source:${processed.input.source}`, retrievedAt: at }, note: "Stated by seller at intake" }) : null,
          timeline: ai(processed.input.timeline), condition: ai(processed.input.condition), occupancy: ai(processed.input.occupancy), motivationSummary: null,
          notes: processed.input.notes ?? null, tags: processed.input.tags, duplicateOf: dup, facts: {}, comps: [], underwriting: null, approvedOfferCeiling: null, receivedAt: at, updatedAt: at,
        });
        const phone = processed.phones[0]?.e164;
        const c = processed.input.consent;
        if (phone && c?.sms && c.disclosureText) {
          const rec: ConsentRecord = { id: newId(), channel: "sms", kind: "express_written", capturedAt: c.capturedAt ?? at, source: `web_form:${c.pageUrl ?? processed.input.source}`, disclosureText: c.disclosureText, evidenceRef: c.ipAddress ? `ip:${c.ipAddress}` : undefined };
          await repo.addConsent(orgId, phone, rec);
        } else if (phone && ["web_form", "ppc", "seo"].includes(processed.input.source)) {
          await repo.addConsent(orgId, phone, { id: newId(), channel: "sms", kind: "inquiry", capturedAt: at, source: `inquiry:${processed.input.source}` });
        }
        await repo.recordUsage(orgId, "lead_processed", 1, `${event.id}:lead_processed`);
        if (dup) await repo.createTask({ id: newId(), organizationId: orgId, leadId: id, kind: "duplicate_review", status: "open", createdAt: at, title: "Possible duplicate lead", detail: processed.duplicates.candidates[0]?.reasons.join("; ") ?? "" });
        return id;
      });
      if (processed.duplicates.verdict === "duplicate") return { leadId, duplicate: true };
      if (processed.propertyAddress) await step.emit("request-research", EVENTS.researchRequested, { leadId });
      if (processed.phones.length) await step.emit("request-outreach", EVENTS.outreachRequested, { leadId });
      return { leadId, score: processed.score.score, tier: processed.score.tier };
    },
  };

  const propertyResearch: WorkflowDefinition<{ leadId: string }> = {
    id: "property.research", version: 1, description: "Property Research Agent: authorized property data, comps, provenance",
    triggers: [EVENTS.researchRequested], permissions: ["properties.research", "leads.write"], maxAttempts: 6, retry: { baseDelayMs: 30_000, maxDelayMs: 30 * 60_000 },
    payloadSchema: LeadIdPayload,
    async handler({ event, step, tenant }) {
      const orgId = tenant.organizationId;
      const lead = await repo.getLead(orgId, event.payload.leadId);
      if (!lead?.property) return { skipped: "no property address" };
      const address = { line1: lead.property.line1 + (lead.property.unit ? ` ${lead.property.unit}` : ""), city: lead.property.city, state: lead.property.state, zip: lead.property.zip5 };
      const details = await step.run("details", () => properties.getPropertyDetails(address));
      const comps = await step.run("comps", () => properties.getComparableSales(address, { radiusMiles: 1, monthsBack: 6, maxResults: 8 }));
      await step.run("persist", async () => {
        await repo.updateLead(orgId, lead.id, { facts: { ...(details?.data.facts ?? {}) } as LeadRecord["facts"], comps: comps.data });
        await repo.recordUsage(orgId, "property_lookup", details?.meta.units ?? 0, `${event.id}:details`);
        await repo.recordUsage(orgId, "comps_lookup", comps.meta.units, `${event.id}:comps`);
      });
      await step.emit("request-underwriting", EVENTS.underwritingRequested, { leadId: lead.id });
      return { facts: Object.keys(details?.data.facts ?? {}).length, comps: comps.data.length, demoData: comps.meta.isDemoData };
    },
  };

  const initialUnderwriting: WorkflowDefinition<{ leadId: string }> = {
    id: "underwriting.initial", version: 1, description: "Underwriting Agent: deterministic deal analysis with human-approved offer ceiling",
    triggers: [EVENTS.underwritingRequested], permissions: ["underwriting.run", "leads.write"], maxAttempts: 3,
    payloadSchema: LeadIdPayload,
    async handler({ event, step, tenant }) {
      const orgId = tenant.organizationId;
      const lead = await repo.getLead(orgId, event.payload.leadId);
      if (!lead) return { skipped: "lead not found" };
      const sqft = lead.facts.livingAreaSqft?.value as number | undefined;
      if (!sqft) {
        await step.run("flag-missing", () => repo.createTask({ id: newId(), organizationId: orgId, leadId: lead.id, kind: "follow_up", status: "open", createdAt: nowIso(), title: "Living area unknown — underwriting blocked", detail: "Confirm square footage with the seller or a verified source." }));
        return { skipped: "living area unknown" };
      }
      const settings = await repo.getSettings(orgId);
      const result = await step.run("underwrite", () => {
        const scope = lead.condition?.value === "major_repairs" || lead.condition?.value === "teardown" ? "full" : lead.condition?.value === "moderate_repairs" ? "moderate" : "cosmetic";
        const input: WholesaleDealInput = {
          asOf: clock.now().toISOString().slice(0, 10),
          subject: { livingAreaSqft: sqft },
          arv: { method: "comps", comps: lead.comps.filter((c) => c.kind === "closed_sale" && c.livingAreaSqft).map((c) => ({ id: c.id, address: c.address, salePrice: c.price, saleDate: c.date, livingAreaSqft: c.livingAreaSqft as number, distanceMiles: c.distanceMiles ?? undefined })) },
          rehab: { method: "estimate", scope, costPerSqft: settings.underwriting.rehabCostPerSqft?.[scope] },
          askingPrice: lead.askingPrice?.value,
          assumptions: {
            arvFactor: settings.underwriting.arvFactor, targetAssignmentFee: settings.underwriting.targetAssignmentFee, holdMonths: settings.underwriting.holdMonths,
            endBuyerProfitRate: settings.underwriting.endBuyerProfitRate, annualPropertyTax: (lead.facts.annualTaxAmount?.value as number | undefined) ?? 0,
          },
        };
        return underwriteWholesaleDeal(input);
      });
      await step.run("persist", async () => {
        await repo.updateLead(orgId, lead.id, { underwriting: result });
        await repo.recordUsage(orgId, "underwriting_run", 1, `${event.id}:uw`);
      });
      if ((result.decision === "pursue" || result.decision === "negotiate") && (result.recommendedMaxOffer ?? 0) > 0) {
        const street = lead.property?.line1 ?? "property";
        const approval = await step.waitForApproval("approve-offer-ceiling", {
          summary: `Approve a negotiation ceiling of $${(result.recommendedMaxOffer as number).toLocaleString("en-US")} for ${street} (decision: ${result.decision}).`,
          requiredPermission: "offers.approve",
          payload: { leadId: lead.id, recommendedMaxOffer: result.recommendedMaxOffer, arv: result.arv.value, decision: result.decision },
        });
        await step.run("record-ceiling", () => repo.updateLead(orgId, lead.id, { approvedOfferCeiling: result.recommendedMaxOffer, status: "offer_pending" }).then(() => approval.decidedBy));
      }
      return { decision: result.decision, recommendedMaxOffer: result.recommendedMaxOffer };
    },
  };

  const outreach: WorkflowDefinition<{ leadId: string }> = {
    id: "conversation.outreach", version: 1, description: "Follow-Up Agent: compliant first touch",
    triggers: [EVENTS.outreachRequested], permissions: ["conversations.send", "leads.write"], maxAttempts: 5,
    payloadSchema: LeadIdPayload,
    async handler({ event, step, tenant, run }) {
      const orgId = tenant.organizationId;
      const lead = await repo.getLead(orgId, event.payload.leadId);
      if (!lead || lead.status === "duplicate") return { skipped: true };
      const settings = await repo.getSettings(orgId);
      const body = TEMPLATES.firstTouch(settings.businessName, lead.firstName, lead.property?.line1 ?? null);
      const first = await step.run("first-touch", async () => {
        const d = await gateAndSend(orgId, lead, body, "marketing", `${run.id}:first-touch`, { isFirstMessage: true });
        return { verdict: d.verdict, nextAllowedAt: d.nextAllowedAt?.toISOString() ?? null, reasons: d.reasons.map((r) => r.code) };
      });
      if (first.verdict === "defer" && first.nextAllowedAt) {
        await step.sleepUntil("wait-for-window", new Date(first.nextAllowedAt));
        const retry = await step.run("first-touch-retry", async () => (await gateAndSend(orgId, (await repo.getLead(orgId, lead.id)) as LeadRecord, body, "marketing", `${run.id}:first-touch-retry`, { isFirstMessage: true })).verdict);
        if (retry === "allow") await step.run("mark-contacting", () => repo.updateLead(orgId, lead.id, { status: "contacting" }).then(() => true));
        return { verdict: retry };
      }
      if (first.verdict === "allow") await step.run("mark-contacting", () => repo.updateLead(orgId, lead.id, { status: "contacting" }).then(() => true));
      return first;
    },
  };

  const inbound: WorkflowDefinition<{ leadId: string; body: string }> = {
    id: "conversation.inbound", version: 1, description: "Acquisitions Agent: opt-out handling, AI qualification extraction, compliant reply",
    triggers: [EVENTS.messageReceived], permissions: ["conversations.read", "conversations.send", "leads.write"], maxAttempts: 4,
    payloadSchema: z.object({ leadId: z.string().uuid(), body: z.string().min(1).max(2000) }),
    async handler({ event, step, tenant, run }) {
      const orgId = tenant.organizationId;
      const lead = await repo.getLead(orgId, event.payload.leadId);
      if (!lead) return { skipped: "lead not found" };
      const phone = lead.phones[0];
      await step.run("record-inbound", () => repo.appendMessage({ id: newId(), organizationId: orgId, leadId: lead.id, direction: "inbound", body: event.payload.body, status: "received", authorType: "contact", aiGenerated: false, complianceVerdict: null, complianceReasons: [], at: nowIso() }));

      // 1. Deterministic consent handling first — never delegated to the model.
      const intent = classifyInbound(event.payload.body);
      if (intent.intent === "opt_out") {
        await step.run("apply-opt-out", async () => {
          if (phone) {
            await repo.suppress(orgId, phone, "opt_out", `sms:${intent.matched}`);
            await repo.revokeConsents(orgId, phone, nowIso(), `sms:${intent.matched}`);
            // One confirmation is permitted (FCC 26-67 presumes confirmations within 5 minutes permissible).
            const settings = await repo.getSettings(orgId);
            await messaging.sendSms({ to: phone, body: OPT_OUT_CONFIRMATION(settings.businessName), idempotencyKey: `${run.id}:optout-confirm` }, "allow");
          }
          await repo.updateLead(orgId, lead.id, { status: "dead" });
          if (intent.needsReview) await repo.createTask({ id: newId(), organizationId: orgId, leadId: lead.id, kind: "compliance_review", status: "open", createdAt: nowIso(), title: "Review natural-language opt-out", detail: `Seller wrote: "${event.payload.body.slice(0, 200)}"` });
        });
        return { optOut: true };
      }

      // 2. AI qualification extraction with evidence verification.
      const transcript = (await repo.listMessages(orgId, lead.id)).map((m) => ({ role: m.direction === "inbound" ? ("seller" as const) : ("team" as const), text: m.body }));
      const q = await step.run("extract", () => extractQualification(model, transcript));
      if ("optOut" in q && q.optOut && !("extraction" in q)) return { optOut: true };
      const result = q as Exclude<typeof q, { optOut: true }>;
      const x = result.extraction;
      const at = nowIso();
      const ai = <T>(value: T, confidence: number, evidence: string) => sourced(value, "ai_generated", { source: { system: `agent:acquisitions:${model.id}`, retrievedAt: at, reference: evidence.slice(0, 280) }, confidence });

      const updated = await step.run("update-lead", async () => {
        // Stages only move forward: a reply never demotes a lead that has advanced past qualification.
        const patch: Partial<LeadRecord> = ["new", "contacting"].includes(lead.status) ? { status: "qualifying" } : {};
        if (x.timeline.value !== "unknown") patch.timeline = ai(x.timeline.value, x.timeline.confidence, x.timeline.evidence);
        if (x.condition.value !== "unknown") patch.condition = ai(x.condition.value, x.condition.confidence, x.condition.evidence);
        if (x.occupancy.value !== "unknown") patch.occupancy = ai(x.occupancy.value, x.occupancy.confidence, x.occupancy.evidence);
        if (x.motivation.level !== "unknown") patch.motivationSummary = ai(x.motivation.summary, x.motivation.confidence, x.motivation.evidence);
        if (x.askingPrice.value !== null) patch.askingPrice = ai(x.askingPrice.value, x.askingPrice.confidence, x.askingPrice.evidence);
        const merged = { ...lead, ...patch };
        const missing = lead.missingFields.filter((f) => !(
          (f === "timeline" && merged.timeline) || (f === "condition" && merged.condition) || (f === "occupancy" && merged.occupancy) ||
          (f === "asking_price" && merged.askingPrice) || (f === "motivation" && merged.motivationSummary)));
        patch.missingFields = missing;
        patch.completeness = (8 - missing.length) / 8;
        if (missing.length === 0 && ["new", "contacting", "qualifying"].includes(lead.status)) patch.status = "qualified";
        await repo.recordUsage(orgId, "ai_input_tokens", result.usage.inputTokens, `${run.id}:ai_in`);
        await repo.recordUsage(orgId, "ai_output_tokens", result.usage.outputTokens, `${run.id}:ai_out`);
        return repo.updateLead(orgId, lead.id, patch);
      });

      // A newly stated asking price (or a never-underwritten lead) triggers fresh underwriting.
      if (updated.property && (x.askingPrice.value !== null || !updated.underwriting)) {
        await step.emit("request-underwriting", EVENTS.underwritingRequested, { leadId: lead.id });
      }

      // 3. Escalate, book, or ask the next question — using templates, gated by compliance.
      if (x.needsHuman) {
        await step.run("escalate", () => repo.createTask({ id: newId(), organizationId: orgId, leadId: lead.id, kind: "escalation", status: "open", createdAt: at, title: "Seller conversation needs a human", detail: x.needsHumanReason }));
        await step.run("reply-handoff", async () => (await gateAndSend(orgId, updated, TEMPLATES.handoff(), "conversational_reply", `${run.id}:reply`, { isFirstMessage: false, minutesSinceInbound: 0 })).verdict);
        return { escalated: true, reason: x.needsHumanReason };
      }
      if (x.appointment.requested) {
        await step.run("book", () => repo.createTask({ id: newId(), organizationId: orgId, leadId: lead.id, kind: "book_appointment", status: "open", createdAt: at, title: "Seller requested an appointment", detail: x.appointment.preferredTimes.join(", ") || "No preferred time given" }));
        await step.run("reply-appointment", async () => (await gateAndSend(orgId, updated, TEMPLATES.appointment(), "conversational_reply", `${run.id}:reply`, { isFirstMessage: false, minutesSinceInbound: 0 })).verdict);
        await step.run("mark-appointment", () => repo.updateLead(orgId, lead.id, { status: "appointment_set" }).then(() => true));
        return { appointmentRequested: true };
      }
      const QUESTIONS: Record<string, string> = {
        motivation: "What has you thinking about selling the property?",
        timeline: "If the numbers work, when would you ideally like to close?",
        condition: "How would you describe the property's condition — any repairs it needs?",
        occupancy: "Is the property currently lived in by you, rented to tenants, or vacant?",
        asking_price: "Do you have a price in mind that would work for you?",
      };
      const next = updated.missingFields.find((f) => QUESTIONS[f]);
      if (next) {
        const verdict = await step.run("reply-question", async () => (await gateAndSend(orgId, updated, QUESTIONS[next] as string, "conversational_reply", `${run.id}:reply`, { isFirstMessage: false, minutesSinceInbound: 0 })).verdict);
        return { asked: next, verdict, rejectedFields: result.rejectedFields };
      }
      return { qualified: true, rejectedFields: result.rejectedFields };
    },
  };

  return [leadIntake, propertyResearch, initialUnderwriting, outreach, inbound];
}
