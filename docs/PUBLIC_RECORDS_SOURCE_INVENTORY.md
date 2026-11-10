# Public Records Source Inventory (Northstar Discover, Phase 1)

**Status:** First pass · **Research date:** 2026-11-10 · **Scope:** Discover addendum §§2, 3, 10, 11 (Phase 1)
**Audience:** product, and the platform thread building `CountyConnector`, the county registry and the event model (`DISCOVER_ARCHITECTURE.md`).

> **Rules.** Each source below was checked on its official page on 2026-11-10. "Not verified" means we did not confirm it, not that it is absent. A source being public does **not** mean we may store, redistribute or display it commercially. Every source needs a permission review (column "Terms") before production ingestion. Nothing here claims coverage beyond the listed sources.

---

## 1. Recommendation

1. **Pilot county 1: Philadelphia County, PA.** Best official open data we found: nightly property/assessment file, recorded documents (deeds, mortgages, sheriff deeds, assignments, satisfactions) via API, daily code violations, unsafe and imminently dangerous building lists, and vacant property indicators. Pennsylvania also has a wholesaling disclosure law (Act 52 of 2024), so compliance workflows get exercised early.
2. **Pilot county 2: Cook County, IL.** Socrata portal with parcel sales (1999 to present), parcel universe, and annual tax sale data, all with dataset IDs.
3. **Candidate 3: Cuyahoga County, OH.** ArcGIS parcel service and an online sheriff sale list; Ohio's new wholesaler law (SB 155, effective 2026-03-02) makes it strategically useful. Needs terms review and a recorder/court source.
4. **Hold:** Wayne County/Detroit (good daily blight data but "No License Provided"), Harris County (bulk appraisal files, terms not stated), Maricopa County (recorder search only, 500-result cap, no API found).
5. **Final selection must also weigh customer demand.** Confirm with design partners which of these markets they buy in before building connector 2 or 3.

**Known gaps in every pilot county (next research round):** parcel-level tax delinquency, probate filings, and court foreclosure filings (lis pendens). These usually sit in court or treasurer systems without open APIs; licensed providers (ATTOM, BatchData, ICE) are the likely fallback (`DATA_PROVIDER_EVALUATION.md` §7).

---

## 2. County registry entries (draft, data-shaped for the registry)

Format follows the registry fields in addendum §3. `Access` uses the addendum's priority order: 1 official API, 2 open-data portal, 3 bulk download, 4 authorized feed, 5 licensed provider, 6 permitted extraction.

### 2.1 Philadelphia County, PA

| Record type | Source department | Dataset / endpoint | Access | Update frequency | Terms | Limitations |
|---|---|---|---|---|---|---|
| Property characteristics + assessment history | Office of Property Assessment (OPA) | OpenDataPhilly "Philadelphia Properties and Assessment History"; CSV, GDB, GeoJSON, API [P1] | 2 | Nightly | City of Philadelphia License: City retains rights; "as is"; user assumes responsibility [P1] | Field list not on landing page (see metadata); history CSV > 1.4M rows |
| Recorded documents: deeds, mortgages, sheriff deeds, mortgage assignments, satisfactions | Department of Records | OpenDataPhilly "Real Estate Transfers"; Carto SQL API table `RTT_SUMMARY` [P2][P3] | 2 | "Updated regularly" (no schedule) | City of Philadelphia License [P3] | From Dec 1999; ~3.7M transactions at 2018 release; document images not included [P2] |
| Document images and full index | Department of Records | PhilaDox (web UI) [P4] | 6 only if permitted | n/a | **Paid subscription** for full access; free limited search [P4] | No API; do not automate without written permission |
| Code violations | Licenses & Inspections (L&I) | OpenDataPhilly "L&I Code Violations"; CSV/SHP by year range, Carto SQL API [P5] | 2 | Daily | City of Philadelphia License [P5] | Very large; download by date range |
| Unsafe buildings; imminently dangerous buildings | L&I | Linked from the L&I violations dataset; CSV, SHP, GeoJSON, API [P5] | 2 | Not stated | City of Philadelphia License | |
| Vacant property indicators (buildings, land, points) | City of Philadelphia | Catalog "Vacant Property Indicators"; API per dataset [P6] | 2 | Not stated (metadata updated 2025-03-31) | City terms at metadata.phila.gov [P6] | Indicator definitions not on landing page; it is a **derived** signal, not an official registry |
| Tax delinquency | Department of Revenue | OpenDataPhilly "Real Estate Tax Balances"; ArcGIS REST, CSV [P7][P8] | 2 | "Routinely updated" | City of Philadelphia License | **Aggregated** by ZIP, council district, census tract only. Not parcel-level [P8] |
| Sheriff sales, probate, foreclosure filings | Sheriff; Register of Wills; Court of Common Pleas | Not verified | | | | Research next |

