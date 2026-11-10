# Competitive Analysis

**Status:** First pass · **Research date:** 2026-11-10 · **Scope:** Brief section 06
All prices are list prices from the source shown, retrieved 2026-11-10. Vendors change pricing often. Where sources disagree, both figures are shown.

---

## 1. Summary

The market splits into four categories that are **not interchangeable**:

| Category | Players | What they own | Overlap with Northstar v1 |
|---|---|---|---|
| **Data + list platforms** | PropStream, BatchLeads, DealMachine | Nationwide property/owner data, list building, skip tracing, mail, basic dialing | Property retrieval, lead intelligence (partial) |
| **Investor CRMs** | REsimpli, CarrotCRM (formerly InvestorFuse), FreedomSoft, Left Main | Pipeline, follow-up drips, calling/SMS, KPIs | CRM connectivity, follow-up, pipeline, AI qualification |
| **General CRM/automation** | GoHighLevel, Podio | Configurable workflows, messaging, funnels; customer builds the REI logic | Automation, pipeline |
| **Deal analysis** | DealCheck | Underwriting calculators, comps, reports | Initial underwriting |

**Key finding:** every category is adding AI (REsimpli "AI agents free on every plan," CarrotCRM "Autonomous Lead Manager," DealMachine AI Chat). AI features alone will not differentiate Northstar. No vendor reviewed combines (1) source-cited, confidence-scored property data from multiple providers, (2) deterministic, auditable underwriting tied to the conversation that produced the inputs, and (3) consent- and state-law-aware automation. That combination is the proposed wedge.

---

## 2. Verified pricing

### Data + list platforms

| Vendor | Plan | Price | Users | Key limits / usage pricing | Source |
|---|---|---|---|---|---|
| **PropStream** | Essentials | $99/mo ($81/mo annual) | add-on users $30/mo | 25k saves/exports; skip trace 12¢/contact; Connect add-on $30/mo | [C1] |
| | Pro | $199/mo ($165/mo annual) | 2 | 50k saves; up to $6k/mo free skip tracing; Lead Automator 50k props | [C1] |
| | Elite | $699/mo ($583/mo annual) | 9 | 100k saves; up to $12k/mo free skip tracing | [C1] |
| **BatchLeads** | Personal Basic | $99/mo ($77 annual) | 3 | 10k property exports; 250 skip credits; $0.09/skip | [C5] |
| | Personal Plus | $299/mo ($233 annual) | 8 | 30k exports; 1,000 skip credits; lead scoring | [C5] |
| | Team Basic | $599/mo (annual contract) | 50 | 75k leads/mo; $0.08/skip | [C5] |
| | Team Plus | $899/mo (annual contract) | up to 200 | 150k leads/mo; $0.08/skip | [C5] |
| **DealMachine** | Basic | $99 per user/mo | per seat | 10k data credits/user; mail from $0.75/postcard | [C2a] |
| | Pro | $149 per user/mo | per seat | 20k data credits/user | [C2a] |
| | Scale | $599 per package/mo | 10 seats | 100k records/package; SSO/SAML; API included | [C2a][C2b] |

DealMachine's pricing page text did not render Basic/Pro dollar figures; the per-user figures come from DealMachine's own blog dated 2026-07-30. [C2a]

### Investor CRMs

| Vendor | Plan | Price | Users | Notes | Source |
|---|---|---|---|---|---|
| **REsimpli** | Solo | $249/mo billed annually | 1 | "Every feature on every plan"; unlimited standard calling/SMS (fair use); AI agents free; AI calling billed per use; 14-day trial | [C3a] |
| | Team / Business | not shown on page | 5 / 15 | Third-party site lists Basic $149, Pro $299, Enterprise $599 (annual), flagged stale | [C3a][C3b] |
| **CarrotCRM** (InvestorFuse) | Essential | $69/mo ($703/yr) | 3 | 50 property reports/mo; AI pay-per-use | [C4] |
| | Scale | $179/mo ($1,825/yr) | 5 | workflows, autoresponders, transaction mgmt | [C4] |
| | Team | $349/mo ($3,559/yr) | 10 | round robin, scorecards, TV KPI dashboard | [C4] |
| | AI Suite add-on | $99/mo | | required for AI beyond monthly trial | [C4] |
| **FreedomSoft** | | Pricing not published on sources found; secondary reviews only | | Not verified | [C6] |
| **Left Main REI** | | Salesforce-based; pricing not verified | | Not verified | [C7] |

