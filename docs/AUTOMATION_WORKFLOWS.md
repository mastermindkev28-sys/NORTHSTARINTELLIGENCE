# Automation Workflows

Engine: `packages/workflows` (ADR-003). Implementations: `packages/agents/src/workflows.ts`. Every workflow declares trigger, least-privilege permissions, retry policy, and payload schema.

## Engine guarantees
| Concern | Mechanism |
|---|---|
| Idempotent ingestion | `events` unique (org, idempotency_key); re-emit returns the original event and runs |
| One run per workflow per event | `workflow_runs` unique (workflow_id, event_id) |
| Exactly-once steps (memoized) | `step.run(name)` output persisted; replays return stored output |
| At-least-once side effects | External calls use `step.idempotencyKey(name)`; messaging adapters dedupe by key |
| Concurrency | Lease via `FOR UPDATE SKIP LOCKED`; expired leases reclaimable; lost-lease writes rejected |
| Retries | Exponential backoff `base·2^(n−1)` capped, ±20 % jitter; non-retryable errors (validation, auth) skip retries |
| Dead-letter | After `maxAttempts` or non-retryable error → `dead_letters` + error log |
| Durable sleep | `step.sleepUntil` suspends run (`sleeping`) until time |
| Human approval | `step.waitForApproval` suspends (`awaiting_approval`); only human users with the permission can decide; rejection cancels the run |
| Observability | `workflow_logs` per run; audit entries for approvals |

## Workflow catalog

| Workflow | Trigger | Execution | Output / success | Failure / escalation |
|---|---|---|---|---|
| `lead.intake` | `lead.received` | Validate → normalize → dedupe → score → completeness → persist → record consent evidence → meter | Lead record; emits `property.research_requested` (if address) and `conversation.outreach_requested` (if phone) | Invalid payload → dead-letter (non-retryable). Duplicate → `duplicate_review` task, no outreach |
| `property.research` | `property.research_requested` | Provider registry: details + comps (fallback, cache) → persist facts with provenance → meter | Facts + comps; emits `underwriting.requested` | All providers down → retry (30 s base, 6 attempts) → dead-letter |
| `underwriting.initial` | `underwriting.requested` | Deterministic `underwriteWholesaleDeal` with org assumptions | Underwriting result; if pursue/negotiate → approval request (offers.approve) → on approval, ceiling recorded, status `offer_pending` | Missing living area → follow-up task; rejection → run cancelled |
| `conversation.outreach` | `conversation.outreach_requested` | Templated first touch → compliance gate | `allow` → SMS sent, status `contacting` | `defer` → durable sleep to window then re-check; `require_review` → compliance task; `block` → recorded with reason codes |
| `conversation.inbound` | `message.received` | Record inbound → deterministic opt-out check → Claude extraction w/ evidence verification → update lead (`ai_generated`) → re-underwrite on new asking price → escalate / book / next question | Lead updated; templated reply sent through gate | Opt-out → suppress, revoke, one confirmation, lead `dead`; sensitive topics → escalation task + handoff reply; model refusal → non-retryable → dead-letter + human |

## Planned workflows
`followup.sequence` (consented cadence, capped, quiet-hour aware), `followup.scan` (scheduled: dormant leads), `crm.sync` (write-back), `appointment.book` (calendar), `dnc.scrub` (scheduled ≤ 31 days), `billing.usage_rollup` (daily), `onboarding.org_created`, `transaction.milestones`, `document.ingest`.
