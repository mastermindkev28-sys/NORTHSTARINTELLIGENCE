# Database Schema

Source of truth: `packages/db/migrations/*.sql` (checksummed; never edit an applied migration — add a new one). Postgres 16. Last updated 2026-11-14 (migration `0001_foundation.sql`).

## Conventions
- UUID primary keys (`gen_random_uuid()`), `timestamptz` everywhere, money as `numeric(14,2)`.
- Every tenant table: `organization_id uuid NOT NULL` + **ENABLE + FORCE RLS** + policy `organization_id = app.current_org_id()` (USING and WITH CHECK).
- `app.current_org_id()` reads the transaction-local `app.org_id` setting; NULL (unset) → every policy false (fail closed).
- Application role `northstar_app`: NOBYPASSRLS; DML on public tables; **no UPDATE/DELETE on `audit_log`; no writes to `users`**.

## Tables

| Domain | Table | Purpose / notable constraints |
|---|---|---|
| Tenancy | `organizations` | Tenant; plan, status, settings JSONB. RLS: a tenant sees only itself. |
| | `users` | Global identities (auth provider id). RLS: visible only if a member of the current org. App role read-only. |
| | `memberships` | (org, user) → role ∈ owner/admin/manager/acquisitions/analyst/viewer. |
| Records | `contacts` | Seller contact; `phones text[]` (GIN index). |
| | `properties` | Normalized address with unique `(organization_id, address_key)`. |
| | `property_facts` | Field/value JSONB with `origin`, `source_system`, `source_record_id`, `retrieved_at`, `confidence`; superseded, never overwritten. CHECK: estimates/AI values require confidence. |
| Pipeline | `leads` | Status pipeline, score/tier/factors, completeness, missing fields, duplicate_of, asking/timeline/condition/occupancy, assignment. Unique external id per source. |
| | `appointments`, `tasks` | Scheduling and work items (`created_by_type` user/agent/system). |
| | `underwriting_runs` | Inputs + full result JSONB + methodology version + recommended max offer + decision. |
| | `offers` | Draft → pending_approval → approved → sent…; references approval. |
| Comms & compliance | `consent_records` | Channel, kind (express_written/express/inquiry), evidence, revocation. CHECK: express_written requires disclosure text. |
| | `suppression_entries` | Unique (org, channel, value); reasons opt_out, dnc_internal, wrong_number, litigation_risk, manual. |
| | `dnc_scrubs` | Registry results per number with `scrubbed_at` (freshness ≤ 31 days enforced by gate). |
| | `conversations`, `messages` | Messages store `compliance_decision` JSONB, `ai_generated`, unique idempotency key. |
| Automation | `events` | Unique (org, idempotency_key). |
| | `workflow_runs` | Status, attempts, `next_run_at`, lease (`locked_by`, `locked_until`), last_error, output. Unique (workflow_id, event_id). Partial indexes for due runs and expired leases. |
| | `workflow_steps` | Memoized step outputs, PK (run_id, name). |
| | `workflow_logs` | Execution log lines per run. |
| | `dead_letters` | Exhausted/non-retryable runs; resolution fields. |
| | `approvals` | Human approval requests; unique (run_id, step_name); pending → approved/rejected only. |
| Governance | `audit_log` | Append-only (trigger rejects UPDATE/DELETE even for owners; app role lacks the privilege). |
| | `usage_events` | Metered usage (leads, lookups, AI tokens, SMS segments, …) with idempotency key. |
| | `integration_connections` | Provider config + `secret_ref` pointer (secrets live in the secret manager, never here). |
| | `inbound_webhook_receipts` | Replay protection by (org, provider, delivery_id). |

## Functions
- `app.current_org_id()` — tenant context.
- `app.claim_due_runs(worker, lease_ms, limit, now)` — SECURITY DEFINER; leases due/expired runs across tenants with `FOR UPDATE SKIP LOCKED`.
- `app.membership_for(user, org)` — SECURITY DEFINER; resolves role during request authentication.
- `app.reject_audit_mutation()` — audit immutability trigger.

## Verified by tests (`packages/db/src/db.test.ts`, real Postgres)
Tenant isolation on read/write, cross-tenant insert/update rejection, fail-closed without context, no context leakage across pooled connections, every `organization_id` table has forced RLS + policy, audit immutability, provenance/consent CHECKs, app role cannot write identities, migration idempotency and drift detection, plus the full workflow-store contract (including concurrent claiming).

## Planned migrations
`0002`: hash-chained audit log (`prev_hash`, `hash`), retention policies, `organization_settings` (calibration, contact window), `documents` (object-storage refs), billing tables (`subscriptions`, `invoices` mirror), CRM sync cursors.
