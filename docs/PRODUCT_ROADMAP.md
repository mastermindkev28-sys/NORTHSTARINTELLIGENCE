# Product Roadmap

Sequencing principle: commercialize early on a correct foundation; expand by customer demand. Dates are targets, not commitments.

## Now — Foundation & v1 core (built this cycle)
- Monorepo, core domain, provenance model, RBAC model.
- Underwriting engine (deterministic, tested).
- Lead intelligence, compliance engine, workflow engine, agents, provider adapters.
- Postgres schema with RLS; web app on the live engine (demo workspace).

## Next — Design-partner beta (target: 6–8 weeks)
1. Postgres-backed `DomainRepository` + worker process (replace in-memory demo store).
2. Authentication & org onboarding (Supabase Auth, ADR-005), invite flow, RBAC enforcement in routes.
3. Twilio per-tenant A2P 10DLC onboarding; inbound SMS webhook with Twilio signature validation; delivery status callbacks.
4. CRM write-back: GoHighLevel (first), then Podio; CSV import.
5. ATTOM (or BatchData) contract with display/cache/LLM rights; production provider config.
6. National DNC scrub integration (per-tenant SAN) and suppression import.
7. Calendar booking (Google/Microsoft), AM routing.
8. Eval set for qualification extraction (≥ 200 labeled transcripts) before enabling live model.
9. Stripe billing with metered usage; usage dashboards.

## v1.x — Commercial launch (target: Q1–Q2 2027)
- Voice: inbound AI answering (recording + AI disclosure + human handoff).
- Follow-up sequences (consented, capped, quiet-hour aware) with nurture logic.
- Comp adjustment UI, org calibration (rehab rates, ARV factors), offer letter drafts (human-approved).
- Business Intelligence: speed-to-lead, funnel conversion, cost per appointment.
- GHL Marketplace app (agency resale channel).

## v2 — Transact & Due Diligence
- Contract milestone extraction (human-confirmed), deadline tracking, document collection, closing coordination.
- Document intelligence (inspection reports, title commitments, leases) with citations and `ai_generated` labeling.

## v3 — Portfolio & Institutional
- Portfolio dashboard, rental ops ingestion, asset monitoring, investor reporting.
- MLS integrations via customer/broker credentials (RESO Web API), enterprise SSO, data warehouse export.
