# SaaS Pricing & Unit Economics

Last updated 2026-11-14. Competitive evidence: `research/pricing-benchmarks.md`. **All cost figures marked (A) are assumptions to be replaced with measured values from design-partner usage.**

## 1. Verdict on the original hypothesis

| Tier | Hypothesis | Verdict | Change |
|---|---|---|---|
| Starter | $199 | Defensible price, mispositioned as single-seat | 3 seats, capped AI credits, no unlimited AI |
| Professional | $499 | Strongly validated (market anchor $497–$499) | Lead with cost-per-appointment ROI |
| Team | $999 | Plausible; likely underpriced for scaled ops | Expect $1.2k–$2k invoices with usage |
| Enterprise | Custom | Validated | Annual, SSO, setup fee |

## 2. Recommended structure — platform fee + included AI credits + published overage

| | Starter | Professional | Team | Enterprise |
|---|---|---|---|---|
| Monthly (annual = ~20 % off + bonus credits) | **$199** | **$499** | **$999** | Custom (≥ $2,000) |
| Seats | 3 | 5 | 10 | Custom |
| AI-processed leads / month (intake → qualification → underwriting) | 150 | 400 | 1,000 | Custom |
| Overage per AI-processed lead | $0.90 | $0.75 | $0.60 | Contract |
| Underwriting & compliance engine | Included | Included | Included | Included |
| CRM integrations | 1 | 2 | Unlimited + routing | + Salesforce/Left Main |
| SMS / voice / property data | Pass-through at cost + 15 % | same | same | Negotiated |
| Setup | — | — | Optional $997 | $3,000+ |

Principles: gate on AI usage and modules, not seats; publish all rates (credit opacity is a top complaint); never charge separately for underwriting ("underwriting included" is a positioning advantage vs. one-time power-up fees).

**Design partners:** 90-day pilot at 50 % of list, in exchange for outcome data, a case study, and weekly feedback. Optional outcome-priced pilot (per qualified appointment) as a differentiation test.

## 3. Cost model per AI-processed lead

| Component | Basis | Cost per lead |
|---|---|---|
| LLM extraction | Claude Opus 5.5 at $4 / $20 per MTok (input/output). Assume 4 seller replies × (~1.2k input + ~0.8k output incl. adaptive thinking) (A). System prompt cached. | ≈ 4 × ($0.0048 + $0.016) ≈ **$0.08** |
| SMS | ~8 segments/lead (A) × ~$0.0083 Twilio US segment + ~$0.003 carrier fee (A — verify current Twilio and carrier rates) | ≈ **$0.09** |
| Property data | 1 detail + 1 comps/AVM lookup. ATTOM pricing not public; BatchData ≈ $0.01/record at volume (published). Budget **$0.10–$0.50** (A) until contracted | ≈ **$0.25** (A) |
| Compute/storage | Postgres, worker, web (A: ~$0.02/lead at small scale) | ≈ **$0.02** |
| **Total variable COGS** | | **≈ $0.44 / lead** (A) |

Lower-cost model option: Claude Haiku 5.5 ($0.10 / $0.50 per MTok) would cut LLM cost ~40×. This is a quality decision, not a default — it requires the extraction eval set to show parity first.

## 4. Gross margin by tier (at full included usage)

| Tier | Price | Included leads | Variable COGS | Fixed platform alloc. (A) | Gross margin |
|---|---|---|---|---|---|
| Starter | $199 | 150 | $66 | $15 | **59 %** |
| Professional | $499 | 400 | $176 | $20 | **61 %** |
| Team | $999 | 1,000 | $440 | $30 | **53 %** |

At typical utilization (~60 % of included usage, A), margins are 70–75 %. SMS and data pass-through (cost + 15 %) move those lines from COGS to revenue-neutral, raising margin to **~75–80 %** at full usage. **Action:** if measured data COGS exceeds $0.25/lead, raise overage or move data to pass-through on all tiers.

## 5. SaaS metrics to instrument (from `usage_events` + billing)

MRR, net revenue retention, logo churn, CAC payback, gross margin per tenant, AI COGS per qualified lead, leads processed per seat, time to first value (first qualified + underwritten lead), activation (≥ 25 leads processed in first 14 days).

## 6. Open validation tasks

1. Measure real token usage per conversation with the live model on the eval set.
2. Contract ATTOM/BatchData pricing with display + cache + LLM rights.
3. Van Westendorp survey with 30+ ICP teams at $199 / $499 / $999.
4. Confirm Twilio segment + carrier fees and 10DLC registration costs per tenant.
