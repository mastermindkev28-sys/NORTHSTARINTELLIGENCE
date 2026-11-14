import "server-only";
import {
  createNorthstarWorkflows,
  EVENTS,
  InMemoryDomainRepository,
  MockStructuredModel,
  ClaudeStructuredModel,
  type QualificationExtraction,
  type StructuredModel,
} from "@northstar/agents";
import { contextForRole, FixedClock } from "@northstar/core";
import { SandboxMessaging } from "@northstar/integrations";
import { DemoPropertyProvider, PropertyDataRegistry } from "@northstar/providers";
import { InMemoryWorkflowStore, WorkflowEngine } from "@northstar/workflows";

/**
 * DEMO WORKSPACE. Runs the production workflow engine, agents, compliance gate and underwriting engine
 * against synthetic leads, synthetic property data, a sandbox messaging adapter, and a simulated clock.
 * Nothing here contacts a real person or represents a real property.
 */
export const DEMO_ORG = "00000000-0000-4000-8000-00000000d3e0";
export const DEMO_MANAGER = contextForRole(
  DEMO_ORG,
  { type: "user", id: "demo-manager", display: "Demo Manager" },
  "manager",
);
const SYSTEM = contextForRole(DEMO_ORG, { type: "system", id: "webhook:demo" }, "owner");
const SIM_START = "2026-11-16T16:00:00Z"; // Monday 10:00 CST

function simulatedExtraction(input: string): QualificationExtraction {
  const t = input.toLowerCase();
  const quote = (needle: string) => (t.includes(needle) ? needle : "");
  const lastSeller = input
    .split("\n")
    .filter((l) => l.startsWith("SELLER:"))
    .join(" ")
    .toLowerCase();
  return {
    motivation: lastSeller.includes("moving")
      ? { summary: "Relocating", level: "high", evidence: quote("moving"), confidence: 0.85 }
      : lastSeller.includes("inherited")
        ? {
            summary: "Inherited property",
            level: "medium",
            evidence: quote("inherited"),
            confidence: 0.8,
          }
        : { summary: "", level: "unknown", evidence: "", confidence: 0 },
    timeline: t.includes("60 days")
      ? { value: "within_90_days", evidence: "60 days", confidence: 0.85 }
      : { value: "unknown", evidence: "", confidence: 0 },
    condition: t.includes("roof")
      ? {
          value: "moderate_repairs",
          repairsMentioned: ["roof"],
          evidence: "roof",
          confidence: 0.75,
        }
      : { value: "unknown", repairsMentioned: [], evidence: "", confidence: 0 },
    occupancy: t.includes("vacant")
      ? { value: "vacant", evidence: "vacant", confidence: 0.9 }
      : { value: "unknown", evidence: "", confidence: 0 },
    askingPrice: t.includes("165k")
      ? { value: 165000, evidence: "165k", confidence: 0.85 }
      : { value: null, evidence: "", confidence: 0 },
    decisionMakers: { value: "", evidence: "", confidence: 0 },
    appointment: {
      requested: t.includes("come by"),
      preferredTimes: t.includes("thursday") ? ["Thursday afternoon"] : [],
    },
    sellerQuestions: [],
    sentiment: "neutral",
    needsHuman: t.includes("attorney"),
    needsHumanReason: t.includes("attorney") ? "Seller referenced an attorney." : "",
  };
}

const CONSENT = (business: string) => ({
  sms: true,
  disclosureText: `By submitting this form, I agree to receive automated marketing text messages from ${business} at the number provided. Consent is not a condition of any purchase. Msg & data rates may apply. Reply STOP to opt out.`,
  capturedAt: "2026-11-16T15:40:00Z",
  pageUrl: "https://demo.northstar.example/sell",
});

