# Integration Catalog

Every external dependency sits behind an adapter with a safe mock. Status: **Live** (verified against the real service), **Built** (implemented and tested against stubs, awaiting credentials), **Mock** (contract + mock only), **Planned**.

No integration in this repository has been verified against a live service yet.

## Property data (`@northstar/integrations/property`)

Contract: `PropertyDataProvider` (getProperty, getOwner, getSalesHistory, getComps, getValueEstimate, getRentEstimate). Per-field provenance; null-with-reason for missing data; no silent fallback to demo data; per-tenant metering hook. Provider shortlist and evaluation: docs/DATA_PROVIDER_EVALUATION.md.

| Provider | Status | Credential | Notes |
|---|---|---|---|
| Mock (demo data) | Built | none | Deterministic, every record flagged `demo: true` and labelled DEMO |
| RentCast | Built | `RENTCAST_API_KEY` | Property records, owner, history, AVM value and rent, comparables. Field mapping follows public docs; **re-verify against live responses** before production. AVM comparables include listings; confidence capped at 0.6 and must be reviewed before use in ARV |
| Realie | Planned (primary launch provider) | `REALIE_API_KEY` | Selecting it throws `not_configured` until the adapter is built against live schema |
| ATTOM | Planned | — | Later: premium AVM/comps, pre-foreclosure |
| BatchData | Planned | — | Later: liens, skip trace |
| MLS (RESO Web API via licensed partner) | Planned | — | Not v1; requires broker/MLS licensing |

## Messaging (`@northstar/integrations/messaging`)

| Provider | Status | Credential | Notes |
|---|---|---|---|
| Compliance gate | Built | — | Suppression, consent evidence, quiet hours, address validation, idempotency |
| Mock | Built | — | Records messages in memory; never contacts anyone |
| Twilio (SMS/voice) | Planned | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, messaging service SID | A2P 10DLC brand/campaign registration required; inbound webhooks need Twilio signature validation adapter |
| Email (Postmark/Resend/SES) | Planned | provider API key | Needed for verification, password reset, invitations |

## Platform

| Integration | Status | Credential |
|---|---|---|
| PostgreSQL | Live (local/CI) | `DATABASE_URL`, `DATABASE_OWNER_URL` |
| Workflow engine (Inngest) | Planned | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` |
| Billing (Stripe) | Planned | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| AI (Anthropic Claude API) | Planned | `ANTHROPIC_API_KEY` |
| Error tracking | Planned | DSN |
| Shared rate limit store | Planned | Redis URL |

## CRM, calendar, documents

| Integration | Status | Notes |
|---|---|---|
| GoHighLevel, Podio, REsimpli, HubSpot, Salesforce | Planned | CRM adapter contract to be defined with the Acquire division: upsert contact/lead, sync status, push notes, webhook ingest |
| Google Calendar, Microsoft 365, Calendly | Planned | Appointment booking |
| Google Drive, Dropbox, Supabase Storage/S3 | Planned | Document ingestion for Due Diligence |

## Adding an integration

1. Define or extend the contract in `packages/integrations`.
2. Build the mock first; label any synthetic data.
3. Implement the adapter with injectable `fetch`, timeouts, typed `ProviderError` kinds (`unauthorized`, `rate_limited`, `not_found`, `upstream`, `invalid_response`) and a retryable flag.
4. Test against stubbed responses for success, missing fields, malformed bodies, and each error class.
5. Document credentials here and in `.env.example`; never commit secrets.
6. Mark Live only after verifying against the real service, with the date.
