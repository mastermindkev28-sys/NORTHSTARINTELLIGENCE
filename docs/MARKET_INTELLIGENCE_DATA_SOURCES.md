# Market Intelligence: Data Sources and Scoring Methodology

**Status:** First pass · **Research date:** 2026-11-10 · **Scope:** Market Intelligence addendum §§1, 3 to 8, 10
**Audience:** product, and the "Build Market Intelligence workspace" thread (engineering). Landlord law is in `LANDLORD_REGULATORY_INDEX.md`.

> All facts below come from official agency pages retrieved 2026-11-10. Anything not confirmed is marked "not verified". These are research inputs. None of the scores below have been computed yet.

---

## 1. Official data source catalog

| Domain | Source | Geography | Frequency / latest | Access | Key caveats | Ref |
|---|---|---|---|---|---|---|
| **Population, households, income, housing stock, rents (survey)** | Census ACS 5-year | Down to tract / block group | Annual releases (2009 to 2024 vintages listed) | Census Data API; **API key required for all queries** | Survey estimates with margins of error; 5-year periods, not point-in-time | [G1][G2] |
| **Population change, migration components** | Census Population Estimates Program (PEP) | US, state, county, city/town | Annual vintages (API page lists through Vintage 2023) | Census Data API, key required | Newer vintages may sit on other pages; components-of-change dataset to confirm | [G2] |
| **Employment, unemployment, wages** | BLS API v2 (LAUS, QCEW, CES series) | State, metro, county (by series) | Monthly (LAUS/CES), quarterly (QCEW) | Free registered key; 500 queries/day, 50 series/query, 20 years/query, 50 requests per 10 s; renew key yearly | Series IDs per program; revisions | [G3] |
| **House prices** | FHFA House Price Index | Quarterly: US, division, state, 100 largest MSAs, ZIP3 (developmental). **Annual (developmental): county, ZIP5, tract** | Monthly (national/division), quarterly, annual | CSV/XLS downloads | Repeat-sales on conforming loans; ZIP5/tract/county are developmental and annual only | [G4] |
| **New supply** | Census Building Permits Survey | National, state, CBSA, county, place | Monthly (revised ~17th workday), annual (2025 final released 2026-05-14) | Excel and ASCII downloads | Permits, not completions; covers permit-issuing places | [G5] |
| **Rent benchmarks** | HUD FMR / SAFMR | Metro/county; ZIP for SAFMR | Annual (FY 2027 published) | HUD User API (token) | Benchmarks, not market rent (`PUBLIC_RECORDS_SOURCE_INVENTORY.md` §4) | [G6] |
| **Crime** | FBI Crime Data Explorer (NIBRS + SRS) | Agency, state, national | Annual | CDE web and API (API details not verified) | 2024: 16,675 agencies submitted, covering 95.6% of population served by eligible agencies; NIBRS-only agencies cover 87.2% of enrolled population; SRS accepted 2022 to 2024 to fill gaps; NIBRS counts more offenses (no Hierarchy Rule), so raw counts are not comparable to SRS | [G7] |
| **Natural hazard risk** | FEMA National Risk Index | County and census tract | Versioned (current version not stated on data page) | Geodatabase, shapefile, CSV; ArcGIS Online services | Shapefile uses -9999 for nulls; generalized hazard score, not an insurance quote | [G8] |
| **Local crime, permits, code** | City open-data portals (e.g., Philadelphia, Chicago, Detroit) | Address / point | Often daily | Socrata, ArcGIS, Carto | Per-city license review | `PUBLIC_RECORDS_SOURCE_INVENTORY.md` |
| **Listings: list price, DOM, price cuts** | Licensed providers (RentCast listings, BatchData listing add-on, MLS via partners) | Property | Daily | API | No free official source; license terms required | `DATA_PROVIDER_EVALUATION.md` |
| **Insurance availability, property tax burden** | Not yet sourced | | | | Research next: state insurance department filings; ACS tax-paid fields | |

**Engineering notes:** store `source`, `dataset`, `vintage`/`period`, `geography_level`, `geo_id`, `retrieved_at`, `is_projection` and `is_developmental` on every observation (addendum §4: keep source dates and geographic resolution, and separate history from projections).

---

## 2. Scoring methodology (draft)

### 2.1 Structure

Score at each geographic level separately (state, metro/city, ZIP/neighborhood). A property never inherits a neighborhood score as if it were its own.

