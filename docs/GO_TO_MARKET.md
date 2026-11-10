# Go-To-Market Plan

**Status:** First pass · **Date:** 2026-11-10 · **Scope:** Brief section 14
Based on `MARKET_RESEARCH.md`, `COMPETITIVE_ANALYSIS.md` and `SAAS_PRICING_AND_UNIT_ECONOMICS.md`. No customers, pilots or revenue exist yet; all targets below are goals, not results.

---

## 1. Positioning

**For** small residential acquisition teams (3 to 10 people) who already pay for seller leads,
**Northstar Intelligence** is the acquisition intelligence layer that answers every lead in seconds, qualifies it compliantly, and turns it into a source-cited offer range,
**unlike** data platforms (PropStream, BatchLeads) that stop at lists and CRMs (REsimpli, CarrotCRM) that stop at pipelines,
**because** every fact, assumption and calculation is traceable and every outreach respects consent and state rules.

**Message hierarchy**
1. *Convert more of the leads you already pay for.* (Speed-to-lead, qualified appointments.)
2. *Know why an offer is what it is.* (Provenance, deterministic underwriting.)
3. *Stay compliant as wholesaling laws tighten.* (Consent ledger, state disclosures.)
4. *Keep your CRM.* (Two-way sync.)

---

## 2. Ideal customer profile

- 3 to 10 person team; acquisitions and/or lead manager role exists.
- Spends on paid lead generation (mail, PPC, cold call, SMS) every month.
- Uses REsimpli, CarrotCRM, GoHighLevel or Podio (our first integrations).
- Operates in at least one state with a recent wholesaling law (CT, OH, PA, MD, TN, OR) or a high-volume market.
- **Disqualifiers:** no paid marketing; wants a free data tool; wants AI cold-calling to non-consented numbers.

---

## 3. Phased plan

| Phase | Weeks | Goal | Exit criteria |
|---|---|---|---|
| **0. Discovery** | 1 to 4 | 15 to 20 interviews; validate pains and price | ≥ 60% of ICP interviewees rank speed-to-lead or qualification consistency as a top-3 pain; price range confirmed |
| **1. Design partners** | 4 to 16 | 3 to 5 teams on a working MVP (qualification + CRM sync + property lookup + underwriting) | Measured baseline vs. pilot: time-to-first-response, qualified-appointment rate, contracts; ≥ 2 willing to pay list price |
| **2. Founder-led sales** | 12 to 26 | First 20 paying teams | Net revenue retention tracking, 2 published case studies with real numbers |
| **3. Repeatable channel** | 26+ | Partnerships and content | CAC payback under 6 months (target) |

---

## 4. Channels (founder-led first)

1. **Direct outreach** to operators in REI communities (BiggerPockets, local REIA meetups, investor Facebook groups), using the interview script below. No paid ads until case studies exist.
2. **Integration partnerships**: listing in CRM marketplaces (GoHighLevel app marketplace, Podio/REsimpli/Carrot partner programs, if available; to be confirmed).
3. **Coaching communities**: wholesaling education groups recommend stacks to thousands of students; offer an affiliate or partner tier after product-market fit.
4. **Content**: state-law compliance guides (CT, OH, PA, MD, TN, OR) and cost-per-contract calculators, which attract our ICP and reinforce positioning.

All outbound by Northstar itself must follow the same TCPA, CAN-SPAM and DNC rules we sell.

---

## 5. Discovery interview script (30 minutes)

1. Team size, roles, markets, deals per month.
2. Lead sources and monthly marketing spend by channel.
3. Walk me through the last lead you got: where did it arrive, who responded, how fast?
4. What tools do you pay for today, and what does each cost? (Stack inventory.)
5. What happens to leads that do not convert in the first week?
6. How do you build an offer? Where do comps come from? Have bad data or comps cost you a deal?
7. How are you handling new state wholesaling rules and texting consent?
8. If one tool answered every lead in under a minute and gave you a defensible offer range, what would that be worth monthly? At what price is it too expensive? Too cheap to trust?
9. Would you share baseline numbers for a 90-day pilot?

---

## 6. Pilot design (measurable ROI)

- **Baseline (2 weeks before):** time-to-first-response, lead-to-appointment rate, appointment-to-contract rate, cost per contract.
- **Pilot (8 to 12 weeks):** same metrics from Northstar's audit log and the customer's CRM.
- **Success threshold (to agree with each partner up front):** e.g., median time-to-first-response under 2 minutes and a measurable lift in qualified appointments.
- **Reporting:** weekly automated report; no metric is claimed in marketing unless it came from a pilot with the partner's written consent.

---

## 7. Customer onboarding and success

Day 0: connect CRM and lead sources, import consent records, choose markets and buy box. Day 1: first AI-qualified lead. Week 1: review 10 conversations together and tune scripts. Month 1: ROI review against baseline. Churn signals: falling allowance utilization, CRM sync errors, unanswered escalations.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Incumbents copy AI qualification | Win on provenance, compliance, ROI reporting; lock in design partners |
| Data licensing blocks a feature | Multi-provider adapter; confirm terms before build |
| TCPA exposure from customer misuse | Consent enforced in product; inbound-first AI; terms of service; counsel review |
| Wholesaling demand keeps contracting | Architecture extends to buy-and-hold teams and agents (Segments D, E) |

---

## 9. Decisions needed from the owner

1. Approve outreach under the Northstar name for discovery interviews (no spend).
2. Design-partner discount level (suggest 50% of Professional for 90 days).
3. Budget for legal review of TCPA and state wholesaling workflows before pilots.
