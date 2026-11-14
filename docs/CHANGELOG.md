# Changelog

## 0.1.0 — 2026-11-14 (foundation)
### Added
- Monorepo (pnpm, TypeScript 5.9, Vitest 5, ESLint, Prettier) and local Postgres tooling.
- `@northstar/core`: provenance model, RBAC, tenant context, errors, money, PII-redacting logger.
- `@northstar/underwriting`: amortization, NPV/IRR, comps ARV with confidence, rehab, cost stack, MAO (rule + cost-based), flip, assignment, rental, projections, sensitivity, wholesale deal underwriting with traces.
- `@northstar/leads`: normalization, duplicate detection, explainable fair-housing-safe scoring, completeness.
- `@northstar/compliance`: opt-out classification (FCC 26-67 keywords + natural language), consent resolution, quiet hours (strictest state, area-code presumption), DNC freshness, 3/24h cap, number-source rules, content and fair-housing checks, fail-closed outreach gate.
- `@northstar/workflows`: durable engine (idempotency, memoized steps, leases, backoff, dead-letter, sleep, approvals) + store contract suite.
- `@northstar/db`: foundation migration with FORCE RLS, append-only audit log, worker claim function, migration runner, Postgres workflow store.
- `@northstar/providers`: ATTOM, RentCast, demo provider, fallback registry with caching and metering.
- `@northstar/integrations`: webhook HMAC verification, Twilio signature validation, sandbox/Twilio messaging.
- `@northstar/agents`: Claude structured-output model + mock, evidence-verified qualification extraction, five product workflows, agent specs.
- `apps/web`: executive dashboard, lead intelligence, lead workspace with provenance, deal analyzer, automation center with approvals, agent registry, signed lead webhook.
- Documentation set under `docs/` including cited market, competitive, pricing, data-provider, and messaging-compliance research.
### Fixed (found by tests / verification)
- Fair-housing patterns missed plural nouns ("neighborhoods").
- Seller-stated asking price after underwriting now triggers re-underwriting.
- Seller replies no longer demote leads that advanced past qualification.
- Dashboard horizontal overflow at mobile width.
