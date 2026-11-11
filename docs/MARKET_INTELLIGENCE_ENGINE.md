# Market Intelligence Engine

**Status:** v0.1 (methodology `market-score/0.1.0`) · **Owner:** engineering · **Inputs:** `docs/MARKET_INTELLIGENCE_DATA_SOURCES.md` and `docs/LANDLORD_REGULATORY_INDEX.md` (research)

This document describes how Northstar Market Intelligence is implemented: the geographic data model, the Market Score, the Landlord Regulatory Index (LRI), undervaluation evidence, monitoring, and the guardrails that keep scoring transparent and fair. Weights and thresholds are starting hypotheses and are versioned with the methodology so every score is reproducible.

## 1. Code map

| Piece | Location |
|---|---|
| Pure engine (no I/O, no clock) | `packages/market/src` |
| Metric allow-list | `metrics.ts` |
| Source catalog | `sources.ts` |
| LRI factors and scoring rules | `regulatory.ts`; cited pilot rows in `regulatory-seed.ts` |
| Strategy profiles | `strategies.ts` |
| Market Score | `score.ts`; risk flags in `risks.ts` |
| Ranking, percentiles, trends | `compare.ts` |
| Property-level undervaluation | `undervaluation.ts` (reuses `calculateArv` from the underwriting engine) |
| Monitoring rules | `alerts.ts` |
| Demo dataset and data source interface | `demo.ts`, `source.ts` |
| Schema | `packages/db/migrations/0005_market_intelligence.sql`, repository `packages/db/src/market.ts` |
| Seed / ingest entry point | `pnpm --filter @northstar/db seed:market [--demo]` |
| Workspace UI | `apps/web/app/app/market/*`, server glue `apps/web/lib/server/market.ts`, `monitoring.ts`, actions `lib/actions/market.ts` |

## 2. Geographic model

Levels: `state → metro → city → zip → neighborhood` (property-level analysis lives in the undervaluation module). Each area has a stable key (`state:42`, `metro:37980`, `city:4260000`, `zip:19134`) plus `state_code`, `county_fips` and `zcta`, which is how Discover parcels (state, county_fips, postal_code) join without either side altering the other's tables.

Every observation stores metric, value, period label, period end, the level it was **measured at**, source id and class, dataset, retrieval time, `is_projection`, `is_developmental` and public-safety `reporting_coverage`. When a ZIP has no ZIP-level value, a metro value may be stored for it with `measured_at = metro`; the engine marks it inherited and lowers confidence.

Reference tables are global: any signed-in member can read them; only `northstar_ingest` can write. `regulatory_factors` is append-only (a change is a new row with a new effective date).

## 3. Market Score

1. **Variable score:** value mapped to 0–100 over the metric's published `[worst, best]` reference range (direction-aware, clamped). Relative mode uses direction-aware percentiles within the comparison set (fewer than 3 areas falls back to absolute). Raw values are always shown.
2. **Category score:** weighted mean of variables, weight = catalog weight × strategy emphasis (0 removes a variable).
3. **Market Score:** weighted mean of six categories using the profile's category weights. Balanced = owner baseline 25/20/20/15/10/10.

**Missing data** never raises a score: a missing variable is imputed at `min(50, observed category mean)`. A category below 60% weight coverage shows "insufficient data" and contributes at `min(50, provisional)`. Below 60% overall coverage the Market Score is withheld (null). *Deviation from the research draft:* the draft excluded missing variables, which can lift a score when the missing variable is weak; conservative imputation cannot.

**Confidence** per variable = source quality (official 1.0, licensed 0.9, third-party 0.75, user 0.6, demo 0.8) × freshness (1 inside the metric's window, linear decline to 0.4) × resolution (0.85 per level coarser than the area) × reporting coverage (for crime data below 90%). Confidence is reported, never used to inflate a score.

**Projections** are excluded from scoring and returned separately. Observations whose period ends after the valuation date are ignored.

## 4. Risk flags

Flags are computed from raw values and returned beside the score, sorted critical → caution → info. Thresholds live in `RISK_THRESHOLDS` (NRI, flood share, wildfire, insurance availability, heat, tax burden, vacancy, population decline, unemployment, rising violent crime), plus "inexpensive but exposed" (affordability ≥ 65 and environmental ≤ 40), missing or low-coverage safety data, insufficient categories, stale and inherited data, and every LRI flag (rent control, caps, just cause, long eviction timelines, pending changes, unverified factors).

## 5. Landlord Regulatory Index

14 factors (eviction, rent regulation, deposits, notice and entry, licensing and compliance), each with a published scoring rule shown in the UI. Rows carry citation, effective date, retrieval time and verification (`official`, `secondary`, `unverified`, `demo`). For a jurisdiction stack (state, then metro/city) the row in force on the valuation date is used; local rows override state rows, except a state preemption of rent regulation always wins. Future rows within 365 days are pending changes. Users set factor weights (0 ignores a factor). Missing factors are imputed conservatively; below 60% coverage the index is withheld. Pilot rows (PA, IL, OH, Philadelphia, Chicago, Cleveland) come from the research doc; court timelines and several state factors are not yet sourced, so most pilots report reduced coverage. Not legal advice.

## 6. Undervaluation evidence

Five separate signals: below adjusted comps, below each AVM, below neighborhood $/sq ft, active distress events, seller-stated price. "Potentially below market" requires ≥ 3 eligible comps (≤ 1 mi, ≤ 180 days, arm's-length), a discount ≥ 10%, price below the low end of the comp range, and comp dispersion ≤ 15%. `minComps` cannot be set below 3. AVMs and area data alone yield "indicators only". Assessed value is reported as a tax measure and never used (a test asserts the result is identical with and without it).

## 7. Monitoring

Rules: score change, category change, new risk flag, metric threshold crossing, regulatory change or newly scheduled change, confidence drop. Each alert has a stable dedupe key and evidence (variable, old and new value, source, dates); `market_alerts` is unique per (org, dedupe_key), so re-running never duplicates. On first check an area is compared with itself one year earlier (prior vintage). Today monitoring runs on demand from the workspace; the scheduled version is an Inngest function per organization calling `runMonitoring` inside `withTenant` with a system actor.

## 8. Guardrails

- Only catalog metrics can be scored; unknown metrics throw. Protected characteristics and proxies (race, ethnicity, national origin, religion, sex, familial status, disability, age, school demographics, voucher holders, etc.) are rejected by `PROHIBITED_METRIC_PATTERNS` in code **and** by a check constraint on `geo_metric_observations.metric`. Counsel should review the allow-list before launch, and a disparate-impact review of default scores across pilot geographies should be run once real data is loaded.
- Public safety is aggregate only; never shown on a property, never for tenant screening; missing data is flagged and never read as safe.
- Hazard indicators are not insurance quotes; assessed value is not market value; population growth is an input, not a proxy for appreciation.

## 9. Data sources and demo data

`MARKET_DATA_SOURCE=demo` (default) uses fictional geographies (states Avalon, Brightwater, Cedar Plains, Dunmore; 8 metros; 32 ZIPs) with two vintages and deliberate edge cases, labeled everywhere, plus the real cited pilot law. `MARKET_DATA_SOURCE=db` reads the 0005 tables. Official connectors (Census ACS/PEP/BPS, BLS LAUS/CES/QCEW, FHFA HPI, HUD FMR, FBI CDE, FEMA NRI/NFHL) are catalogued with access requirements and are the next build step; Census and HUD need API keys.
