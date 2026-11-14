# Next Actions (prioritized)

Ordered by customer value × unblock factor. Owner: engineering unless noted.

1. **Postgres `DomainRepository` + worker entrypoint.** Replace in-memory demo store; run workflows on `PostgresWorkflowStore`; add RLS tests for domain queries. *(Unblocks everything production.)*
2. **Authentication & onboarding** (ADR-005): sessions → membership check via `app.membership_for` → tenant context; enforce permissions in every route/server action; org creation + invites.
3. **Inbound SMS webhook** with Twilio signature validation, delivery-status callbacks, message persistence, idempotency by `MessageSid`.
4. **Full NANP area-code → state/time-zone table** (currently only FL/OK/MD/CT presumptions) so phone-only leads aren't routed to review.
5. **Qualification eval set** (≥ 200 labeled transcripts, synthetic + consented real) and live-model run with `ANTHROPIC_API_KEY`; measure tokens → replace COGS assumptions.
6. **GoHighLevel integration** (OAuth app, contact/opportunity write-back, webhook intake).
7. **Data provider contract** (ATTOM or BatchData) with display/cache/LLM rights; contract-verify adapter mappings against live responses. *(Owner: founder — requires spend/legal.)*
8. **DNC scrub integration** with per-tenant SAN; scheduled ≤ 31-day re-scrub workflow. *(Owner: founder for registry accounts.)*
9. **Twilio A2P 10DLC onboarding flow** per tenant.
10. **Stripe billing** with metered usage rollups from `usage_events`.
11. **Org settings UI:** rehab $/sqft calibration, underwriting defaults, contact window tightening, templates.
12. **CI hardening:** commit Playwright smoke tests; dependency & secret scanning; coverage thresholds for underwriting/compliance (target ≥ 95 %).
13. **Migration 0002:** hash-chained audit log, retention policies, organization_settings, documents.
14. **Federal holiday quiet days** (pending counsel confirmation) and state rule packs for wholesaling disclosures.

## Decisions needed from the owner
| Decision | Options | Recommendation |
|---|---|---|
| Trademark/domain clearance | Engage counsel now vs. later | Now — before public marketing |
| Primary data provider | ATTOM Premium vs. BatchData | ATTOM primary (coverage, AVM), BatchData secondary (`DATA_PROVIDER_EVALUATION.md`) |
| Hosting/accounts | Vercel + Supabase + Fly vs. AWS | Vercel + Supabase + Fly for speed; revisit at Enterprise |
| Compliance counsel | TCPA/real-estate counsel engagement | Required before first live SMS |
| Pricing | Adopt revised structure (`SAAS_PRICING_AND_UNIT_ECONOMICS.md`) | Adopt for design partners; validate with survey |