### 2.2 Cook County, IL

| Record type | Source department | Dataset / endpoint | Access | Update frequency | Terms | Limitations |
|---|---|---|---|---|---|---|
| Parcel sales | Cook County Assessor's Office | Socrata `wvhk-k5uv` on datacatalog.cookcountyil.gov (JSON/CSV/XML) [C1] | 1/2 | Semi-monthly; sales arrive months after recording | License not stated; access "public" [C1] | Excludes sales < $10k, quit claims, executor deeds, beneficial interests; may include non-arm's-length |
| Parcel universe (characteristics) | Assessor | Socrata "Assessor - Parcel Universe" [C2] | 1/2 | Not verified | Not verified | |
| Annual tax sale (delinquent prior-year taxes offered at sale) | Treasurer | Socrata `55ju-2fs9` [C3] | 1/2 | Last updated 2026-01-27 | License not stated | Not a live delinquency list; sale details at cookcountytreasurer.com [C3] |
| Recorder (deeds, mortgages, liens) | Cook County Clerk (Recordings) | Not verified | | | | Research next |
| Foreclosure / probate | Circuit Court of Cook County | Not verified | | | | Research next |
| Code violations | City of Chicago (municipal) | Not verified in this pass | | | | Chicago data portal likely; confirm |

### 2.3 Cuyahoga County, OH (candidate)

| Record type | Source department | Dataset / endpoint | Access | Update frequency | Terms | Limitations |
|---|---|---|---|---|---|---|
| Parcels with CAMA real property characteristics | Fiscal Officer / CuyahogaGIS | ArcGIS MapServer `gis.cuyahogacounty.gov/server/rest/services/Open_Data_Parcels/MapServer` [H1] | 2 | Not stated | Copyright "CuyahogaGIS, CCFO"; no use terms published [H1] | Field list not exposed on service page |
| Sheriff foreclosure sales | Sheriff | Online Sheriff Sale list (search by city, parcel, date) and results database; auctions via Real Auction [H2] | 6 only if permitted | Per sale | Real Auction terms apply to participation [H2] | No API or bulk download listed; statuses include withdrawn, bankruptcy, postponed, cancelled, unsold (useful for event status model) |
| Tax, transfers (1975+), foreclosure filings (2005+), sheriff sales (2000+) | Aggregated by NEO CANDO (Case Western Reserve University) from Fiscal Office and Clerk of Courts | NEO CANDO property data portal [H3] | 4/5 | Some sources weekly | **Not stated**; commercial use unknown [H3] | Third-party academic aggregator; needs written permission |

### 2.4 Held candidates

| County | What exists | Why held | Source |
|---|---|---|---|
| Wayne County / Detroit, MI | Blight violations (daily, ArcGIS + CSV); property sales 2018+ (ArcGIS, CSV) | Both list "No License Provided"; needs written permission | [W1][W2] |
| Harris County, TX | HCAD bulk ASCII tab-delimited property files and GIS shapefiles; values schedule Jan to Aug | Terms not stated; appraisal data only (no recorder/court) | [X1] |
| Maricopa County, AZ | Recorder web search: by recording number, doc code, names; max 500 results | No API found; automated extraction not permitted without approval | [M1] |

---

## 3. Event-model implications found in the sources

- **Status changes are real and frequent.** Cuyahoga sheriff listings carry withdrawn, bankruptcy, postponed, cancelled and unsold statuses [H2]. Model these as new events on the same sale, never as completed auctions.
- **Recording lag.** Cook County sales appear months after recording [C1]. Store `event_date`, `recorded_date` and `discovered_at` separately.
- **Aggregated vs parcel-level.** Philadelphia's tax delinquency open data is aggregated [P8]. Never attach an aggregate-area statistic to a parcel as if it were that parcel's record.
- **Derived vs official.** Philadelphia "vacant property indicators" are a city-derived signal, not a vacant registry [P6]. Label as `derived_signal` with source.
- **Exclusions.** Cook's sales file excludes quit claims and executor deeds [C1], which are exactly the estate-related transfers investors care about. Do not infer "no estate transfer" from absence.

---

## 4. HUD and PHA rent benchmarks (Section 8 strategy inputs)

