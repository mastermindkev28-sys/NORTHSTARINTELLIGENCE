import type { Sourced } from "@northstar/core";
import type { ConsentRecord, ContactWindow } from "@northstar/compliance";
import type { LeadIdentity } from "@northstar/leads";
import type { ComparableRecord } from "@northstar/providers";
import type { WholesaleDealResult } from "@northstar/underwriting";

export type LeadStatus =
  | "new"
  | "contacting"
  | "qualifying"
  | "qualified"
  | "appointment_set"
  | "offer_pending"
  | "under_contract"
  | "closed_won"
  | "closed_lost"
  | "nurture"
  | "dead"
  | "duplicate";

export interface LeadRecord {
  id: string;
  organizationId: string;
  status: LeadStatus;
  source: string;
  externalId: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phones: string[];
  email: string | null;
  numberSource: "consumer_provided" | "skip_trace" | "purchased_list" | "unknown";
  property: {
    line1: string;
    unit: string | null;
    city: string;
    state: string;
    zip5: string;
    key: string;
  } | null;
  mailingState: string | null;
  score: number;
  tier: string;
  scoreFactors: { signal: string; points: number; explanation: string }[];
  completeness: number;
  missingFields: string[];
  askingPrice: Sourced<number> | null;
  timeline: Sourced<string> | null;
  condition: Sourced<string> | null;
  occupancy: Sourced<string> | null;
  motivationSummary: Sourced<string> | null;
  notes: string | null;
  tags: string[];
  duplicateOf: string | null;
  facts: Record<string, Sourced<unknown>>;
  comps: ComparableRecord[];
  underwriting: WholesaleDealResult | null;
  approvedOfferCeiling: number | null;
  receivedAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  organizationId: string;
  leadId: string;
  direction: "inbound" | "outbound";
  body: string;
  status: "sent" | "received" | "blocked" | "deferred" | "pending_review";
  authorType: "contact" | "agent" | "system" | "user";
  aiGenerated: boolean;
  complianceVerdict: string | null;
  complianceReasons: string[];
  at: string;
}

export interface TaskRecord {
  id: string;
  organizationId: string;
  leadId: string | null;
  title: string;
  detail: string;
  kind:
    | "review_message"
    | "escalation"
    | "book_appointment"
    | "duplicate_review"
    | "compliance_review"
    | "follow_up";
  status: "open" | "done";
  createdAt: string;
}

export interface OrgSettings {
  businessName: string;
  contactWindow?: Partial<ContactWindow>;
  underwriting: {
    arvFactor: number;
    targetAssignmentFee: number;
    holdMonths: number;
    endBuyerProfitRate: number;
    /** Organization-calibrated rehab $/sqft by scope; absent → placeholder defaults (flagged). */
    rehabCostPerSqft?: Partial<Record<"cosmetic" | "moderate" | "full" | "gut", number>>;
  };
}

export interface DncResult {
  national: boolean | "unknown";
  scrubbedAt: string | null;
}

/** Tenant-scoped domain persistence used by agents and workflows. Postgres implementation: @northstar/db (next). */
export interface DomainRepository {
  getSettings(orgId: string): Promise<OrgSettings>;
  insertLead(lead: LeadRecord): Promise<void>;
  getLead(orgId: string, leadId: string): Promise<LeadRecord | null>;
  updateLead(orgId: string, leadId: string, patch: Partial<LeadRecord>): Promise<LeadRecord>;
  listLeads(orgId: string): Promise<LeadRecord[]>;
  listLeadIdentities(orgId: string): Promise<LeadIdentity[]>;
  addConsent(orgId: string, phone: string, record: ConsentRecord): Promise<void>;
  listConsents(orgId: string, phone: string): Promise<ConsentRecord[]>;
  revokeConsents(orgId: string, phone: string, at: string, source: string): Promise<void>;
  suppress(orgId: string, value: string, reason: string, source: string): Promise<void>;
  isSuppressed(orgId: string, value: string): Promise<boolean>;
  latestDnc(orgId: string, phone: string): Promise<DncResult>;
  appendMessage(msg: MessageRecord): Promise<void>;
  listMessages(orgId: string, leadId: string): Promise<MessageRecord[]>;
  createTask(task: TaskRecord): Promise<void>;
  listTasks(orgId: string): Promise<TaskRecord[]>;
  recordUsage(
    orgId: string,
    metric: string,
    quantity: number,
    idempotencyKey: string,
  ): Promise<void>;
}

