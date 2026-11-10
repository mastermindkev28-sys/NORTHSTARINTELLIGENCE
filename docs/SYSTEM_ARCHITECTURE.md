# System Architecture

Status as of 2026-11-10. This document describes what is built and how the planned components attach to it. Decisions and their rationale are in [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md).

## 1. Goals that shape the design

1. **Tenant isolation is enforced by the database**, not by application discipline.
2. **Financial results are reproducible**: deterministic functions, recorded inputs, engine version, fingerprint.
3. **Provenance everywhere**: every number says whether it is verified, assumed, third-party, AI-derived, or calculated.
4. **Modular divisions on one platform**: Acquire, Intelligence, Underwrite, Due Diligence, Transact, Portfolio share identity, tenancy, audit, data, and workflow infrastructure, and can be sold separately.
5. **No vendor is load-bearing without an adapter**: property data, messaging, CRM, billing, and AI sit behind interfaces with mocks.
6. **Operates without any chat session**: everything runs as a normal web application plus a durable workflow engine.

## 2. Component map

```
                ┌──────────────────────────── Browser ────────────────────────────┐
                │  Next.js client components (live underwriting runs the same     │
                │  @northstar/underwriting library locally for instant feedback)  │
                └───────────────────────────────┬─────────────────────────────────┘
                                                │ HTTPS (session cookie, HttpOnly)
┌───────────────────────────────────────────────▼──────────────────────────────────────────────┐
│ apps/web (Next.js 16, App Router)                                                            │
│  proxy.ts ── request id, fast /app redirect (not an authorization decision)                  │
│  Server Components ── read via asTenant()                                                    │
│  Server Actions ───── auth, underwriting save/finalize, member roles (RBAC pre-check)        │
│  Route Handlers ───── /api/health   (planned: /api/v1/*, /api/webhooks/*, /api/inngest)      │
└──────┬───────────────────────────┬────────────────────────────┬──────────────────────────────┘
       │                           │                            │
┌──────▼───────────┐   ┌───────────▼────────────┐   ┌───────────▼─────────────────────────────┐
│ @northstar/core  │   │ @northstar/underwriting│   │ @northstar/integrations                 │
│ auth crypto,     │   │ pure deterministic     │   │ PropertyDataProvider (mock, RentCast,   │
│ RBAC matrix,     │   │ calculators, reports,  │   │ Realie planned), messaging compliance   │
│ zod schemas,     │   │ provenance + trace     │   │ gate + MessagingProvider (mock, Twilio  │
│ logger, rate     │   │                        │   │ planned), CRM (planned)                 │
│ limit, webhooks  │   └────────────────────────┘   └─────────────────────────────────────────┘
└──────┬───────────┘
┌──────▼──────────────────────────────────────────────────────────────────────────────────────┐
│ @northstar/db: withTenant / withUser / withAnonymous (transaction-local context),            │
│ typed repositories, checksummed migration runner                                             │
└──────┬──────────────────────────────────────────────────────────────────────────────────────┘
       │  login role ∈ northstar_app (NOBYPASSRLS, not owner)
┌──────▼──────────────────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL 16: FORCE RLS on every table · SECURITY DEFINER auth entry points · audit triggers │
│ organizations · users · memberships · sessions · audit_log · properties · leads ·            │
│ underwriting_analyses · communication_suppressions · usage_events                            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

Planned: Workflow engine (Inngest, ADR-008) ── events from app & webhooks → durable functions
         (lead intake, enrichment, follow-up, agent runs) → same repositories inside withTenant
```

## 3. Request lifecycle (authenticated page)

1. `proxy.ts` assigns `x-request-id`; redirects to `/login` if no session cookie is present.
2. `getSession()` hashes the cookie token and calls `app.resolve_session()` (security definer): returns user, active org, and role only if the session is unexpired, unrevoked, the user is active, and the membership is active.
3. `asTenant()` opens a transaction and sets `app.user_id`, `app.org_id`, `app.request_id` with `set_config(..., true)`.
4. Queries run under RLS. Writes fire `app.audit_row_change()`, which records the action, actor, request id, and changed column names.
5. Commit; the settings vanish with the transaction, so the pooled connection is clean.

## 4. Tenancy and identity model

- **Organization** = tenant (a wholesaling company, brokerage, fund). **User** = global identity. **Membership** = (org, user, role, status).
- Roles: `owner`, `admin`, `manager`, `acquisitions`, `analyst`, `viewer`. Matrix in `packages/core/src/rbac.ts`, enforced in SQL policies (`app.can_write`, `app.can_delete`, owner/admin checks). Invariants enforced by triggers: an org always keeps an active owner; only owners grant or revoke owner.
- A user can belong to several organizations and switch the session's active org; membership is re-checked on every request.

## 5. Underwriting flow

```
form (percent units, provenance selectors)
  → zod schema (@northstar/core/validation) → engine input (decimals, Sourced values)
  → buildWholesaleDealReport / buildRentalReport (pure)
  → client: live display      server (on save): recompute → store inputs + report + engine version + fingerprint
```
Finalized analyses are frozen by a trigger. See [UNDERWRITING_METHODOLOGY.md](UNDERWRITING_METHODOLOGY.md).

## 6. Division roadmap on this foundation

| Division | Foundation already in place | Next components |
|---|---|---|
| Acquire | `leads` table, suppression list, messaging compliance gate, usage metering | lead intake API + CSV import, dedupe, pipeline UI, follow-up workflows, CRM adapters |
| Intelligence | property data contract, provenance model, mock + RentCast | Realie adapter, property workspace, enrichment workflow, provider license registry, cache |
| Underwrite | engine, calculators, reports, finalize | comps pulled from providers into ARV, PDF export, portfolio-level scenario library |
| Due Diligence | audit, provenance class `ai_interpretation` | document storage, extraction agent, checklist engine, human review queue |
| Transact | audit, roles | transactions, milestones, deadline engine, notifications |
| Portfolio | rental engine and projections | assets, actuals ingestion, portfolio dashboards |

## 7. Agent architecture (planned)

A central orchestrator runs as durable workflows. Agents are workflows with a Claude tool-use loop whose tools are thin wrappers over repositories, provider adapters, and the underwriting library, each executed inside `withTenant` with a role scoped to the agent's task. Agent actions are written to `audit_log` with `actor_type = 'agent'`. Consequential actions (sending campaigns, making offers, signing, spending) create approval requests for a human. Specifications: docs/AI_AGENT_SPECIFICATIONS.md (to be written).

## 8. Environments

| Environment | Web | Database | Data providers |
|---|---|---|---|
| Local | `pnpm dev` | local Postgres 16 | mock (demo data) |
| CI | build + tests | Postgres 16 service container | mock / fetch stubs |
| Staging (planned) | Vercel preview | managed Postgres (separate project) | provider sandboxes |
| Production (planned) | Vercel | managed Postgres with PITR | licensed providers |

Deployment steps: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).
