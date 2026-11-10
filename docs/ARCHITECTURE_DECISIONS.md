# Architecture Decision Records

Each record states the problem, the options considered, the decision, and its consequences. Records are append-only: a reversed decision gets a new record that supersedes the old one.

Status key: **Accepted** (implemented or binding), **Proposed** (recommended, not yet implemented), **Superseded**.

Vendor pricing and limits quoted here reflect public information at the time of writing and must be re-verified before any spending commitment.

| # | Decision | Status |
|---|---|---|
| 001 | TypeScript monorepo with pnpm workspaces | Accepted |
| 002 | Next.js (App Router) for the web application | Accepted |
| 003 | Shared-schema multi-tenancy enforced by forced PostgreSQL RLS | Accepted |
| 004 | Managed PostgreSQL host, kept portable (Supabase recommended as host) | Accepted |
| 005 | First-party sessions now, enterprise SSO via an identity broker later | Accepted |
| 006 | Underwriting as a pure, deterministic, provenance-aware library | Accepted |
| 007 | Rate limiting behind an interface; shared store in production | Accepted |
| 008 | Durable workflow engine: Inngest | Proposed |
| 009 | Raw SQL with typed repositories instead of an ORM | Accepted |
| 010 | Multi-provider property data adapters with no silent fallback | Accepted |
| 011 | Messaging through a mandatory compliance gate (Twilio as first provider) | Accepted (gate) / Proposed (Twilio) |
| 012 | Stripe Billing fed by an internal, idempotent usage ledger | Proposed |
| 013 | Observability: structured logs now, OpenTelemetry + error tracking next | Accepted (logs) / Proposed |
| 014 | AI agents call deterministic tools; they never compute financial results | Accepted |

---

## ADR-001: TypeScript monorepo with pnpm workspaces

**Problem.** Six product divisions, a web app, background workers, and shared domain logic must evolve together without copy-paste or version drift.

**Options.** (a) Polyrepo per service. (b) Monorepo with Nx/Turborepo. (c) Monorepo with plain pnpm workspaces.

**Decision.** (c) pnpm workspaces with *internal packages* that export TypeScript source directly (`packages/*` → `"exports": "./src/index.ts"`), consumed by Next.js via `transpilePackages` and by Vitest natively. TypeScript strict mode, `noUncheckedIndexedAccess`.

**Why.** One language end to end; one PR can change schema, domain logic, and UI atomically; no build step for internal packages. Turborepo can be added later for caching without restructuring.

**Consequences.** Packages are not independently publishable until a build step is added. Import paths are extensionless (Bundler resolution) so they work in Next.js/Turbopack, Vitest, and tsx alike.

## ADR-002: Next.js (App Router) for the web application

**Problem.** We need a premium, data-dense web application with server-side authorization, fast iteration, and a credible path to production hosting.

**Options.** Next.js; Remix/React Router; SPA (Vite) + separate API (Fastify/Hono).

**Decision.** Next.js 16 App Router. Server Components read data inside the tenant context; Server Actions perform mutations; Route Handlers serve health checks and, later, public API and webhooks. `proxy.ts` provides a fast auth redirect and request IDs, but authorization is never decided there.

**Why.** Largest ecosystem, first-class Vercel support, server-side rendering keeps secrets and DB access off the client, and Server Actions remove a layer of hand-written API plumbing for first-party UI.

**Risks / consequences.** Long-running work (provider calls, AI agents, bulk imports) must NOT run in request handlers; it goes to the workflow engine (ADR-008). A public REST API for integrations will be added as versioned Route Handlers sharing the same repositories.

## ADR-003: Shared-schema multi-tenancy enforced by forced PostgreSQL RLS

**Problem.** "Never expose one customer's data to another customer." Application-level `WHERE org_id = ?` filters fail silently the first time someone forgets one.

**Options.** (a) Database per tenant. (b) Schema per tenant. (c) Shared schema with `org_id` + application filtering. (d) Shared schema with `org_id` + row-level security.

**Decision.** (d). Every tenant-owned table carries `org_id NOT NULL` and has RLS **enabled and forced** (so even the table owner is subject to it). The application connects as a login role in the `northstar_app` group, which is not the table owner and has `NOBYPASSRLS`. Each request runs in a transaction that sets `app.user_id` and `app.org_id` with `set_config(..., true)` (transaction-local, so pooled connections can never leak context). Policies require both `org_id = app.current_org_id()` **and** active membership of the user in that org (`app.in_tenant()`), so a forged org id yields nothing. Role checks (`app.can_write`, `app.can_delete`, owner/admin checks) live in the same policies. Cross-table references are guarded by triggers that reject cross-tenant foreign keys.

