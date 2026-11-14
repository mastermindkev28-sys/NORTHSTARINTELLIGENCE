# Integration Catalog

Status: ✅ built & tested · 🟡 adapter built, needs credentials/contract verification · ⬜ planned. Credentials are configured via environment/secret manager (see `.env.example`); never stored in the database.

| Integration | Purpose | Status | Credentials / requirements |
|---|---|---|---|
| Northstar lead webhook | Inbound leads from forms, PPC vendors, Zapier | ✅ HMAC-SHA256 `x-northstar-signature: t=…,v1=…`, 5-min window, 64 KB limit | `LEAD_WEBHOOK_SIGNING_SECRET` per source (per-tenant secrets planned) |
| Anthropic Claude | Qualification extraction (structured outputs) | 🟡 implemented, live calls not yet exercised (no key in this environment) | `ANTHROPIC_API_KEY`; optional `NORTHSTAR_LLM_MODEL` |
| Twilio Messaging | Outbound/inbound SMS | 🟡 REST adapter + signature validation verified against Twilio's documented example | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`; **A2P 10DLC brand + campaign registration per tenant** |
| ATTOM | Property details, assessment, ownership, AVM | 🟡 adapter (expandedprofile, attomavm) with defensive mapping; contract-verify fields with live responses | `ATTOM_API_KEY`; commercial license with display, cache, and LLM-processing rights |
| RentCast | Rent estimates, value AVM (listing-based comps) | 🟡 adapter | `RENTCAST_API_KEY` |
| BatchData | Secondary property data, liens, pre-foreclosure | ⬜ | Reseller addendum required for redistribution; 30-day cache refresh |
| National DNC Registry | Scrubbing (≤ 31 days) | ⬜ | Per-tenant SAN (registry accounts cannot be shared) |
| GoHighLevel | CRM write-back, marketplace app | ⬜ (first CRM) | OAuth app (Marketplace) |
| Podio | CRM write-back | ⬜ | OAuth |
| REsimpli / CarrotCRM / Left Main | CRM write-back | ⬜ | Partner APIs (availability to verify) |
| Google / Microsoft Calendar, Calendly | Appointment booking | ⬜ | OAuth |
| Stripe | Subscriptions + metered usage | ⬜ | `STRIPE_SECRET_KEY`, webhook secret |
| Supabase | Postgres + Auth | ⬜ (ADR-005 proposed) | Project URL, service credentials |
| Email (Postmark/SES) | Transactional email | ⬜ | API key, domain verification (SPF/DKIM/DMARC) |
| MLS (RESO Web API) | Comps via customer/broker credentials | ⬜ v3 | Per-MLS vendor agreements; IDX/VOW rules |

## Adapter standards
Injectable HTTP (testable), timeouts, error classification (429/5xx → retryable `PROVIDER_UNAVAILABLE`; 401/403 → non-retryable `PROVIDER_NOT_CONFIGURED`), no invented fields (absent stays absent), provenance on outputs, usage metering hook, fixture tests.
