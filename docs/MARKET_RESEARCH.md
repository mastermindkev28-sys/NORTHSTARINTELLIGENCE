# Market Research: Residential Wholesalers and Acquisition Teams

**Status:** First pass · **Owner:** Northstar Intelligence (Head of Market Research) · **Research date:** 2026-11-10
**Scope:** Brief section 06 (initial market entry). Companion docs: `COMPETITIVE_ANALYSIS.md`, `DATA_PROVIDER_EVALUATION.md`, `SAAS_PRICING_AND_UNIT_ECONOMICS.md`, `GO_TO_MARKET.md`.

> **Evidence rules used in this document.** Every number has a source and a retrieval date. Where no reliable public figure exists (for example, the number of active wholesalers in the US), this document says so and does not estimate one. Statements labeled **Hypothesis** are our reasoning and must be validated in customer interviews before they drive decisions.

---

## 1. Executive summary

1. **The activity base is large but contracting.** ATTOM counted 64,348 single-family and condo flips in Q1 2026 (8.0% of all sales), down from 70,579 a year earlier. Typical gross flip ROI fell to 25.4% from 29.6%. [S1] Redfin reports investor purchases in Q1 2026 fell 6% year over year to their lowest level since 2020, at 19% of purchases in the metros it tracks. [S2]
2. **Margin compression makes efficiency the buying trigger.** When spreads shrink, operators cut marketing waste and look for tools that convert more of the leads they already pay for. Our product pitch should be framed as *cost per acquired contract*, not features. (Hypothesis, consistent with S1/S2.)
3. **Regulation is tightening fast, and almost no tool treats it as a product problem.** In 2024 to 2026, Pennsylvania, Maryland, Tennessee, Ohio, Oregon and Connecticut each enacted wholesaling disclosure, cancellation or registration rules. [S3][S4][S5] The FCC has confirmed AI-generated voices are "artificial" under the TCPA, so AI voice outreach needs prior express consent. [S6] This is the clearest opening for a "compliance-native" product.
4. **The current stack is fragmented and expensive.** A typical operator pays for a data/list tool ($99 to $899/mo), an investor CRM ($69 to $599/mo), a dialer and SMS, skip tracing (8 to 12 cents per record) and a deal calculator. See `COMPETITIVE_ANALYSIS.md` for verified prices. One new wholesaler on BiggerPockets reported nearly $400/mo in software before buying a CRM. [S9]
5. **"AI" is no longer a differentiator by itself.** REsimpli advertises AI agents on every plan; CarrotCRM (formerly InvestorFuse) ships AI lead scoring and an "Autonomous Lead Manager"; DealMachine has AI chat. [C3][C4][C2] Northstar must win on *verifiable* intelligence: data provenance, deterministic underwriting, and measured ROI.

---

## 2. Market activity (sized from public data only)

| Metric | Value | Period | Source |
|---|---|---|---|
| Homes flipped (SFR + condo) | 64,348 | Q1 2026 | ATTOM [S1] |
| Flips as % of all home sales | 8.0% (Q4 2025: 7.2%; Q1 2025: 8.2%) | Q1 2026 | ATTOM [S1] |
| Typical gross flip profit | $66,000 (Q1 2025: $74,172) | Q1 2026 | ATTOM [S1] |
| Typical gross flip ROI | 25.4% (Q1 2025: 29.6%) | Q1 2026 | ATTOM [S1] |
| Flips bought with cash | 61.1% | Q1 2026 | ATTOM [S1] |
| Investor home purchases (39 metros) | 45,397, down 6% YoY; lowest since 2020 | Q1 2026 | Redfin [S2] |
| Investor share of purchases | 19% (20% a year earlier) | Q1 2026 | Redfin [S2] |
| Low-priced tier investor purchases | down 10% YoY; lowest Q1 in a decade | Q1 2026 | Redfin [S2] |

**What we could not verify.** There is no authoritative public count of active wholesalers or acquisition teams in the US, and wholesale assignments are not consistently recorded as separate transactions. We will not publish a top-down TAM built on guessed counts. Section 7 gives a bottom-up method we will fill with interview and pilot data.

**Interpretation (Hypothesis).** Wholesalers sit upstream of flips and buy-and-hold purchases, so flip and investor-purchase volume is a reasonable proxy for deal flow. Both are down year over year, which means competition for the same motivated sellers is up and marketing costs per contract are likely rising. That favors tools that raise conversion and speed-to-lead rather than tools that generate more raw leads.