| Source | What it gives | Access | Notes | Source |
|---|---|---|---|---|
| HUD Fair Market Rents (FMR) | 40th percentile gross rent by bedroom for metro/non-metro county; FY 2027 files published | HUD User API `https://www.huduser.gov/hudapi/public/fmr`: `listStates`, `listCounties/{state}`, `listMetroAreas`, `data/{entityid}`, `statedata/{state}`, optional `year`. Bearer token from a free HUD User account, registered per dataset. GET only, `Accept: application/json` | FMRs generally effective Oct 1; revisions occur (FY 2026 revised 2026-05-21). Rate limits not stated; API terms of service linked but not reviewed yet | [U1][U2] |
| HUD Small Area FMR (SAFMR) | ZIP-level FMRs | Same API: for SAFMR areas `data/{entityid}` returns ZIP-level rows in `basicdata` plus an MSA row (example `METRO47900M47900`) | Mandatory SAFMR area list not on page; check per metro | [U2] |
| PHA payment standards | Max subsidy per bedroom size set by each PHA | **PDF schedules per PHA**; no common API found. Example: Philadelphia Housing Authority SAFMR ZIP schedule (five tiers, Group 1 Basic to Group 5 High Opportunity), effective 2026-11-01; project-based uses City-Wide FMR, effective 2026-10-01 | Needs per-PHA curation with effective dates and manual review | [U3] |
| PHA utility allowances | Tenant utility allowance by unit type | PHA-published schedules (Philadelphia: Monthly Utility Allowance page) | Same curation approach | [U4] |

**Product rules (from addendum §7F):** show FMR/SAFMR and PHA payment standards as **benchmarks** with effective dates. Never present them as approved or guaranteed rent. Actual contract rent is set per unit after rent reasonableness and inspection.

---

## 5. Next research steps

1. Read each portal's full license text (City of Philadelphia License, Cook County terms, CuyahogaGIS) and record permission metadata: storage, redistribution, commercial display, attribution.
2. Find parcel-level sources for tax delinquency, probate, lis pendens and sheriff sales in Philadelphia and Cook.
3. Pull schemas (`columns.json`, Carto table schema, ArcGIS layer fields) so connector configs can be written as data.
4. Confirm design-partner markets before committing to county 3.
5. Review HUD User API terms of service.

---

## Sources (all retrieved 2026-11-10)

- [P1] OpenDataPhilly, Philadelphia Properties and Assessment History. https://opendataphilly.org/datasets/philadelphia-properties-and-assessment-history
- [P2] City of Philadelphia, "City releases open data set of millions of property records," 2018-10-26. https://www.phila.gov/2018-10-26-city-releases-open-data-set-of-millions-of-property-records/
- [P3] OpenDataPhilly, Real Estate Transfers. https://opendataphilly.org/datasets/real-estate-transfers/
- [P4] OpenDataPhilly, PhilaDox Property Documents. https://opendataphilly.org/datasets/philadox-property-documents/
- [P5] OpenDataPhilly, Licenses and Inspections Code Violations. https://opendataphilly.org/datasets/licenses-and-inspections-code-violations/
- [P6] Data.gov, Vacant Property Indicators (City of Philadelphia). https://catalog.data.gov/dataset/vacant-property-indicators
- [P7] City of Philadelphia, "Philly releases open data on property tax delinquencies," 2024-09-23. https://www.phila.gov/2024-09-23-philly-releases-open-data-on-property-tax-delinquencies/
- [P8] OpenDataPhilly, Real Estate Tax Balances. https://opendataphilly.org/datasets/real-estate-tax-balances/
- [C1] Data.gov, Cook County Assessor - Parcel Sales (`wvhk-k5uv`). https://catalog.data.gov/dataset/assessor-parcel-sales
- [C2] Data.gov, Cook County Assessor - Parcel Universe. https://catalog.data.gov/dataset/assessor-parcel-universe
- [C3] Data.gov, Cook County Treasurer - Annual Tax Sale (`55ju-2fs9`). https://catalog.data.gov/dataset/treasurer-annual-tax-sale
- [H1] CuyahogaGIS, Open_Data_Parcels MapServer. https://gis.cuyahogacounty.gov/server/rest/services/Open_Data_Parcels/MapServer
- [H2] Cuyahoga County, Foreclosure Sales. https://www.cuyahogacounty.gov/how-do-i/view/foreclosure-sales
- [H3] NEO CANDO, Property Data Portal. https://neocando.case.edu/property-data.html
- [W1] Detroit Open Data, Blight Violations. https://detroitdata.org/dataset/blight-violations
- [W2] Detroit Open Data, Property Sales. https://detroitdata.org/dataset/property-sales1
- [X1] Harris Central Appraisal District, Public Data. https://hcad.org/hcad-online-services/pdata/
- [M1] Maricopa County Recorder, document data search. https://legacy.recorder.maricopa.gov/recdocdata
- [U1] HUD User, Fair Market Rents datasets. https://www.huduser.gov/portal/datasets/fmr.html
- [U2] HUD User, FMR and Income Limits API. https://www.huduser.gov/portal/dataset/fmr-api.html
- [U3] Philadelphia Housing Authority, Payment Standards. https://www.pha.phila.gov/housing/housing-choice-voucher/payment-standards/
- [U4] Philadelphia Housing Authority, Monthly Utility Allowance and Payments. https://www.pha.phila.gov/housing/housing-choice-voucher/monthly-utility-allowance-and-payments/
