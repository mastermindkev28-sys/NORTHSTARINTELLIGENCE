# Northstar Intelligence

**The intelligence infrastructure for real estate.** A product of Northstar Acquisitions LLC. (Working brand name pending trademark, corporate-name, and domain clearance.)

A modular real estate operating system. The first commercial focus is residential wholesalers and acquisition teams; the platform is built to extend to investors, brokerages, property managers, and institutional operators across six divisions: Acquire, Intelligence, Underwrite, Due Diligence, Transact, and Portfolio.

## What is in this repository

| Path | Contents |
|---|---|
| `apps/web` | Next.js 16 application: auth, workspaces, underwriting workspace, reports, members, audit log |
| `packages/underwriting` | Deterministic, provenance-aware underwriting engine (ARV, MAO, assignment, flip, rental, DSCR, IRR, sensitivity) |
| `packages/db` | PostgreSQL migrations with forced multi-tenant row-level security, tenant-scoped data access, integration tests |
| `packages/core` | Auth crypto, RBAC, validation, logging, rate limiting, webhook verification |
| `packages/integrations` | Property data and messaging adapters with safe mocks and a TCPA-oriented compliance gate |
| `docs/` | Architecture decisions, system architecture, schema, methodology, security, testing, deployment, strategy and research |

## Quick start

```bash
corepack enable && pnpm install
createdb -h localhost -U postgres northstar_dev
DATABASE_OWNER_URL=postgres://postgres@localhost:5432/northstar_dev APP_DB_ROLE=northstar_web APP_DB_PASSWORD=devpassword pnpm db:migrate
cp .env.example apps/web/.env.local
pnpm dev   # http://localhost:3000
```

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Details: [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) · [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) · [docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) · [docs/TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md)

## Principles

- Tenant isolation is enforced by the database, and proven by tests.
- Financial results are deterministic, reproducible, and show their formulas and sources.
- Verified facts, assumptions, third-party estimates, and AI interpretations are always distinguished.
- Demo data is always labelled. Nothing is invented to fill missing data.
