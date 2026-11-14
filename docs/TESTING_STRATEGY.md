# Testing Strategy

Run: `pnpm test` (unit + DB integration), `pnpm test:db`, `pnpm typecheck`, `pnpm lint`. DB tests need Postgres (`pnpm db:local` or `docker compose up -d postgres`); they skip locally if unavailable and **fail in CI** if unavailable.

## Current status (2026-11-14)
**197 tests passing** across 13 files (statements 91.3 %, lines 94.6 %; compliance 98 %, workflows 99 %, underwriting 96 % lines): unit (underwriting, leads, compliance, workflows, providers, integrations, agents, core) + real-Postgres integration (RLS, constraints, migrations, workflow store contract). Typecheck and lint clean. Web app builds and was verified in a real browser (Playwright): approvals, analyzer, webhook status codes, no console errors, no horizontal overflow at 390 px.

## Layers
| Layer | What | Where |
|---|---|---|
| Financial calculation tests | Independent reference values (Python), identities (cost-based MAO), determinism, invalid inputs | `packages/underwriting/src/*.test.ts` |
| Domain unit tests | Normalization references, dedupe thresholds, scoring invariants (fair housing), completeness | `packages/leads` |
| Compliance tests | Keywords & phrases, quiet hours across zones/DST/states/area codes, consent/revocation, DNC freshness, frequency cap, number source, content, fair housing | `packages/compliance` |
| Contract tests | One scenario suite run against every `WorkflowStore` (memory + Postgres): idempotency, memoization, retries/backoff, dead-letter, sleep, approvals/authorization, chaining, concurrency, lease expiry, tenant isolation | `packages/workflows/src/storeContract.ts` |
| Security / isolation | RLS on every tenant table, cross-tenant writes, fail-closed, context leakage, audit immutability, app-role privileges, injection-shaped tenant ids | `packages/db/src/db.test.ts` |
| Adapter tests | Fixture responses, absent-field handling, error classification, fallback, caching | `packages/providers`, `packages/integrations` |
| Workflow E2E | Full acquisition loop with demo provider, mock model, sandbox messaging | `packages/agents/src/agents.test.ts` |
| Browser E2E | Playwright smoke over the running app (to be committed as `apps/web/e2e`) | planned in CI |
| Model evals | Labeled transcript set; per-field precision/recall; hallucinated-price rate must be 0 | planned before live model |

## Rules
- Never delete or weaken a test to pass. Fix the code or document an intentional behavior change in the test name and `CHANGELOG.md`.
- Every bug fix adds a regression test (examples this cycle: plural fair-housing patterns; re-underwriting on new asking price; stage demotion).
- Every new tenant table must pass the RLS enumeration test.
- Time-dependent logic uses `FixedClock`.
