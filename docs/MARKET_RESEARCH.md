# Northstar Intelligence: Market Research

**Owner:** Head of Market Research
**Date:** 2026-11-14
**Scope:** Residential real estate wholesalers and investor acquisition teams in the US. This is the initial ICP for Northstar's first commercial product, which combines seller lead intelligence, CRM connectivity, AI qualification, follow-up automation, property data, initial underwriting, and appointment and pipeline management.
**Companion docs:** [`COMPETITIVE_ANALYSIS.md`](COMPETITIVE_ANALYSIS.md) · [`research/pricing-benchmarks.md`](research/pricing-benchmarks.md)

---

## How to read this document

- **Facts** carry an inline source and a retrieval date. "Retrieved 2026-11" means the page was fetched or the search was run on 2026-11-14.
- Sections and callouts labelled **Analysis** or **Inference** are Northstar's interpretation. They are not sourced facts.
- **Unverified** marks figures that come only from forums, vendor marketing, or aggregators we could not confirm against a primary source. Do not use them in investor materials without further checks.
- Vendor-authored comparisons are flagged because they are biased. REsimpli, DealMachine and Goliath, for example, all publish "best software" lists that rank themselves first.

---

## 1. Executive summary

1. **The market is real, but shrinking in volume and squeezed on margin.** Investors bought about 1.32M homes in 2025, down 4.5% from 2024 ([BatchData Investor Pulse Q4 2025 coverage via search](https://batchdata.io/investor-pulse-q4), retrieved 2026-11). Q2 2026 investor purchases were down 22% year over year ([BatchData Q2 2026](https://batchdata.io/investor-pulse-q2-2026), retrieved 2026-11). Typical flip gross margins fell to 21.5% in Q2 2026 from 27.6% a year earlier ([ATTOM Q2 2026 via search](https://www.attomdata.com/news/market-trends/flipping/home-flipping-profits-continue-gradual-two-year-decline/), retrieved 2026-11). **Inference:** buyers will pay for software that lowers cost per deal. They will cut software that only adds activity.
2. **Wholesaling is being regulated state by state, quickly.** A tracker updated October 21, 2026 counts **22 states plus Philadelphia** with wholesaling-specific laws in effect, and Rhode Island's law takes effect January 1, 2027 ([DealMachine tracker](https://dealmachine.com/blog/wholesaling-laws-by-state), retrieved 2026-11). Most of these laws arrived in 2023–2026. **Inference:** disclosure, cancellation-window and licensing logic belongs inside the workflow product. It is a differentiator, not a footnote.
3. **Cold outbound carries more legal risk every year.** TCPA filings were up 57.9% year to date through September 2025 versus 2024 ([JD Supra / WebRecon via search](https://www.jdsupra.com/legalnews/september-2025-litigation-update-tcpa-9385044/), retrieved 2026-11). The FCC has ruled that AI-generated voices are "artificial" voices under the TCPA, so they need prior express consent ([Orrick](https://www.orrick.com/insights/2024/02/Did-the-FCC-Really-Ban-AI-Generated-Voice-Calls-No-But-Restrictions-Apply), retrieved 2026-11). Carriers have blocked unregistered 10DLC traffic since early 2025 (secondary sources; see §8). **Inference:** AI cold calling to skip-traced numbers is a weak foundation. AI qualification of inbound and opted-in leads is a strong one.
4. **Tool sprawl is the most consistent pain.** Operators stitch together a data tool, a skip tracer, an SMS platform, a dialer, a CRM (often Podio or GoHighLevel), a website or PPC vendor, an underwriting calculator and a dispositions tool. Our illustrative stacks (§4) cost about **$600/mo for a solo operator, $2,100/mo for a small team, and $6,000+/mo for a scaled operation** in software alone, before marketing spend.
5. **Willingness to pay is bimodal.** Solo and beginner investors cluster at $0–$199/mo: DealCheck $0–$20, PropStream $99–$199, GHL $97. Teams that are already running paid lead generation routinely pay $497–$1,500/mo for a single function: Launch Control $497–$2,297, Left Main $500–$2,000 (third-party), Goliath $1,499–$7,499. Detail is in [`research/pricing-benchmarks.md`](research/pricing-benchmarks.md).

---

## 2. ICP definition and segmentation

### 2.1 Core ICP (recommended focus)

**A residential acquisition team of 2–10 people that:**
- generates 100+ seller leads a month across at least two channels, with at least one inbound channel (PPC, SEO, direct mail call-ins, or SMS replies);
- closes roughly 2–10 deals a month through any exit: assignment, double close, wholetail, novation or listing, or a buy-and-hold handoff;
- has at least one dedicated lead manager or acquisitions role, often offshore or virtual assistant callers;
- runs a CRM that is either a configurable general tool (Podio, GHL or GHL resellers) or an REI CRM (REsimpli, CarrotCRM/InvestorFuse, FreedomSoft, DataSift, Left Main).

**Why this segment (Analysis):** It feels the coordination cost of speed-to-lead, follow-up and underwriting consistency. It already pays $2k+/mo for software (§4). It is less fragile than solo operators. It is not yet locked into custom Salesforce builds like the top operators.

### 2.2 Segment map

| Segment | Typical profile (Analysis) | Primary jobs-to-be-done | Software budget signal | Fit for Northstar v1 |
|---|---|---|---|---|
| **Solo wholesalers** | 1 person, often new, part-time or early-stage. Heavy on cold SMS, cold calls and driving for dollars. | Find a list, reach owners cheaply, run a deal, find a buyer | Entry tools sit at $0–$199/mo: DealCheck $0/$10/$20 ([DealCheck](https://dealcheck.io/pricing/)), PropStream $99 ([PropStream](https://www.propstream.com/pricing)), GHL Starter $97 ([HighLevel](https://www.gohighlevel.com/pricing)). All retrieved 2026-11. | **Low–medium.** Price-sensitive and high churn (inference). Use as self-serve funnel, not core. |
| **Small acquisition teams (2–10)** | Owner plus 1–3 acquisition reps, 1–3 callers or VAs, sometimes a dispositions person | Speed to lead, consistent qualification, pipeline visibility, KPIs | Pay $497–$797/mo for single tools: Launch Control Lite/Core ([Launch Control](https://launchcontrol.us/pricing/)), FreedomSoft Scale $797 ([FreedomSoft](https://freedomsoft.com/pricing/)). Retrieved 2026-11. | **High: core ICP.** |
| **Scaled / virtual wholesalers (10–50+)** | Multi-market, often "virtual" (remote markets), call centers, PPC budgets, dedicated disposition teams | Lead routing, call-center management, attribution, compliance at scale | Left Main $500–$2,000/mo plus reported $3,000 implementation ([G2 via search](https://www.g2.com/products/left-main/pricing), third-party). Goliath $1,499–$7,499 ([Goliath](https://goliathdata.com/pricing)). Retrieved 2026-11. | **Medium–high** as an expansion segment. Needs Salesforce or Left Main integration and enterprise controls. |
| **Fix-and-flip operators** | Buy, renovate, resell. Often source from wholesalers plus their own marketing. | Accurate ARV and rehab estimates, quick offer decisions, project tracking | FreedomSoft includes repair estimator and rehab manager ([FreedomSoft](https://freedomsoft.com/pricing/), retrieved 2026-11). DealCheck for analysis. | **Medium.** Underwriting module is the hook. Rehab project management is out of scope for v1. |
| **Buy-and-hold / BRRRR investors** | Accumulate rentals. Small investors dominate ownership: owners of 1–10 homes hold ~96% of ~15.9M investor-owned homes ([BatchData Q2 2026](https://batchdata.io/investor-pulse-q2-2026), retrieved 2026-11). | Rental underwriting (cash flow, DSCR, refi), deal flow from wholesalers, portfolio tracking | DealCheck $0–$20/mo is the price anchor for analysis. | **Low for v1** as a direct buyer. **High as a buyer network** for wholesaler dispositions and as a later portfolio-module segment. |
| **Agents doing investor work** ("hybrid agents") | Licensed agents who market to motivated sellers and wholesale, list, or refer | Investor-style lead gen while staying compliant with license law | Carrot explicitly targets "real estate investors and hybrid agents" ([Carrot blog via search](https://carrot.com/blog/investorfuse-announcement/), retrieved 2026-11). Mojo dialer from $99/mo ([Mojo](https://www.mojosells.com/pricing), retrieved 2026-11). | **Medium and rising.** Licensing laws (PA, IL, VA, SC, KY, NE, IA, RI) push wholesalers toward licensure (inference; see §8). |

### 2.3 Segment sizing signals

> No reliable public census of wholesalers exists. Every count below is a proxy, and the weaker ones are labelled.

| Signal | Value | Source / status |
|---|---|---|
| Investor home purchases, 2025 (BatchData definition) | ~1.32M homes, −4.5% YoY vs 1.39M in 2024 | [BatchData Q4 2025 coverage via search](https://batchdata.io/investor-pulse-q4), retrieved 2026-11 |
| Investor share of purchases, Q2 2026 (BatchData) | 26.7% (five-quarter low). 284,068 purchases, −22% YoY (preliminary). | [BatchData Q2 2026](https://batchdata.io/investor-pulse-q2-2026), retrieved 2026-11 |
| Investor share, Q3 2025 (BatchData) | 34%, described as a five-year high | [National Mortgage Professional via search](https://nationalmortgageprofessional.com/news/investor-share-home-purchases-hits-five-year-high-q3), retrieved 2026-11 |
| Investor share, Q4 2025 (Redfin, ~38–39 large metros) | 18% of homes sold. 49,824 purchases, +2% YoY. | [Redfin Q4 2025](https://www.redfin.com/news/investor-report-q4-2025/), retrieved 2026-11 |
| Investor share, Q1 2026 (Redfin) | ~19% (vs 20% a year earlier). Purchases −6% YoY, the lowest Q1 since 2020. Low-priced home purchases −10%. | [Redfin Q1 2026 via search](https://www.redfin.com/news/investor-report-q1-2026/), retrieved 2026-11 |
| Flips, Q2 2026 (ATTOM) | 77,991 flips = 6.2% of sales. Typical gross profit $60,526 (21.5% margin) vs $71,000 (27.6%) in Q2 2025. | [ATTOM via search](https://www.attomdata.com/news/market-trends/flipping/home-flipping-profits-continue-gradual-two-year-decline/), retrieved 2026-11 |
| Investor-owned homes by portfolio size | ~15.9M investor-owned homes. 1–5 property owners hold 92.1%, 6–10 hold 3.9%, 1,001+ hold 2.2%. | [BatchData Q2 2026](https://batchdata.io/investor-pulse-q2-2026), retrieved 2026-11 |
| Number of active wholesalers | Forum post claims "90,000 in mid-2022 to about 20,000" by fall 2024, attributed to an unnamed data provider | **Unverified.** [BiggerPockets forum](https://biggerpockets.com/forums/311/topics/1209991-90-000-wholesalers-in-2022-and-now-there-ar-20-000-wolesalers-wha-happened), retrieved 2026-11 |
| PropStream user base | "Tens of thousands"; one aggregator says 40,000 users | **Unverified.** [Latka via search](https://getlatka.com/companies/propstream.com), retrieved 2026-11 |

**Why the shares differ:** Redfin classifies buyers by entity names (LLC, Inc, Trust, etc.) in large metros ([Redfin methodology](https://www.redfin.com/news/investor-report-q4-2025/)). BatchData uses a broader single-family definition. Use Redfin as the conservative figure and BatchData as the broad one.

#### Analysis: serviceable market scenarios

The table below is **illustrative arithmetic on stated assumptions, not a sourced statistic.** It frames how large an outcome the ICP can support.

| Scenario | Paying acquisition operations in the US (assumption) | Northstar blended ARPA (assumption) | Implied annual software spend pool |
|---|---|---|---|
| Conservative | 15,000 | $400/mo | $72M |
| Base | 30,000 | $500/mo | $180M |
| Expansive (incl. hybrid agents, flippers, BRRRR) | 60,000 | $450/mo | $324M |

**Rationale:** The wholesaler count is unverified, with forum claims of 20k–90k. PropStream alone may have tens of thousands of subscribers (unverified). Investor purchase volume of over 1M homes a year supports a fragmented base of tens of thousands of active buyers. **Implication:** this is a **venture-scale niche only with expansion** into adjacent investor workflows (underwriting, dispositions, portfolio) or adjacent verticals (land, agents). A wholesaler-only CRM tops out at a modest ARR ceiling. The "modular real estate operating system" vision is therefore commercially necessary, not decoration.

---

## 3. Current customer workflows (end to end)

> **Analysis:** This section synthesizes vendor feature sets (PropStream, REsimpli, FreedomSoft, Launch Control, BatchDialer, InvestorLift), forum threads, and the regulations in §8. It describes common practice, not a survey.

### 3.1 Workflow map

```
[1] List building  →  [2] Skip trace  →  [3] Outreach (cold call / SMS / mail / PPC / SEO / D4D)
        ↓                                       ↓
[4] Lead intake & routing  →  [5] Qualification call (LM)  →  [6] Underwriting (comps/ARV/repairs/MAO)
        ↓                                                            ↓
[7] Follow-up nurture (months)  ←—————— not ready ——————  [8] Appointment / offer (AM)
                                                                     ↓
[9] Contract + state disclosures  →  [10] Title/escrow & TM  →  [11] Dispositions (buyers list / InvestorLift / MLS)
                                                                     ↓
                                                        [12] Close, assignment fee, KPI attribution
```

### 3.2 Lead sources

| Channel | How it works | Typical tools (sourced pricing in pricing-benchmarks) | Pain / risk (Analysis unless cited) |
|---|---|---|---|
| **List pulling** | Filter owners by distress or equity signals: absentee, tax-delinquent, probate, pre-foreclosure, high equity, vacancy | PropStream, BatchLeads, DealMachine, DataSift, REsimpli, FreedomSoft, Goliath | Data staleness. Duplicate lists across vendors. "List stacking" across sources is manual unless done in DataSift or REsimpli. |
| **Skip tracing** | Append phones and emails to owners | PropStream 10–12¢/contact; FreedomSoft from 12¢; Launch Control 10–13¢; Lead Sherpa from 15¢; DataSift 12–15¢ or unlimited at $97/mo. All from vendor pricing pages, retrieved 2026-11. | Accuracy is a recurring complaint. A G2 AI summary for BatchLeads notes phone accuracy "can be inconsistent" ([G2 via search](https://g2.com/products/batchleads/reviews)). One 2022 single-user review claims ~38% accuracy (**anecdotal**; [SaaSWorthy via search](https://www.saasworthy.com/product/batchleads/reviews)). |
| **Cold calling** | VA or in-house callers using power, predictive or triple-line dialers | BatchDialer $95–$199/agent/mo (annual), Mojo $89–$139 dialer, smrtPhone $29–$99/seat | TCPA/DNC exposure. Caller-ID spam labelling (BatchDialer sells "phone reputation monitoring" and "auto number replacement"). Turnover of VA callers. |
| **Cold SMS** | Bulk text to skip-traced cell numbers, then manage replies | Launch Control $497–$2,297, Smarter Contact $199–$1,799, Lead Sherpa $0–$1,299, ReplySmart $97–$2,097 | 10DLC registration and blocking. TCPA litigation. Carrier fee increases. Daily send caps (e.g., Launch Control 750–4,500/day by plan). |
| **Direct mail** | Postcards and letters to lists, with inbound call tracking | DealMachine $0.58–$0.89/piece, PropStream from $0.57/postcard, FreedomSoft from $0.79/postcard | High cost per lead. Slow feedback loop. Georgia solicitation-notice rules (see §8). |
| **PPC / SEO** | Seller landing pages ("we buy houses"), Google Ads, LSAs | Carrot $99–$299/mo plus ad spend | High cost per click, but high intent. Inbound leads expect immediate response, so speed to lead is critical. |
| **Driving for dollars** | Tag distressed properties in an app while driving | DealMachine (included in all plans), PropStream mobile, BatchLeads, REsimpli | Low cost, slow. Data then goes through skip tracing and outreach. |
| **Referrals / agents / wholesaler JV** | Deals from agents, other wholesalers, bird dogs | CRM plus buyer list | Hard to track attribution. |

### 3.3 Lead management and acquisition calls

1. **Intake:** Leads arrive from SMS replies, call-ins (tracked numbers), web forms, and dialer dispositions. A typical team has at least 3–5 inbound "inboxes" (Analysis).
2. **Lead manager (LM) call:** The LM qualifies on four pillars: condition, timeline, motivation, price ("CTMP"), sometimes extended with occupancy, mortgage and liens, and decision-makers. Vendors now pitch AI for this step. Hey Rafi markets missed-call text-back, qualification and walkthrough booking ([Hey Rafi](https://heyrafi.com/blog/ai-for-real-estate-wholesalers)). Carrot's AI Suite includes an "Autonomous Lead Manager" ([Carrot](https://carrot.com/pricing/)). Both retrieved 2026-11.
3. **Handoff to acquisitions manager (AM):** The AM runs comps, builds an offer, and calls or visits the seller. Many teams book in-person appointments for higher-value deals.
4. **Follow-up:** Most leads are not ready on the first contact. A vendor guide claims sellers often respond only after the 4th or 5th touch (**vendor claim**; [Real Estate Skills via search](https://www.realestateskills.com/blog/ai-for-wholesaling-real-estate-guide)). REsimpli argues that treating first-call qualification as yes/no "leaves money on the table" ([REsimpli via search](https://resimpli.com/blog/can-ai-answer-qualify-seller-calls-for-real-estate/)). Retrieved 2026-11.

### 3.4 Underwriting

- **Inputs:** property facts (beds, baths, sqft, year built), sales comps, rental comps, repair estimate, liens and mortgage balance, holding and closing costs, and the buyer's required margin.
- **Output:** ARV, repair budget, maximum allowable offer (MAO) per exit strategy (assignment, wholetail, flip, rental, novation, or creative finance).
- **Tools:** DealCheck (flip, rental, BRRRR and multifamily calculators, $0–$20/mo; [DealCheck](https://dealcheck.io/pricing/)), PropStream comps, FreedomSoft "Market Analyzer & Dynamic Offer Generator" ($2,997 one-time power-up; [FreedomSoft](https://freedomsoft.com/pricing/)), BatchLeads "Reia AI" offer calculations ($19/mo; [BatchLeads](https://batchleads.io/pricing)), and spreadsheets. Retrieved 2026-11.
- **Pain (Analysis):** Underwriting quality depends on the AM. Repair estimates are guesses until a walkthrough. Teams lack a consistent, auditable "why did we offer X" record. This is the opening for Northstar's initial underwriting module.

### 3.5 Contracting

- Purchase agreement with assignment clause, eSigned (REsimpli, FreedomSoft and others include eSign).
- **New since 2023:** state-specific disclosures, cancellation windows, licensing thresholds, earnest-money escrow rules, and contract-duration caps. See §8. For example, Missouri requires a disclosure 14 days before signing, Connecticut caps contract length at 90 days, and Oklahoma requires escrow ([DealMachine tracker](https://dealmachine.com/blog/wholesaling-laws-by-state), retrieved 2026-11).

### 3.6 Dispositions

- Deal blast to an owned cash-buyer list (SMS or email), plus marketplaces such as InvestorLift. InvestorLift Mogul costs $497/mo or $1,997/yr and includes "God Mode" buyer ranking (Arizona only) ([InvestorLift](https://www.investorlift.com/pricing), retrieved 2026-11).
- REsimpli includes cash-buyer searches ([REsimpli](https://resimpli.com/pricing/)). PropStream sells an "Investor Outreach" add-on at $70/mo ([PropStream](https://www.propstream.com/pricing)). Retrieved 2026-11.
- Where licensing laws apply, more deals exit via MLS listing or referral (inference).

---

## 4. Typical tool stacks and monthly spend

> **Analysis:** These stacks are illustrative builds from **published list prices** retrieved 2026-11-14. Each price is sourced in [`research/pricing-benchmarks.md`](research/pricing-benchmarks.md). They exclude marketing spend (mail, PPC, data overages), which usually exceeds software spend for active teams.

### 4.1 Solo wholesaler ("lean stack")

| Function | Tool (list price) | Monthly |
|---|---|---|
| Lists and comps | PropStream Essentials | $99 |
| Skip tracing | 1,500 contacts × $0.12 (PropStream Essentials rate) | $180 |
| SMS | Smarter Contact Starter (quarterly billing $199/mo), 2,500 texts × $0.03, 3 numbers × $5 | $289 |
| CRM | Podio Plus, 1 user (~$11.20/user/mo as displayed) | ~$11 |
| Underwriting | DealCheck Pro | $20 |
| **Total** | | **≈ $600/mo** |

The all-in-one alternative is REsimpli Solo at $249/mo billed annually, before AI calling usage ([REsimpli](https://resimpli.com/pricing/)).

### 4.2 Small acquisition team (3–5 people)

| Function | Tool (list price) | Monthly |
|---|---|---|
| Lists and data | PropStream Pro (2 seats, free skip tracing via Connect) | $199 |
| SMS | Launch Control Core $797 + provider fee $55 | $852 |
| Dialer | BatchDialer Pro, 2 agents × $151 (annual billing) | $302 |
| CRM | DataSift Business (5 users) | $299 |
| Phones | smrtPhone Unlimited, 3 seats × $99 | $297 |
| Website / inbound | Carrot Individual | $119 |
| Underwriting | DealCheck Pro × 2 | $40 |
| **Total** | | **≈ $2,100/mo** |

### 4.3 Scaled / virtual operation (10–25 people)

| Function | Tool (list price) | Monthly |
|---|---|---|
| Lists and data | PropStream Elite (9 seats) | $699 |
| SMS | Launch Control Pro $1,497 + $85 provider fee | $1,582 |
| Dialer | BatchDialer Pro, 6 agents × $151 | $906 |
| CRM | Left Main "Launch" ($1,200, third-party listing) | $1,200 |
| Phones | smrtPhone Unlimited, 10 seats × $99 | $990 |
| Dispositions | InvestorLift Mogul | $497 |
| Inbound + AI | Carrot Individual $119 + AI Suite $99 | $218 |
| **Total** | | **≈ $6,100/mo** (plus reported $3,000 Left Main implementation) |

### 4.4 Observations (Analysis)

- **The spend is fragmented across 5–8 vendors.** REsimpli's marketing claims customers "save up to $4,048/year" by replacing four apps ([REsimpli](https://resimpli.com/wholesaling-crm/), vendor claim, retrieved 2026-11). This confirms consolidation is the dominant sales narrative, and it is already taken.
- **Usage costs (texts, minutes, skip traces, mail) are a large and volatile share** of the bill. A pricing model that makes usage predictable would itself be a differentiator.
- **Integrations are glued together with Zapier, Globiflow and native connectors.** smrtPhone lists native integrations with Podio, HighLevel, Left Main, InvestorFuse and DataSift ([smrtPhone](https://smrtphone.io/pricing/), retrieved 2026-11). A BiggerPockets poster explicitly wanted a stack that avoids Zapier "because of cost and clunkiness" ([BiggerPockets](https://biggerpockets.com/forums/80/topics/1219680-real-estate-wholesaling-technology-dream-stack-vs-essentials), Nov 2024, retrieved 2026-11).

---

## 5. Key pain points and complaints

Ranked by Northstar's judgement of frequency × severity × relevance to Northstar's capabilities (Analysis). Evidence is summarized, not quoted at length.

| # | Pain | Evidence (summarized) | Northstar relevance |
|---|---|---|---|
| 1 | **Tool sprawl and integration tax** | Podio needs Globiflow and Zapier. One forum user called Globiflow "expensive ($120 mo)" ([BiggerPockets via search](https://www.biggerpockets.com/forums/93/topics/874545-crm-of-choice-for-wholesalers)). Users say most Podio users "need a developer" ([BiggerPockets via search](https://www.biggerpockets.com/forums/898/topics/435593-rei-software-for-wholesalers?page=1)). After acquisition, BatchLeads and PropStream still require separate subscriptions and logins ([search summary of BatchLeads FAQ](https://batchleads.io/?p=273616)). All retrieved 2026-11. | **High.** Make CRM connectivity the core, not an afterthought. |
| 2 | **Slow speed to lead and inconsistent follow-up** | A wave of AI products targets this step: Hey Rafi (missed-call text-back, sub-60-second response), Carrot "Autonomous Lead Manager", REsimpli AI agents, FreedomSoft "Rapid Response" and "Lead Follow-Up" voice agents at $297/mo each ([FreedomSoft](https://freedomsoft.com/pricing/)). Vendors would not build this many products without demand (inference). | **High.** Directly maps to AI qualification and follow-up automation. |
| 3 | **Data quality: skip-trace accuracy and stale property data** | BatchLeads G2 summary: phone accuracy inconsistent. PropStream Trustpilot (4.6/5, 432 reviews) complaints include out-of-date or missing data ([Trustpilot](https://www.trustpilot.com/review/propstream.com)). DealMachine Trustpilot (3.4/5, 69 reviews) cites stale data ([Trustpilot](https://www.trustpilot.com/review/dealmachine.com)). Retrieved 2026-11. | **Medium.** Do not try to out-data PropStream. Offer multi-source waterfall and confidence scoring. |
| 4 | **Compliance anxiety and deliverability** | 10DLC blocking. T-Mobile fee changes effective January 2026 ([Twilio support via search](https://support.twilio.com/hc/en-us/articles/44609260499995-T-Mobile-Messaging-Carrier-Fee-Changes-January-2026)). Quiet-hours class actions ([Mondaq via search](https://www.mondaq.com/unitedstates/telecoms-mobile-cable-communications/1617926/set-telemarketing-to-snooze-telemarketing-quiet-hours-lawsuits-on-the-rise)). 22 state wholesaling laws. Vendors now market compliance: Smarter Contact "AI compliance protection" ([Smarter Contact](https://www.smartercontact.com/pricing)), Lead Sherpa "Compliance Monitoring Dashboard" ([Lead Sherpa](https://leadsherpa.com/pricing)), ReplySmart "opt-out shield" ([ReplySmart](https://www.replysmart.ai/)). Retrieved 2026-11. | **High.** Compliance-by-design is a credible wedge (see Competitive Analysis). |
| 5 | **Pricing opacity, credit systems and billing friction** | DealMachine reviewers object to a credit system charging for previously included actions, and to billing after cancellation ([Trustpilot](https://www.trustpilot.com/review/dealmachine.com)). PropStream low-star reviews focus on refunds and post-cancellation charges ([Trustpilot](https://www.trustpilot.com/review/propstream.com)). Left Main and Lead Sherpa are sales-led, with setup fees (Left Main $3,000 reported, third-party). REsimpli AI calling is "billed separately" with no rate shown on the pricing page ([REsimpli](https://resimpli.com/pricing/)). Retrieved 2026-11. | **Medium–high.** Transparent, capped usage pricing is a differentiator. |
| 6 | **Complexity and learning curve** | PropStream Trustpilot notes a learning curve and slow navigation. REsimpli Trustpilot (4.9/5, 1,038 reviews) is overwhelmingly positive, but its AI summary flags "clunky" navigation and dialer issues ([Trustpilot](https://www.trustpilot.com/review/resimpli.com)). GHL lacks wholesaling pipelines and property fields out of the box (per REsimpli review, vendor-biased; [REsimpli](https://resimpli.com/blog/gohighlevel-review-for-real-estate-investors/)). Retrieved 2026-11. | **Medium.** Opinionated defaults per segment. |
| 7 | **Inconsistent underwriting** | DealCheck exists as a separate tool. FreedomSoft sells its offer generator as a $2,997 one-time add-on. BatchLeads sells Reia AI separately. Fragmentation suggests no CRM "owns" underwriting (inference). | **High.** Underwriting at intake is a natural extension of qualification. |

**Review-data caveat:** Trustpilot notes that some profiles (REsimpli, DealMachine) are not actively invited or are unrepresentative. G2 and Capterra pages returned HTTP 403 to our fetcher, so G2 evidence above comes from search-result summaries. Treat review themes as directional.

---

## 6. Willingness-to-pay evidence

| Evidence | What it shows | Source (retrieved 2026-11) |
|---|---|---|
| Single-function SMS platforms at $497–$2,297/mo (Launch Control); $199–$1,799 (Smarter Contact); $149–$1,299 (Lead Sherpa) | Teams pay $500+/mo for **one channel** when it produces leads | [Launch Control](https://launchcontrol.us/pricing/), [Smarter Contact](https://www.smartercontact.com/pricing), [Lead Sherpa](https://leadsherpa.com/pricing) |
| Goliath: $1,499 / $2,999 / $7,499 per month | A data + CRM + AI voice bundle sells at enterprise-like prices to scaled ops | [Goliath](https://goliathdata.com/pricing) |
| FreedomSoft AI voice agents $297/mo each; "AI Acquire" $597/mo + $997 activation | AI acquisition labor is priced as a role replacement, not a feature | [FreedomSoft](https://freedomsoft.com/pricing/) |
| Left Main $500–$2,000/mo + $3,000 setup (reported) | Scaled teams accept setup fees and Salesforce-based customization | [G2 via search](https://www.g2.com/products/left-main/pricing), third-party |
| InvestorLift Mogul $497/mo | Dispositions tooling commands team-level pricing | [InvestorLift](https://www.investorlift.com/pricing) |
| DealCheck $0–$20/mo; Privy $37–$79/mo (third-party) | Pure analysis or data tools for individuals are low-price | [DealCheck](https://dealcheck.io/pricing/), [G2 via search](https://www.g2.com/products/privy-pro/pricing) |
| REsimpli: "AI Agents are now free on every plan" | AI **assist** features are being commoditized by an incumbent | [REsimpli](https://resimpli.com/pricing/) |
| Wholesale fee economics | Fees are widely variable. REISift guide says $2,000–$7,000 average. An InvestorLift community post claims $33,000 average (unsourced). | **Unverified / anecdotal**: [REISift](https://www.reisift.io/blog-posts/assignment-fee), [InvestorLift community](https://community.investorlift.com/the-lift-2/mastering-wholesale-business-strategies-how-data-community-and-innovation-are-driving-success-889) |

**Analysis: ROI framing.** If one incremental assignment is worth even the low end of the reported range (~$2k–$7k, unverified), then a $499/mo tool that produces **one extra deal per quarter** pays back about 1.3–4.7× (one deal of $2k–$7k against three months at $499, about $1.5k). Teams think in cost per deal, not cost per seat. Northstar's pricing page and onboarding should report "cost per qualified appointment" and "deals influenced" from day one.

---

## 7. Underserved segments and gaps (Analysis)

1. **Small inbound-heavy teams on Podio or GHL.** They have invested in custom builds and cannot easily switch to REsimpli or FreedomSoft without losing that work. They need an **intelligence layer** (qualification, underwriting, routing) that plugs into what they have. Most competitors are all-in-ones that want to replace the CRM.
2. **Compliance-burdened markets.** These include licensing states (PA, IL, VA, SC, KY, NE, IA, and RI from 2027) and disclosure and cancellation states (OR, OK, CT, MO, OH, DE, LA, MD, ND, WI, TX, TN, AZ, AL, IN). We did not find any competitor's pricing or feature page among those reviewed that advertises a state-by-state wholesaling disclosure and cancellation-window workflow. This should be validated with demos (it is a gap in **marketing**, possibly not in product).
3. **Hybrid agents and licensed wholesalers.** As laws push wholesalers to licensure, deals increasingly exit via listing or referral. Investor CRMs are built around assignment, and agent CRMs (Lofty, kvCORE, etc.) are not built around distressed-seller underwriting.
4. **Buy-and-hold investors as a buyer network.** About 96% of investor-owned homes belong to small investors ([BatchData](https://batchdata.io/investor-pulse-q2-2026)). Matching wholesaler inventory to buy-box criteria is a dispositions opportunity. InvestorLift covers it, but at $497/mo and with "God Mode" only in Arizona.
5. **Underwriting audit trail.** No mainstream product makes the offer rationale (comps used, repair assumptions, exit strategy, margin) a first-class, shareable object tied to the lead and the contract.

---

## 8. Regulatory headwinds and product implications

> Legal information summarized from trackers and law-firm publications. **This is not legal advice.** Each row should be confirmed against primary statutes before product logic is built on it.

### 8.1 State wholesaling laws (in effect or signed)

Primary source: [DealMachine "Wholesaling Laws by State" tracker, last updated Oct 21, 2026](https://dealmachine.com/blog/wholesaling-laws-by-state). Cross-checked against [Squatters.io 50-state tracker, reviewed Jul 5, 2026](https://squatters.io/blog/wholesaling-laws-by-state). Both retrieved 2026-11.

| Jurisdiction | Law | Effective | Key requirements (summary) |
|---|---|---|---|
| Illinois | 225 ILCS 454/1-10 (PA 101-0357) | 2019 | Dealing in assignable contracts 2+ times in 12 months requires a license |
| Oklahoma | HB 1148 (2021); SB 1075 (2025) | Nov 2021 / Nov 1, 2025 | License to market; pre-contract disclosure; Oklahoma escrow for earnest money; 2-business-day cancellation; missing disclosure voids contract (per Squatters) |
| Pennsylvania | Act 52 of 2024 (SB 1173) | Jan 2025 | Broker or salesperson license for covered wholesale transactions; disclosure of intent to assign; non-waivable seller cancellation. **Sources conflict:** DealMachine says "until later of 30 days or conveyance," Squatters says "whichever is first". |
| Philadelphia | Phila. Code 9-5202 | Apr 2023 (per DealMachine) | City Residential Property Wholesaler License, in addition to state requirements |
| Arizona | A.R.S. 44-5101 | 2022 | Written disclosures; seller may cancel before close of escrow if missing |
| Nebraska | LB 892 | 2022 | License to publicly market an equitable interest |
| Kentucky | HB 62 | Jun 2023 | License to advertise an equitable interest |
| Alabama | SB 228 (Act 2023-201) | Aug 2023 | Disclosures; 3-business-day assignment notice; penalties |
| Texas | SB 1577 | Jan 1, 2024 | Written disclosure of equitable interest, or it is treated as unlicensed brokerage |
| Wisconsin | 2023 Act 208 | 2024 | Notice to seller; rescission if not given |
| South Carolina | Act 204 | May 2024 | License to market property before taking title; brokerages barred from wholesaling for clients |
| Indiana | HEA 1068 | Jul 1, 2024 | Disclosure of unlicensed status. Squatters reports a 2-day rescission right; DealMachine says no statutory cancellation (**conflict**) |
| Iowa | HF 2394 | Jul 1, 2024 | Broker license or licensed representation; disclosures; penalties up to $10,000 or 10% of price |
| Virginia | HB 917 | Jul 2024 | License required at 2+ deals in 12 months |
| Georgia | SB 90 / HB 1292 | 2024 | Solicitation rules for unsolicited offers (header, fair-market-value notice). Affects mailers. Listed by Squatters only. |
| Tennessee | SB 909 / Pub. Ch. 72 | Mar 2025 | Bold disclosure; 3-business-day notice before assignment |
| Oregon | HB 4058 | Jul 1, 2025 | $300 registration plus background check; bold disclosure; 3-business-day cancellation for either side |
| North Dakota | HB 1125 | Aug 1, 2025 | Written disclosure to all parties |
| Maryland | HB 124 / SB 160 | Oct 1, 2025 | Two-sided disclosure; rescission rights |
| Ohio | SB 155 | Mar 2, 2026 | Separate signed 12-pt bold disclosure before contract; cancellation if omitted |
| Connecticut | Public Act 25-168 | Jul 1, 2026 | DCP registration ($285); disclosure report; 3-business-day cancellation; 90-day maximum to close; registered-wholesaler ID in marketing |
| Louisiana | HB 468 / Act 807 | Aug 1, 2026 | Disclosure; 1% minimum earnest money in escrow; 5-calendar-day rescission |
| Missouri | SB 973 | Aug 28, 2026 | Separate bold disclosure delivered **14 days before** signing |
| Delaware | SB 201 | Aug 2026 (disclosure); license from Feb 26, 2027 | State disclosure form; 21-calendar-day seller cancellation (per DealMachine) |
| Rhode Island | Licensing law signed Jun 23, 2026 | **Jan 1, 2027** | 2-deal licensing rule; disclosure to both sides; 3-business-day non-waivable cancellation |

**Pending, not law** (as of the trackers' dates): New Jersey A4278, Michigan HB 5366 (would make wholesaling licensed brokerage), Alabama HB 586, Pennsylvania HB 600 (second wholesaler license plus a statewide **do-not-solicit list**; dies at session end Nov 30, 2026), North Carolina HB 797 (passed House 103-0, stalled in Senate) (sources as above).

### 8.2 Outreach regulation (TCPA, DNC, quiet hours, AI voice, state mini-TCPAs)

| Development | Summary | Source (retrieved 2026-11) |
|---|---|---|
| FCC AI-voice declaratory ruling (Feb 8, 2024) | AI-generated or cloned voices count as "artificial" voices under the TCPA, so prior express consent is required. Not a ban on the technology. | [Orrick](https://www.orrick.com/insights/2024/02/Did-the-FCC-Really-Ban-AI-Generated-Voice-Calls-No-But-Restrictions-Apply) |
| One-to-one consent rule vacated (Jan 24, 2025) | Eleventh Circuit vacated the FCC rule (*Insurance Marketing Coalition v. FCC*). The FCC later deleted it. **Note:** some vendor blogs still wrongly cite it as effective in 2026. | [Kelley Drye](https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/eleventh-circuit-vacates-tcpa-11-consent-rule); [Mondaq](https://www.mondaq.com/unitedstates/telecoms-mobile-cable-communications/1654600/fcc-deletes-deletes-deletes-one-to-one-consent-tcpa-rule) |
| Consent revocation rule (Apr 11, 2025) | Honor revocation and DNC requests within 10 days (the period cited in the Mondaq summary); one confirmation text allowed within 5 minutes. Parts of the rule were delayed by one year (exact dates vary by source). | [Mondaq](https://www.mondaq.com/unitedstates/telecoms-mobile-cable-communications/1594580/fccs-tcpa-consent-revocation-rule-effective-april-11-2025); [Pierce Atwood](https://www.pierceatwood.com/alerts/fcc-deletes-tcpa-regulations-following-supreme-court-and-eleventh-circuit-rulings) |
| TCPA litigation surge | Filings +57.9% YTD through Sep 2025 vs 2024 (WebRecon). Class actions roughly doubled. December 2025: 222 cases, 68% class actions. | [JD Supra](https://www.jdsupra.com/legalnews/september-2025-litigation-update-tcpa-9385044/); [JD Supra Dec 2025](https://www.jdsupra.com/legalnews/december-2025-litigation-update-5845819/) |
| Quiet-hours suits | Wave of class actions over texts sent before 8am or after 9pm recipient time. FCC sought comment Mar 2025. A 2026 Delaware ruling held that consent makes quiet hours inapplicable, but this is unsettled. Damages $500–$1,500 per message. | [Mondaq](https://www.mondaq.com/unitedstates/telecoms-mobile-cable-communications/1617926/set-telemarketing-to-snooze-telemarketing-quiet-hours-lawsuits-on-the-rise); [NatLawReview](https://natlawreview.com/article/tick-tock-dont-get-caught-navigating-tcpas-quiet-hours) |
| Texas SB 140 (eff. Sep 1, 2025) | Texas mini-TCPA now covers texts. Annual registration plus $10,000 security for telephone solicitors. Expanded private right of action. A Nov 2025 settlement exempts texts sent **with prior consent** from registration. | [Jackson Walker](https://www.jw.com/news/insights-texas-tcpa-sb-140/); [NatLawReview](https://natlawreview.com/article/texas-puts-registration-hold-consent-based-marketing) |

### 8.3 A2P 10DLC and carrier rules

- Carriers moved from throttling to **blocking unregistered 10DLC traffic in early 2025**. Sources cite Feb 1 or Feb 3, 2025; these are secondary vendor sources ([Apten](https://apten.ai/blog/a2p-dlc-compliance-2026), [tech-insider](https://tech-insider.org/sms-deliverability-carrier-blocking-10dlc-2026/), retrieved 2026-11).
- **T-Mobile carrier fee changes effective January 2026** ([Twilio support](https://support.twilio.com/hc/en-us/articles/44609260499995-T-Mobile-Messaging-Carrier-Fee-Changes-January-2026), via search, retrieved 2026-11). AT&T (Apr 1, 2026) and Verizon (May 1, 2026) per-message increases are reported by one agency blog (**unverified**; [GHL Scale Up](https://www.ghlscaleup.com/blog/a2p-10dlc-fees-explained)).
- Market signal: Goliath limits texting credits to **"opted-in contacts only"** ([Goliath](https://goliathdata.com/pricing)). ReplySmart caps each number at 700 contacts and skips landlines ([ReplySmart](https://www.replysmart.ai/)). Smarter Contact advertises "guaranteed 2-day 10DLC approval" ([Smarter Contact](https://www.smartercontact.com/pricing)). Retrieved 2026-11.

### 8.4 What this implies for the product (Analysis)

1. **Jurisdiction rules engine.** Encode, per property state (and city, for Philadelphia):
   - license and registration requirements, including the "2+ deals in 12 months" thresholds;
   - the disclosure template and its delivery timing (Missouri: 14 days before signing; Ohio: before a binding contract);
   - the cancellation window (OK 2 business days; OR, CT and RI 3 business days; LA 5 calendar days; DE 21 calendar days; PA per statute);
   - contract-duration caps (CT 90 days), escrow rules (OK, LA), and marketing identifiers (CT registration ID; GA solicitation notice).

   Surface these as **blocking tasks** in the pipeline. Monetize as a Professional-tier feature, or as an add-on that law-firm partners can maintain.
2. **Consent ledger as a first-class object.** Record source, timestamp, channel and scope of consent per phone number. Recipient-local quiet hours. Revocation honored well inside the 10-day window, with keyword and AI intent detection. DNC and litigator scrubbing (BatchDialer already sells "DNC and litigator scrub"; [BatchDialer](https://batchdialer.com/pricing)).
3. **AI voice only on consented or inbound conversations.** Default the AI qualification agent to inbound calls, callbacks, missed-call text-back and opted-in SMS. Make outbound AI voice to cold lists **off by default**, behind legal acknowledgement. This is a deliberate contrast with vendors marketing AI cold calling.
4. **Exit-strategy-agnostic pipeline.** Support assignment, double close, novation, wholetail, listing and referral, so that licensed wholesalers and hybrid agents fit natively.
5. **10DLC-aware messaging.** Use brand and campaign registration, number pools, per-number caps and complaint-rate monitoring, or delegate to a registered partner (Smarter Contact, Twilio, Telnyx) rather than owning carrier relationships in v1.

---

## 9. Switching costs

| Switching cost | Detail | Implication (Analysis) |
|---|---|---|
| Data and history | Lead history, notes, call recordings, SMS threads, and offer history sit inside the incumbent CRM | Northstar must import from Podio, GHL, REsimpli, CarrotCRM, Left Main and CSV, or sit **alongside** the CRM to avoid migration entirely |
| Phone numbers and 10DLC | Moving SMS platforms means re-registering brand and campaign. ReplySmart quotes 3–10 business days for approval ([ReplySmart](https://www.replysmart.ai/)). | Do not force a phone migration in v1. Integrate with existing telephony (smrtPhone, BatchDialer, GHL LC Phone). |
| Custom builds | Podio and GHL users have paid developers or snapshot vendors (Fiverr and Upwork listings for Podio/Globiflow and GHL REI setups are abundant; [Upwork via search](https://www.upwork.com/services/product/development-it-podio-crm-system-with-advanced-globiflow-automation-2070226092250313380)) | Sunk-cost bias favors a layer that augments rather than replaces |
| Annual contracts and prepaid credits | BatchLeads offers 40% off for annual commitment, and its Enterprise tier is annual-only ([BatchLeads](https://batchleads.io/pricing)). DealMachine offers 17% off annual ([DealMachine](https://www.dealmachine.com/pricing)). Prepaid mail credit tiers run to $20,000 ([DealMachine](https://www.dealmachine.com/pricing)). | Time outreach to renewal cycles. Offer contract buy-outs for strategic logos. |
| Team habits and training | Callers, LMs and AMs trained on existing workflows | Opinionated templates and a guided first-30-days program |
| Setup fees already paid | Left Main reported $3,000 implementation (third-party). FreedomSoft one-time power-ups $1,997–$2,997. | These buyers are the hardest to dislodge. Target them only with a complementary module. |

---

## 10. Integration requirements (prioritized)

> **Analysis:** Based on which integrations competitors advertise and which tools appear in typical stacks.

| Priority | Integration | Why |
|---|---|---|
| P0 | **GoHighLevel** (API, webhooks; snapshot-compatible custom fields) | Large installed base via agencies and REI snapshots. REIReply is reported to be built on GHL white-label ([BiggerPockets via search](https://www.biggerpockets.com/posts/5633728)). Hey Rafi integrates with GHL, Podio and REIReply ([Hey Rafi](https://heyrafi.com/blog/ai-for-real-estate-wholesalers)). |
| P0 | **Podio** (API; Globiflow-compatible) | Legacy investor CRM. Progress re-established Podio as an independent product line in April 2025 (search summary; [Progress](https://www.progress.com/podio/pricing)). |
| P0 | **Telephony / SMS**: smrtPhone, BatchDialer, Twilio/Telnyx, Smarter Contact/Launch Control | Qualification needs call and text events and recordings |
| P0 | **Property data**: at least one bulk provider (ATTOM, BatchData API, or similar) plus user-supplied PropStream and other CSV exports | Underwriting needs property facts and comps. BatchData skip-trace plans start at $2,000/mo for 100k traces ([BatchData](https://batchdata.io/pricing)), so vendor choice matters for COGS. |
| P1 | REsimpli, CarrotCRM/InvestorFuse, DataSift, FreedomSoft, Left Main (Salesforce) | Displace-or-augment targets |
| P1 | Calendars (Google, Outlook), eSign (DocuSign or native), Zapier/Make | Appointment and contract steps |
| P2 | InvestorLift and buyer-list tools; title and escrow portals; QuickBooks | Dispositions and closing |

---

## 11. Weak assumptions in the brief (challenge)

1. **"The first product combines seven capabilities."** That bundle (lead intel, CRM, AI qualification, follow-up, property data, underwriting, pipeline) is almost exactly what REsimpli, FreedomSoft and Goliath already sell. Launching it as an all-in-one puts Northstar head-to-head with funded incumbents on their strongest ground. **Recommendation:** lead with the **qualification → underwriting → appointment** slice that plugs into existing CRMs. Earn the right to be the system of record later. See the Competitive Analysis wedge.
2. **"Seller lead intelligence" as a data play.** PropStream (Stewart-owned, now also owning BatchLeads and BatchDialer; [PropStream press release](https://www.propstream.com/news/propstream-announces-acquisition-of-batch-leads-and-batch-dialer-enhancing-its-ai-powered-real-estate-data-and-lead-generation-solutions), Jul 7, 2025) and BatchData have scale advantages in raw data. Northstar's intelligence should come from **conversation and outcome data** (what sellers said, which offers converted), not raw property records.
3. **The $199 Starter tier.** It sits above the $97–$149 floor of GHL ($97), REIReply ($99), ReplySmart ($97), DataSift ($149 with 3 users) and InvestorFuse legacy ($147). Competitors at that price usually include 3+ seats. A single-seat $199 tier without data or messaging will look expensive. See [`research/pricing-benchmarks.md`](research/pricing-benchmarks.md) for the full verdict.
4. **"Wholesalers" as a stable ICP.** Volume is contracting (investor purchases −22% YoY in Q2 2026 per BatchData). Margins are compressing (ATTOM). Laws are spreading. Design for **acquisition teams regardless of exit strategy**, so the business survives a structural shift from assignment to licensed or hybrid models.

---

## 12. Research gaps and next steps

| Gap | Proposed method |
|---|---|
| True count of active wholesale and acquisition operations | Buy a count from a data vendor (repeat-assignor entities in deed data), or survey PropStream/BatchLeads user communities |
| Actual monthly stack spend | 20–30 customer discovery interviews with a structured spend worksheet |
| G2/Capterra review mining (blocked to our fetcher) | Manual export of the 1–3 star reviews for REsimpli, PropStream, BatchLeads, FreedomSoft and GHL |
| Willingness to pay for compliance features | Van Westendorp pricing survey plus a fake-door test on the compliance add-on |
| AI qualification accuracy benchmarks | Pilot with 3–5 design partners. Vendor claims (e.g., Retell's 70–95% accuracy; [Retell](https://retellai.com/blog/how-to-automate-real-estate-lead-qualification-ai)) are not independent. |
| Legal validation of the rules engine | Engage counsel in PA, OK, OR, CT, MO and TX before shipping jurisdiction logic |
