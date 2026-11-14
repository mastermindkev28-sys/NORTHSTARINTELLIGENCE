# Northstar Intelligence: Competitive Analysis

**Owner:** Head of Market Research
**Date:** 2026-11-14
**Companion docs:** [`MARKET_RESEARCH.md`](MARKET_RESEARCH.md) · [`research/pricing-benchmarks.md`](research/pricing-benchmarks.md)

---

## How to read this document

- **Pricing** comes from each vendor's public pricing page, fetched on **2026-11-14**, unless marked *third-party* (G2, aggregators, competitor pages) or *unverified*. Vendors change pricing often, so re-check before external use.
- **Capability ratings** are based on the vendor's own pricing and feature pages plus search summaries. They have **not been hands-on tested.** Ratings: ● native/core · ◐ partial, add-on, or via integration · ○ not offered or not found.
- **Strengths and weaknesses** combine review-site themes (Trustpilot fetched directly; G2/Capterra via search summaries, because those sites returned 403) with Northstar analysis, labelled as such.

---

## 1. Market structure at a glance (Analysis)

The investor-software market is consolidating around four poles. A wave of AI-native point solutions is attacking the "lead manager" role in between them.

| Pole | Players | Gravity |
|---|---|---|
| **Data platforms moving downstream** | PropStream (Stewart; acquired BatchLeads and BatchDialer, announced Jul 7, 2025), BatchData, DealMachine, DataSift, Goliath | Own the list and the skip trace. Now adding dialers, CRM and AI. |
| **REI all-in-one CRMs** | REsimpli, FreedomSoft, REIPro, CarrotCRM (formerly InvestorFuse), Left Main (Salesforce-based) | Own the workflow and pipeline. Adding data and AI agents. |
| **Horizontal automation platforms** | GoHighLevel plus REI snapshots and resellers (e.g., REIReply), Podio plus templates | Own flexibility and price. Rely on agencies and consultants. |
| **Outreach channels** | Smarter Contact (acquired Launch Control, 2026), Lead Sherpa, ReplySmart, BatchDialer, Mojo, smrtPhone | Own SMS and voice deliverability and compliance |
| **AI-native acquisition agents** (emerging) | FreedomSoft AI Acquire, REsimpli AI agents, Goliath "David", Carrot AI Suite, Hey Rafi, plus a long tail of Retell/Vapi-based builds sold on Fiverr | Attack the lead-manager and caller labor line item |

