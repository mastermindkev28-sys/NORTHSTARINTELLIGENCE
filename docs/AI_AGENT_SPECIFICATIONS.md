# AI Agent Specifications

Machine-readable source of truth: `packages/agents/src/agentSpecs.ts` (rendered at `/agents` in the app). Agents are **workflows with least-privilege grants**, not free-roaming chatbots. AI is used only where judgment over unstructured input adds value.

## Common contract (all agents)
- **Permissions:** declared per workflow; the engine builds a tenant context containing only those permissions. No agent holds `offers.approve` or `billing.manage`; agents cannot decide approvals (engine rejects non-user actors).
- **Memory:** durable state lives in Postgres (lead record, messages, step outputs). No hidden model memory; each model call receives exactly the context it needs.
- **Inputs/outputs:** Zod schemas (`payloadSchema`, structured outputs). Invalid input → non-retryable failure → dead-letter.
- **Failure handling:** retryable errors (provider outages, rate limits) back off; non-retryable (validation, auth, refusal) dead-letter and surface to humans.
- **Provenance:** AI-derived values stored as `ai_generated` with confidence and the verbatim evidence quote.
- **Monitoring:** run status, retries, dead letters, approval latency, escalation rate, rejected-extraction rate, cost per run (usage events).

## Agents

### A. Central Orchestrator — *implemented*
`WorkflowEngine`. Receives events, creates runs, leases/executes, memoizes steps, retries, dead-letters, suspends for sleeps/approvals, logs. Deterministic.

### B. Lead Intelligence Agent — *implemented* (`lead.intake`)
- **Tools:** `processLeadIntake` (normalize, dedupe, score, completeness), repository.
- **Input:** `LeadInput` (any source). **Output:** lead record, consent evidence, follow-on events.
- **Escalation:** duplicate → review task.
- **Tests:** normalization references, dedupe thresholds, fair-housing invariance (name changes don't change score), end-to-end intake.

### C. Acquisitions Agent — *implemented* (`conversation.inbound`)
- **Tools:** `classifyInbound` (deterministic), `extractQualification` (Claude structured outputs), compliance gate, messaging port, repository.
- **Model input:** system prompt (cached) + transcript. **Model output schema:** `QualificationExtraction` (motivation, timeline, condition, occupancy, asking price, decision makers, appointment, questions, sentiment, needsHuman + reason) — each with evidence + confidence.
- **Guards:** opt-out handled before the model; evidence must be a verbatim substring of seller text; asking price number must appear in seller text; ≥ 3 unsupported values → human; protected characteristics never recorded.
- **Escalation:** negotiation/offer requests, attorney/lawsuit/bankruptcy/imminent foreclosure, hostility, legal/tax questions, refusal.
- **Tests:** hallucination guard, opt-out bypass of model, end-to-end qualification, escalation.

### D. Follow-Up Agent — *partial* (`conversation.outreach`)
Templated first touch through the gate; quiet-hour deferral via durable sleep. Sequences and dormant-lead scans are planned.

### E. Property Research Agent — *implemented* (`property.research`)
Provider registry with fallback, cache, metering; facts with source/retrieval time/confidence; never generates data.

### F. Underwriting Agent — *implemented* (`underwriting.initial`)
Deterministic engine; assumptions from org settings; approval gate for negotiation ceiling; re-runs when seller states a new asking price.

### G. Due Diligence Agent — *specified*
Document ingestion → extraction with citations (page/char) → findings labeled `ai_generated` → missing-document checklist → escalation on material risk. Requires object storage + document eval set.

### H. Transaction Agent — *specified*
Contract milestone extraction (human-confirmed), deadline monitoring (scheduled), document collection, status updates.

### I. Business Intelligence Agent — *partial*
Metrics computed deterministically from events/usage (dashboard implemented); narrative summaries planned (numbers never produced by the model).

### J. Customer Success Agent — *specified*
Onboarding guidance over product docs, integration diagnostics, churn signals from usage.

## Testing requirements (per agent)
1. Unit tests on deterministic tools. 2. Workflow tests with the mock model (happy path, failure, escalation). 3. **Eval set** for any live-model step (≥ 200 labeled transcripts for extraction; precision/recall per field; zero tolerance for hallucinated asking prices) before enabling in production.
