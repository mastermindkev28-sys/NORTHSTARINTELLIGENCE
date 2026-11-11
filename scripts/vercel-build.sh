#!/usr/bin/env bash
# Vercel build for the hosted preview: migrate and load reference data, then build.
# Expects a hosted Postgres integration (Neon) that injects DATABASE_URL_UNPOOLED (owner, direct),
# plus APP_DB_ROLE / APP_DB_PASSWORD for the non-owner login role the app runs as.
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_OWNER_URL="${DATABASE_OWNER_URL:-${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-}}}"
if [ -z "$DATABASE_OWNER_URL" ]; then
  echo "No owner database URL (DATABASE_OWNER_URL or DATABASE_URL_UNPOOLED). Add the Neon integration." >&2
  exit 1
fi
pnpm --filter @northstar/db migrate
pnpm --filter @northstar/db seed:market --demo
pnpm -r --filter './packages/**' build
pnpm --filter @northstar/web build