**Why.** Isolation is enforced by the database regardless of application bugs, and is testable: `packages/db/test/rls.test.ts` proves isolation for reads, writes, updates, deletes, moves, forged context, concurrency, and connection reuse.

**Consequences.** Every query must run inside `withTenant` / `withUser` / `withAnonymous`. Flows that precede a tenant context (sign-up, login, session resolution) go through narrowly scoped `SECURITY DEFINER` functions. The migration owner must be a superuser or hold `BYPASSRLS`. Enterprise customers that contractually require physical isolation can later get a dedicated database running the same migrations (option a as a premium tier) without code changes.

## ADR-004: Managed PostgreSQL host, kept portable

**Problem.** Choose where Postgres runs without locking the product to one vendor's proprietary features.

**Options.** Supabase, Neon, AWS RDS/Aurora, Google Cloud SQL, Crunchy Bridge.

**Decision.** Plain PostgreSQL 16 features only (RLS, pgcrypto, citext, plpgsql). Supabase is the recommended managed host for launch (managed backups and point-in-time recovery on paid tiers, connection pooling, storage for documents, good developer experience). We deliberately do **not** depend on Supabase Auth's `auth.uid()` in policies or on PostgREST; our policies read our own session settings, so moving to RDS/Neon/Cloud SQL is a connection-string change.

**Consequences.** We do not get Supabase's auto-generated APIs for free; that is intentional (we want one authorization path). Requires a transaction-mode pooler compatible with `set_config(..., true)` (Supavisor/PgBouncer transaction mode are compatible because settings are transaction-local).

## ADR-005: First-party sessions now, enterprise SSO later

**Problem.** Need secure authentication today, and SAML/OIDC SSO for brokerages and institutions later.

**Options.** Supabase Auth; Clerk; Auth.js; WorkOS; first-party.

**Decision.** First-party email/password with scrypt (`N=16384, r=8, p=1`, parameters stored with each hash) and opaque 256-bit session tokens stored only as SHA-256 hashes, `HttpOnly`, `SameSite=Lax`, `Secure` in production, 7-day expiry, server-side revocation. Users are global identities with memberships in many organizations. `users.password_hash` is nullable so externally managed identities (SSO) slot in without schema change. Plan: add WorkOS (or equivalent) for SAML/OIDC + SCIM when the first enterprise customer requires it, and TOTP/WebAuthn MFA before general availability.

**Why.** Full control over session semantics and RLS integration, zero per-MAU cost, no vendor coupling of identity to tenancy.

**Risks.** We own password reset, email verification, and MFA. These are tracked in docs/NEXT_ACTIONS.md as pre-launch requirements; they need an email delivery provider (credential required).

## ADR-006: Underwriting as a pure, deterministic, provenance-aware library

**Problem.** "Every calculation must use tested deterministic financial functions and transparent assumptions," and outputs must distinguish verified inputs, user assumptions, third-party estimates, AI interpretations, and calculated results.

**Decision.** `packages/underwriting` is a dependency-free library of pure functions: no I/O, no clock, no randomness. Every numeric input may carry provenance (`{ value, source, sourceRef, asOf }`); every result returns `{ value, trace[], assumptions[], warnings[], engineVersion, source: 'calculated' }`. The trace records each formula with the substituted values. Reports carry an FNV-1a fingerprint of the inputs. The same library runs in the browser (live calculation) and on the server (authoritative recomputation on save), so a stored report can never diverge from its stored inputs.

**Numerics.** IEEE-754 doubles at full precision internally; rounding (half away from zero, exponent-shift method) only at output boundaries. For the magnitudes involved (< $10^9$, cents precision) doubles carry ~15–16 significant digits, so error is far below one cent; this is verified by tests and property-based invariants. A decimal library would cost bundle size and speed without changing any displayed cent.

**Consequences.** Any change to a formula bumps `ENGINE_VERSION`; finalized analyses keep the version they were computed with and are immutable in the database.

## ADR-007: Rate limiting behind an interface

**Decision.** `RateLimiter` interface in `@northstar/core` with an in-memory token bucket for development and single-instance deployments. In production on serverless/multi-instance hosting, implement the same interface on a shared store (Upstash Redis or Postgres). Login is limited per IP+email.