const DEMO_LEADS = [
  {
    source: "web_form",
    firstName: "Avery",
    lastName: "Demo",
    phones: ["(312) 555-0101"],
    propertyAddress: { line1: "1418 W Demo Ave", city: "Chicago", state: "IL", zip: "60614" },
    notes:
      "Inherited this house from my aunt. Needs a new roof and we can't keep paying taxes on it.",
    condition: "major_repairs",
    timeline: "within_30_days",
    tags: ["probate"],
    consent: true,
  },
  {
    source: "ppc",
    firstName: "Jordan",
    lastName: "Sample",
    phones: ["(214) 555-0102"],
    propertyAddress: { line1: "88 Sample Ridge Dr", city: "Dallas", state: "TX", zip: "75201" },
    notes: "Tired landlord, tenants moving out next month.",
    occupancy: "tenant_occupied",
    condition: "moderate_repairs",
    consent: true,
  },
  {
    source: "seo",
    firstName: "Riley",
    lastName: "Placeholder",
    phones: ["(305) 555-0103"],
    propertyAddress: { line1: "2201 Fictional Blvd", city: "Miami", state: "FL", zip: "33101" },
    notes: "Behind on my mortgage, got a notice of default.",
    timeline: "asap",
    askingPrice: 210000,
    consent: true,
  },
  {
    source: "direct_mail",
    firstName: "Casey",
    lastName: "Example",
    phones: ["(602) 555-0104"],
    propertyAddress: { line1: "740 Example Canyon Rd", city: "Phoenix", state: "AZ", zip: "85004" },
    notes: "Just curious what it's worth.",
    condition: "turnkey",
    timeline: "flexible",
    consent: false,
  },
  {
    source: "list_import",
    firstName: "Morgan",
    lastName: "Testcase",
    phones: ["(404) 555-0105"],
    propertyAddress: { line1: "19 Testcase Ln", city: "Atlanta", state: "GA", zip: "30303" },
    tags: ["absentee", "high-equity", "vacant"],
    consent: false,
  },
  {
    source: "web_form",
    firstName: "Taylor",
    lastName: "Mock",
    phones: ["(216) 555-0106"],
    propertyAddress: { line1: "5520 Mock Pkwy", city: "Cleveland", state: "OH", zip: "44103" },
    notes: "Relocating for work, house is vacant.",
    occupancy: "vacant",
    condition: "light_repairs",
    timeline: "within_90_days",
    askingPrice: 95000,
    consent: true,
  },
];

export interface Workspace {
  engine: WorkflowEngine;
  store: InMemoryWorkflowStore;
  repo: InMemoryDomainRepository;
  messaging: SandboxMessaging;
  clock: FixedClock;
  model: StructuredModel;
  modelMode: "claude" | "simulated";
  ready: Promise<void>;
}

async function seed(ws: Workspace) {
  for (const [i, l] of DEMO_LEADS.entries()) {
    const { consent, ...rest } = l;
    await ws.engine.emit(
      SYSTEM,
      EVENTS.leadReceived,
      { lead: { ...rest, ...(consent ? { consent: CONSENT("Northstar Demo Homes") } : {}) } },
      { idempotencyKey: `demo-lead-${i}` },
    );
  }
  await ws.engine.drain();
  const leads = await ws.repo.listLeads(DEMO_ORG);
  const avery = leads.find((x) => x.firstName === "Avery");
  const taylor = leads.find((x) => x.firstName === "Taylor");
  const riley = leads.find((x) => x.firstName === "Riley");
  ws.clock.advance(20 * 60_000);
  if (avery)
    await ws.engine.emit(
      SYSTEM,
      EVENTS.messageReceived,
      {
        leadId: avery.id,
        body: "Yes, it's vacant since my aunt passed. Roof leaks. I'd like to be done in 60 days and was hoping for 165k.",
      },
      { idempotencyKey: "demo-in-1" },
    );
  if (taylor)
    await ws.engine.emit(
      SYSTEM,
      EVENTS.messageReceived,
      { leadId: taylor.id, body: "Sure, you can come by Thursday to see it." },
      { idempotencyKey: "demo-in-2" },
    );
  if (riley)
    await ws.engine.emit(
      SYSTEM,
      EVENTS.messageReceived,
      {
        leadId: riley.id,
        body: "My attorney said I should talk to a few buyers before the sale date.",
      },
      { idempotencyKey: "demo-in-3" },
    );
  await ws.engine.drain();
}

function create(): Workspace {
  const clock = new FixedClock(SIM_START);
  const repo = new InMemoryDomainRepository();
  repo.settings.set(DEMO_ORG, {
    businessName: "Northstar Demo Homes",
    underwriting: {
      arvFactor: 0.7,
      targetAssignmentFee: 10_000,
      holdMonths: 6,
      endBuyerProfitRate: 0.15,
    },
  });
  const store = new InMemoryWorkflowStore();
  const messaging = new SandboxMessaging();
  const useClaude =
    !!process.env.ANTHROPIC_API_KEY && process.env.NORTHSTAR_DEMO_USE_CLAUDE === "1";
  const model: StructuredModel = useClaude
    ? new ClaudeStructuredModel()
    : new MockStructuredModel((req) => simulatedExtraction(req.input));
  const engine = new WorkflowEngine({ store, clock, jitter: () => 1, workerId: "demo-worker" });
  const properties = new PropertyDataRegistry({
    providers: [new DemoPropertyProvider(() => clock.now())],
    environment: "development",
  });
  for (const wf of createNorthstarWorkflows({ repo, model, properties, messaging, clock }))
    engine.register(wf);
  const ws: Workspace = {
    engine,
    store,
    repo,
    messaging,
    clock,
    model,
    modelMode: useClaude ? "claude" : "simulated",
    ready: Promise.resolve(),
  };
  ws.ready = seed(ws);
  return ws;
}

const g = globalThis as unknown as { __northstarWorkspace?: Workspace };
export async function getWorkspace(): Promise<Workspace> {
  g.__northstarWorkspace ??= create();
  await g.__northstarWorkspace.ready;
  return g.__northstarWorkspace;
}
