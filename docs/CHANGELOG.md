# Changelog

## Unreleased — Market Intelligence

### Added
- **`@northstar/market`**: metric allow-list with fair-housing guardrails, source catalog, Landlord Regulatory Index (14 cited factors, append-only rows, effective dates, user weights), transparent Market Score (6 categories, confidence, coverage, conservative missing-data handling), risk flags never averaged into scores, 10 strategy profiles plus custom profiles, relative/absolute normalization, trends, five-signal undervaluation evidence, monitoring rules with deduped evidence-carrying alerts, labeled demo dataset. 63 tests, 98% line coverage.
- **Migration 0005**: geo_areas, geo_metric_observations (protected-metric check constraint), append-only regulatory_factors, market_score_profiles, market_watchlists, market_watchlist_items, market_alert_rules, market_alerts; shared `app.investment_strategy` enum and `northstar_ingest` role. Seed script for cited pilot rows. 11 RLS tests.
- **Workspace** at `/app/market`: explorer, area profiles, compare, Landlord Regulatory Index, undervaluation workbench, monitoring and alerts, score profiles, sources and methodology. E2E `e2e/market.mjs`.
- **Docs**: MARKET_INTELLIGENCE_ENGINE.md.

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
