# Northstar Discover: Architecture

Status: engineering foundation built and tested against stubbed sources. **No county source has been verified against live data yet.** The build environment's network policy blocks the county portals, so every mapping is marked `mappingVerified: false` until a person checks it against a live sample.

Scope: the public-records discovery engine and the multi-strategy scoring described in the owner's Discover addendum. Source inventory, pilot county choice, provider evaluation, and HUD data research are in docs/PUBLIC_RECORDS_SOURCE_INVENTORY.md and docs/DATA_PROVIDER_EVALUATION.md (research thread). Data model decisions: ADR-015.

## Pipeline

```
County portal (Socrata / ArcGIS / Carto / bulk / licensed feed)
   │  CountyConnector.fetchPage(cursor, since)          packages/discover/src/connectors
   ▼
SourceRecord (generic instrument + optional event, license tag, retrieved at)
   │  contentHash (FNV-1a over key-sorted JSON, retrieval time excluded)
   ▼
discover.source_records          append-only; identical content is skipped (idempotent re-runs)
   │  resolveRecord (APN, address, owner name → confidence)
   ├─ ≥ 0.85 and no near-tie → discover.record_links (method auto)
   ├─ 0.60–0.85 or near-tie  → discover.match_reviews (a person decides)
   └─ < 0.60                 → unlinked
   │  applyObservation (event lifecycle)
   ▼
discover.property_events         append-only versions; anomalies flagged, never rejected
   │  expireIfStale (deterministic expiry policy)
   ▼
Scores (computed on read, never stored as one number)
   ├─ scorePropertySignals   → property signal score + factors
   ├─ scoreDataConfidence    → data confidence score + factors
   └─ scoreStrategyFit       → per strategy, per buy box: fit / partial / not_a_fit / insufficient_data
```

## CountyConnector

`CountyConnector { sourceKey, county {state, countyFips, name}, category, license, demo, fetchPage(req) }`.

- Generic implementations: `SocrataConnector` (SoQL `$limit/$offset/$order/$where`, app token sent as `X-App-Token` header, never in the URL), `ArcGisConnector` (layer `/query`, no geometry, follows `exceededTransferLimit`), `CartoConnector` (SQL API, stable `ORDER BY <col>, cartodb_id`). County specifics live in row mappers.
- Every interpolated value is validated: identifiers by regex, dates as `YYYY-MM-DD`, cursors as non-negative integers.
- Typed `SourceError` kinds (`unauthorized`, `rate_limited`, `not_found`, `upstream`, `invalid_response`, `network`, `timeout`) with a `retryable` flag.
- `assertAccessPermitted` refuses to build a connector when the source's terms prohibit automated access. No connector bypasses authentication, CAPTCHAs, rate limits, or published restrictions.
- `DemoCountyConnector` emits deterministic synthetic records for a fictional county (FIPS 00000), all flagged `demo: true`. The pipeline fails a run that mixes demo and live records.

## Pilot county registry (`connectors/registry.ts`, mirrored by `discover.county_sources`)

| Source key | County | Category | Platform | Status | License |
|---|---|---|---|---|---|
| `phl.rtt_summary` | Philadelphia (42101) | recorder: deeds, mortgages, sheriff deeds, assignments, satisfactions | Carto | Built, mapping unverified | City of Philadelphia License (display permitted, attribution) |
| `phl.li_violations` | Philadelphia | code enforcement | Carto | Built, mapping unverified | same |
| `phl.opa_properties` | Philadelphia | assessor (parcel spine) | Carto | Planned | same |
| `cook.parcel_sales` | Cook (17031) | recorder (sales; excludes quit-claim/executor deeds) | Socrata `wvhk-k5uv` | Built, mapping unverified | No license stated: evaluation only, not displayable |
| `cook.tax_sale` | Cook | tax | Socrata `55ju-2fs9` | Planned | same |
| `cuyahoga.parcels` | Cuyahoga (39035) | assessor | ArcGIS | Planned | Terms not reviewed |

Known gaps (from research): no pilot county has parcel-level tax delinquency, probate, or lis pendens. The fallback is a licensed provider (ICE or ATTOM premium), added as a `licensed` platform source with its own license tag.

## Generic record model

- **Instrument**: `instrumentType`, `instrumentNumber` or `book`/`page`, `recordedDate`, `instrumentDate`, `parties[]` with roles (grantor, grantee, mortgagor, mortgagee, assignor, assignee, plaintiff, defendant, owner), `consideration`, `apn`. A mortgage's consideration is its original recorded amount and is never treated as a current balance, payment, rate, arrears status, or contractual restriction.
- **Event**: `eventType` (signal type), `status`, `eventDate`, `filedDate`, `scheduledDate`, `amount`; stored with `discoveredAt` (when Northstar first saw it) separate from the event date.

