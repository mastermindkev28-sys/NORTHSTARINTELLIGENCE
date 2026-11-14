# Company Strategy

**Company:** Northstar Acquisitions LLC · **Brand:** Northstar Intelligence (working name pending trademark, corporate-name, and domain clearance — not yet verified)
**Tagline:** The intelligence infrastructure for real estate.
**Last updated:** 2026-11-14

## 1. Thesis

Real estate acquisition businesses run on a fragmented stack (list/data tool + CRM + SMS/dialer + spreadsheet underwriting + VAs). The expensive, recurring problems are **speed to lead, inconsistent qualification and follow-up, slow or unreliable underwriting, and compliance exposure**. Northstar connects information, decision-making, and execution in one operating layer: intelligent agents run deterministic, auditable workflows; humans approve consequential decisions.

## 2. Strategic decisions (and why)

| Decision | Choice | Reason |
|---|---|---|
| Initial ICP | Small acquisition teams (2–10 people) buying **inbound or consented** seller leads (PPC, SEO, direct-mail call-ins, SMS replies) | Highest willingness to pay is for replacing labor (lead managers/VAs); inbound/consented is the legally durable channel (see `MARKET_RESEARCH.md` §2, §8). |
| Wedge | **"The AI acquisitions desk that works inside your existing CRM"**: answer in < 60 s, qualify, underwrite, compliance-check, book, write back to the CRM | All-in-ones (REsimpli, FreedomSoft, Goliath) already sell the v1 bundle and REsimpli made AI agents free — competing as "another all-in-one with AI" is a price war. Qualification + **underwriting + compliance** as a CRM-agnostic layer is unoccupied (`COMPETITIVE_ANALYSIS.md` §7). |
| What we don't build in v1 | Native full CRM, list building, skip tracing at scale, AI cold calling | Data is PropStream/BatchData's moat; cold AI outreach is the riskiest TCPA use case. Offer a "lite pipeline" for teams without a CRM. |
| Architecture | Modular platform (six divisions) on one tenancy/data/automation core | Expansion into Underwrite, Due Diligence, Transact, Portfolio without rebuild. |
| AI posture | AI for judgment over unstructured input (extraction with evidence); **deterministic** for money, compliance, routing; humans approve offers | Trust is the product in a regulated, high-stakes domain. |
| Data posture | Provider-neutral adapters, provenance on every fact, never invent data | Avoids lock-in and licensing risk; makes outputs auditable. |

## 3. Division roadmap (summary)

1. **Northstar Acquire** + **Underwrite (initial)** — commercial v1 (now).
2. **Northstar Intelligence** (property/market) — deepen with licensed data (v1.x).
3. **Northstar Transact** — milestones, deadlines, document collection (v2).
4. **Northstar Due Diligence** — document intelligence with citations (v2).
5. **Northstar Portfolio** — buy-and-hold asset analytics (v3).

Details: `PRODUCT_ROADMAP.md`.

## 4. Moat (what compounds)

- **Outcome data:** conversation → qualification → offer → close, per market. Calibrates scoring, repair bands, and ARV adjustments over time (customer-consented, tenant-isolated, aggregated only with permission).
- **Compliance engine as product:** versioned, counsel-reviewed policy data (state windows, caps, revocation rules) with audit evidence — hard to replicate and increasingly required.
- **Workflow embedment:** CRM write-back + approvals + audit trail make Northstar the system of record for acquisition decisions.

## 5. Risks we accept / mitigate

| Risk | Mitigation |
|---|---|
| Market contraction (investor purchases −22% YoY Q2 2026, per BatchData; flip margins down, per ATTOM) | Price on ROI; expand to flippers, buy-and-hold, hybrid agents. |
| Regulation (22 states + Philadelphia regulate wholesaling; FCC 26-67 effective 2026-11-25) | Compliance-first product; counsel review cadence; policy data versioned. |
| Incumbents adding AI | Differentiate on underwriting depth, provenance, compliance, CRM-agnosticism. |
| Data licensing (internal-use defaults) | Signed display/cache/LLM rights before production (`DATA_PROVIDER_EVALUATION.md`). |
| AI COGS vs flat pricing | Credit-based pricing with published overage (`SAAS_PRICING_AND_UNIT_ECONOMICS.md`). |

## 6. Success criteria (12 months)

- 10 design partners live; ≥ 5 converted to paid.
- Median first response < 60 s; ≥ 70 % of leads with a complete qualification record and draft MAO before the acquisition manager's first touch.
- Zero compliance incidents (opt-outs honored, quiet-hour blocks, disclosures generated).
- Gross margin ≥ 70 % at the Professional tier; logo churn < 3 %/month.
