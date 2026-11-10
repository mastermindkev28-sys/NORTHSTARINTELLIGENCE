# Changelog

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
