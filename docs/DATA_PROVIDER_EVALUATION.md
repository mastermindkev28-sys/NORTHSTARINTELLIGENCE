# Data Provider Evaluation

**Status:** First pass · **Research date:** 2026-11-10 · **Scope:** Brief section 10
Prices are list prices retrieved 2026-11-10. **Licensing and redistribution terms were not published on any pricing page reviewed**; each must be confirmed in writing before production use.

---

## 1. Recommendation

1. **Launch stack (low fixed cost):** Realie (parcel, owner, sales, comps) as primary + RentCast (value and rent estimates, listings, market stats) as secondary, both behind a `PropertyDataProvider` adapter. Both start at $0 with metered tiers, so cost scales with customers.
2. **Upgrade path at scale:** ATTOM (from $500/mo) or BatchData (from $1,000/mo property data; skip tracing from $2,000/mo) once volume justifies minimums and we need deeper history, pre-foreclosure, or contact enrichment.
3. **Parcel geometry (optional):** Regrid self-serve for boundaries and maps.
4. **MLS data:** do not depend on it for v1. Access requires per-MLS licensing, and most investor (non-member) use cases do not qualify. Revisit via brokerage partners and Trestle/RESO feeds later.
5. **Never** scrape portals or use data outside its license. Zillow's public records API is invite-only with use-case-specific terms. [D8]

---

## 2. Provider comparison

| Provider | Data types (per vendor) | Pricing (list) | Unit cost at top self-serve tier | Fixed minimum | Source |
|---|---|---|---|---|---|
| **Realie** | Property/parcel data, owner, comparables (premium endpoints) | Free 25 tokens; $50/1,250; $150/6,000; $350/30,000 tokens/mo. 1 token = 1 successful call; 404s not billed | ~$0.0117/call ($350/30k); overage $0.012 | $0 | [D1] |
| **RentCast** | Property records, value AVM, rent AVM, sale and rental listings, market stats | Free 50; $74/1,000; $199/5,000; $449/25,000 req/mo | ~$0.018/req; overage $0.015 to $0.20 | $0 | [D2][D3] |
| **ATTOM** | Basic: profiles, assessment, owner and mortgage, basic sales history, schools, POI. Premium (quote): AVM, rental AVM, comps, expanded history, pre-foreclosure, boundaries | Basic from $500/mo; Premium by quote. Call volumes not listed | n/a | $500/mo | [D4] |
| **BatchData** | Core property (240+ fields), mortgage/liens, pre-foreclosure; add-ons: listings, valuation, comps, deed history, permits, contact enrichment, BatchRank | Property: $1,000/100k records → $10,000/3M. Add-ons $100 to $5,000/mo. Skip trace $2,000/100k → $20,000/3M | ~$0.01/record (Growth); skip ~$0.02 | $1,000/mo | [D5] |
| **Regrid** | Parcel boundaries, standard/premium parcel schema; enterprise adds buildings, enhanced ownership, zoning | Self-serve from 2,000 records/mo (dollar price not shown); enterprise >10k/mo by quote | not published | not published | [D6] |
| **Cotality Trestle** | MLS listing data via RESO feeds; Trestle MCP for approved AI apps | MLS-specific licensing; 100+ MLSs on platform | n/a | per MLS | [D7] |
| **Zillow Public Records API** | Public records | Invite-only; ToS depends on use case; price not stated | n/a | n/a | [D8] |

---

## 3. Evaluation against brief criteria

| Criterion | Realie | RentCast | ATTOM | BatchData |
|---|---|---|---|---|
| Coverage | Nationwide claim, not independently verified | Nationwide, same data on all plans [D2] | Nationwide; endpoint coverage "may vary by license" [D4] | Nationwide claim |
| Accuracy | Untested | Untested | Untested | Untested |
| Historical data | Sales history (depth unverified) | Listing history | Basic sales; expanded in Premium | Deed history add-on |
| Comparable sales | Premium comps (max 50 results) | Via AVM comps | Premium | $1,250/mo add-on |
| Ownership | Yes (premium owner) | Yes | Yes | $100/mo owner profile add-on |
| Rental | Not stated | **Yes (rent AVM)** | Premium rental AVM | Not stated |
| API quality | REST, token billing, docs public | REST, docs public, rate limits documented | REST, free trial | REST, MCP server on request |
| Licensing / redistribution | **Unverified** | **Unverified** | **Unverified** | Custom contract terms |
| Usage restrictions | Tokens do not roll over | Overage billing | By license | Per contract |

**Accuracy test plan (before committing):** pull 200 recently sold properties across 4 target metros, compare each provider's last sale price/date and owner against county recorder records, and record match rate and lag. This directly tests the stale-data complaint seen with incumbents (`MARKET_RESEARCH.md` §5).

---

## 4. MLS and RESO considerations

- RESO standards (Data Dictionary, Web API) standardize **format**, not **permission**. Trestle describes access as limited to "approved" applications and "authorized" data, with monitoring and digital fingerprinting for unauthorized redistribution. [D7]
- IDX/VOW/back-office licenses are tied to MLS membership (brokers/agents). A wholesaler SaaS generally cannot license MLS data directly for its customers.
- Path to MLS-grade comps: (a) customer-supplied credentials where their MLS license allows tool use, (b) brokerage partnerships, (c) licensed listing data from aggregators (RentCast listings, BatchData listing add-on) subject to terms.

---

## 5. Adapter and provenance requirements (for architecture)

