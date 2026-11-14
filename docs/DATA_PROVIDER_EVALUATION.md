# Property Data Provider Evaluation

**Owner:** Data Partnerships & Compliance Research
**Prepared for:** Northstar Intelligence (Northstar Acquisitions LLC)
**Research date:** 2026-11-14 (all web sources retrieved 2026-11 unless stated otherwise)
**Status:** Research draft for internal decision-making. **Not legal advice.** Every licensing conclusion below must be confirmed against the executed contract with each provider and reviewed by counsel before Northstar displays, caches, or redistributes any third-party data to tenants.

---

## 0. How to read this document

| Label | Meaning |
|---|---|
| **Fact** | Stated by a cited source (preferably the provider's own page, terms, or a primary legal source). URL and retrieval month are given inline. |
| **Analysis** | Northstar's interpretation, scoring, or recommendation. Reasonable people (and counsel) may disagree. |
| **Unverified** | Reported by a secondary source only, or we could not open the primary page. Do not rely on it for budgeting or contracting. |
| **Not public** | The provider does not publish this (typically pricing or license terms); it must be obtained in a sales process. |

Prices change frequently. Every price below carries its source URL and the month we retrieved it (2026-11). Treat all of them as indicative until quoted in writing.

---

## 1. Executive summary

**Analysis — recommendation at a glance**

| Role | Recommendation | Why | Key condition |
|---|---|---|---|
| **Primary property provider (MVP)** | **ATTOM** (Property Data API, Premium tier) | Broadest single-vendor national coverage (Fact: "160+ million U.S. properties", "99% of the U.S. population"), ownership + mortgage + foreclosure + AVM + rental AVM + comps + boundaries from one REST/JSON API; 30-day free trial; established vendor. | ATTOM's API license text is **not public**. We must negotiate an explicit **multi-tenant SaaS display + caching** grant before go-live. |
| **Secondary / fallback** | **BatchData** (Property Data API via its "Power Your Platform" program) | Wholesaler-native fields (open liens, pre-foreclosure, quick lists), published pricing, bulk + API, and in-house skip trace. Gives a second source for cross-validation and failover. | BatchData's standard ToS is **internal-use only**; display to tenants **requires a signed Reseller Addendum**. Local caches must be refreshed at least every 30 days. |
| **Rentals source** | **RentCast** | Rent AVM + rental comps + rental listings; published self-serve pricing; API terms expressly grant the right to "sublicense, disclose, display, resell and distribute" API data and state no attribution is required. | Confirm the API terms version at signing; respect the required property-report disclaimer. |
| **Parcels source** | **Regrid** (enterprise license, not self-serve terms) — defer until map/parcel features are needed; use ATTOM boundary data in MVP if licensed | 160M+ parcels, standardized schema, tiles + REST. | Regrid's standard API terms restrict disclosure, derivative use of geometries, and **inputting data into AI models**; an enterprise agreement must expressly permit tenant display and LLM inference use. |
| **Skip trace** | **Do not embed skip-traced numbers into automated outreach.** Offer skip trace as an optional, tenant-initiated, separately licensed module (BatchData Skip Tracing under the same Reseller Addendum, or bring-your-own-provider). | Skip-traced numbers carry **no TCPA consent** (BatchData ToS §6.12 and §6.26(a) say so explicitly). GLBA/DPPA-regulated sources (IDI, LexisNexis) require permissible purposes that do not fit marketing. | Skip-traced numbers may only be used for human, manually dialed calls after DNC/state-law scrubbing; never for AI voice, prerecorded, or automated SMS. See the messaging compliance research. |
| **MLS data / comps** | **No direct MLS feed in MVP.** Comps from licensed public-record sales (ATTOM/BatchData). Phase 2: tenant-authorized MLS access through the tenant's own broker participant (MLS Grid / Trestle / Bridge / Spark per MLS). | RESO standardizes the format, not the right to use the data. Access is granted per MLS, per license type (IDX/VOW/BBO), usually only to participants/subscribers and their vendors. | Northstar must never pool one tenant's MLS-licensed data into another tenant's comps or into a shared model. |

**Key licensing risk (Analysis):** Nearly every provider's *default* terms are written for internal use by the licensee. Showing provider data inside a multi-tenant SaaS to Northstar's customers is **redistribution** and needs an explicit written grant (reseller/platform/OEM addendum) that also covers (a) caching duration and refresh duration, (b) deletion obligations on termination, (c) derivative works (our ARV/MAO calculations stored per deal), and (d) whether the data may be sent to an LLM for inference. Until those grants are signed, Northstar should treat provider data as **non-displayable** in production.

---

## 2. Evaluation criteria and Northstar requirements

**Analysis.** Northstar's product (lead intake, AI seller qualification, comps, deterministic ARV/MAO/rental underwriting) needs:

1. **Ownership & owner mailing address** (seller identification, absentee detection).
2. **Property characteristics** (beds/baths/sqft/year/lot) for comps and underwriting.
3. **Sales/deed history** (last sale price/date, transfer type) for comps and equity estimation.
4. **Mortgages / open liens** (equity estimate, distress signals).
5. **Foreclosure / pre-foreclosure** (NOD/lis pendens/auction) — core wholesaler signal.
6. **AVM + comps** (as a cross-check only; Northstar's own deterministic underwriting is primary).
7. **Rental estimates/comps** (rental analysis, BRRRR/buy-and-hold MAO).
8. **Parcels/boundaries** (map, APN normalization).
9. **Provenance**: provider, dataset, source record date, retrieval timestamp, confidence. Northstar must never invent or silently impute data.
10. **License fit**: right to display to tenants, cache, store derived calculations, and use within AI-assisted workflows.

### Weighting (Analysis)

| # | Criterion | Weight |
|---|---|---|
| C1 | Wholesaling data coverage (ownership, characteristics, sales, mortgages/liens, pre-foreclosure) | 25% |
| C2 | License fit for multi-tenant SaaS (display, caching, derivative storage, AI use) | 20% |
| C3 | API quality & developer experience (REST/JSON, docs, sandbox, self-serve) | 15% |
| C4 | Pricing transparency & early-stage affordability | 15% |
| C5 | Valuation, comps, rentals | 10% |
| C6 | Provenance metadata & data freshness signals | 10% |
| C7 | Vendor stability / continuity risk | 5% |

**Gate (Analysis):** A *primary* provider must deliver C1 items 1–5 nationally. Providers failing the gate can still win a specialized role (rentals, parcels).

---

## 3. Provider profiles

Each profile separates **Facts** (with sources) from **Analysis**.

### 3.1 ATTOM (incl. Estated)

**Facts**
- Coverage: "160+ million U.S. properties", "99% of the U.S. population"; categories listed include ownership, mortgage, foreclosure, ATTOM AVM, Rental AVM, comparable sales, building permits, parcel/school/neighborhood boundaries, assessor/tax, characteristics. API "supports both JSON and XML formats running REST conventions"; "free 30-day trial" with developer sandbox. — https://www.attomdata.com/solutions/property-data-api/ (retrieved 2026-11)
- Pricing: "Basic Property API plans start at $500 per month." Premium pricing "varies based on data requirements, usage and application needs." Page layout indicates Premium adds full event history, expanded sales history, AVM/AVM history/rental AVM, comps, assessment history, pre-foreclosure, boundaries (tier mapping inferred from icons — treat as **unverified**). Building permits and parcel tiles are add-ons. "Individual endpoint availability and data coverage may vary by license." — https://www.attomdata.com/solutions/delivery/property-data-api/pricing/ (retrieved 2026-11)
- Billing unit: ATTOM documentation describes billing by "API Reports" (a multi-result query can count per returned page) — https://cloud-help.attomdata.com/article/684-api-report (via search summary, retrieved 2026-11; **unverified** detail).
- Licensing: ATTOM's public website terms state that use of data is "subject to the terms of a separate license agreement." The API license text itself was **not publicly retrievable**. — https://www.attomdata.com/terms-of-use/ (retrieved 2026-11)
- **Estated:** ATTOM acquired Estated (2022). ATTOM says "there are no plans to deprecate the Estated API, but acknowledge it is a possibility," will provide "a minimum six-month period for customers to migrate," and is incorporating Estated features into an ATTOM endpoint for new customers. Search summaries indicate ATTOM does not currently market Estated to new customers (**unverified** wording). — https://cloud-help.attomdata.com/article/661-is-estated-api-being-replaced (retrieved 2026-11)

**Analysis**
- Best single-vendor fit for C1 + C5 + C6 if Premium is licensed. The $500/month Basic tier is unlikely to include pre-foreclosure, AVM, or comps; budget for a Premium quote.
- Do not build on Estated as a new customer; integrate ATTOM API directly.
- License terms are the critical unknown: we need written answers on tenant display, cache TTL, storage of derived values, and LLM use.

### 3.2 Cotality (formerly CoreLogic) — property data + Trestle

**Facts**
- Cotality's U.S. developer portal lists a Property API ("comprehensive property characteristics, ownership, and assessment data"), Spatial, Insight and other APIs; credentials are requested from a Cotality account representative (OAuth2 client credentials). Cotality notes it was formerly CoreLogic (rebranded 2025). — https://develop.cotality.com/getting-started/overview (via search summary, retrieved 2026-11)
- Trestle (MLS data distribution): free for MLSs; MLSs "approve data connections based on use case"; Trestle RESO delivers standardized data via Web API. Vendor/broker fees are not listed on the product page. — https://www.cotality.com/products/trestle (retrieved 2026-11)
- Third-party listings report broker feeds at $30/month and other feeds at $100/month plus technology-provider fees — **unverified** (FitGap via search, 2026-11). An API directory states Trestle rates "are not publicly published."

**Analysis**
- Top-tier data and AVMs, but enterprise-only access, **not public** pricing, and long sales cycles make it a poor MVP primary. Revisit at scale or for MLS transport (Trestle) in Phase 2.

### 3.3 First American DataTree

**Facts**
- No published API pricing; buyers are directed to contact DataTree — https://datarade.ai/data-providers/datatree-by-first-american/profile (retrieved 2026-11). First American states data can be delivered via the DataTree API or file — https://dna.firstam.com/loan-portfolio (retrieved 2026-11).

**Analysis**
- Strong title-plant-derived recorder data (deeds, mortgages, liens). Enterprise sales process; pricing and redistribution terms **not public**. Good later-stage alternative to ATTOM/BatchData for lien accuracy.

### 3.4 BatchData (BatchLeads API / BatchService)

**Facts — pricing** (https://batchdata.io/pricing, retrieved 2026-11)

| Product | Growth | Professional | Scale | Enterprise |
|---|---|---|---|---|
| Property Data | $1,000/mo — 100,000 records | $2,500/mo — 300,000 | $5,000/mo — 750,000 | $10,000/mo — 3,000,000 |
| Skip Tracing | $2,000/mo — 100,000 traces | $5,000/mo — 300,000 | $10,000/mo — 750,000 | $20,000/mo — 3,000,000 |

Property Data plans include property search/lookup, address autocomplete, "core property data (240+ points)", "mortgage and open liens (140+ points)", "pre-foreclosure (20+ points)", "quick lists (30+ lists)", single/bulk lookup, API access. Add-ons (monthly): Listing $600, Property Valuation $600, Comps $1,250, History (Deed) $500, Parcel Boundaries $2,500, Contact Enrichment $5,000, among others. Skip trace includes phones, email, DNC status, litigator scrub, carrier info.

**Facts — licensing** (BatchData Terms of Service, "Last Updated: November 6, 2026", https://batchdata.io/terms-of-service, retrieved 2026-11; text beyond §7.3 was truncated in our retrieval)
- §2.1: Services are "intended for Customer's internal business use only and a Permissible Purpose."
- §6.25(f): "Absent a fully executed Reseller Addendum, Customer is not authorized to resell, sublicense, or redistribute." §6.25(c): sub-customers must be bound with BatchData as third-party beneficiary.
- §6.20(c): Customer must "refresh local caches of any Data no less frequently than every thirty (30) days"; §6.20(d): delete/suppress records on notice; §6.24(a): no public repositories or search-engine exposure.
- §6.13(d): maintain compliance records "for five (5) years."
- §6.13(a)/§6.3: not consumer reports; BatchData is not a CRA; no use for credit, insurance, employment, tenant screening, or housing eligibility.
- §6.15 (DPPA) and §6.16 (GLBA) permissible-purpose representations.
- §6.12 / §6.26(a): data does not "constitute, or evidence consent" for TCPA purposes; "Customer is solely responsible for determining whether and how it may lawfully contact any person."
- Platform program: platforms may embed data via API or bulk (CSV/Parquet/Delta); BatchData reviews each use case and how fields are displayed; pay-as-you-go accounts are "Not for resale. For internal business use only." — https://batchdata.io/power-your-platform (retrieved 2026-11)

**Analysis**
- Most wholesaler-aligned dataset in this review (liens, pre-foreclosure, lists, skip trace in one place). Clear, explicit terms are a plus: we know exactly what to negotiate.
- Licensing posture is restrictive by default; tenant display without the Reseller Addendum would breach §6.25(f). The 30-day cache refresh duty must be engineered into our cache layer.
- Recommended as secondary/fallback and as the likely skip-trace vendor (under the same addendum).

### 3.5 PropStream

**Facts**
- We found no evidence of a public developer API; a third-party directory states PropStream "does not currently offer an API" (undated). PropStream's blog references a push integration to BatchDialer. — https://www.propstream.com/blog (search summary, retrieved 2026-11); **unverified**.

**Analysis**
- Not integrable as a provider. Tenants may export lists from PropStream and import them (subject to PropStream's own terms, which the tenant must honor). Our importer must tag provenance as "tenant-imported: PropStream export" and must not re-share across tenants.

### 3.6 Regrid (parcels)

**Facts**
- "160M+ Parcel Records", "100%" U.S. parcel coverage, Standard and Premium schemas, REST + tiles, 30-day sandbox; self-serve monthly plans; enterprise licensing above 10,000 records/month. — https://regrid.com/api (retrieved 2026-11)
- Self-serve: "Start with 2,000 Parcel records per month plus additional per record pricing"; dollar figures were not visible to us (page requires app access) — **not retrieved**. — https://support.regrid.com/reference/plan-options (retrieved 2026-11)
- API Terms (https://regrid.com/terms/api, retrieved 2026-11):
  - License is "non-exclusive, non-sublicensable, non-transferable"; permitted uses include "Integrate parcel data into Customer's apps, products, and services."
  - Customer may not "disclose or transmit any data contained in the Software to any individual other than a Customer employee" and may not "extract or process the Data, including parcel geometries in any derivative works" without written approval.
  - "Customer may cache or store the parcel records retrieved or collected by the API" — but may not "cache the Data or otherwise store Data offline without written approval."
  - "No Data may be inputted into an AI Model to customize, train, fine-tune, or improve" any AI model (narrow internal exceptions).
  - On termination: "must destroy all parcel records."

**Analysis**
- Excellent technical product; the self-serve terms are internally inconsistent for a SaaS (integration permitted, but disclosure limited to employees). An enterprise agreement must explicitly grant tenant display and clarify that sending parcel attributes to an LLM *for inference* is not "customizing/training." Defer until parcel maps are on the roadmap.

### 3.7 RentCast (rents, AVM, listings)

**Facts — pricing** (https://www.rentcast.io/api, retrieved 2026-11)

| Plan | Price/mo | Included requests | Overage/request |
|---|---|---|---|
| Developer | $0 | 50 | $0.20 |
| Foundation | $74 | 1,000 | $0.06 |
| Growth | $199 | 5,000 | $0.03 |
| Scale | $449 | 25,000 | $0.015 |

- Endpoints: property records, value estimate (+comps), rent estimate (+comps), sale listings, rental listings, market statistics; "150M+ property records"; rate limit "20 requests per second." — https://developers.rentcast.io (retrieved 2026-11)
- Billing: only HTTP 200 with body is billed; no hard caps; alerts at 85%/100%. — https://developers.rentcast.io/reference/billing-and-pricing (retrieved 2026-11)
- API Terms (https://www.rentcast.io/terms-api, retrieved 2026-11): §1(iv) grants the right "to sublicense, disclose, display, resell and distribute the API Data to third parties"; §1(v) storage "within your internal systems as necessary to perform the permitted uses"; §3.4 "neither use of the RentCast API nor use of the API Data requires attribution or disclosure"; §3.3 third-party data remains subject to its own license terms; §8.2 property reports must carry a specified disclaimer; §2 prohibits knowingly allowing unauthorized scraping.

**Analysis**
- Best license fit in this review and cheapest entry. Does not cover mortgages/liens or pre-foreclosure, so it fails the primary gate. Ideal **rentals source** and an inexpensive AVM cross-check. Note §3.3: some listing data may be third-party-licensed; ask RentCast which fields carry pass-through restrictions.

### 3.8 HouseCanary

**Facts — pricing** (https://housecanary.com/pricing, retrieved 2026-11)
- Subscriptions: Basic $19/mo, Pro $79/mo, Teams $199/mo, Enterprise custom. Core API included from Pro.
- Property Analytics API per successful call: Basic endpoints $0.50 / $0.40 / $0.30 (Basic/Pro/Teams); Premium $4 / $3 / $2.50; Premium Plus $6 / $5 / $4. Property Estimate API $0.05 (Teams); Build to Rent API $25 (Teams).
- Redistribution/display terms: **not reviewed / not public in our retrieval.**

**Analysis**
- Strong AVM/analytics; per-call economics are expensive for list-scale enrichment but acceptable for on-demand valuation cross-checks on qualified leads. Candidate for a later "second opinion AVM" adapter.

### 3.9 Realie

**Facts — pricing** (https://docs.realie.ai/api-reference/pricing, retrieved 2026-11)

| Plan | Price/mo | Tokens/mo | Overage/token |
|---|---|---|---|
| Free | $0 | 25 | $0.15 |
| Tier 1 | $50 | 1,250 | $0.05 |
| Tier 2 | $150 | 6,000 | $0.025 |
| Tier 3 | $350 | 30,000 | $0.012 |

One token per successful (HTTP 200) call; 404/401/403 not billed. Data-use/redistribution terms are in separate Terms of Use (**not reviewed**).

**Analysis**
- Very low cost; useful for prototyping and as a tertiary fallback for characteristics/ownership. Data depth on liens/foreclosure and licensing for tenant display are unconfirmed.

### 3.10 Melissa (Property API)

**Facts**
- Property data covering deed, mortgage, owner, assessor for ~140–150M parcels (secondary listings). Pricing: a Slashdot listing cites "1000 free credits/month" and credits "starting at $0.018"; a non-Melissa domain lists $1,760 per 100,000 records/year — both **unverified** (search summary, 2026-11). Official pricing **not retrieved**.

**Analysis**
- Strong in address verification/standardization (useful for our address normalization layer). As a property source it is a secondary option pending official pricing and terms.

### 3.11 LightBox (SmartFabric)

**Facts**
- Developer portal offers a 3-week evaluation with 2,000 total requests; parcel API includes boundaries, situs address, tax attributes, owner names/addresses, sales history, land use/zoning, LightBox ID. Production pricing appears sales-led (**not public**). — https://developer.lightboxre.com/ (search summary, retrieved 2026-11)

**Analysis**
- Commercial-real-estate heritage; a credible parcel alternative to Regrid at enterprise scale. Not an MVP fit.

### 3.12 ReportAll USA (parcels)

**Facts**
- Parcel API: 160.6–161.6M parcels (page is internally inconsistent); free 30-day trial; pricing "flexible", sales@reportallusa.com. — https://reportallusa.com/parcel-data-api (retrieved 2026-11). A search summary cites "packages start as low as $1,875" (**unverified**). License terms not reviewed.

**Analysis**
- Viable parcel fallback to Regrid; confirm display/caching terms.

### 3.13 PropMix (PubRec)

**Facts**
- PubRec: 151M+ properties across 3,100+ counties; deed and mortgage data add-ons; pricing based on successful calls; tier prices **not retrieved** (pricing page returned 404). — https://pubrec.propmix.io (search summary, retrieved 2026-11)

**Analysis**
- Possible lower-cost assessor/deed source; insufficient public information to rank highly.

### 3.14 Zillow Group / Bridge Interactive

**Facts**
- Bridge Public Records API: "The platform is currently invite only, so please contact us for access"; "This resource is really for commercial use cases by businesses"; agreement type "TOS, depending on use-case." — https://www.zillowgroup.com/developers/api/public-data/public-records-api/ (retrieved 2026-11)
- Zestimate API: access via a "Request Access" form; approval criteria not described; detailed terms hosted on bridgedataoutput.com (not retrievable). — https://zillowgroup.com/developers/api/zestimate/zestimates-api (retrieved 2026-11)
- Zillow's legacy public APIs were retired in 2021 (secondary sources; **unverified** exact date). Zillow's consumer Terms of Use prohibit automated access/scraping (secondary summaries; zillow.com returned 403 to us).

**Analysis**
- Not a dependable MVP source: invite-only, approval-gated, use-case-specific terms. **Northstar must never scrape Zillow, Redfin, or Realtor.com.** Bridge remains relevant as an MLS *transport* in markets where a tenant's MLS uses it (Section 6).

### 3.15 Realtor.com (Move, Inc.)

**Facts**
- No public developer API for listing data was found; listing data originates from MLS feeds under license; Realtor.com's partner APIs are oriented to lead delivery (secondary sources, retrieved 2026-11; **unverified**).

**Analysis**
- Not a provider option. Unofficial "Realtor.com APIs" on marketplaces are scrapers; prohibited for Northstar.

### 3.16 County assessor / recorder open data

**Facts (general)**
- Public-record availability, format, bulk-access fees and commercial-use rules vary by county and state; there is no single national open dataset. (General knowledge; no single source. **Analysis** label applies to the implications below.)

**Analysis**
- Highest provenance (the source of truth) but fragmented, inconsistent, and labor-intensive. Use selectively: (1) as a verification link shown to users ("view county record"), (2) for targeted high-volume counties where bulk files are cheap, (3) to resolve provider conflicts. Some states restrict commercial use of certain public records or exclude sale prices ("non-disclosure" states); validate per jurisdiction before ingesting.

### 3.17 Skip-tracing providers

| Provider | Facts (with source) | Analysis |
|---|---|---|
| **BatchData Skip Tracing / BatchSkipTracing** | Billed "per matched record"; REST `POST https://api.batchdata.com/api/v3/property/skip-trace`, up to 100 properties/request; returns DNC, TCPA, litigator, deceased, bankruptcy flags; "your team holds the TCPA and Do Not Call obligations." — https://batchdata.io/batchskiptracing (retrieved 2026-11). Monthly plan prices in §3.4. Per-match pay-as-you-go price: **not public** on the page (secondary sources cite $0.04–$0.07; **unverified**). | Best fit if we already hold a BatchData Reseller Addendum. Flags are useful inputs to our suppression engine but are not a substitute for our own registry scrub. |
| **Tracerfy** | ToS effective Jan 3, 2026: "Normal Trace: 1 credit per successful hit"; "Enhanced Trace: 15 credits per successful hit"; DNC scrub "1 credit per phone number checked"; "Tracerfy is NOT a Consumer Reporting Agency"; "Customer remains solely responsible for full TCPA compliance"; §13 "Customer may NOT resell, redistribute, sublicense, or share data with third parties," and requires equivalent restrictions for end users who receive data. — https://tracerfy.com/terms-of-service (retrieved 2026-11). Marketing pages cite $0.02/credit — https://tracerfy.com/ (retrieved 2026-11). | §13 conflicts with a multi-tenant SaaS model unless Tracerfy agrees in writing. Suitable only as a tenant's own BYO account. |
| **IDI (idiCORE), LexisNexis (Accurint), TransUnion TLO-type** | These platforms gate GLBA- and DPPA-regulated data by permissible purpose. LexisNexis documentation lists GLBA permissible uses such as collections and "skip tracing to locate debtors"; with no permissible use selected, searches run only against non-GLBA data, and DPPA searches are not performed. — https://secure.accurint.com/bps/509/html/tcol/glb.html and https://secure.accurint.com/bps/516/html/glb_dppa_faq.html (search summaries, retrieved 2026-11). DPPA permits bulk marketing use only "if the State has obtained the express consent" of the person (18 U.S.C. §2721(b)(12)) and requires recipients to keep records of redisclosure for 5 years (§2721(c)). — https://www.law.cornell.edu/uscode/text/18/2721 (retrieved 2026-11) | **Analysis:** Real-estate acquisition marketing is not an evident GLBA or DPPA permissible purpose. Northstar should not resell or embed these platforms for outreach. Tenants with their own credentialed accounts remain responsible for their certifications. |

**Legal constraints common to all skip tracing (Analysis, counsel to confirm)**
- **FCRA:** Skip-trace vendors disclaim CRA status and prohibit eligibility uses (credit, insurance, employment, tenant screening, housing). Northstar must hard-block using skip-trace or owner data to make eligibility decisions about people (for example, screening sellers for financing or tenant decisions).
- **GLBA:** Credit-header data is restricted to GLBA exceptions; avoid GLBA-regulated sources for marketing.
- **DPPA:** Motor-vehicle-record-derived data cannot be used for marketing without express consent; avoid.
- **TCPA/State law:** Skip-traced numbers carry no consent. Treat every skip-traced number as **no-consent / cold** in the consent ledger.

---

## 4. Evaluation matrix (weighted scoring)

**Analysis.** Scores 1 (poor) to 5 (excellent), based on the facts above. "?" items were scored conservatively (2) when terms or prices were not public. Weighted score = Σ(score × weight).

| Provider | C1 Coverage (25%) | C2 License fit (20%) | C3 API/DX (15%) | C4 Price (15%) | C5 AVM/Comps/Rent (10%) | C6 Provenance (10%) | C7 Stability (5%) | **Weighted** | Primary gate (C1 items 1–5) |
|---|---|---|---|---|---|---|---|---|---|
| ATTOM | 5 | 3 (negotiable; not public) | 4 | 3 | 4 | 4 | 5 | **3.95** | Pass (Premium) |
| RentCast | 2 | 5 | 5 | 5 | 5 | 3 | 3 | **3.95** | **Fail** (no liens/foreclosure) |
| BatchData | 4.5 | 3 (explicit; addendum needed) | 4 | 4 | 3 | 3 | 4 | **3.73** | Pass |
| HouseCanary | 3 | 2 | 4 | 4 | 5 | 4 | 4 | **3.45** | Fail/unclear |
| Cotality | 5 | 2 | 3 | 1 | 5 | 4 | 5 | **3.40** | Pass (enterprise) |
| First American DataTree | 5 | 2 | 3 | 1 | 4 | 4 | 5 | **3.30** | Pass (enterprise) |
| Realie | 3 | 2 | 4 | 5 | 2 | 3 | 2 | **3.10** | Unclear |
| Regrid | 2 | 2 | 5 | 3 | 1 | 4 | 4 | **2.80** | Fail (parcels role) |
| Melissa | 3 | 2 | 4 | 3 | 1 | 3 | 4 | **2.80** | Unclear |
| County open data | 2 | 4 | 1 | 4 | 1 | 5 | 2 | **2.75** | Fail (fragmented) |
| LightBox | 3 | 2 | 4 | 1 | 2 | 4 | 4 | **2.70** | Unclear |
| PropMix PubRec | 3 | 2 | 3 | 2 | 2 | 3 | 3 | **2.55** | Unclear |
| ReportAll | 2 | 2 | 4 | 3 | 1 | 3 | 3 | **2.50** | Fail (parcels role) |
| Estated | — | — | — | — | — | — | — | n/a | Not marketed to new customers |
| Zillow/Bridge | — | — | — | — | — | — | — | n/a | Invite-only |
| PropStream | — | — | — | — | — | — | — | n/a | No public API |
| Realtor.com | — | — | — | — | — | — | — | n/a | No public API |

**Sensitivity note (Analysis):** If ATTOM's negotiated license is restrictive (C2 = 2), its score drops to 3.75, roughly even with BatchData. The primary/secondary order should then be decided by the executed license terms and the Premium quote. Design the adapter layer so the swap is a configuration change.

---

## 5. Recommendation (Analysis)

### 5.1 Primary for MVP — ATTOM (Premium Property API)
- Start the 30-day trial immediately to validate field coverage in our launch markets (pre-foreclosure, open mortgages, AVM, comps).
- In parallel, request the API license agreement and negotiate a **SaaS Display / Platform Addendum** (Section 7).
- Use ATTOM as system of record for property characteristics, ownership, sales history, mortgages, foreclosure events, AVM cross-check, and (if licensed) boundaries.

### 5.2 Secondary / fallback — BatchData
- Use for failover, field-level cross-validation (owner name, open liens), and wholesaler-specific list signals.
- Contract via the "Power Your Platform" program with a **Reseller Addendum**. Engineer the §6.20(c) 30-day cache refresh and §6.20(d) delete-on-notice.

### 5.3 Rentals — RentCast
- Rent AVM + rental comps + rental listings for rental analysis and MAO-by-rent. Begin on the Growth or Scale tier; display the required §8.2 disclaimer wherever a property report is shown.

### 5.4 Parcels — Regrid (enterprise), deferred
- MVP: use APN/boundary data from ATTOM if included in the Premium license. Phase 2: Regrid enterprise license with explicit tenant-display and LLM-inference clauses; ReportAll/LightBox as alternates.

### 5.5 Skip trace — tenant-initiated, segregated, no automation
- Offer skip trace as an opt-in module per tenant, sourced from BatchData under the same addendum (or the tenant's own account). Results are stored in the tenant's partition, tagged `consent_status = none`, and are **ineligible** for AI voice, prerecorded, or automated SMS. Allowed use: human click-to-dial only, after registry/state DNC, litigator, and state-law checks.
- Exclude GLBA/DPPA-regulated platforms (IDI, LexisNexis, TLO) from the product.

### 5.6 Architecture requirements that follow from licensing (Analysis)
1. **Provider adapter interface** returning a normalized record plus a provenance envelope: `provider`, `dataset/endpoint`, `provider_record_id`, `source_recorded_at` (e.g., deed recording date), `retrieved_at`, `license_id`, `display_allowed` (bool), `cache_expires_at`, `confidence` (provider-supplied or rule-based), `field_level_sources` (when fields are merged).
2. **Never fabricate:** missing fields stay null with a reason (`not_provided`, `license_restricted`, `provider_error`). Underwriting must surface which inputs were user-entered and which were provider-sourced.
3. **License-aware cache:** TTL per provider (BatchData ≤30 days refresh); purge jobs on contract termination; per-tenant partitions; no cross-tenant reuse of tenant-paid or tenant-licensed data.
4. **LLM boundary:** Send provider data to an LLM only where the license allows it. Default to sending the minimum fields needed, and never send provider data for training or fine-tuning.
5. **Attribution/disclaimer slots** in the UI per provider (RentCast §8.2 disclaimer; any ATTOM/BatchData display requirements once known).

---

## 6. MLS data: what standardization does and does not grant

### 6.1 RESO Web API and Data Dictionary (Facts)
- "The RESO Web API is the modern way to transport data in the real estate industry"; it uses "the OData V4 standard specification." Listed versions include **Web API Core 2.0.0**, **Data Dictionary 2.0** (ratified) and a **Data Dictionary 2.1 Draft**. — https://reso.org/reso-web-api/ (retrieved 2026-11)
- "Access to data from the Web API is gained through local MLSs." Recipients must agree to the MLS's data-use and licensing policies, then get credentials from the MLS's vendor. "RESO does not provide MLS real estate data." — same source.

### 6.2 License types (Facts with examples)

| Feed / license | Purpose | Typical eligibility | Example (Fact) |
|---|---|---|---|
| **IDX** (Internet Data Exchange) | Public display of other brokers' listings on a participant's website | MLS participants/subscribers and their vendors | NAR IDX policy: an IDX participant "may not distribute, provide, or make any portion of the MLS database available to any person or entity" except as policy/MLS rules permit — https://www.nar.realtor/handbook-on-multiple-listing-policy/advertising-print-and-electronic-section-1-internet-data-exchange-idx-policy (retrieved 2026-11) |
| **VOW** (Virtual Office Website) | Authenticated consumer access through a participant's brokerage relationship (often more fields incl. sold) | Participants (brokerage services to registered consumers) | NAR VOW policy requires participants to protect MLS data from scraping/misappropriation — https://www.nar.realtor/handbook-on-multiple-listing-policy/virtual-office-websites-policy-governing-use-of-mls-data-in-connection-with-internet-brokerage (retrieved 2026-11) |
| **BBO** (Broker Back Office) | Internal brokerage use (CMA, analytics, agent production), **no public display** | Participants/subscribers | Canopy MLS: back office "no public display of listing data"; may be used for CMA and market analytics; $500 setup + $100/month — https://go.canopymls.com/data (retrieved 2026-11) |
| **Non-participant / data license** | Other uses (analytics, portals) | Case-by-case board approval | Canopy MLS non-participant license: $1,000 setup + $1,200/quarter; requires Board approval; "will only approve AVM requests for Participants and Subscribers" — https://go.canopymls.com/data (retrieved 2026-11) |

### 6.3 Transport platforms (Facts)
- **MLS Grid:** a vendor registers, adds the broker/agent to a data subscription, and the broker (and agent) sign via emailed link; "ONE standard license agreement for IDX, VOW, and Back Office products"; every party with data access must accept the terms; MLS Grid collects MLS license fees. — https://mlsgrid.com/faq and OneKey MLS https://support.onekeymls.com/hc/en-us/articles/27251536794644-Data-Delivery-Resources (search summaries, retrieved 2026-11). OneKey fee example ($250/month feed + $20/month per license) is **unverified**.
- **Unlock MLS (Austin):** vendors need "at least one active Unlock MLS subscriber ready to sign up for their services"; all users register with MLS Grid first. — https://www.unlockmls.com/data-licensing (retrieved 2026-11)
- **Trestle (Cotality):** MLSs approve connections by use case. — https://www.cotality.com/products/trestle (retrieved 2026-11)
- **Spark API (FBS):** the developer agreement limits MLS content storage to temporary performance caching that "does not exceed 24 hours" (alpha docs copy; verify live version). — https://alpha.sparkplatform.com/docs/terms_of_use/developer_agreement_and_terms_of_use (search summary, retrieved 2026-11)
- **Bridge (Zillow):** new users need an invite; MLS-specific approvals. — https://www.unlockmls.com/data-licensing (retrieved 2026-11)

### 6.4 Why standardized access is not unrestricted access (Analysis)
- RESO defines **how** data moves (schema + protocol), not **who** may use it or **for what**. Each MLS is the licensor; each license type has a use scope (display vs internal), field scope (payloads), and retention and display rules.
- Licenses are granted per MLS, and there are hundreds of U.S. MLSs. National coverage requires many separate agreements.
- Most licenses run to a **participant (broker)** or **subscriber (agent)**. A technology vendor's rights derive from that participant's license and end when the participant relationship ends.

### 6.5 How a non-broker SaaS can legally obtain MLS data (Analysis; counsel and each MLS to confirm)
1. **Tenant-authorized vendor access (recommended Phase 2 path):** A tenant who is (or employs) an MLS participant/subscriber authorizes Northstar as their vendor. Northstar signs the MLS's vendor agreement through MLS Grid, Trestle, Bridge, Spark, or a direct feed. The data is used only for that tenant (typically a BBO license for CMAs/comps). Many wholesalers are **not** licensed, so this path covers only tenants on licensed teams.
2. **Broker sponsorship:** Northstar (or an affiliate) partners with a licensed brokerage that holds participant rights and licenses a BBO/VOW feed with Northstar as vendor. This creates brokerage-law and RESPA/agency considerations. Get counsel review before using this path; do not adopt it casually.
3. **Non-participant data license:** Some MLSs license data to non-participants by board approval (Canopy example). Expect narrow scope, AVM restrictions, and fees.
4. **Licensed aggregators:** Some property-data vendors sell listing add-ons (for example, BatchData "Listing" $600/month). Confirm in writing what MLS-derived rights the vendor holds and passes through. Assume nothing.
5. **Never:** scrape portals or MLS front-ends, share one tenant's credentials across tenants, or keep copies beyond license terms.

### 6.6 Implications for comps (Analysis)
- **MVP comps** come from public-record sales (ATTOM/BatchData). Every comp shows its source and recording date. In non-disclosure states, public-record sale prices may be missing or unreliable. Our underwriting must flag "insufficient verified sales" instead of filling gaps with invented values.
- **MLS-derived comps** (Phase 2) are tenant-scoped: displayed only to users covered by that tenant's MLS license, never pooled into cross-tenant comps, AVMs, or model training, and purged when the license ends.
- Comp outputs must carry `comp_source` (public record vs MLS (tenant license) vs provider AVM) so ARV/MAO reports are auditable.

---

## 7. Credentials and contracts Northstar must obtain

| Provider | Credentials (technical) | Contracts / legal documents | Specific clauses to negotiate (Analysis) |
|---|---|---|---|
| **ATTOM** | Developer Platform API key (trial → production); separate keys per environment | ATTOM API License Agreement (click-through at trial; production order form/MSA for Premium); any add-on schedules (boundaries, permits) | Tenant display rights in a multi-tenant SaaS; cache/storage TTL; storage of derived calculations (ARV/MAO, comps selections); post-termination retention; LLM inference use; attribution requirements; endpoint list per license; billing on "API Reports"; SLA and change-notice for deprecations (Estated precedent: ≥6 months) |
| **BatchData** | Production API token (developer.batchdata.com); bulk delivery credentials (if bulk) | Order Form + ToS (Nov 6, 2026 version) + **Reseller Addendum** (signed by a BatchData officer, §6.25(a)) + Platform program approval of field display; DPPA/GLBA permissible-purpose certifications | Approved field list for tenant display; sub-customer flow-down terms (BatchData as third-party beneficiary); 30-day cache refresh mechanics; delete-on-notice SLA; 5-year compliance records (§6.13(d)); skip-trace inclusion under the same addendum; TCPA indemnity allocation |
| **RentCast** | API key (paid plan) | RentCast API Terms (rentcast.io/terms-api) — click-through; consider an order form for volume | Confirm §1(iv) redistribution grant survives plan changes; identify any third-party pass-through fields (§3.3); disclaimer text (§8.2); volume pricing |
| **Regrid** (Phase 2) | API token + tile token | Enterprise license (not self-serve terms) | Explicit tenant display right; exception to the AI-model clause for inference-only use; offline storage approval; derivative geometry use; termination purge timelines |
| **Skip trace (BatchData)** | Same BatchData token with skip-trace product enabled | Reseller Addendum covering skip trace; permissible-purpose certification; Northstar ToS flow-down to tenants | Tenant attestation of lawful use; no FCRA uses; flags provided (DNC/litigator) are advisory; data-retention limits |
| **National DNC Registry** (supports outreach; not a data vendor) | Each *seller* (tenant) obtains a Subscription Account Number (SAN); Northstar accesses on tenants' behalf as service provider | FTC registry terms; tenant authorization for Northstar to access with tenant SAN | Cost sharing across sellers is prohibited (47 CFR 64.1200(c)(2)(i)(E)). Each tenant must have its own access (see the messaging compliance research) |
| **MLS (Phase 2, per market)** | MLS Grid / Trestle / Bridge / Spark vendor accounts; per-tenant authorizations | Per-MLS vendor/data license agreement (IDX/VOW/BBO); tenant broker's signature; MLS rules acknowledgment | License type per use; field payload; display rules; caching (e.g., Spark ≤24h); audit rights; termination purge |
| **Northstar internal** | — | Data Processing & Use Policy; tenant ToS that flows down every provider restriction (no scraping, no resale, no FCRA uses); provider-specific attribution in UI | Counsel review of all of the above |

---

## 8. Open questions / next steps

1. Obtain ATTOM API license agreement and Premium quote; validate launch-market coverage during trial.
2. Open BatchData "Power Your Platform" review; request the Reseller Addendum template; confirm add-on pricing per tier (the page states add-on pricing "varies by plan tier").
3. Confirm RentCast pass-through restrictions and volume tier.
4. Confirm with each provider whether sending records to an LLM for inference is permitted.
5. Counsel review: provider contracts, tenant ToS flow-downs, MLS strategy (Section 6.5), and skip-trace module design.

*End of document. Research only — not legal advice. Have counsel review before acting on it.*
