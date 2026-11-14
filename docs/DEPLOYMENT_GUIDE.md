# Deployment Guide

**Status: not deployed.** Production deployment requires accounts, credentials, and owner approval (external spend). Nothing in this repository claims a live deployment.

## Local development
```bash
pnpm install
pnpm db:local            # disposable Postgres 16 on :54329 (or: docker compose up -d postgres)
DATABASE_URL=postgres://northstar:northstar@localhost:54329/northstar pnpm db:migrate
pnpm test                # unit + DB integration
pnpm dev                 # web app on http://localhost:3000 (demo workspace)
```
Optional: `ANTHROPIC_API_KEY` + `NORTHSTAR_DEMO_USE_CLAUDE=1` runs the demo with the live model; `LEAD_WEBHOOK_SIGNING_SECRET` enables the webhook endpoint.

## Production topology (ADR-004)
1. **Postgres 16** (Supabase or RDS): enable PITR; run migrations as the owner role in CI/CD (`pnpm db:migrate`); create a login for the app that is a member of `northstar_app` (NOBYPASSRLS).
2. **Worker:** container running the engine loop (`engine.tick()` every ~1 s with backoff when idle). Scale horizontally; leases make it safe. *(Worker entrypoint + Postgres domain repository are the next build items.)*
3. **Web:** Vercel project for `apps/web` (root `apps/web`, install at repo root). Environment variables from `.env.example`.
4. **Secrets:** platform secret manager; rotate quarterly; per-tenant integration secrets referenced by `integration_connections.secret_ref`.
5. **Observability:** log drain for JSON logs; alerts on dead-letter count > 0, approval backlog age, opt-out latency, provider error rates.

## Release process
Branch → PR → CI (typecheck, lint, unit, DB integration against a Postgres service, build) → review → merge → migrate → deploy web + worker → smoke test → monitor. Migrations are forward-only and checksummed.

## Pre-production checklist
- [ ] Trademark/domain clearance for brand
- [ ] Auth integrated; RBAC enforced on every route/action
- [ ] Postgres domain repository and worker deployed
- [ ] Data provider contract with display/cache/LLM rights
- [ ] Twilio 10DLC registration flow; DNC SAN per tenant
- [ ] Counsel review of compliance policy data and templates
- [ ] Rate limiting/WAF; CSP; dependency + secret scanning
- [ ] Backups + restore drill; incident runbook
- [ ] Model eval set passing thresholds
