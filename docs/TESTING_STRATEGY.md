# Testing Strategy

## Layers

| Layer | Tool | Location | What it proves |
|---|---|---|---|
| Financial unit tests | Vitest | `packages/underwriting/test` | Every formula against hand-checked and textbook values; boundaries; invalid inputs; warnings |
| Property-based invariants | Vitest + seeded PRNG | `packages/underwriting/test/properties.test.ts` | Linearity of MAO, amortization identities, IRR root property, NOI/cash-flow identities, determinism over hundreds of random deals (seeded, so failures reproduce) |
| Reconciliation tests | Vitest | `report.test.ts`, `wholesale.test.ts` | Cost stack reconciles to MAO; max supportable fee leaves the buyer exactly at minimum margin; report determinism and fingerprint stability |
| Platform unit tests | Vitest | `packages/core/test`, `packages/integrations/test` | Password hashing and hostile inputs, tokens, RBAC parity with SQL, redaction, rate limiting, webhook tampering/replay/rotation, provider mapping and error handling with stubbed HTTP, messaging compliance gate |
| Database integration and security | Vitest + real PostgreSQL | `packages/db/test/rls.test.ts` | Tenant isolation, authorization boundaries, concurrency, connection reuse, audit immutability, session validity, migration integrity |
| End-to-end | Playwright | `apps/web/e2e/smoke.mjs` | Real browser, production build, real database: auth gate, sign-up, live calculation, save, report, finalize, rental, audit, cross-tenant 404, sign-out, bad password |

## Current results (2026-11-10)

| Suite | Tests | Result |
|---|---|---|
| underwriting | 103 | pass, 99.4% statements, 94.2% branches |
| core | 20 | pass |
| integrations | 26 | pass |
| db (real Postgres 16) | 35 | pass |
| e2e smoke (production build) | 9 checks | pass |

## How to run

```bash
pnpm install
pnpm test                       # all packages; DB tests need Postgres (see below)
pnpm --filter @northstar/underwriting test:coverage
TEST_DATABASE_ADMIN_URL=postgres://postgres@localhost:5432/postgres pnpm --filter @northstar/db test
# e2e: start the app (see DEPLOYMENT_GUIDE.md), then
BASE_URL=http://localhost:3000 pnpm --filter @northstar/web e2e
```

DB tests create an isolated database per run, apply migrations as the owner, and connect as a non-owner member of `northstar_app`, which is exactly the production posture. If Postgres is unreachable they are skipped with a warning locally; CI always provides Postgres, so they never silently skip there.

## Rules

1. Never delete or weaken a test to make a suite pass. Fix the code or document why the expectation changed.
2. Every formula change bumps `ENGINE_VERSION` and adds a test with an independently computed expected value.
3. Every new tenant table must pass the "RLS enabled and forced on every table" test and get isolation tests.
4. Every external adapter is tested against stubbed HTTP responses for success, missing fields, malformed bodies, auth failure, rate limiting, and network errors.
5. Test duplicate events (idempotency), concurrent operations, invalid credentials, and authorization boundaries for every new workflow.

## Gaps to close next

- Accessibility checks (axe) in the e2e run.
- Load test of the session + RLS path (target p95 < 50 ms DB time per page).
- Mutation testing on the underwriting package.
- Visual regression on key screens once the design system stabilizes.
