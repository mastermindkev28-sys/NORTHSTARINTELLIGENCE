# Project Status Dashboard

**As of:** 2026-11-14 · **Version:** 0.1.0 (foundation) · **Branch:** `claude/brave-lamport-n8ugyq`

## Summary
The technical foundation and the core v1 acquisition loop are implemented and verified locally: lead intake → property research → deterministic underwriting → human-approved offer ceiling → compliant outreach → AI qualification → opt-out handling. The product runs end to end in a demo workspace over synthetic data. **It is not deployed, has no live integrations, and has no customers or revenue.**

## Completed (implemented + verified)
| Area | Evidence |
|---|---|
| Underwriting engine (ARV, MAO, flip, assignment, rental, IRR, projections, sensitivity) | 60+ tests vs. independent reference values |
| Lead intelligence (normalize, dedupe, score, completeness) | 18 tests |
| Compliance gate (consent, revocation per FCC 26-67, quiet hours strictest-state, DNC freshness, 3/24h cap, number source, content, fair housing) | 51 tests |
| Durable workflow engine | 13-scenario contract suite × 2 stores (memory, Postgres) |
| Postgres schema with FORCE RLS, audit immutability | 12 isolation/constraint tests on real Postgres |
| Property data adapters + fallback registry | 11 tests (fixtures; not live) |
| Webhook + Twilio signature verification, messaging adapters | 5 tests (Twilio doc example) |
| Agents + five product workflows | 10 end-to-end workflow tests |
| Web app (dashboard, leads, lead workspace, analyzer, automation/approvals, agents, webhook) | Production build + Playwright browser verification |
| Documentation set (22 docs + research) | `docs/` |

## Active / partial
| Item | State |
|---|---|
| Follow-Up Agent | First touch done; sequences planned |
| Business Intelligence | Dashboard metrics done; scheduled reports planned |
| Claude integration | Implemented with SDK; **not exercised live** (no API key in environment) |
| Twilio / ATTOM / RentCast | Adapters built; **no live credentials or contracts** |

## Blocked (requires owner action)
| Blocker | Needed |
|---|---|
| Live model runs | `ANTHROPIC_API_KEY` |
| Live property data | Provider contract with display/cache/LLM rights + API key |
| Live SMS | Twilio account, per-tenant A2P 10DLC registration, counsel-reviewed templates |
| DNC scrubbing | National DNC Registry SAN per tenant |
| Deployment | Hosting accounts (Vercel/Supabase/Fly) and spend approval |
| Public brand use | Trademark/corporate/domain clearance |

## Outstanding decisions
See `NEXT_ACTIONS.md` § Decisions needed (data provider, hosting, counsel, pricing adoption, brand clearance).

## Integration requirements
See `INTEGRATION_CATALOG.md`.

## Security concerns (open)
- Authentication not yet integrated (demo runs as a fixed demo manager).
- Domain data in the demo uses an in-memory repository; Postgres repository pending.
- No rate limiting/WAF or CSP yet; no dependency/secret scanning in CI yet.
- Audit log not yet hash-chained.

## Test status
197 passing (unit + Postgres integration); typecheck clean; lint clean; coverage 91.3 % statements / 94.6 % lines. CI workflow defined (`.github/workflows/ci.yml`) — not yet observed running on GitHub.

## Deployment status
Not deployed. Local production build succeeds.

## Next highest-value priorities
1. Postgres domain repository + worker. 2. Auth + RBAC enforcement. 3. Inbound SMS webhook. 4. Area-code time-zone table. 5. Extraction eval set + live model. (Full list: `NEXT_ACTIONS.md`.)
