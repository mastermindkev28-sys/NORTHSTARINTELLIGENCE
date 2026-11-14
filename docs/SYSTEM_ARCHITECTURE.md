# System Architecture

Last updated 2026-11-14.

## 1. Overview

```
            ┌──────────── Inbound channels ────────────┐
 Lead sources (webhooks, CSV, CRM)   Twilio SMS/voice webhooks   Users (web)
            │ signed (HMAC)                 │ signed (Twilio)          │ authN/RBAC
            ▼                               ▼                          ▼
     ┌────────────────────── apps/web (Next.js 16) ───────────────────────┐
     │ Route handlers (webhooks)  ·  Server components/actions (UI)       │
     └───────────────┬────────────────────────────────────────────────────┘
                     │ emit(event, idempotencyKey)
                     ▼
     ┌──────── @northstar/workflows (durable engine) ────────┐
     │ events → runs (1 per subscribed workflow)             │
     │ lease/claim (SKIP LOCKED) · memoized steps · retries  │
     │ backoff · dead-letter · durable sleep · approvals     │
     └───────┬───────────────────────────────────────┬───────┘
             │ step.run(...)                          │ store
             ▼                                        ▼
 ┌───────── Agents (@northstar/agents) ─────────┐   Postgres (@northstar/db)
 │ lead.intake · property.research ·            │   FORCE RLS per tenant
 │ underwriting.initial · conversation.outreach │   events, runs, steps, logs,
 │ conversation.inbound                         │   approvals, dead_letters,
 └──┬────────┬───────────┬────────────┬─────────┘   audit_log (append-only),
    │        │           │            │             leads, consent, suppression…
    ▼        ▼           ▼            ▼
 leads   compliance  underwriting  providers ──► ATTOM / RentCast / BatchData (adapters)
 (pure)  (pure gate) (pure math)   integrations ──► Twilio, CRMs, calendars
                     models ──► Claude (structured outputs) | Mock
```

## 2. Packages

| Package | Responsibility | Depends on |
|---|---|---|
| `@northstar/core` | Provenance (`Sourced<T>`, `ValueOrigin`), RBAC, tenant context, errors (retryability), money, logging (PII redaction), hashing | zod |
| `@northstar/underwriting` | Deterministic financial engine with traces | core |
| `@northstar/leads` | Lead schema, normalization, dedupe, scoring, completeness | core, libphonenumber-js |
| `@northstar/compliance` | Opt-out classification, consent, quiet hours, DNC freshness, frequency cap, content & fair-housing checks, outreach gate | core |
| `@northstar/workflows` | Durable workflow engine + store contract + in-memory store | core |
| `@northstar/db` | SQL migrations, migration runner, tenant transactions, Postgres workflow store | workflows, pg |
| `@northstar/providers` | Property data interface, ATTOM/RentCast adapters, demo provider, fallback registry, cache, metering hooks | core |
| `@northstar/integrations` | Webhook verification (Northstar HMAC, Twilio), messaging adapters (sandbox, Twilio) | core |
| `@northstar/agents` | Structured model interface (Claude/mock), qualification extraction, domain repository, product workflows, agent specs | all of the above |
| `apps/web` | Next.js UI, webhook endpoints, server actions | agents, … |

Pure packages (`underwriting`, `leads`, `compliance`) have no I/O, which makes them exhaustively testable and reusable in workers, the web app, and future APIs.

## 3. Key flows

1. **Lead intake:** webhook verifies signature → validates → `engine.emit("lead.received", key)` (idempotent) → `lead.intake` normalizes/dedupes/scores/persists/records consent → emits `property.research_requested` and `conversation.outreach_requested`.
2. **Research → underwriting:** provider registry fetches facts + comps (fallback, cache, metering) → `underwriting.initial` runs the deterministic engine → if the deal pencils, **suspends for human approval** of the negotiation ceiling.
3. **Outreach:** templated first touch → compliance gate → `allow` sends (idempotency key), `defer` durably sleeps until the window, `require_review` creates a task, `block` records reason codes.
4. **Inbound reply:** opt-out classified deterministically first → else Claude extraction with evidence verification → lead updated with `ai_generated` provenance → escalate / book / ask next templated question → re-underwrite if a new asking price was stated.

## 4. Tenancy & security model

- Every tenant row has `organization_id`; **FORCE ROW LEVEL SECURITY** with `organization_id = app.current_org_id()` on every tenant table (verified by an automated test that enumerates all tables).
- The app connects as `northstar_app` (NOBYPASSRLS). Tenant context is set per transaction with `set_config('app.org_id', …, true)` — transaction-local, so pooled connections cannot leak context (tested).
- Workers claim runs across tenants only through `app.claim_due_runs` (SECURITY DEFINER, returns scheduling rows), then execute each run under that run's tenant context.
- Application code also asserts tenancy (`assertSameTenant`) — defense in depth.

## 5. Runtime topology (target production)

| Component | Hosting (ADR-004) |
|---|---|
| Web (Next.js) | Vercel (or container on AWS/Fly) |
| Worker (`engine.tick()` loop) | Long-running container (Fly.io/Render/ECS); horizontally scalable via SKIP LOCKED leasing |
| Postgres 16 | Supabase (managed Postgres + Auth) or AWS RDS; PITR backups |
| Secrets | Platform secret manager (Vercel/Fly/AWS Secrets Manager); `integration_connections.secret_ref` points to it |
| Observability | Structured JSON logs (PII-redacted) → log drain; OpenTelemetry traces (planned) |

## 6. Scalability notes

- Due-run index (`workflow_runs_due_idx`) partial on queued/sleeping; claims are `ORDER BY next_run_at LIMIT n FOR UPDATE SKIP LOCKED`.
- Step outputs stored as JSONB; large artifacts (documents) go to object storage (planned) with references.
- Provider calls cached (TTL respecting license terms) and metered.
