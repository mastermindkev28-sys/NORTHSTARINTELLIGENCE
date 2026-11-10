# Deployment Guide

Nothing has been deployed yet. This guide covers local development, CI, and the steps to stand up staging/production once accounts and credentials exist.

## Prerequisites

- Node.js ≥ 22, pnpm 10 (`corepack enable`)
- PostgreSQL 16 (local install or Docker: `docker run -d -p 5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16`)

## Local development

```bash
pnpm install
cp .env.example apps/web/.env.local          # adjust if your Postgres differs
createdb -h localhost -U postgres northstar_dev
DATABASE_OWNER_URL=postgres://postgres@localhost:5432/northstar_dev \
APP_DB_ROLE=northstar_web APP_DB_PASSWORD=devpassword \
pnpm db:migrate                               # applies migrations, creates the app login role
pnpm dev                                      # http://localhost:3000 → Create workspace
```

The app must connect with the **app role** (`DATABASE_URL`), never the owner: the owner bypasses RLS.

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | web | App login role ∈ `northstar_app`. Use the provider's transaction-mode pooler URL in serverless. |
| `DATABASE_OWNER_URL` | migrations only | Owner/superuser. Keep out of the web runtime. |
| `APP_DB_ROLE`, `APP_DB_PASSWORD` | migrations (local/CI) | Optional: provision the app login role. In production, provision via infrastructure. |
| `PROPERTY_DATA_PROVIDER` | web | `mock` (default, demo data), `rentcast`, `realie` (pending) |
| `RENTCAST_API_KEY` | web | Required when provider is `rentcast` |
| `LOG_LEVEL` | all | `debug`/`info`/`warn`/`error` |

## CI

`.github/workflows/ci.yml` runs on every push and PR: install (frozen lockfile), typecheck, lint, unit tests, DB integration tests against a Postgres 16 service, production build, and the Playwright smoke test against the built app.

## Staging / production (requires owner action)

These steps need accounts, spending approval, and credentials, so they are not done yet.

1. **Database**: create a managed Postgres 16 project (Supabase recommended, ADR-004) in a US region; enable PITR backups. Create the app login role: `create role northstar_web login password '…' nobypassrls in role northstar_app;` (after the first migration creates `northstar_app`).
2. **Migrations**: run `pnpm db:migrate` with `DATABASE_OWNER_URL` from a trusted machine or a CI job with an environment-protected secret. Never run migrations from the web runtime.
3. **Web**: create a Vercel project with root `apps/web`, install command `pnpm install --frozen-lockfile`, build command `pnpm --filter @northstar/web build`. Set env vars per environment. Preview deployments must point at the staging database, never production.
4. **Domain and TLS**: attach the domain after trademark/domain clearance.
5. **Health and monitoring**: point an uptime check at `/api/health`; add error tracking (ADR-013).
6. **Shared rate limiting**: provision Upstash Redis (or use Postgres) and swap the limiter implementation before running more than one instance.
7. **Restore drill**: restore the latest backup into a scratch project and run `pnpm --filter @northstar/db test` against it; record the date here.

## Rollback

- Web: Vercel instant rollback to the previous deployment.
- Database: migrations are forward-only; ship a new corrective migration. For data loss, PITR restore.