| Category | Baseline weight (owner hypothesis) | Example variables | Primary sources |
|---|---|---|---|
| Growth fundamentals | 25% | Population change, net migration, household growth, employment growth, wage growth, permits per 1,000 households | PEP, ACS, BLS, BPS |
| Affordability and undervaluation | 20% | Median price vs. median income, price per sq ft vs. metro, share of sales below comp-supported value (property-level evidence, see §3) | ACS, FHFA, licensed sales/listings |
| Landlord regulatory climate | 20% | Individual factors from `LANDLORD_REGULATORY_INDEX.md`, each user-weighted | Statutes, ordinances |
| Rental economics | 15% | Gross rent-to-price, FMR/SAFMR vs. price (Section 8 profiles), rent trend | ACS, HUD, RentCast |
| Public safety | 10% | Violent and property crime rates per 1,000 residents, 3 to 5 year trend, **with coverage flag** | Local open data, FBI CDE |
| Property and environmental risk | 10% | NRI risk and expected annual loss, flood/wildfire/heat flags, tax burden | FEMA NRI |

### 2.2 Rules (from the addendum, made testable)

1. **Normalize within the comparison set** (for example, percentile among metros the user is comparing), and show raw values next to every percentile.
2. **Missing data lowers confidence and never raises the score.** A missing variable is excluded from the category score, and category confidence = available weight ÷ total weight. Below a threshold (proposed 60%), show the category as "insufficient data" instead of a score.
3. **Material risk flags are never averaged away.** Examples: tract NRI rating in the top tier, crime data coverage below threshold, pending rent-control or good-cause changes, very high tax burden. Flags show at the top of every profile regardless of the overall score.
4. **Weights are per strategy profile** (addendum §8). Proposed defaults: Flip raises affordability/undervaluation and liquidity; Buy-and-hold raises rental economics and regulatory; Section 8 replaces generic rent with PHA payment standards. The owner's baseline stays as the "Balanced" profile.
5. **History and projection never share a variable.** Projections, if used, are a separate labeled variable.
6. **Population growth is an input, not a proxy for appreciation** (addendum §4).

### 2.3 Fair housing and responsible-use guardrails

- **Excluded inputs:** race, ethnicity, national origin, religion, sex, familial status, disability, and fields that closely track them (for example, ACS demographic shares, school demographic composition). The variable allow-list should be reviewed by counsel before launch.
- **Public safety is aggregate only:** shown at city, ZIP or tract level with reporting coverage and data year; never attached to a property; never labeled "safe" when data is missing; not available to tenant screening or housing-access workflows.
- **Disparate-impact review:** before launch, test whether default scores correlate strongly with protected-class composition across the pilot geographies, and document the results. This is a recommendation, not a legal conclusion; counsel should review.
- **Every alert carries its evidence** (variable, old value, new value, source, date).

---

## 3. Undervaluation evidence model (addendum §3)

Keep five separate signals; never merge them into one "undervalued" label.

| Signal | Definition | Minimum evidence before showing |
|---|---|---|
| Below comparable market value | Asking/offer price below an adjusted-comps value | ≥ 3 comps within distance/time limits, adjustments shown, confidence band |
| Below third-party estimate | Below one or more AVMs | Show each AVM separately with source; never sufficient alone |
| Below recent neighborhood transactions | Below median $/sq ft of recent arm's-length sales in the area | Sample size and date window shown |
| Distressed-sale indicator | Public-record event (tax sale, lis pendens, sheriff sale) | Event from `PUBLIC_RECORDS_SOURCE_INVENTORY.md` with source |
| Seller-requested below-market price | Seller's stated asking price from a conversation | Recorded as seller statement, not a valuation |

Assessed value is shown only as a tax measure, never as market value.

---

## 4. Next research steps

1. Confirm FBI CDE API access and terms; collect pilot-city local crime datasets and their coverage.
2. Identify current NRI version and change log.
3. Source insurance availability (state insurance department data) and property tax burden.
4. Build the variable allow-list with counsel.

---

## Sources (all retrieved 2026-11-10)

- [G1] Census Bureau, ACS 5-Year Data API. https://www.census.gov/data/developers/data-sets/acs-5year.html
- [G2] Census Bureau, Population Estimates APIs. https://cdn.www.census.gov/data/developers/data-sets/popest-popproj/popest.html
- [G3] BLS, API FAQs. https://www.bls.gov/developers/api_faqs.htm
- [G4] FHFA, HPI Datasets. https://www.fhfa.gov/data/hpi/datasets
- [G5] Census Bureau, Building Permits Survey. https://www.census.gov/construction/bps/index.html
- [G6] HUD User, FMR datasets and API. https://www.huduser.gov/portal/datasets/fmr.html ; https://www.huduser.gov/portal/dataset/fmr-api.html
- [G7] FBI CDE, "Reported Crimes in the Nation 2024 FAQs." https://cde.ucr.cjis.gov/LATEST/resources/reports/Reported%20Crimes%20in%20the%20Nation%202024%20FAQs.pdf
- [G8] FEMA, National Risk Index Data Resources. https://hazards.fema.gov/nri/data-resources
