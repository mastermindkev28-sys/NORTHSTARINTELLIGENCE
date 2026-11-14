import type { Permission } from "@northstar/core";

export type AgentStatus = "implemented" | "partial" | "specified";

export interface AgentSpec {
  id: string;
  name: string;
  division: "acquire" | "intelligence" | "underwrite" | "due_diligence" | "transact" | "portfolio" | "platform";
  purpose: string;
  status: AgentStatus;
  /** Workflows that implement the agent's behavior. */
  workflows: string[];
  triggers: string[];
  permissions: Permission[];
  /** Where AI (LLM) judgment is used; everything else is deterministic. */
  aiUsage: string;
  escalation: string[];
  metrics: string[];
}

/** Single source of truth for agent scope and least-privilege grants. Rendered in docs/AI_AGENT_SPECIFICATIONS.md. */
export const AGENT_SPECS: AgentSpec[] = [
  { id: "orchestrator", name: "Central Orchestrator", division: "platform", status: "implemented", purpose: "Routes events to workflows, leases and executes runs, retries, dead-letters, suspends for sleeps and approvals, records every step.", workflows: ["(WorkflowEngine)"], triggers: ["all domain events"], permissions: [], aiUsage: "None — deterministic.", escalation: ["Dead-lettered runs surface in the Automation Center", "Approvals surface to users holding the required permission"], metrics: ["runs by status", "retry rate", "dead-letter count", "approval latency", "p95 run duration"] },
  { id: "lead_intelligence", name: "Lead Intelligence Agent", division: "acquire", status: "implemented", purpose: "Validates, normalizes, dedupes, scores, and routes new leads.", workflows: ["lead.intake"], triggers: ["lead.received"], permissions: ["leads.read", "leads.write"], aiUsage: "None in v1 — deterministic, explainable scoring with a fair-housing signal allowlist.", escalation: ["Duplicate verdict → duplicate_review task"], metrics: ["leads processed", "duplicate rate", "tier distribution", "time to first touch"] },
  { id: "acquisitions", name: "Acquisitions Agent", division: "acquire", status: "implemented", purpose: "Handles seller replies: consent changes, structured qualification extraction, next question, appointment requests, escalation.", workflows: ["conversation.inbound"], triggers: ["message.received"], permissions: ["conversations.read", "conversations.send", "leads.write"], aiUsage: "Claude extracts qualification facts with verbatim evidence; values without evidence are discarded. Outbound text is templated.", escalation: ["Negotiation/offer requests", "Attorney, lawsuit, bankruptcy, imminent foreclosure", "Hostile or distressed sellers", "Legal/tax questions", "≥3 unsupported extractions", "Model refusal"], metrics: ["qualification completeness", "escalation rate", "rejected-extraction rate", "reply latency", "appointment rate"] },
  { id: "follow_up", name: "Follow-Up Agent", division: "acquire", status: "partial", purpose: "Compliant first touch and scheduled follow-up sequences.", workflows: ["conversation.outreach"], triggers: ["conversation.outreach_requested"], permissions: ["conversations.send", "leads.write"], aiUsage: "None — templates gated by the compliance engine.", escalation: ["require_review compliance verdict → compliance_review task"], metrics: ["contact rate", "deferred-by-quiet-hours count", "blocked count by reason", "opt-out rate"] },
  { id: "property_research", name: "Property Research Agent", division: "intelligence", status: "implemented", purpose: "Retrieves authorized property facts and comparable sales with provenance and provider fallback.", workflows: ["property.research"], triggers: ["property.research_requested"], permissions: ["properties.research", "leads.write"], aiUsage: "None — provider adapters only. No data is generated.", escalation: ["All providers unavailable → retry, then dead-letter"], metrics: ["lookup success rate", "provider fallback rate", "cost per lookup", "facts per property"] },
  { id: "underwriting", name: "Underwriting Agent", division: "underwrite", status: "implemented", purpose: "Runs deterministic deal analysis and requests human approval of the negotiation ceiling.", workflows: ["underwriting.initial"], triggers: ["underwriting.requested"], permissions: ["underwriting.run", "leads.write"], aiUsage: "None — tested financial functions only.", escalation: ["Missing living area → follow_up task", "Any offer ceiling → approval (offers.approve)"], metrics: ["runs", "decision mix", "approval rate", "ARV confidence distribution"] },
  { id: "due_diligence", name: "Due Diligence Agent", division: "due_diligence", status: "specified", purpose: "Document ingestion, extraction, missing-document detection, risk summaries.", workflows: [], triggers: ["document.uploaded"], permissions: ["leads.read"], aiUsage: "Planned: document extraction with citations; findings labeled ai_generated.", escalation: ["Material risk findings", "Low-confidence extractions"], metrics: ["documents processed", "extraction accuracy (eval set)"] },
  { id: "transaction", name: "Transaction Agent", division: "transact", status: "specified", purpose: "Contract milestones, deadlines, document collection, status updates.", workflows: [], triggers: ["contract.signed", "schedule.daily"], permissions: ["leads.read", "leads.write"], aiUsage: "Planned: milestone extraction from contracts (human-confirmed).", escalation: ["Deadline within 48h without completion"], metrics: ["on-time milestone rate", "days to close"] },
  { id: "business_intelligence", name: "Business Intelligence Agent", division: "platform", status: "partial", purpose: "Operational metrics: funnel conversion, speed to lead, bottlenecks.", workflows: [], triggers: ["schedule.daily"], permissions: ["leads.read", "workflows.read"], aiUsage: "Planned: narrative summaries over computed metrics (numbers never generated by AI).", escalation: [], metrics: ["report delivery"] },
  { id: "customer_success", name: "Customer Success Agent", division: "platform", status: "specified", purpose: "Onboarding guidance, integration diagnostics, churn signals.", workflows: [], triggers: ["org.created", "integration.error"], permissions: ["workflows.read"], aiUsage: "Planned: guided onboarding Q&A over product docs.", escalation: ["Integration failures > 24h", "Usage drop > 50% week over week"], metrics: ["time to first value", "activation rate"] },
];