---

## 3. Customer segments

| Segment | Description | Likely current stack | Fit for first product |
|---|---|---|---|
| **A. Solo / new wholesaler** | 1 to 2 people, low or no marketing budget, driving for dollars, cold calling | PropStream Essentials or DealMachine Basic, free Podio or spreadsheets [S9] | Low. Price-sensitive; high churn risk. |
| **B. Small acquisition team (core ICP)** | 3 to 10 people (acquisitions, lead manager, dispositions), steady paid marketing (mail, PPC, cold call, SMS) | Data tool + investor CRM (REsimpli, CarrotCRM, Left Main, FreedomSoft) + dialer | **High.** Real lead volume, real conversion pain, budget for $300 to $1,000/mo. |
| **C. Scaled operator / multi-market** | 10 to 50+ people, call center (often offshore VAs), several markets | Salesforce-based CRM (e.g., Left Main), custom Podio/GoHighLevel builds, BatchData-style APIs | Medium-term. Needs integrations, SSO, permissions, reporting. |
| **D. Buy-and-hold / flip acquisition teams** | Buying for their own portfolio, not assigning | Similar to B plus underwriting spreadsheets, DealCheck [C9] | High. Underwriting depth matters more. |
| **E. Agents/brokers doing investor deals** | Licensed agents sourcing off-market | Agent CRMs plus a data tool | Later. Different compliance regime. |

**Recommended beachhead:** Segment B and D teams that already spend on paid lead generation. They feel conversion loss in dollars and can measure our impact within one pilot month.

---

## 4. Current workflow (observed in vendor docs and practitioner forums)

1. **List building**: pull distressed/absentee/equity lists from PropStream, BatchLeads or DealMachine; "list stacking" across sources. [C1][C5][C2]
2. **Skip tracing**: buy phone numbers at roughly $0.08 to $0.12 per record. [C1][C5]
3. **Outreach**: direct mail ($0.57 to $0.89 per piece on data platforms), cold calling via dialers, SMS, PPC. [C1][C2]
4. **Lead intake and qualification**: lead manager calls back, asks the "four pillars" (condition, motivation, timeline, price) and logs into the CRM.
5. **Follow-up**: drip sequences and task reminders. Practitioners consistently cite follow-up as the main driver of conversion. [S9]
6. **Comps and offer**: pull comps from the data tool, compute ARV and MAO in a spreadsheet or DealCheck.
7. **Contract and disposition**: e-sign, find a cash buyer, assign, track to closing.

**Where the time and money leak (Hypotheses to validate):**
- Leads arrive in several systems and wait minutes to hours for a first response.
- Qualification notes are inconsistent, so comps/offers get built on incomplete facts.
- Comps are pulled from data whose freshness is unknown (see section 5).
- Marketing attribution is weak. One REsimpli reviewer says marketing tracking relies on "tags and an external list." [S10]
- Rules automation is limited. The same reviewer wants if/then rules and "fewer lost leads and conversations." [S10]

---

## 5. Customer complaints and operational weaknesses

| Theme | Evidence | Source |
|---|---|---|
| **Stale or wrong sales/ownership data** | Flipper reports comps showing sales that county records do not show, and an owner not updated months after a recorded sale (2024). | BiggerPockets [S7] |
| **Outdated listing data, search limits** | Trustpilot's AI summary of PropStream reviews mentions outdated auction/MLS info and search limitations; 13% of 399 reviews are 1-star. | Trustpilot [S8] |
| **Inaccurate contact data + extra skip-trace fees** | 1-star BatchLeads review (Sep 2026): contact info wrong "most of the time," skip tracing costs extra. Overall 4.7/5 on 1,360 reviews, so a minority view. | Trustpilot [S11] |
| **Tool sprawl / cost** | New wholesaler near $400/mo before a CRM; considers Google Sheets. | BiggerPockets [S9] |
| **Podio complexity** | Concern that customizing Podio steals time from seller follow-up. | BiggerPockets [S9] |
| **CRM automation gaps** | No custom if/then rules; AI transcripts limited to some plans; weak marketing tracking; lost leads. | TrustRadius review of REsimpli [S10] |
| **Feature gating via add-ons** | CarrotCRM AI usage beyond trial needs a $99/mo AI Suite add-on; REsimpli bills AI calling per use. | Vendor pricing pages [C4][C3] |

