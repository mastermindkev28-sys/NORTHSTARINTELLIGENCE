# SaaS Pricing and Unit Economics

**Status:** First pass (pre-validation) · **Research date:** 2026-11-10 · **Scope:** Brief section 14
Every cost input below is either a cited list price or a labeled **Assumption**. No revenue, customer or usage figures are real; there are no customers yet.

---

## 1. Recommendation

- **Keep the $199 / $499 / $999 / Custom structure as the working hypothesis.** It sits inside the range buyers already pay: investor CRMs $69 to $599/mo, data platforms $99 to $899/mo (`COMPETITIVE_ANALYSIS.md`).
- **Price on outcomes-bearing usage, not seats.** Include a monthly allowance of *AI-qualified conversations* and *property lookups* per tier, with metered overage. Seats are generous because competitors' seat counts are generous (PropStream Elite 9 users, BatchLeads Team 50+).
- **Pass through messaging and skip tracing at cost plus a small margin**, or let customers bring their own Twilio account. Competitors meter these separately (PropStream skip 12¢, BatchLeads 8 to 9¢, GoHighLevel SMS usage).
- **Starter is the weakest tier.** At $199 it is above CarrotCRM Essential ($69) and equal to PropStream Pro, without our own list data. Use it only if interviews show solo operators value AI qualification; otherwise launch with Professional and Team only, plus a design-partner rate.
- **Target:** ≥ 75% blended gross margin at expected usage, ≥ 60% at full allowance usage.

---

## 2. Proposed packaging (hypothesis)

| | Starter | Professional | Team | Enterprise |
|---|---|---|---|---|
| Price | $199/mo | $499/mo | $999/mo | Custom (annual) |
| Seats | 2 | 5 | 12 | Custom |
| AI-qualified conversations / mo | 300 | 1,000 | 2,500 | Custom |
| Property lookups / mo | 1,000 | 3,000 | 8,000 | Custom |
| Underwriting reports / mo | 25 | 150 | 400 | Unlimited (fair use) |
| CRM sync | 1 CRM | 1 CRM | 2 CRMs | Custom + API |
| Compliance (consent ledger, DNC, state checklists) | ✓ | ✓ | ✓ | ✓ + audit export |
| SSO, custom roles, SLA | | | | ✓ |
| Messaging / skip tracing | Pass-through | Pass-through | Pass-through | Negotiated |

Allowance sizes are **Assumptions** to test against design-partner lead volumes.

---

## 3. Variable cost inputs

| Cost item | Unit cost used | Basis |
|---|---|---|
| Property lookup | $0.02 per call | Realie $350/30k ≈ $0.0117; RentCast $449/25k ≈ $0.018 [D1][D3]. Rounded up for mixed calls. |
| AI-qualified conversation | $0.08 base ($0.11 uncached) | **Assumption:** 8 turns, ~40k cumulative input + 3k output tokens on Claude Sonnet 5.5 at $2 / $10 per million tokens = $0.11; ~$0.08 with prompt caching of system prompt and history. Lead triage on Claude Haiku 5.5 ($0.10 / $0.50 per M) adds < $0.001. [P1] |
| Underwriting report | $0.035 | **Assumption:** 10k input + 1.5k output on Sonnet 5.5 for the narrative; the math itself runs in deterministic code at ~zero marginal cost. [P1] |
| SMS (pass-through) | ~$0.0125 per segment | Twilio $0.0083 + carrier fee ~$0.0035 to $0.005 [P2] |
| Phone number | $1.15/mo per long code | Twilio [P2] |
| Fixed infra per tenant | $15 / $20 / $30 | **Assumption:** hosting, database, logging, monitoring allocation |

Model prices are Anthropic first-party list prices as of 2026-11-03 per the Claude API reference. [P1]

---

## 4. Gross margin per tier (excludes pass-through messaging)

| Tier | Price | AI convos | Lookups | Reports | Fixed | **COGS at 100% allowance** | **GM** | **COGS at 50%** | **GM** |
|---|---|---|---|---|---|---|---|---|---|
| Starter | $199 | $24.00 | $20.00 | $0.88 | $15 | $59.88 | 69.9% | $37.44 | 81.2% |
| Professional | $499 | $80.00 | $60.00 | $5.25 | $20 | $165.25 | 66.9% | $92.62 | 81.4% |
| Team | $999 | $200.00 | $160.00 | $14.00 | $30 | $404.00 | 59.6% | $217.00 | 78.3% |

**Reading:** margins clear the target at expected usage. At full allowance the Team tier dips below 60%, so either reduce its lookup allowance to ~6,000 or price lookups as credits. Payment processing (~3%) is not included.

**Sensitivity (Assumption-driven):**
- If conversations cost $0.11 (no caching), Professional at full use rises to $195 COGS (60.9% GM).
- If we must use ATTOM ($500/mo minimum) or BatchData ($1,000/mo) at launch, those are **fixed** costs on top of metered usage: they consume the gross profit of roughly 1.2 to 2.5 Professional customers at expected usage ($500 or $1,000 ÷ ~$406 gross profit each). Hence the Realie/RentCast launch stack.

---

## 5. Usage-based options considered

| Option | Pros | Cons | Decision |
|---|---|---|---|
| Pure seat pricing | Simple | Misaligned with AI/data costs; competitors give many seats | Reject |
| Pure usage | Aligned with cost | Unpredictable bills; wholesalers dislike surprises | Reject |
| **Tier + allowance + overage** | Predictable, protects margin | Needs metering and clear UI | **Adopt** |
| Per-contract success fee | Strong ROI story | Hard to verify; legal questions around compensation on real estate deals | Do not pursue without counsel |
| Premium modules (Due Diligence, Transact) | Expansion revenue | Later divisions | Plan for year 2 |
| API access | Enterprise value | Data license limits on redistribution | Enterprise only, after license review |

---

## 6. SaaS metrics to instrument from day one

MRR, net revenue retention, logo churn, allowance utilization per tenant, COGS per tenant (from metering), cost per AI conversation, time-to-first-value (first qualified lead), payback period. Tie these to billing events (brief section 8).

---

## 7. Validation plan

1. In 15 to 20 interviews, test price anchors with Van Westendorp questions and a "current stack" spend inventory.
2. Offer 3 to 5 design partners Professional at a discounted rate for 90 days in exchange for baseline metrics and a case study.
3. After 60 days, compare real per-tenant COGS from metering against section 4 and re-set allowances.

---

## Sources (all retrieved 2026-11-10)

- [P1] Anthropic Claude API model pricing (Claude API reference, cached 2026-11-03): Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50, Opus 5.5 $4 / $20 per million input/output tokens.
- [P2] Twilio US SMS pricing (page current as of October 2026). https://www.twilio.com/en-us/sms/pricing
- [D1], [D3]: see `DATA_PROVIDER_EVALUATION.md`. Competitor prices: see `COMPETITIVE_ANALYSIS.md`.
