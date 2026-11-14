# Underwriting Methodology

Implementation: `packages/underwriting`. Methodology version: **2026.11.1** (stamped on every result). Every function is deterministic: identical inputs produce identical outputs.

## 1. Principles
1. **Transparent:** each result carries a calculation trace (formula, inputs, result) and an assumptions register with provenance.
2. **Labeled inputs:** `verified` · `user_assumption` · `third_party_estimate` · `ai_generated` · `calculated`. AI-derived ARV triggers a warning.
3. **No invented data:** if comps don't qualify, ARV is `null` and the decision is `insufficient_data`.
4. **Estimates, not guarantees:** results include explicit limitations; offers require human approval.
5. **Rates are decimals** (0.06 = 6 %). Inputs like `6` for a rate are rejected, preventing the most common spreadsheet error.
6. **Rounding:** full precision internally; half-away-from-zero at presentation; ARV rounded to $100; recommended max offer floored to $500.

## 2. Formulas

| Metric | Formula |
|---|---|
| Monthly payment | PMT = P·r / (1 − (1+r)^−n), r = annual/12 (P/n when r = 0) |
| Remaining balance | B_k = P(1+r)^k − PMT·((1+r)^k − 1)/r |
| NPV / IRR | NPV = Σ CF_t/(1+i)^t; IRR solves NPV = 0 (Newton–Raphson, bisection fallback; `null` when no sign change) |
| ARV | adjustedPrice_i = salePrice_i + Σ adjustments_i; ppsf_i = adjusted_i / sqft_i; ARV = (Σ w_i·ppsf_i / Σ w_i) × subject sqft |
| Comp weights | equal; inverse distance 1/max(d, 0.1); recency-distance (1/d)·1/(1 + monthsAgo/6) |
| Rehab | line items Σ qty × unit cost, or scope $/sqft × sqft; × (1 + contingency) |
| Holding | (tax/12 + insurance/12 + utilities + HOA + other) × months |
| Hard-money loan | min(maxLTC × (purchase + financed rehab), maxLTV × ARV) |
| Financing cost | loan × points + lender fees + interest (IO: loan × rate/12 × months) |
| Disposition | sale × (commission + seller closing) + concessions + fixed |
| MAO (rule) | ARV × factor − repairs − assignment fee |
| MAO (cost-based) | (ARV − repairs − profit − holding − financing − disposition − fixed closing − fee) ÷ (1 + closing rate) — closing costs that scale with price are solved algebraically |
| Recommended max offer | max(0, min(rule, cost-based)), floored to $500 |
| Assignment | fee = buyer price − contract price; cushion = buyer max − buyer price |
| GSI / EGI / NOI | GSI = (rent + other)×12; EGI = GSI × (1 − vacancy); NOI = EGI − OpEx |
| OpEx | tax + insurance + HOA + utilities + mgmt%·EGI + maint%·EGI + capex%·GSI + other |
| Cap rate / yield on cost | NOI ÷ price; NOI ÷ (price + rehab + closing) |
| Cash-on-cash | annual cash flow ÷ total cash invested (`null` if no cash invested) |
| DSCR | NOI ÷ annual debt service (`null` if unlevered) |
| Break-even occupancy | (OpEx + debt service) ÷ GSI |
| Projection | Income grows at rent growth; fixed expenses at expense growth; %-based expenses track income; value compounds at appreciation; sale at year N net of selling costs and loan payoff; IRR on annual cash flows |
| Sensitivity | 1-D, 2-D grids, and tornado (one-at-a-time swing, sorted) on any numeric input path |

## 3. ARV comp selection & confidence
Default filters: sold ≤ 6 months before valuation date, ≤ 1 mile, living area within ±25 %, positive adjusted price; IQR outlier trim (1.5×) when ≥ 4 comps. Every exclusion is recorded with a reason. Listings (e.g. RentCast) are **never** used as closed-sale comps automatically.

Confidence (heuristic, not a statistical interval) = 0.40·count + 0.35·dispersion + 0.15·recency + 0.10·distance, where count = min(n/5, 1); dispersion = 1 if CV ≤ 8 %, 0.3 if CV ≥ 30 %, linear between; recency = 1 − avgMonths/(1.5·maxAge); distance = 1 − avgMiles/(1.5·maxRadius). Fewer than 3 comps caps confidence at 0.35 and grades "insufficient". Grades: high ≥ 0.75, medium ≥ 0.55, else low.

## 4. Decision rules (wholesale)
`pass` if recommended ≤ 0 or asking exceeds it by > 10 %; `pursue` if asking ≤ recommended; `negotiate` if within 10 % or no asking price; downgrade `pursue → negotiate` when ARV confidence is low/insufficient.

## 5. Default assumptions (organization-configurable; labeled `user_assumption`)
ARV factor 70 %, assignment fee $10,000, hold 6 months, end-buyer profit 15 % of ARV, buyer closing 2 %, commission 5 %, seller closing 1.5 %, rehab contingency 10 %. Rehab $/sqft defaults (cosmetic $15, moderate $35, full $60, gut $90) are **placeholders** and flagged on every result until calibrated.

## 6. Verification
Reference values were computed with an independent Python implementation (closed-form amortization, bisection IRR) and asserted in tests: e.g. PMT($200k, 6 %, 360) = $1,199.10; balance after 60 payments = $186,108.71; total interest = $231,676.38; IRR([−1000, 300, 400, 500]) = 8.8963 %; rental example NOI $14,436, DSCR 1.2055, CoC 3.845 %. Cost-based MAO is verified by identity (end-buyer profit at MAO equals the target exactly). 60+ underwriting tests cover invalid inputs, edge cases (zero rates, no comps, negative IRR), determinism, and boundary decisions.

## 7. Limitations
Not an appraisal or BPO. Comp coverage depends on licensed data and may lag. Rehab requires walkthrough/bids. Heuristic confidence. Taxes, insurance, and rents must be verified locally.