### General CRM / automation

| Vendor | Plan | Price | Notes | Source |
|---|---|---|---|---|
| **GoHighLevel** | Starter / Unlimited / SaaS Pro | $97 / $297 / $497 per mo | Usage: SMS ~$0.0079 out; calls $0.021/min out; AI ~$0.02 to $0.04/message. Source is a third-party article dated 2025-02-27; verify on GHL. | [C8] |
| **Podio** | Free / Plus / Premium | $0 / $11.20 / $19.20 per user/mo (annual) | Automation add-on $39 to $559/mo by action volume; 1,000 API calls/hr | [C10] |

### Deal analysis

| Vendor | Plans | Notes | Source |
|---|---|---|---|
| **DealCheck** | Free, Plus, Pro | Plus: 50 saved properties, 10 sales + 10 rental comps; Pro: unlimited, owner lookup, branded reports. Dollar prices are in an image on the help page and were not verified. | [C9] |

---

## 3. Capability overlap matrix

● strong · ◐ partial · ○ absent or not verified. Based on vendor pages and docs cited above; not hands-on testing.

| Capability (Northstar v1) | PropStream | BatchLeads | DealMachine | REsimpli | CarrotCRM | GoHighLevel | Podio | DealCheck |
|---|---|---|---|---|---|---|---|---|
| Seller lead intelligence (dedupe, scoring, missing-info) | ◐ | ◐ lead scoring | ◐ | ◐ | ● AI scoring | ○ | ○ | ○ |
| CRM / pipeline | ○ | ◐ | ◐ | ● | ● | ● | ● (DIY) | ○ |
| AI-assisted qualification | ○ | ○ | ◐ AI chat | ● AI agents | ● Autonomous Lead Mgr | ◐ AI employee | ○ | ○ |
| Follow-up automation | ◐ | ◐ | ◐ | ● | ● | ● | ◐ add-on | ○ |
| Property data retrieval | ● | ● | ● | ◐ | ◐ 50 to 200 reports/mo | ○ | ○ | ◐ |
| Initial underwriting (ARV/MAO) | ◐ comps/estimates | ◐ | ○ | ◐ | ○ | ○ | ○ | ● |
| Appointments | ○ | ○ | ○ | ◐ | ◐ | ● | ○ | ○ |
| Source provenance + confidence on data | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Consent ledger / state disclosure workflows | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |

The last two rows are "not verified" rather than proven absent: we found no evidence of them in the reviewed sources.

---

## 4. Competitor notes

**PropStream.** Category leader in self-serve data. Strength: breadth, onboarding (Trustpilot praise for trainers). Weakness: data freshness complaints (comps and owner changes lagging county records), no real CRM. [C1][S7][S8] Threat: bundles free skip tracing and dialer to raise switching cost.

**BatchLeads / BatchData.** Same company runs BatchLeads (app) and BatchData (API, $1,000+/mo). Strong at volume and team pricing. Contact-accuracy complaints are a minority but persistent. [C5][S11] BatchData is also a potential **supplier** (`DATA_PROVIDER_EVALUATION.md`).

**DealMachine.** Driving-for-dollars origin, moving to per-seat pricing and an API with an MCP-style AI search. Watch: an API-first data vendor plus AI chat could move into qualification. [C2a][C2b]

**REsimpli.** Most direct all-in-one competitor to our ICP: CRM + phone + SMS + list stacking + AI agents, flat pricing, no feature gates. Weaknesses from users: no custom if/then rules engine, weak marketing attribution, lost leads. [C3a][S10]

