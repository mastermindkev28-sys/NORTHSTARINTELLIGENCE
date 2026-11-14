# Architecture Decision Records

Format: Context · Options · Decision · Consequences. Status: Accepted unless noted.

## ADR-001 — TypeScript monorepo (pnpm workspaces)
**Context:** One team, many modules (six divisions), shared domain types across UI, workers, and APIs.
**Options:** Polyrepo; Python backend + TS frontend; TS monorepo.
**Decision:** TypeScript end to end in a pnpm monorepo; internal packages export TS source (no build step), consumed by Vitest, tsx, and Next.js (Turbopack). Extensionless relative imports (Bundler resolution).
**Consequences:** Shared types eliminate drift; one toolchain. Pure domain packages are reusable. Requires discipline on package boundaries (enforced by dependency direction).

## ADR-002 — Postgres as system of record, with FORCE RLS for tenant isolation
**Context:** Multi-tenant SaaS with sensitive PII; must never leak across tenants.
**Options:** Schema-per-tenant; DB-per-tenant; shared tables + app-level filters; shared tables + RLS.
**Decision:** Shared tables, `organization_id` everywhere, FORCE RLS, transaction-local tenant setting, non-BYPASSRLS app role, SECURITY DEFINER functions for the few cross-tenant worker operations. Enterprise tenants can later move to dedicated databases with the same schema.
**Consequences:** Isolation enforced even if application code has a bug (tested). Every new table must add a policy — enforced by a test that fails if any `organization_id` table lacks forced RLS.

## ADR-003 — Own durable workflow engine on Postgres (vs. Inngest / Trigger.dev / n8n)
**Context:** Need event-driven automation with idempotency, retries, dead-letter, sleeps, human approvals, audit, and per-tenant isolation; must run independently of any chat session; cost-sensitive early.
**Options:** Inngest (excellent DX, hosted, step memoization; vendor dependency and per-step pricing); Trigger.dev (similar, self-hostable); n8n (visual, weak typing/testing, poor fit for tenant-isolated product logic); Temporal (powerful, heavy ops); own engine on Postgres.
**Decision:** A small engine with Inngest-like semantics (`step.run` memoization, `sleepUntil`, `waitForApproval`, `emit`) behind a `WorkflowStore` interface, Postgres implementation using SKIP LOCKED leases. Same contract tests run against memory and Postgres stores.
**Consequences:** No extra vendor or per-step cost; approvals and audit are first-class; workflows are unit-testable. We own correctness — mitigated by the contract suite (concurrency, lease expiry, idempotency). If scale or features demand it, the `WorkflowDefinition` API maps cleanly onto Inngest/Temporal.

## ADR-004 — Hosting: Vercel for web, container worker, managed Postgres
**Decision:** Next.js on Vercel (or container), worker as a long-running container, managed Postgres 16 with PITR. Avoid serverless-only workers because claims/leases and long sleeps need a steady loop.
**Consequences:** Two deployables; simple ops. Not yet deployed — requires accounts and approval (see `DEPLOYMENT_GUIDE.md`).

## ADR-005 — Supabase for Postgres + Auth (subject to review) — *Proposed*
**Context:** Need auth (email, SSO later), managed Postgres, low ops.
**Decision (proposed):** Supabase Postgres + Auth; the app sets `app.org_id` from the verified session's selected organization after checking membership via `app.membership_for()`. We do **not** rely on Supabase's PostgREST/anon-key access to tenant tables (all access through our server with the `northstar_app` role).
**Consequences:** Portable schema (plain Postgres); auth swappable (Clerk/Auth.js/WorkOS for enterprise SSO).

## ADR-006 — AI usage policy: extraction with evidence; deterministic money, compliance, and routing; templated outbound
**Context:** Hallucinated facts or AI-written offers create financial and legal harm.
**Decision:** LLMs only extract structured facts from seller messages using structured outputs; each value requires a verbatim quote that must appear in the seller's text or it is discarded. Opt-outs are detected without the model. Outbound seller messages in v1 are compliance-reviewed templates. All AI values are stored as `ai_generated` with confidence. Human approval gates all offers.
**Consequences:** Lower "wow" than free-form AI chat, much higher trust and compliance. Free-form drafting can be added later as *human-reviewed drafts*.

## ADR-007 — Claude via official SDK, model-agnostic interface
**Decision:** `StructuredModel` interface; `ClaudeStructuredModel` uses `@anthropic-ai/sdk` `beta.messages.parse` with Zod structured outputs, explicit `effort`, prompt caching on the stable system prompt, and server-side refusal fallback (`fallbacks: "default"`). Default model `claude-opus-5-5`, configurable via `NORTHSTAR_LLM_MODEL`. Deterministic mock used when no key is configured.
**Consequences:** Swappable models; testable without network; refusals escalate to humans rather than failing silently.

## ADR-008 — Provider-neutral property data with provenance
**Decision:** `PropertyDataProvider` adapters (ATTOM, RentCast; BatchData next), ordered fallback registry, caching with license-respecting TTL, usage metering, and `Sourced<T>` on every fact. Demo provider refused in production.
**Consequences:** No single-vendor dependency; every number traceable to source and retrieval time.

## ADR-009 — Compliance as a single fail-closed gate
**Decision:** All outbound messaging goes through `evaluateOutreach`; messaging adapters require an explicit `"allow"` verdict. Policy parameters (windows, caps, keywords) are versioned data reviewed by counsel; organizations can only tighten them.
**Consequences:** Some legitimate messages are deferred or routed to review (accepted trade-off).
