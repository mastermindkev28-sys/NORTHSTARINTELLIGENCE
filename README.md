# Northstar Intelligence

**The intelligence infrastructure for real estate.** A product of Northstar Acquisitions LLC.

Northstar is a modular real estate operating system. The first product is an **AI acquisitions desk**: every inbound or opted-in seller lead is answered fast, qualified with evidence-verified AI extraction, underwritten with deterministic and tested financial models, checked by a fail-closed compliance engine, and routed for human approval before any offer.

## Repository
| Path | Contents |
|---|---|
| `packages/core` | Provenance, RBAC, tenancy, errors, money, logging |
| `packages/underwriting` | Deterministic underwriting engine (ARV, MAO, flip, rental, IRR, sensitivity) |
| `packages/leads` | Lead normalization, dedupe, scoring, completeness |
| `packages/compliance` | TCPA/DNC/state-law outreach gate, opt-outs, fair housing |
| `packages/workflows` | Durable event-driven workflow engine |
| `packages/db` | Postgres migrations (RLS), migration runner, Postgres workflow store |
| `packages/providers` | Property data adapters (ATTOM, RentCast, demo) with provenance |
| `packages/integrations` | Webhook verification, messaging (Twilio, sandbox) |
| `packages/agents` | Claude-backed agents and product workflows |
| `apps/web` | Next.js application (demo workspace on the live engine) |
| `docs/` | Strategy, research, architecture, methodology, compliance, status |

## Quick start
```bash
pnpm install
pnpm db:local
pnpm test
pnpm dev   # http://localhost:3000
```
See `docs/DEPLOYMENT_GUIDE.md` and `docs/PROJECT_STATUS.md`.