export class InMemoryDomainRepository implements DomainRepository {
  readonly leads = new Map<string, LeadRecord>();
  readonly consents = new Map<string, ConsentRecord[]>();
  readonly suppressions = new Map<string, { reason: string; source: string }>();
  readonly dnc = new Map<string, DncResult>();
  readonly messages: MessageRecord[] = [];
  readonly tasks: TaskRecord[] = [];
  readonly usage = new Map<string, { orgId: string; metric: string; quantity: number }>();
  readonly settings = new Map<string, OrgSettings>();

  async getSettings(orgId: string): Promise<OrgSettings> {
    return (
      this.settings.get(orgId) ?? {
        businessName: "Your Company",
        underwriting: {
          arvFactor: 0.7,
          targetAssignmentFee: 10_000,
          holdMonths: 6,
          endBuyerProfitRate: 0.15,
        },
      }
    );
  }
  async insertLead(lead: LeadRecord) {
    this.leads.set(lead.id, structuredClone(lead));
  }
  async getLead(orgId: string, id: string) {
    const l = this.leads.get(id);
    return l && l.organizationId === orgId ? structuredClone(l) : null;
  }
  async updateLead(orgId: string, id: string, patch: Partial<LeadRecord>) {
    const l = this.leads.get(id);
    if (!l || l.organizationId !== orgId) throw new Error("Lead not found");
    Object.assign(l, structuredClone(patch), { updatedAt: new Date().toISOString() });
    return structuredClone(l);
  }
  async listLeads(orgId: string) {
    return [...this.leads.values()]
      .filter((l) => l.organizationId === orgId)
      .map((l) => structuredClone(l));
  }
  async listLeadIdentities(orgId: string): Promise<LeadIdentity[]> {
    return (await this.listLeads(orgId)).map((l) => ({
      id: l.id,
      source: l.source,
      externalId: l.externalId,
      phonesE164: l.phones,
      email: l.email,
      addressKey: l.property?.key ?? null,
      zip5: l.property?.zip5 ?? null,
      fullName: l.fullName,
    }));
  }
  private k(orgId: string, v: string) {
    return `${orgId}:${v}`;
  }
  async addConsent(orgId: string, phone: string, record: ConsentRecord) {
    const list = this.consents.get(this.k(orgId, phone)) ?? [];
    list.push(structuredClone(record));
    this.consents.set(this.k(orgId, phone), list);
  }
  async listConsents(orgId: string, phone: string) {
    return structuredClone(this.consents.get(this.k(orgId, phone)) ?? []);
  }
  async revokeConsents(orgId: string, phone: string, at: string, source: string) {
    for (const c of this.consents.get(this.k(orgId, phone)) ?? [])
      if (!c.revokedAt) Object.assign(c, { revokedAt: at, revocationSource: source });
  }
  async suppress(orgId: string, value: string, reason: string, source: string) {
    this.suppressions.set(this.k(orgId, value), { reason, source });
  }
  async isSuppressed(orgId: string, value: string) {
    return this.suppressions.has(this.k(orgId, value));
  }
  async latestDnc(orgId: string, phone: string): Promise<DncResult> {
    return this.dnc.get(this.k(orgId, phone)) ?? { national: "unknown", scrubbedAt: null };
  }
  async appendMessage(msg: MessageRecord) {
    this.messages.push(structuredClone(msg));
  }
  async listMessages(orgId: string, leadId: string) {
    return this.messages
      .filter((m) => m.organizationId === orgId && m.leadId === leadId)
      .map((m) => structuredClone(m));
  }
  async createTask(task: TaskRecord) {
    this.tasks.push(structuredClone(task));
  }
  async listTasks(orgId: string) {
    return this.tasks.filter((t) => t.organizationId === orgId).map((t) => structuredClone(t));
  }
  async recordUsage(orgId: string, metric: string, quantity: number, idempotencyKey: string) {
    if (!this.usage.has(idempotencyKey))
      this.usage.set(idempotencyKey, { orgId, metric, quantity });
  }
}