**Key consolidation facts:**
- PropStream announced the acquisition of BatchLeads and BatchDialer on Jul 7, 2025 ([PropStream press release](https://www.propstream.com/news/propstream-announces-acquisition-of-batch-leads-and-batch-dialer-enhancing-its-ai-powered-real-estate-data-and-lead-generation-solutions), retrieved 2026-11). Products remained separate subscriptions at the time of the post-deal FAQ (search summary).
- Launch Control's site states it "has been acquired by Smarter Contact" ([Launch Control](https://launchcontrol.us/pricing/), retrieved 2026-11). A competitor page dates the close to Sep 2026 (**unverified**; [Goliath](https://goliathdata.com/landing/goliath-vs-launch-control/)).
- Carrot acquired InvestorFuse in 2022 and rebranded it as CarrotCRM ([Carrot](https://carrot.com/blog/investorfuse-announcement/); [Carrot CRM page](https://carrot.com/features/crm), retrieved 2026-11).

---

## 2. Capability matrix

Columns: **Data** = lead data / list building · **Skip** = skip tracing · **CRM** = CRM/pipeline · **Out** = outbound SMS/dialer · **AIQ** = AI qualification · **F/U** = follow-up automation · **Prop** = property data/comps · **UW** = underwriting · **TM** = transaction management · **Dispo** = dispositions · **Port** = portfolio management.

| Vendor | Data | Skip | CRM | Out | AIQ | F/U | Prop | UW | TM | Dispo | Port |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Northstar v1 (planned)** | ◐ | ◐ | ◐ (connect) | ◐ (via partners) | ● | ● | ● | ● | ○ | ○ | ○ |
| PropStream | ● | ● | ◐ | ◐ | ◐ | ◐ | ● | ◐ | ○ | ◐ | ○ |
| DealMachine | ● | ● | ◐ | ◐ | ◐ | ◐ | ● | ◐ | ○ | ○ | ○ |
| REsimpli | ● | ● | ● | ● | ● | ● | ◐ | ◐ | ◐ | ● | ○ |
| CarrotCRM (ex-InvestorFuse) + Carrot sites | ○ | ○ | ● | ◐ | ◐ | ● | ◐ | ○ | ● | ○ | ○ |
| GoHighLevel (generic) | ○ | ○ | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ |
| GHL REI snapshots / REIReply | ○ | ◐ | ● | ● | ● | ● | ○ | ◐ | ○ | ◐ | ○ |
| Podio + investor templates | ○ | ○ | ● | ◐ | ○ | ◐ | ○ | ◐ | ◐ | ◐ | ○ |
| FreedomSoft | ● | ● | ● | ● | ● | ● | ● | ● | ● | ◐ | ○ |
| DealCheck | ○ | ○ | ○ | ○ | ○ | ○ | ● | ● | ○ | ○ | ◐ |
| BatchLeads | ● | ● | ◐ | ◐ | ◐ | ◐ | ● | ◐ | ○ | ○ | ○ |
| BatchData (API) | ● | ● | ○ | ○ | ○ | ○ | ● | ○ | ○ | ○ | ○ |
| DataSift | ● | ● | ● | ◐ | ◐ | ● | ◐ | ○ | ○ | ○ | ○ |
| REIPro | ● | ● | ● | ◐ | ○ | ◐ | ● | ● | ◐ | ○ | ○ |
| Left Main (Salesforce) | ○ | ○ | ● | ◐ | ◐ | ● | ◐ | ◐ | ● | ◐ | ○ |
| Launch Control | ○ | ● | ◐ | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ |
| Smarter Contact | ○ | ● | ◐ | ● | ◐ | ● | ○ | ○ | ○ | ○ | ○ |
| Lead Sherpa | ◐ | ● | ◐ | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ |
| ReplySmart | ● | ● | ◐ | ● | ◐ | ● | ○ | ◐ | ○ | ○ | ○ |
| BatchDialer | ◐ | ○ | ○ | ● | ◐ | ○ | ◐ | ○ | ○ | ○ | ○ |
| Mojo | ◐ | ◐ | ◐ | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Privy | ◐ | ○ | ○ | ○ | ○ | ○ | ● | ◐ | ○ | ○ | ○ |
| InvestorLift | ○ | ◐ | ○ | ○ | ◐ | ○ | ◐ | ○ | ○ | ● | ○ |
| Goliath | ● | ● | ● | ● | ● | ● | ◐ | ○ | ○ | ○ | ○ |
| Hey Rafi (AI acquisitions assistant) | ○ | ○ | ○ | ◐ | ● | ● | ○ | ○ | ○ | ○ | ○ |
| Epique (agent brokerage, AI) | ○ | ○ | ◐ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ |

**Reading the matrix (Analysis):**
- **Nobody combines strong AI qualification with strong underwriting** except FreedomSoft, which sells AI voice agents at $297/mo each and its offer generator as a $2,997 one-time add-on. That is the gap Northstar's v1 combination targets.
- **Portfolio management is empty** across the investor-acquisition set. That is a long-term expansion lane for the "operating system" vision. Adjacent landlord tools (e.g., Stessa, Baselane) were not researched here.
- **Dispositions are thin** outside REsimpli (cash-buyer search) and InvestorLift.

---

## 3. Competitor profiles

> Every price below states its URL. All retrieved **2026-11-14** unless noted.

### 3.1 PropStream (a Stewart Information Services company)

- **Category:** Property data and lead-generation platform. It is now also the parent of BatchLeads and BatchDialer.
- **Core capabilities:** Nationwide property data, lead lists and filters, comps, skip tracing, "Lead Automator", postcards and email, click-to-dial (Pro and Elite), "PropStream Intelligence Assistant" and AI Search, mobile driving for dollars.
- **Overlap with Northstar:** Lead intel, property data/comps, follow-up (Lead Automator). Partial underwriting.
- **Pricing** ([propstream.com/pricing](https://www.propstream.com/pricing)):

  | Plan | Monthly | Annual (per month) | Saves/exports per month | Seats | Skip tracing |
  |---|---|---|---|---|---|
  | Essentials | $99 | $81 | 25,000 | 1 (+$30/mo each) | 12¢/contact |
  | Pro | $199 | $165 | 50,000 | 2 (up to 5 more at $30) | Free via Connect; extra 10¢ |
  | Elite | $699 | $583 | 100,000 | 9 | Free via Connect; extra 10¢ |

  Add-ons: Investor Outreach $70/mo; PropStream Connect bundle from $30/mo (Essentials); deeds $5 each; postcards from 57¢.
- **Strengths:** Data breadth and brand. Trustpilot 4.6/5 from 432 reviews ([Trustpilot](https://www.trustpilot.com/review/propstream.com)). Training and onboarding are praised. Parent-company balance sheet. Owning BatchLeads, BatchDialer and BatchData as a data source creates a consolidated data and outreach stack.
- **Weaknesses / complaints:** Stale or missing data in some markets, learning curve and slow navigation, refund and post-cancellation billing complaints ([Trustpilot](https://www.trustpilot.com/review/propstream.com)). Not a true CRM. Unused saves don't roll over.
- **Target segment:** Solo to mid-size investors and agents. The broadest top of funnel in the market.

### 3.2 DealMachine

- **Category:** Data platform with driving-for-dollars roots. Moving to credit-based, per-seat plans and API/AI agents.
- **Core capabilities:** Lists and data credits, driving for dollars (all plans), mail (usage-based), AI Search, AI Postcards, API, and AI-agent documentation.
- **Overlap:** Lead intel, property data, follow-up (mail). Partial AI.
- **Pricing** ([dealmachine.com/pricing](https://www.dealmachine.com/pricing)): The page lists Scale at **$599 per package/mo** (100K records, 10 seats) and states "Plans start at $99/mo". Annual saves 17%. Basic and Pro prices were not rendered in our fetch. Search summaries of DealMachine's own pages list **Basic $99/user/mo (10,000 credits) and Pro $149/user/mo (20,000 credits)** ([DealMachine blog via search](https://www.dealmachine.com/blog/how-dealmachine-pricing-works)). Mail costs $0.70–$0.89 per piece, or $0.58–$0.86 with prepaid tiers.
- **Strengths:** Driving for dollars UX. List filters (tax delinquency, probate, equity). A compliance-content engine (its wholesaling-laws tracker is the most current we found).
- **Weaknesses:** Trustpilot 3.4/5 from 69 reviews. Complaints cover billing and refunds, the shift to a credit system, app-redesign login issues, and stale data ([Trustpilot](https://www.trustpilot.com/review/dealmachine.com)). Product-direction churn ("classic" vs current plans).
- **Target segment:** Solo and small investors. Driving-for-dollars users.

### 3.3 REsimpli

- **Category:** REI all-in-one CRM. Arguably the category leader for small teams by mindshare.
- **Core capabilities:** List stacking and data, skip tracing, triple-line dialer, unlimited calling and SMS (fair use), eSign, cash-buyer search, drip campaigns, direct mail, websites, AI agents ("Gen 2").
- **Overlap:** Almost total. CRM, follow-up, AI qualification, data, dialer, dispositions.
- **Pricing** ([resimpli.com/pricing](https://resimpli.com/pricing/)): **Solo $249/mo billed annually** (1 user). Team (5 users) and Business (15 users) prices are not shown. "Save up to 29% with yearly." "AI Agents are now free on every plan." AI calling is "billed separately" with no rate shown. A 14-day trial.
  - *Conflicting third-party/cached data (unverified, possibly outdated):* REsimpli affiliate landing pages surfaced by search list Gen 2 tiers at $149 / $299 / $599 per month (billed yearly), AI calling at $0.50/min, AI SMS at $0.50/message, and per-agent prices of $99–$399/mo with a "Full AI Team" bundle at $1,099/mo ([search summary of resimpli.com partner pages](https://resimpli.com/ryan), retrieved 2026-11). The current pricing page contradicts the per-agent fees ("free on every plan").
- **Strengths:** Trustpilot 4.9/5 from 1,038 reviews, with heavy praise for support and onboarding ([Trustpilot](https://www.trustpilot.com/review/resimpli.com)). No feature gating across tiers. Aggressive content marketing (dozens of "vs" pages). Just made AI agents free, which compresses the price of AI assist.
- **Weaknesses:** Trustpilot AI summary notes some users find it clunky, with dialer issues. Trustpilot also flags that the company doesn't actively invite reviews ([Trustpilot](https://www.trustpilot.com/review/resimpli.com)). Pricing opacity on usage. All-in-one means replacing the existing CRM, which is a high switching cost.
- **Target segment:** Solo to 15-person wholesaling and flipping teams.

### 3.4 CarrotCRM (formerly InvestorFuse) and Carrot websites

- **Category:** Action-based lead-management CRM plus inbound SEO/PPC website platform.
- **Core capabilities:** Outreach sequences, KPIs, contracts, workflows, inbound call popups, transaction management (Scale), round-robin (Team). Carrot sites provide inbound seller lead generation. The AI Suite adds an Autonomous Lead Manager, AI lead scoring, AI summaries and call insights.
- **Overlap:** CRM, follow-up, AI qualification (via AI Suite), pipeline.
- **Pricing:**
  - CarrotCRM/InvestorFuse ([investorfuse.com/pricing](https://www.investorfuse.com/pricing)): CarrotCRM annual plans are shown as Essentials (3 users, 50 property reports/mo), Scale (5 users, 100 reports/mo) and Team (10 users, 200 reports/mo), each with **two unlabeled annual prices** ($703/$1,470; $1,825/$2,470; $3,559/$3,770 per year). Legacy InvestorFuse monthly plans: Essentials $147/mo (1 user), Pro $247/mo (5 users), Premium Beta $497/$377/mo (10 users). Extra users $20/mo on legacy plans. Non-refundable setup fee (amount not stated).
  - Carrot websites ([carrot.com/pricing](https://carrot.com/pricing/)): Individual $119/mo or $99/mo annual (includes the free CarrotCRM version); Agency $299/mo; **AI Suite add-on $99/mo** with usage limits.
- **Strengths:** Owns inbound (SEO/PPC) seller lead generation for investors. Long-standing brand. Bundled CRM gives Carrot a land-and-expand path.
- **Weaknesses (Analysis):** The pricing page is confusing, with two unlabeled prices per plan and "Everything in Pro" referencing a tier that doesn't exist ([InvestorFuse pricing](https://www.investorfuse.com/pricing)). No data or skip tracing. Relies on smrtPhone and other integrations for telephony.
- **Target segment:** Inbound-focused investors and hybrid agents. Teams of 3–10.

### 3.5 GoHighLevel (HighLevel)

- **Category:** Horizontal marketing automation, CRM and white-label SaaS platform for agencies.
- **Core capabilities:** CRM and pipelines, workflows, 2-way SMS and email, calling, funnels and websites, calendars, Conversation AI, Voice AI, reputation management. "Unlimited contacts and users."
- **Overlap:** CRM, outbound, AI qualification, follow-up, appointments. No property data or underwriting.
- **Pricing** ([gohighlevel.com/pricing](https://www.gohighlevel.com/pricing)):

  | Plan | Monthly | Annual |
  |---|---|---|
  | Starter | $97 | $970/yr |
  | Unlimited | $297 | $4,970/yr as displayed (higher than 12× monthly; likely a page error) |
  | Founder ("Pro") | $497 | $2,970/yr |
  | Enterprise | Custom | Custom |

  AI Employee add-on: Growth $50/mo or Unlimited $97/mo per sub-account. Usage-based charges for SMS, calls, Conversation AI and Voice AI; rates are not on the pricing page. Third-party summaries put Voice AI at about $0.045/min engine plus about $0.015/min voice, before tokens and telephony (**third-party**; [Trillet via search](https://trillet.ai/blogs/gohighlevel-voice-ai-options-built-in-vs-trillet-vs-others)).
- **Strengths:** Price, with a $97 entry and unlimited users. Huge agency and reseller ecosystem. Agencies can rebill AI and usage with markup ([HighLevel help center](https://help.gohighlevel.com/support/solutions/articles/155000008422-fixed-rate-rebilling-for-ai-products)). Ships AI features fast.
- **Weaknesses:** Generic. No wholesaling pipelines, motivated-seller stages or property fields out of the box (per a REsimpli review, vendor-biased; [REsimpli](https://resimpli.com/blog/gohighlevel-review-for-real-estate-investors/)). Quality depends on the snapshot or agency. Usage costs are opaque.
- **Target segment:** Agencies and tech-savvy operators. Through resellers, any SMB vertical including REI.

#### 3.5a Real estate GHL snapshots and resellers (REIReply and others)

- **What they are:** Pre-built GHL sub-account templates ("snapshots") with investor pipelines (e.g., cash buyers, FSBO, failed listings), sold one-time or bundled with white-label subscriptions ([SupplyGem](https://supplygem.com/gohighlevel-real-estate-snapshot/); [GHL snapshot preview](https://app.gohighlevel.com/v2/preview/9SjyAWdVlYEGTkOJhCeu), retrieved 2026-11).
- **REIReply:** Reported to be built on GHL's white-label plan ([BiggerPockets via search](https://www.biggerpockets.com/posts/5633728)). The homepage shows "just $99" with no billing period stated ([reireply.com](https://reireply.com/)). A secondary source cites a separate AI tier at $997 setup + $297/mo (**unverified**; [Real Estate Skills via search](https://www.realestateskills.com/blog/ai-for-wholesaling-real-estate-guide)).
- **Implication (Analysis):** GHL lets any agency launch a "wholesaler CRM" in days. This is the main price-compression threat at the low end.

### 3.6 Podio (Progress) and investor Podio templates

- **Category:** General-purpose work-management platform, customized into REI CRMs via templates, Globiflow automation and Zapier.
- **Core capabilities:** Custom apps and fields, workflows, automation (Premium tier and add-ons), client access with free external licenses.
- **Overlap:** CRM/pipeline. Partial follow-up, TM and dispositions, depending on the build.
- **Pricing** ([progress.com/podio/pricing](https://www.progress.com/podio/pricing)): Free ($0, up to 5 users, 100 items); Plus ~$11.20/user/mo; Premium ~$19.20/user/mo (25,000 automation actions/mo). The page displays "11.2014" and "19.2024", likely a formatting error. Automation add-ons run $49–$699/mo (monthly) or $39–$559 (annual) for 100K–5M actions.
- **Common investor templates:** Podio App Market "Real Estate Investment Pack" ([Podio market](https://podio.com/market/packs/190459-real-estate-investment-pack)). A large freelance market sells custom REI Podio/Globiflow builds ([Upwork via search](https://www.upwork.com/services/product/development-it-podio-crm-system-with-advanced-globiflow-automation-2070226092250313380)). Lead Sherpa and smrtPhone advertise Podio integrations ([Lead Sherpa](https://leadsherpa.com/pricing); [smrtPhone](https://smrtphone.io/pricing/)).
- **Strengths:** Cheap per seat. Infinitely customizable. Large installed base among long-tenured wholesalers.
- **Weaknesses:** Needs developers, Globiflow and Zapier. Forum users describe Globiflow as about $120/mo and say most users "need a developer" (BiggerPockets via search; see Market Research §5). Aging UX. Ownership changes: Progress re-established Podio as an independent product line in Apr 2025 (search summary).
- **Target segment:** Legacy wholesalers and teams with an in-house "systems" person.

### 3.7 FreedomSoft

- **Category:** REI all-in-one (data + CRM + phone + mail + websites) with AI voice agents.
- **Core capabilities:** List building, skip tracing, built-in phone, direct mail, KPI dashboard, repair estimator, rehab manager, website builder, eSignature, unlimited comps, AI voice agents.
- **Overlap:** The closest full overlap with Northstar's v1 bundle, including underwriting (repair estimator and offer generator).
- **Pricing** ([freedomsoft.com/pricing](https://freedomsoft.com/pricing/)):

  | Plan | Monthly | Annual (per month) | Users | Lead downloads/mo |
  |---|---|---|---|---|
  | Start | $197 | $147 | Up to 6 | 3,000 |
  | Grow | $297 | $247 | Up to 8 | 6,000 |
  | Scale | $797 | $597 | 12 | 12,000 |

  Usage: skip tracing from $0.12; SMS $0.04 to send or receive; voice $0.03/min; **AI voice $0.35/min**. AI voice agents (Live Answer, Rapid Response, Lead Follow-Up, Re-engagement) cost **$297/mo each**. **AI Acquire** (unlimited agents) costs $597/mo + $997 activation (Founders promo). Power-ups: MLS data $97/mo; Market Analyzer & Dynamic Offer Generator $2,997 one-time; Automator Suite $1,997 one-time.
- **Strengths:** Breadth. Generous seat counts at entry (6 users at $197). Explicitly prices AI as labor ("full team").
- **Weaknesses (Analysis):** One-time "power-up" fees of $1,997–$2,997 signal upsell-heavy monetization. Underwriting is gated behind those fees. Review data was not retrieved, so complaints are unverified.
- **Target segment:** Small to mid-size wholesale and flip teams.

### 3.8 DealCheck

- **Category:** Deal analysis and underwriting calculator (rental, flip, BRRRR, multifamily, wholesale).
- **Overlap:** Underwriting and property comps only.
- **Pricing** ([dealcheck.io/pricing](https://dealcheck.io/pricing/)): Starter $0 (15 saved properties); Plus $10/mo; Pro $20/mo (unlimited). Annual offers "3 months free".
- **Strengths:** Cheap. Strong brand among buy-and-hold investors. Branded reports.
- **Weaknesses (Analysis):** Standalone. No lead or CRM workflow. Underwriting is detached from the seller conversation.
- **Target segment:** Individual investors of all types. A price anchor for "calculator-only" underwriting.

### 3.9 BatchLeads / BatchData (now under PropStream/Stewart)

- **Category:** BatchLeads is a data + lead-management app. BatchData is a property and skip-trace data API.
- **Core capabilities:** Lists, auto-enriched contact info, BatchRankAI scoring, driving for dollars, mail. Add-ons: Dialer AI ($89/mo) and Reia AI ($19/mo for property analysis, scripts and offer calculations).
- **Overlap:** Lead intel, property data, partial AI and underwriting.
- **Pricing:**
  - BatchLeads ([batchleads.io/pricing](https://batchleads.io/pricing)): Growth $119/mo (3 users, 10k leads/mo); Professional $349 (8 users, 35k); Scale $749 (26 users, 75k); Enterprise custom (annual only, up to 1M leads). 40% off for annual prepay. Extra leads and exports 4¢.
  - BatchData skip tracing ([batchdata.io/pricing](https://batchdata.io/pricing)): $2,000/mo (100k traces), $5,000 (300k), $10,000 (750k), $20,000 (3M).
- **Strengths:** Generous seats and records. Contact data bundled into leads. Now part of the largest data group.
- **Weaknesses:** Phone-number accuracy inconsistent (G2 summary via search). Cost adds up. Weak Podio integration (SaaSWorthy summary). Post-acquisition product overlap with PropStream creates roadmap uncertainty.
- **Target segment:** Solo to scaled wholesalers. BatchData serves proptech builders, including potential Northstar suppliers.

### 3.10 DataSift (formerly REISift)

- **Category:** Data + list-stacking CRM.
- **Pricing** ([datasift.ai/pricing](https://www.datasift.ai/pricing)): Professional $149/mo (3 users, 10k new properties); Business $299 (5 users, 25k); Expert $499 (15 users, 50k, unlimited skip tracing); AI $1,250 (30 users, 100k, AI scores). Unlimited skip tracing add-on $97/mo. AI score add-ons $297 each.
- **Strengths:** List stacking and "sifting". Unlimited skip tracing at higher tiers. Explicit AI tier.
- **Weaknesses (Analysis):** Telephony and SMS via integrations. Underwriting not a focus.
- **Target segment:** Data-driven small and mid-size wholesale teams.

### 3.11 REIPro

- **Category:** REI all-in-one (lead gen, mail, skip tracing, 10-step workflow, comps, deal analyzer).
- **Pricing:** **Not shown** on [myreipro.com/pricing](https://www.myreipro.com/pricing) in our fetch. Aggregators list Standard $97, Standard PLUS $129 and Team $197/mo, or $57/mo annual (**unverified, third-party**; [SourceForge](https://sourceforge.net/software/product/REIPro), [SaaSworthy](https://www.saasworthy.com/product/reipro)). One index describes pricing as sales-led ([xpay](https://www.xpay.sh/saas-pricing/reipro/)).
- **Assessment (Analysis):** Low-price incumbent with limited AI and momentum signals. Low threat.

### 3.12 Left Main REI (Salesforce-based)

- **Category:** Enterprise-grade REI CRM on Salesforce for scaled operations.
- **Pricing:** Not public on the vendor site (sales-led). G2 lists Starter $500, Launch $1,200 and Enterprise $2,000 per month, updated Mar 10, 2026 (**third-party**; [G2 via search](https://www.g2.com/products/left-main/pricing)). Reported $3,000 implementation fee and $80 per extra user (**unverified**).
- **Strengths (Analysis):** Salesforce extensibility, reporting and permissions for 10–50+ seat operations.
- **Weaknesses (Analysis):** Cost, setup, consultant dependence.
- **Target segment:** Scaled and virtual wholesalers. **Relevance:** an integration target, not a v1 competitor.

### 3.13 Launch Control (now owned by Smarter Contact)

- **Category:** Bulk SMS for investors.
- **Pricing** ([launchcontrol.us/pricing](https://launchcontrol.us/pricing/)): Lite $497/mo (12,500 SMS; +$22 provider fee); Core $797 (25,000; +$55); Pro $1,497 (60,000; +$85); Pro Plus $2,297 (90,000; +$135); Enterprise custom. Skip tracing $0.10–$0.13. Daily limits 750–4,500. A second plan table on the same page shows different message counts and fees.
- **Strengths:** Established among SMS-first wholesalers. Done-for-you content.
- **Weaknesses (Analysis):** Pure channel, exposed to TCPA and carrier risk. Pricing page inconsistencies. Ownership transition.

### 3.14 Smarter Contact

- **Category:** SMS and calling platform for real estate. Consolidator, having acquired Launch Control.
- **Pricing** ([smartercontact.com/pricing](https://www.smartercontact.com/pricing)): Pay-as-you-go messaging (billed quarterly): Starter $199/mo (1 seat, $0.03/text), Pro $399 (2 seats), Elite $499 (3 seats, unlimited volume, $0.02/text). Yearly $169 / $339 / $419. Committed use: Elite Plus $799–$1,799/mo for 20k–100k texts. Calling plans $199–$499/mo. Extra seats $99–$199. The **AI Bundle** (compliance protection, campaign monitoring, tone analysis) is included; AI message drafts are "coming soon". "No 3rd party 10DLC registration" and "guaranteed 2-day 10DLC approval".
- **Strengths:** Compliance tooling. Scale after the Launch Control deal.
- **Weaknesses (Analysis):** Channel-only. AI is focused on compliance, not qualification, today.

### 3.15 Lead Sherpa

- **Category:** SMS prospecting + skip tracing + list building (PropStack).
- **Pricing** ([leadsherpa.com/pricing](https://leadsherpa.com/pricing)): Free $0 (900 SMS/mo); Starter $149 (15,000 SMS/mo); Core $499 (45,000); Pro $1,299 (100,000). Bundled free skip traces (the mapping to tiers is our inference). Skip tracing from $0.15/record. Excludes Telnyx/Twilio provider charges. Podio and Zapier integrations; compliance monitoring dashboard.
- **Note:** Third-party listings show different prices ($250–$500 starting), which suggests recent repricing ([Capterra via search](https://www.capterra.com/p/231666/Lead-Sherpa/)).

### 3.16 BatchDialer (under PropStream/Stewart)

- **Category:** Predictive and power dialer for real estate.
- **Pricing** ([batchdialer.com/pricing](https://batchdialer.com/pricing)): **per agent, billed annually:** Starter $95/mo (3 lines), Pro $151 (5 lines, AI coaching and call summaries), Enterprise $199. Monthly-billing price is not stated; struck-through annual figures imply $119 / $189 / $249 (our inference). Includes DNC and litigator scrub and phone-reputation monitoring. Lead-list add-ons $49–$119/mo.
- **Relevance:** Integration partner for call events and recordings. Its AI is coaching, not qualification.

### 3.17 Mojo

- **Category:** Dialer and lead-management for agents and investors.
- **Pricing** ([mojosells.com/pricing](https://www.mojosells.com/pricing)): Agent Access $10/user/mo plus Single Line Dialer $89/mo or Triple Line $139/mo. Data add-ons $25–$50 (skip tracer $49, pre-foreclosures $49/county, expired leads $50/area).
- **Relevance:** Represents the agent side of "agents doing investor work". Low AI.

### 3.18 Privy

- **Category:** On-market investor deal finding and comps (MLS-based).
- **Pricing:** Not retrieved from the vendor (pricing URL returned 404). G2 lists Agent $37/mo and Investor $47 (1 state) / $79 (3 states) per user per month (**third-party**; [G2 via search](https://www.g2.com/products/privy-pro/pricing)).
- **Relevance:** On-market underwriting and comps. A potential data feature, not a direct competitor.

### 3.19 InvestorLift

- **Category:** Dispositions marketplace and buyer intelligence.
- **Pricing** ([investorlift.com/pricing](https://www.investorlift.com/pricing)): Marketplace free. **Mogul $497/mo or $1,997/yr** per seat (14-day free trial), including "God Mode" buyer ranking (Arizona only) and LiftGPT. The page lists no buyer premium or assignment fee.
- **Relevance:** Complements Northstar (dispositions). A later integration or partnership candidate. Its annual price (~$166/mo equivalent) shows deep annual discounting.

### 3.20 Goliath Data

- **Category:** Data + CRM ("Command Center") + AI voice ("David") for scaled operators.
- **Pricing** ([goliathdata.com/pricing](https://goliathdata.com/pricing)): Ramp $1,499/mo (5 seats, 5,000 skip traces, 10,000 texting credits to **opted-in contacts only**, 10,000 AI tokens); Growth $2,999 (10 seats); Scale $7,499 (20 seats).
- **Relevance:** Shows the high end of willingness to pay. Notable for **consent-only texting** and **token-metered AI**, both of which validate Northstar's direction.

### 3.21 ReplySmart (AI-assisted outbound)

- **Category:** SMS + calling + lead finder + skip trace + AI reply drafts for wholesalers.
- **Pricing** ([replysmart.ai](https://www.replysmart.ai/)): $97–$2,097/mo by SMS volume (0–100k segments) plus $70 setup. Credits: SMS 2.5¢, call minute 30¢, property pull 2¢, skip match 6¢, **AI-drafted reply 5¢**, phone number $3/mo.
- **Relevance:** A clear example of **per-action AI pricing** at 5¢ per draft, with a human in the loop.

### 3.22 AI acquisition-agent startups and builders

| Player | What it does | Pricing | Source |
|---|---|---|---|
| Hey Rafi | AI acquisitions assistant: missed-call text-back, qualification, routing, walkthrough booking. Integrates with Podio, REIReply, GHL. | Not public (demo-led) | [heyrafi.com](https://heyrafi.com/blog/ai-for-real-estate-wholesalers) |
| FreedomSoft AI Acquire | Voice agents for live answer, rapid response, follow-up, re-engagement | $297/agent/mo; $597/mo + $997 for unlimited; $0.35/min | [FreedomSoft](https://freedomsoft.com/pricing/) |
| Goliath "David" | AI voice and follow-up inside a data + CRM bundle | From $1,499/mo (token-metered) | [Goliath](https://goliathdata.com/pricing) |
| Carrot AI Suite | Autonomous Lead Manager, AI lead scoring, call insights | $99/mo add-on with usage limits | [Carrot](https://carrot.com/pricing/) |
| REsimpli AI Agents | Lead manager and co-pilot agents | "Free on every plan" (current page); AI calling billed per use | [REsimpli](https://resimpli.com/pricing/) |
| Retell / Vapi-based custom builds | Agencies and freelancers sell AI cold callers for wholesalers (VAPI, Retell, ElevenLabs, n8n, GHL, Twilio) | Varies; not benchmarked | [Fiverr listing via search](https://fiverr.com/destiny_precise/ai-sdr-cold-calling-with-vapi-retell-ai-for-real-estate); [Retell guide](https://retellai.com/blog/how-to-automate-real-estate-lead-qualification-ai) |

**Epique:** Epique Realty is an AI-forward agent brokerage. It launched "Epique OS" (CRM, AI tools, training) for its agents in Jul 2026 ([Newswire via search](https://www.newswire.com/news/epique-realty-launches-epique-labs-and-unveils-epique-os-the-all-in-one)). We found **no** investor or wholesaler product. It is not a direct competitor and is relevant only to the hybrid-agent segment.

---

## 4. Positioning map (Analysis)

**Axes:** X = **breadth** (point solution → all-in-one system of record). Y = **intelligence depth** (manual/rules → AI that makes decisions on qualification and underwriting).

```
 Intelligence depth (AI decisions: qualification + underwriting)
  ▲
  │                                   Goliath ($1.5k–7.5k)
  │      [NORTHSTAR TARGET]              FreedomSoft + AI Acquire
  │      AI qualification +
  │      underwriting layer               REsimpli (AI agents free)
  │      that plugs into any CRM
  │  Hey Rafi                              
  │  ReplySmart     Carrot AI Suite        DataSift AI tier
  │                                  GHL + AI Employee / REI snapshots
  │  BatchLeads Reia/Dialer AI              
  │  Smarter Contact (AI compliance)        PropStream (AI search)
  │  DealCheck   Privy                       DealMachine
  │  Launch Control  Lead Sherpa         CarrotCRM   Left Main
  │  BatchDialer  Mojo  InvestorLift     Podio + templates   REIPro
  └──────────────────────────────────────────────────────────────────►
     Point solution                                   All-in-one / system of record
```

**Read-out:** The upper-right is crowding (REsimpli, FreedomSoft, Goliath). The **upper-left/center** (a deep-intelligence layer that is CRM-agnostic) has only small, unproven players (Hey Rafi, ReplySmart), none of which combine qualification with underwriting and compliance.

---

## 5. Where competitors are NOT interchangeable (Analysis)

| Not interchangeable because… | Example | Implication for Northstar |
|---|---|---|
| **Data depth and coverage** | PropStream, BatchData and DealMachine own nationwide records and skip-trace pipelines. CRMs resell them. | Don't compete on raw data. Integrate and let users bring their own. |
| **Channel deliverability and registration** | Smarter Contact/Launch Control and Lead Sherpa handle 10DLC, number pools and carrier relations | Partner. Don't own carrier relationships in v1. |
| **System-of-record lock-in** | REsimpli, FreedomSoft and Left Main hold years of lead history. Podio and GHL hold custom builds. | Be additive. Win without migration. |
| **Inbound lead generation** | Carrot owns SEO/PPC sites for investors | Integrate with Carrot's lead feed. Target its customers' speed-to-lead problem. |
| **Dispositions network** | InvestorLift's buyer marketplace has network effects | Partner. Don't build a marketplace in v1. |
| **Price floor** | GHL ($97, unlimited users) and DealCheck ($0–$20) set psychological anchors | Avoid the $99 knife fight. Price on outcomes. |

---

## 6. White-space opportunities (Analysis)

1. **CRM-agnostic AI deal desk.** Qualification, underwriting and appointment-setting that runs on top of GHL, Podio, REsimpli, CarrotCRM and Left Main. Most AI agents today are locked into their parent CRM (FreedomSoft, REsimpli, Goliath, Carrot).
2. **Underwriting at the point of conversation.** Pull property data and comps while the seller is on the phone or in SMS. Produce a draft MAO per exit strategy with an auditable rationale before the AM touches the lead. Today underwriting is a separate tool (DealCheck) or a paywalled add-on (FreedomSoft $2,997; BatchLeads Reia $19/mo).
3. **Compliance-by-design for wholesaling law plus TCPA.** A jurisdiction rules engine (disclosures, cancellation windows, licensing thresholds) plus a consent ledger. Channel vendors cover SMS compliance (Smarter Contact, Lead Sherpa, ReplySmart). None we reviewed markets state wholesaling-law workflow inside the CRM (needs demo validation).
4. **Outcome analytics.** Cost per qualified appointment and cost per contract by source, rep and AI agent, across fragmented tools. Every team asks "which channel pays?" and the evidence is anecdotal (see Market Research §6).
5. **Exit-strategy flexibility for licensed and hybrid operators.** Assignment, list and referral in one pipeline, as licensing laws spread.
6. **Long-term:** portfolio and asset management for buy-and-hold. This is empty in the acquisition-tool set and fits the "operating system" vision.

---

## 7. Recommended competitive wedge

### 7.1 The wedge (Analysis / recommendation)

> **"The AI acquisitions desk that works inside your existing CRM."** Every inbound or opted-in seller lead is answered in under a minute, qualified (condition, timeline, motivation, price), underwritten (property data, comps, ARV range, repair band, MAO by exit strategy), checked for compliance (consent, quiet hours, state wholesaling rules), and booked onto an AM's calendar. All of it is written back to GHL, Podio, REsimpli, CarrotCRM or Left Main.

**Initial target:** small acquisition teams (2–10) that spend on **inbound or consented channels**: PPC, SEO (Carrot sites), direct mail call-ins, SMS replies, and missed calls.

### 7.2 Why this wedge

| Reason | Evidence |
|---|---|
| **Avoids a head-on fight with all-in-ones** | REsimpli, FreedomSoft and Goliath already sell the full v1 bundle (matrix §2). REsimpli just made AI agents free ([REsimpli](https://resimpli.com/pricing/)), so competing on "all-in-one + AI" means competing on price with a well-reviewed incumbent. |
| **Removes the migration objection** | Podio and GHL users have sunk custom builds. REsimpli and Left Main users have years of history (Market Research §9). A layer sells without migration. |
| **Targets the labor line item, where willingness to pay is highest** | AI agents are priced as roles: FreedomSoft $297/agent or $597 for unlimited, Goliath from $1,499 ([FreedomSoft](https://freedomsoft.com/pricing/); [Goliath](https://goliathdata.com/pricing)). |
| **Legally durable** | AI voices need prior express consent ([Orrick](https://www.orrick.com/insights/2024/02/Did-the-FCC-Really-Ban-AI-Generated-Voice-Calls-No-But-Restrictions-Apply)). TCPA filings are surging (Market Research §8). Inbound and opted-in-first AI avoids the riskiest use case that competitors and freelancers promote (AI cold calling). |
| **Underwriting is the defensible differentiator** | Qualification alone is commoditizing (GHL Conversation AI, REsimpli free agents). Qualification plus underwriting plus compliance is not offered as a CRM-agnostic layer by anyone we found. |
| **Builds a proprietary data asset** | Conversation outcomes, offer-versus-close data and repair-band calibration compound over time. Raw property data does not, because PropStream and BatchData own that. |

### 7.3 What this means for scope (recommendation)

- **Build in v1:** AI qualification (SMS and voice, inbound and consented), the underwriting engine, appointment booking, the compliance rules engine (start with 8–10 high-volume states), CRM write-back for GHL, Podio and one REI CRM, and outcome analytics.
- **Partner in v1:** property data (ATTOM, BatchData or similar), telephony and SMS (Twilio or Telnyx, smrtPhone, Smarter Contact), dispositions (InvestorLift).
- **Defer:** a native full CRM (offer a "lite pipeline" for teams without one), list building and skip tracing at scale, transaction management, portfolio management.

### 7.4 Proof points to win (recommendation)

1. Median time to first response under 60 seconds, 24/7.
2. Percentage of leads with a complete qualification record and a draft MAO before the AM's first touch.
3. Cost per qualified appointment versus the team's prior baseline.
4. Zero compliance incidents: quiet-hours blocks, honored opt-outs, generated disclosures.

---

## 8. Threats

| Threat | Severity | Why (evidence) | Mitigation (Analysis) |
|---|---|---|---|
| **GHL's low price and agency ecosystem** | High | $97 entry, unlimited users, AI Employee $50–$97/sub-account, agencies rebill AI with markup ([HighLevel](https://www.gohighlevel.com/pricing); [HighLevel help](https://help.gohighlevel.com/support/solutions/articles/155000008422-fixed-rate-rebilling-for-ai-products)). Snapshots let anyone launch a "wholesaler CRM". | Integrate deeply with GHL instead of fighting it. Possibly become the underwriting and compliance app GHL agencies resell (a GHL Marketplace app). |
| **PropStream data moat plus consolidation** | High | Stewart-owned PropStream now owns BatchLeads and BatchDialer, with BatchData as a data source ([PropStream PR](https://www.propstream.com/news/propstream-announces-acquisition-of-batch-leads-and-batch-dialer-enhancing-its-ai-powered-real-estate-data-and-lead-generation-solutions)). It could bundle CRM and AI at data-subsidized prices. | Stay data-vendor-neutral. Win on conversation and underwriting intelligence. Support PropStream and BatchLeads exports and imports. |
| **Incumbents adding AI (and making it free)** | High | REsimpli AI agents free on every plan. Carrot AI Suite $99. FreedomSoft AI Acquire. Goliath David. PropStream Intelligence Assistant included. | Differentiate on underwriting depth, compliance, and CRM-agnosticism, not on "has AI". |
| **Market contraction** | Medium–high | Investor purchases −22% YoY in Q2 2026 ([BatchData](https://batchdata.io/investor-pulse-q2-2026)). Flip margins down ([ATTOM via search](https://www.attomdata.com/news/market-trends/flipping/home-flipping-profits-continue-gradual-two-year-decline/)). Wholesaler count possibly down sharply (unverified). | Price on ROI. Expand to hybrid agents, flippers and buy-and-hold underwriting. |
| **Regulatory shocks** | Medium–high | 22 states plus Philadelphia with wholesaling laws. PA HB 600 proposed a statewide do-not-solicit list. TCPA litigation surge. Texas SB 140. | Turn compliance into product value. Maintain a legal-update cadence with counsel. |
| **Channel consolidation** | Medium | Smarter Contact plus Launch Control could bundle AI qualification on top of SMS | Partner early. Be the neutral AI layer across channels. |
| **Commoditized AI infrastructure** | Medium | Retell and Vapi make AI callers cheap to assemble. Industry article cites $0.08–$0.15/min typical AI-agent cost ([Ringly via search](https://www.ringly.io/blog/ai-phone-agent-per-minute-pricing)). | The moat is workflow, data feedback loops and compliance, not the voice model. |
| **AI COGS versus flat pricing** | Medium | Competitors charge $0.35–$0.50/min for AI voice (FreedomSoft; REsimpli cached). An "unlimited AI" Starter tier could produce negative gross margin on heavy users. | Metered or credit-based AI usage (see pricing benchmarks). |

---

## 9. Competitive monitoring list (next 90 days)

- REsimpli: confirm current Team and Business pricing and AI usage rates via a trial account.
- PropStream: watch for PropStream + BatchLeads product merger or bundle pricing.
- Smarter Contact + Launch Control: watch for integrated plans and AI qualification launches.
- GHL Marketplace: identify REI underwriting and compliance apps (potential partners or competitors).
- FreedomSoft AI Acquire: run a mystery-shop demo to benchmark AI qualification quality.
- G2/Capterra: manually export reviews (blocked for automated retrieval).