- `PropertyDataProvider` interface: `getProperty`, `getOwner`, `getSalesHistory`, `getComps`, `getValueEstimate`, `getRentEstimate`; each returns `{value, source, retrievedAt, providerRecordId, confidence, licenseTag}`.
- Field-level provenance: never merge two providers' values without keeping both.
- Missing fields stay `null` with a reason; no imputation without a labeled estimate.
- Caching policy set per provider license (TTL and display rules stored in config).
- Per-tenant metering of calls for cost allocation and credits.
- Mock provider with labeled demo data for development (brief section 15).

---

## 7. Public-record and distress data providers (Discover addendum §10)

Added 2026-11-10 for Northstar Discover. Criteria from the addendum: county coverage, record types, freshness, accuracy, provenance, API, bulk delivery, licensing, redistribution, retention, usage cost, customer display rights. Unless a cell cites a source, it is **unverified** and must be obtained in writing.

| Provider | County coverage (vendor claim) | Public-record types (vendor claim) | Delivery | Licensing / display rights | Cost | Fit for Discover |
|---|---|---|---|---|---|---|
| **ICE Mortgage Technology** (Property Data) | 99.99% of US properties, 3,100+ counties, 155M+ parcels [D9] | Deeds, mortgages/deeds of trust, assignments and releases, lien positions, HOA and tax liens, foreclosure "full cycle"; 830M+ historical transactions [D9] | API, bulk/batch, FTP/XML, match-and-append [D9] | Reseller licensing exists for customer-facing products; terms not published [D9] | Not published | **Strong** fallback for recorder and foreclosure data where counties lack open APIs. Enterprise sales cycle expected |
| **ATTOM** | Nationwide (premium tier) | Premium: pre-foreclosure, expanded sales and event history, assessment history, boundaries [D4] | API | Endpoint availability "may vary by license" [D4] | Basic from $500/mo; premium by quote [D4] | Good mid-market option; confirm foreclosure and lien depth |
| **BatchData** | Nationwide claim | Mortgage and liens (140+ fields), pre-foreclosure (20+), deed history add-on, permits add-on [D5] | API; MCP server and portfolio monitoring on request [D5] | Custom contract terms at Enterprise [D5] | Property data from $1,000/mo; add-ons $100 to $5,000/mo [D5] | Good for liens, pre-foreclosure, permits |
| **Realie** | Nationwide claim | Parcel, owner, sales, comps [D1] | API, bulk data [D1] | Unverified | From $0 [D1] | Core property facts, not distress events |
| **RentCast** | Nationwide | Property records, value/rent AVM, listings [D2] | API | Unverified | From $0 [D3] | Rent comps for buy-and-hold, BRRRR, Section 8 |
| **PropIntel** | 5 metros (Phoenix, Dallas, Atlanta, Tampa, Houston), "5M+ properties"; also claims "every US market" (contradictory) [D10] | County tax records, code violations, permits, tax liens, comps, skip tracing [D10] | REST API [D10] | Not shown [D10] | Not shown | **Not recommended as a data source.** Presents as an investor software platform (a competitor) rather than a licensed record provider |
| **Direct county sources** | Per county | See `PUBLIC_RECORDS_SOURCE_INVENTORY.md` | Socrata, ArcGIS, Carto, bulk files | Per-portal license (e.g., City of Philadelphia License: "as is," City retains rights) | Usually free | **Primary** in pilot counties; best provenance and freshness, highest per-county engineering cost |

**Recommendation for Discover:** use direct county sources first in the 2 to 3 pilot counties (best provenance, free, verifiable against the source), and use one licensed provider (ICE or ATTOM premium, decided after a terms and price quote) to fill record types counties don't publish openly: parcel-level tax delinquency, lis pendens, notices of default, probate-linked transfers. Run the 200-property accuracy test (§3) against county records for whichever provider we shortlist.

**Schema guidance for the platform thread:** do not mirror one vendor's schema. Model a generic recorded instrument (`instrument_type`, `instrument_number` or book/page, `recorded_date`, `instrument_date`, `parties[]` with role, `consideration`, `apn`, `source`, `source_record_id`, `retrieved_at`, `license_tag`) and a generic event (`event_type`, `status`, `event_date`, `filed_date`, `discovered_at`, `supersedes_event_id`). Vendor adapters map into these.

## 8. Open items

1. Request licensing/redistribution terms from Realie, RentCast, ATTOM, BatchData in writing (needs a company contact; no spend required).
2. Run the 200-property accuracy test on free/trial tiers.
3. Confirm Regrid self-serve dollar pricing.
4. Evaluate skip-trace providers separately (customer pass-through recommended).
5. Request ICE and ATTOM premium quotes and license terms covering customer display, retention and redistribution of public-record and foreclosure data.

---

## Sources (all retrieved 2026-11-10)

- [D1] Realie API pricing tiers. https://docs.realie.ai/api-reference/pricing
- [D2] RentCast API billing and pricing docs. https://developers.rentcast.io/reference/billing-and-pricing
- [D3] RentCast API pricing page. https://rentcast.io/api
- [D4] ATTOM Property Data API pricing. https://www.attomdata.com/solutions/delivery/property-data-api/pricing/
- [D5] BatchData pricing. https://batchdata.io/pricing
- [D6] Regrid plan options. https://support.regrid.com/reference/plan-options
- [D7] Cotality, "Cotality launches Trestle MCP," 2026-10-19. https://www.cotality.com/resources/cotality-launches-trestle-mcp-connecting-ai-to-trusted-governed-mls-data
- [D8] Zillow Group, Public Records API. https://www.zillowgroup.com/developers/api/public-data/public-records-api/
- [D9] ICE Mortgage Technology, Property Data. https://mortgagetech.ice.com/products/property-data
- [D10] PropIntel AI website. https://propintel-web.pages.dev/