Caveat: review platforms skew positive (vendors solicit reviews after onboarding) and forum posts skew negative. Treat this table as a list of hypotheses to probe in interviews, not as frequency data.

---

## 6. Regulatory environment (material to product design)

This is a summary for product planning, **not legal advice**. Counsel must review before launch.

**State wholesaling laws (2024 to 2026)**

| State | Law / date | Key requirements | Source |
|---|---|---|---|
| Pennsylvania | Act 52 of 2024 | Written disclosure of intent to assign and of the assignment fee; consumer cancellation right | [S4] |
| Maryland | Effective 2025-10-01 | Disclosure of potential assignment; notice of seller's right to rescind | [S4] |
| Tennessee | SB 909, signed March 2025 | Wholesaling allowed without a license if written disclosures go to seller and end buyer | [S4] |
| Ohio | SB 155, effective 2026-03-02 | Separate bold 12-pt+ written statement that buyer is a wholesaler; seller may cancel before closing | [S4] |
| Oregon | New law and wholesaler registry | Registration as residential property wholesaler | [S5] |
| Connecticut | Effective 2026-07-01 | Register with DCP ($285); signed written wholesale disclosure report before contract | [S3] |

Secondary sources [S4][S5] summarize statutes; we have verified Connecticut against the state's own release [S3]. Each statute must be read directly before we ship state-specific workflows.

**Telephone and messaging (TCPA)**
- FCC declaratory ruling (Feb 2024): AI-generated voices are "artificial" under the TCPA, so such calls need prior express consent unless an exemption applies. [S6]
- The Eleventh Circuit vacated the FCC's "one-to-one" lead-generator consent rule on 2025-01-24. The 2012 prior-express-written-consent standard for autodialed or artificial/prerecorded marketing calls and texts still applies, and Do Not Call protections were extended to texts. [S12]

**Product implications**
- Consent ledger per contact and channel (source, timestamp, scope, revocation) as a core data object.
- AI voice outbound only to contacts with documented consent; AI handles **inbound** and consented callbacks first.
- State-aware contract checklist: disclosure templates, registration number fields, cancellation windows.
- DNC scrubbing and opt-out honored across every channel, with audit trail.

These are also selling points: compliance risk is new, growing and poorly served by incumbents (Hypothesis; validate in interviews).

---

## 7. Willingness to pay and bottom-up sizing method

**Observed price anchors (verified):** operators already pay $69 to $599/mo for investor CRMs and $99 to $899/mo for data platforms (`COMPETITIVE_ANALYSIS.md`). A Segment B team running both typically spends several hundred to over $1,000/mo before usage fees (calculated from listed prices).

**Unknown and must be validated:** how much of that spend a team would move to Northstar, and what premium they would pay for measured conversion lift. We have no primary data yet.

**Bottom-up SAM formula (to fill from interviews and pilots):**

```
SAM ($/yr) = (# of Segment B+D teams in target markets)
           × (% with ≥ N paid leads/month)
           × (expected ACV)
```
Inputs to collect: team counts per metro (from cash-buyer and assignment data in licensed datasets, REI meetup and association rosters), lead-volume distribution (interviews), and ACV (pilot conversions). Do not populate this with guesses.

---

## 8. Switching costs and integration requirements

**Switching costs (Hypotheses):** lead history and notes in the CRM; phone numbers and A2P 10DLC registrations tied to a dialer/SMS vendor; trained VAs; annual contracts (BatchLeads Team plans are annual; PropStream discounts annual). [C5][C1]

**Implication:** the first product should **sit alongside** the existing CRM (two-way sync) instead of forcing a rip-and-replace. Win the qualification and underwriting layer first, then expand.

