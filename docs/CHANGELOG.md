# Changelog

## 0.2.0 (unreleased) — Discover and multi-strategy underwriting

### Added
- **Underwriting engine 1.1.0**: BRRRR (capital recycling, refinance, stabilized returns), creative finance (seller financing with balloon, subject-to, wrap, lease option; due-on-sale, lending-compliance, and legal-review flags; unverified loan terms are critical), Section 8 (HUD benchmark vs PHA payment standard vs contract rent; never guaranteed; not for tenant screening), small multifamily rent roll with in-place vs pro-forma. 30 tests.
- **`@northstar/discover`**: CountyConnector contract; Socrata, ArcGIS, and Carto connectors; pilot registry (Philadelphia, Cook, Cuyahoga) with license metadata; address/APN/name normalization; entity resolution with confidence and review queue; append-only event lifecycle with expiry; idempotent ingestion; three separate scores (property signal, data confidence, strategy fit) with buy boxes and investor profiles. 58 tests.
- **Migration 0003** (ADR-015): global `discover` schema written only by `northstar_ingest`, license-gated reads, append-only records and events; tenant investor profiles, buy boxes, saved searches, watchlists. 12 DB tests.
- **Shared** `INVESTMENT_STRATEGIES` in `@northstar/core`, matching `app.investment_strategy`.
- **Docs**: DISCOVER_ARCHITECTURE, ADR-015, schema/methodology/catalog/testing updates.

## 0.1.0 (unreleased) — Platform foundation

### Added
- **Monorepo**: pnpm workspaces; strict TypeScript; packages `underwriting`, `db`, `core`, `integrations`; app `web`.
- **Underwriting engine** (`@northstar/underwriting` v1.0.0): ARV from comps, renovation, closing, holding, financing, and disposition costs; rule-of-thumb and cost-stack MAO; assignment-fee analysis; flip returns; rental NOI, cap rate, cash-on-cash, DSCR, GRM, break-even occupancy; multi-year projection with IRR and equity multiple; sensitivity grids; financing scenario comparison; deal reports with provenance-grouped assumptions, formula trace, warnings, disclaimer, and input fingerprint. 103 tests.
- **Database**: organizations, users, memberships (6 roles), sessions, append-only audit log with automatic row-change auditing, properties, leads, underwriting analyses (immutable when final), communication suppressions, idempotent usage events. Forced RLS everywhere; checksummed migration runner. 35 integration tests on real Postgres.
- **Core services**: scrypt passwords, opaque session tokens, RBAC matrix, zod schemas with unit conversion, redacting JSON logger, token-bucket rate limiter, HMAC webhook verification with secret rotation. 20 tests.
- **Integrations**: property data contract with per-field provenance; labelled demo provider; RentCast adapter; messaging compliance gate and idempotent messenger. 26 tests.
- **Web app**: sign-up/sign-in/sign-out, workspace switcher, command center, wholesale/flip and rental calculators with live results, saved reports, finalize/archive, members and roles, audit log, health endpoint, security headers, brand palette and typography (Geist, IBM Plex Mono), original Northstar mark.
- **E2E**: Playwright smoke test over the production build, including a cross-tenant access check.
- **Docs**: ARCHITECTURE_DECISIONS, SYSTEM_ARCHITECTURE, DATABASE_SCHEMA, UNDERWRITING_METHODOLOGY, SECURITY_AND_COMPLIANCE, TESTING_STRATEGY, DEPLOYMENT_GUIDE, INTEGRATION_CATALOG.
- **CI**: GitHub Actions workflow with Postgres service.