## Event lifecycle

Statuses: `active`, `scheduled`, `postponed`, `resolved`, `dismissed`, `withdrawn`, `cancelled`, `expired`, `completed`. Terminal: resolved, dismissed, withdrawn, cancelled, expired, completed.

- A changed observation appends version n+1 with `supersedes_version = n`; history is never edited.
- Unexpected transitions (for example withdrawn → scheduled) are accepted and flagged as anomalies for review, because the source is the record of truth.
- Expiry policy: a scheduled or postponed event whose date passed more than 30 days ago with no outcome expires; active events expire only for types given a maximum age. Expiry appends a version with `origin = 'expiry_rule'`.
- Cuyahoga sheriff sale statuses map as: withdrawn → withdrawn, bankruptcy/postponed → postponed, cancelled → cancelled, unsold → expired, sold → completed.

## Entity resolution

Within one county only. Exact normalized APN: 0.99. Exact normalized address with ZIP: 0.90. Exact street with matching city and no ZIP: 0.75. Similar street name (Jaro-Winkler ≥ 0.92) with identical house number, ZIP, and unit: 0.70. An agreeing owner name adds 0.05 (capped at 0.95). A conflicting APN caps address-based confidence at 0.65. House numbers are never fuzzy-matched. Near-ties within 0.05 always go to review.

Normalization: USPS street suffixes (last token only), directionals, unit designators, ZIP+4 → ZIP5, two-letter states; APNs lose separators but keep leading zeros; party names drop punctuation and entity suffixes.

## Scores (kept separate by design)

| Score | Question it answers | Inputs | Output |
|---|---|---|---|
| Property signal | How much public-record activity is attached to this property? | current event versions | 0–100, band, factor per event |
| Data confidence | How far can we trust this record? | field provenance, freshness, completeness, match confidence, conflicts | 0–100, band, factors, missing fields |
| Strategy fit | Does it match this investor's buy box for this strategy? | buy box, property facts, underwriting metrics, investor profile | fit / partial / not_a_fit / insufficient_data, 0–100 or null, criteria |

- Signal weights, status multipliers, a 365-day half-life, diminishing returns for repeated events, and saturation (`100 × (1 − e^(−points/60))`) are exported constants, and every contribution is listed as a factor.
- Signal types describe a property and its records only (tax delinquency, tax sale, lis pendens, foreclosure filing, sheriff sale, code violation, unsafe building, vacancy indicator, probate filing, absentee owner, long ownership, recent sale, permit activity). There are no personal vulnerability, desperation, or protected-characteristic signals, and a test guards the list.
- Demo data forces data confidence to 0.
- Strategy fit never guesses: a missing hard criterion, or more than half the soft criteria missing, yields `insufficient_data`. Any hard failure (geography, type, price, capital) yields `not_a_fit`, whatever the returns.
- There is no combined "opportunity score" function, column, or API; a test asserts none is exported.

## Strategy engines (`@northstar/underwriting` 1.1.0)

Wholesale and flip (existing), buy-and-hold (`analyzeRental`), BRRRR, creative finance (seller financing, subject-to, wrap, lease option), Section 8, and small multifamily rent roll. See UNDERWRITING_METHODOLOGY.md sections 2.13–2.16. Shared strategy names: `INVESTMENT_STRATEGIES` in `@northstar/core` = `app.investment_strategy`.

## Compliance guardrails in code

- Prohibited sources can't be enabled (DB check) or built (connector guard).
- Non-displayable sources are hidden from customers by RLS.
- Every record carries `license_tag`, `source_key`, `source_record_id`, and `retrieved_at`.
- Signal types are property-only. Section 8 output says it must not be used for tenant screening. Creative-finance output flags due-on-sale and lending-compliance risk and requires attorney review.

## Next steps

1. Verify each built mapping against a live sample from a network-permitted environment; record `verified_on` and flip `mapping_verified`.
2. Postgres `DiscoverStore` implementation in `@northstar/db` (ingest role connection) and a scheduled runner (Inngest, ADR proposed).
3. Philadelphia OPA parcel spine mapper; Cook tax sale mapper.
4. Staff review UI for `match_reviews`.
5. Discovery UI: search, filters, map, saved searches, watchlists, alerts.
6. HUD FMR/SAFMR client (huduser.gov `fmr` API, bearer token) and curated PHA payment standards with effective dates.