**Integration priorities for v1:**
1. CRM two-way sync: REsimpli, CarrotCRM, Podio, GoHighLevel (APIs and webhooks to be confirmed per vendor).
2. Lead sources: web forms, PPC landing pages, call tracking, CSV list import.
3. Messaging: Twilio (or customer's existing provider), with consent and opt-out sync.
4. Calendars: Google and Microsoft 365.
5. Property data: at least two providers behind an adapter (`DATA_PROVIDER_EVALUATION.md`).

---

## 9. Expanded scope: multi-strategy investors (Discover addendum, 2026-11-10)

The owner's addendum broadens the platform beyond wholesaling. Wholesalers and acquisition teams remain the **commercial entry point**; the segments below shape architecture and later packaging. We have not yet sized or interviewed these segments, so everything here is a hypothesis.

| Segment | What they need from Northstar | Data dependency |
|---|---|---|
| Beginners (any strategy) | Guided onboarding, preset templates, plain-language explanations | Same as below, with conservative defaults |
| Fix-and-flip operators | ARV, rehab budget, holding and financing costs, net profit and ROI | Comps, permits (BatchData add-on, county permit data) |
| Buy-and-hold / BRRRR investors | Rent estimates, operating expenses, DSCR, refinance scenarios | Rent AVM and comps (RentCast), tax and insurance inputs |
| Creative-finance investors | Existing-loan analysis from **uploaded documents**; due-on-sale and lien flags | Recorded mortgages give history only, never current balance or terms |
| Section 8 / HCV investors | Gross rent benchmarks vs. costs | HUD FMR/SAFMR API, per-PHA payment standard PDFs (`PUBLIC_RECORDS_SOURCE_INVENTORY.md` §4) |
| Small multifamily | Unit-level rent rolls, NOI, cap rate, debt service | Rent rolls (uploaded), rent comps |

Competitive note (needs a proper pass): DealCheck already serves multi-strategy rental and flip analysis for individuals (`COMPETITIVE_ANALYSIS.md`), and PropIntel markets AI property intelligence from county tax, code violation and lien records in five metros. Northstar's differentiation stays the same: verifiable records, source permissions, and transparent strategy-specific models.

## 10. Open research questions (next actions)

1. Run 15 to 20 discovery interviews with Segment B/D operators (script in `GO_TO_MARKET.md`).
2. Measure baseline speed-to-lead and lead-to-contract rates for 3 to 5 design partners.
3. Verify each state statute in section 6 against primary text.
4. Confirm CRM API access terms for REsimpli, CarrotCRM and GoHighLevel.
5. Quantify real cost per contract from partners' marketing spend.

---

## Sources (all retrieved 2026-11-10)

- [S1] ATTOM, "Q1 2026 U.S. Home Flipping Report," published 2026-06-18. https://www.attomdata.com/news/market-trends/flipping/q1-2026-home-flipping-report/
- [S2] Redfin, "Investor Report Q1 2026," published 2026-05-28. https://www.redfin.com/news/investor-report-q1-2026/
- [S3] Connecticut DCP, "Real Estate Wholesalers Required to Register with DCP," 2026-06-25. https://portal.ct.gov/dcp/news-releases-from-the-department-of-consumer-protection/2026-news-releases/real-estate-wholesalers-required-to-register-with-dcp
- [S4] Beancount.io, "Real estate wholesaling assignment fees, state disclosure laws," 2026-09-25 (secondary). https://beancount.io/blog/2026/09/25/real-estate-wholesaling-assignment-fees-state-disclosure-laws-bookkeeping-guide
- [S5] BiggerPockets, "Oregon Clamps Down on Wholesaling With a New Law and Registry" (secondary). https://www.biggerpockets.com/blog/oregon-law-clamps-down-on-wholesalers
- [S6] Cooley, "FCC: AI-Generated Robocalls Illegal Under the TCPA," 2024-02-15. https://www.cooley.com/news/insight/2024/2024-02-15-fcc-ai-generated-robocalls-illegal-under-the-tcpa
- [S7] BiggerPockets forum, "Inaccurate PropStream data" (c. 2024). https://biggerpockets.com/forums/48/topics/1206319-inaccurate-propstream-data
- [S8] Trustpilot, PropStream reviews (4.6/5, 399 reviews). https://ie.trustpilot.com/review/propstream.com
- [S9] BiggerPockets forum, "Is Podio really that difficult to use for new wholesalers" (c. 2022). https://biggerpockets.com/forums/80/topics/1025321-is-podio-really-that-difficult-to-use-for-new-wholesalers
- [S10] TrustRadius, REsimpli review, 2024-08-13. https://www.trustradius.com/reviews/resimpli-2024-08-05-13-42-50
- [S11] Trustpilot, BatchLeads reviews (4.7/5, 1,360 reviews). https://www.trustpilot.com/review/www.batchleads.io
- [S12] Kelley Drye, "Eleventh Circuit Vacates TCPA 1:1 Consent Rule," 2025-01-25. https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/eleventh-circuit-vacates-tcpa-11-consent-rule
- [C1] to [C9]: competitor pricing sources, listed in `COMPETITIVE_ANALYSIS.md`.