**CarrotCRM (InvestorFuse).** Carrot acquired InvestorFuse in 2022 and rebranded it. Cheapest credible investor CRM ($69 to $349) with a strong website/lead-gen funnel parent (Carrot websites). AI behind a $99 add-on. [C4] Threat: owns inbound web leads for many operators.

**GoHighLevel / Podio.** Horizontal tools that REI consultants customize. Cheap per seat, powerful, but every REI workflow is DIY and fragile. Opportunity: integrate with them rather than compete, especially GoHighLevel, which many teams already use for SMS and funnels.

**FreedomSoft, Left Main.** Older all-in-one / Salesforce-based players. Pricing not verified in this pass; flagged for follow-up.

**DealCheck.** Strong consumer/prosumer underwriting with mobile apps; not a workflow tool. Shows demand for calculators, which Northstar can include natively with provenance.

---

## 5. Where Northstar can be materially better

1. **Verified intelligence, not just AI.** Every property fact carries source, retrieval time and confidence; every underwriting number shows formula and inputs (brief sections 10, 11). Directly addresses the stale-comps complaint.
2. **Speed-to-lead with compliant AI qualification.** AI answers inbound and consented callbacks within seconds, captures condition/motivation/timeline/price into structured fields, and hands hot leads to a human with a draft offer range. Measured by time-to-first-response and qualified-appointment rate.
3. **Underwriting tied to the conversation.** Seller-reported facts, third-party data and user assumptions are kept separate, so the offer range is explainable.
4. **Compliance as a feature.** Consent ledger, DNC and opt-out enforcement, and state disclosure checklists (CT, OH, PA, MD, TN, OR first).
5. **Overlay, not rip-and-replace.** Two-way sync with REsimpli, CarrotCRM, GoHighLevel and Podio lowers switching cost; expand into full CRM later.
6. **ROI reporting.** Cost per qualified lead and per contract by marketing channel, which reviewers say incumbents handle poorly. [S10]

**Risks to this thesis.** REsimpli or Carrot could add provenance and compliance features quickly; data platforms could add CRM; overlay products can be squeezed by API access changes. Mitigation: own the proprietary layer (conversation-to-underwriting record, outcome data, compliance audit log) and move fast with design partners.

---

## Sources (all retrieved 2026-11-10)

- [C1] PropStream, "How Much Does PropStream Cost?", 2026-05-15. https://www.propstream.com/news/how-much-does-propstream-cost
- [C2a] DealMachine blog, "How DealMachine pricing works," 2026-07-30. https://www.dealmachine.com/blog/how-dealmachine-pricing-works
- [C2b] DealMachine pricing page. https://dealmachine.com/pricing
- [C3a] REsimpli pricing page. https://www.resimpli.com/pricing
- [C3b] The Front Desk Review, REsimpli (prices checked 2026-09-03, flagged stale). https://frontdeskreview.com/software/real-estate-crm/resimpli/
- [C4] Carrot, "InvestorFuse is now CarrotCRM" pricing page. https://carrot.com/investorfuse-pricing/
- [C5] BatchLeads support, "Subscription plans." https://support.batchleads.io/support/solutions/articles/150000015275-batchleads-subscription-plans-how-much-is-batch-leads
- [C6] PropertyLeads, "FreedomSoft Reviews" (secondary). https://www.propertyleads.com/freedomsoft-reviews/
- [C7] Carrot, "Carrot vs LeftMain" (vendor comparison). https://carrot.com/carrot-vs-leftmain/
- [C8] Ciela AI, "GoHighLevel pricing," dated 2025-02-27 (secondary). https://ciela.ai/blogs/gohighlevel-pricing-ai-automation-agencies
- [C9] DealCheck Help, "DealCheck Plus & Pro." https://help.dealcheck.io/en/articles/2023912-dealcheck-plus-pro
- [C10] Progress, Podio plans and pricing. https://www.progress.com/podio/pricing
- [S7], [S8], [S10], [S11]: see `MARKET_RESEARCH.md`.