**Consequence.** The in-memory limiter does not coordinate across instances; this is a known gap until the shared implementation lands (tracked in NEXT_ACTIONS).

## ADR-008: Durable workflow engine: Inngest (Proposed)

**Problem.** Lead intake, follow-up cadences, provider enrichment, document processing, and agent runs need retries, idempotency, scheduling, dead-lettering, and execution logs, independent of any chat session.

**Options.**
- **Inngest**: event-driven durable functions (steps, sleeps, retries, concurrency and per-key throttling, cron), runs as HTTP endpoints inside our app on Vercel; TypeScript-native; self-hostable open-source server exists.
- **Trigger.dev**: similar durable task model with long-running tasks on its own compute; strong for heavy jobs (document OCR, large imports); open source and self-hostable.
- **n8n**: visual automation; good for ops glue, weaker for versioned, tested, multi-tenant product logic.
- **Temporal**: the most powerful, highest operational and conceptual cost for our stage.

**Recommendation.** Inngest for product workflows (event fan-out, per-tenant concurrency keys, step-level retries map directly to our automation spec), with Trigger.dev as the alternative if we need long-running CPU-heavy tasks that exceed serverless limits. n8n only for internal operations, never for customer data paths. Decision becomes Accepted when the first workflow (lead intake) is built.

**Consequences.** Every workflow must be idempotent on an event id; usage metering already uses `(org_id, idempotency_key)` uniqueness for this reason.

## ADR-009: Raw SQL with typed repositories instead of an ORM

**Decision.** `pg` with hand-written, parameterized SQL in `packages/db/src/repositories.ts` and a small checksummed migration runner.

**Why.** RLS, `SECURITY DEFINER` functions, triggers, and policies are first-class here; ORMs obscure them and their migration generators fight them. Plain SQL migrations are reviewable and portable.

**Revisit when** the query surface grows large enough that a type-safe query builder (Kysely) pays for itself; Kysely can sit on the same pool and context helpers.

## ADR-010: Multi-provider property data adapters with no silent fallback

**Decision.** `PropertyDataProvider` contract (`getProperty`, `getOwner`, `getSalesHistory`, `getComps`, `getValueEstimate`, `getRentEstimate`). Every field carries provenance `{ provider, providerRecordId, retrievedAt, confidence, licenseTag }`; missing values are `null` with a reason, never invented. Disagreeing providers' values are kept side by side. Each call is metered per tenant. The mock provider returns deterministic data flagged `demo: true` and labelled "DEMO". If a real provider is configured and fails, the error surfaces: we never fall back to demo data. Launch providers per docs/DATA_PROVIDER_EVALUATION.md: Realie (primary, adapter pending credentials) and RentCast (implemented, mapping to be re-verified against live responses).

## ADR-011: Messaging through a mandatory compliance gate

**Decision.** All outbound SMS/voice/email goes through `createMessenger`, which runs `checkCompliance` (suppression list, evidence of consent for SMS/voice, recipient-local quiet hours 8:00–21:00, address validation) and idempotency before any provider call. Opt-out keywords are recognized for inbound handling. Any member, including viewers, can record an opt-out. Twilio is the proposed first provider (A2P 10DLC registration required before production SMS).

**Note.** This gate is an engineering floor, not legal advice. TCPA/DNC/state rules require counsel review before outbound automation launches.

## ADR-012: Stripe Billing fed by an internal usage ledger (Proposed)

**Decision.** `usage_events` is the source of truth for metered usage (idempotent per org). A scheduled job reports aggregates to Stripe Billing meters. Plans and entitlements live in our database so limits can be enforced without a Stripe round trip.

## ADR-013: Observability

**Accepted now.** Structured JSON logs with secret redaction, request IDs propagated from `proxy.ts` into the database (`app.request_id`) and the audit log, and a health endpoint.
**Proposed.** OpenTelemetry traces exported to a managed backend, error tracking (Sentry), and uptime checks on `/api/health`.

## ADR-014: AI agents call deterministic tools; they never compute financial results

**Decision.** Claude (Anthropic API, tool use, structured outputs) orchestrates and interprets; numbers come only from the underwriting library and provider adapters exposed as tools. Any AI-extracted value enters the engine tagged `ai_interpretation`, which the engine surfaces in warnings and reports until a human verifies it. Agents get task-scoped permissions and require human approval for binding offers, contracts, spending, outbound campaigns, and destructive changes.
