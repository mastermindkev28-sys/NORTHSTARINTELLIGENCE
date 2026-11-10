# Underwriting Methodology

Engine: `@northstar/underwriting` v1.0.0 (`packages/underwriting`). All functions are pure and deterministic. Rates are decimals inside the engine (0.07 = 7%); the UI accepts percentages and converts them in `@northstar/core/validation`.

> **Limitations.** Results are calculations on stated inputs. They are not appraisals, not guaranteed valuations, and not predictions of investment outcomes. ARV from comparables is only as good as the comps and adjustments supplied. Every report carries this disclaimer.

## 1. Input classification

Every input is tagged with one of the classes required by the operating brief:

| Class | Meaning | Example |
|---|---|---|
| `verified` | Confirmed against a primary record | deed, closing statement, signed contract, lender quote |
| `user_assumption` | Operator's own estimate or policy (default for bare numbers) | repair budget, 70% multiplier, vacancy |
| `third_party_estimate` | From a data provider | AVM value, rent estimate, contractor bid |
| `ai_interpretation` | Extracted or inferred by AI, not yet verified | sale price read from a PDF |
| `calculated` | Output of an engine function | MAO, NOI, DSCR |

Derived values (e.g. an ARV computed from comps, a repair total computed from line items) are recorded as calculated steps, never re-labelled as assumptions. Reports group assumptions by class and list every formula in order.

## 2. Formulas

### 2.1 ARV from comparable sales (`calculateArv`)
For each comp *i*: Adjusted Price = Sale Price + Σ adjustments; Adjusted $/sqft = Adjusted Price ÷ Comp Sqft; Indicated Value = Adjusted $/sqft × Subject Sqft.
**ARV = Σ(Indicated Value × Weight) ÷ Σ Weight** (weights default to 1). Median, low, high, and coefficient of variation are reported.
Warnings: fewer than 3 comps; net adjustments > 25% of sale price; distance above limit (default 1 mi); sale older than limit (default 180 days) or after the valuation date; AI-extracted prices; dispersion (CV) > 15%.

### 2.2 Renovation (`estimateRenovation`)
Subtotal = Σ(Quantity × Unit Cost); Contingency = Subtotal × rate (default 10%); Total = Subtotal + Contingency. Warns when contingency < 5%.

### 2.3 Closing / acquisition costs (`calculateClosingCosts`)
Total = Σ(Base Price × each percentage) + Σ fixed fees.

### 2.4 Holding costs (`calculateHoldingCosts`)
Monthly = Tax ÷ 12 + Insurance ÷ 12 + Utilities + HOA + Maintenance + Other; Total = Monthly × Months.

### 2.5 Financing costs (`calculateFinancingCosts`)
Loan = Price × LTV (or explicit amount) + financed rehab. Points = Loan × points.
Interest-only payment = Loan × Rate ÷ 12. Amortizing payment **P = L·r ÷ (1 − (1 + r)^−n)**, r = Rate ÷ 12 (linear when r = 0). Interest over hold is summed on the declining balance.
Total financing cost = Points + Lender fees + Interest.

### 2.6 Disposition costs (`calculateDispositionCosts`)
Commission = Sale × rate; Seller closing = Sale × rate; Total = Commission + Seller closing + Concessions + Other; Net proceeds = Sale − Total.

### 2.7 Maximum allowable offer
- **Rule of thumb (`calculateMao`)**: Buyer Max = ARV × Multiplier − Repairs − Other; **MAO = Buyer Max − Assignment Fee**. Multiplier default 0.70 is an assumption, not a law.
- **Cost stack (`calculateDetailedMao`)**: Buyer Max = ARV − (Repairs + Acquisition + Holding + Financing + Disposition) − Target Profit; MAO = Buyer Max − Assignment Fee.
- **Recommended max offer** = min(rule of thumb, cost stack). In the deal report, the buyer's percentage-based costs are estimated at the rule-of-thumb buyer price, which is stated in the trace.

### 2.8 Assignment-fee analysis (`analyzeAssignment`)
Fee = Buyer Price − Contract Price; Wholesaler Net = Fee − Wholesaler Costs; Buyer All-in = Buyer Price + Repairs + Buyer Other Costs; Buyer Profit = ARV − All-in; Buyer Margin = Profit ÷ ARV.
**Max supportable fee** = ARV − ARV × Min Margin − Repairs − Other − Contract Price (the fee that leaves the buyer exactly at their minimum margin; verified by test).

### 2.9 Flip returns (`analyzeFlip`)
Total Project Cost = Purchase + Repairs + Acquisition + Holding + Financing + Disposition; Net Profit = Sale − Total; Return on cost = Profit ÷ Total; Return on cash = Profit ÷ Cash invested (all-cash default excludes disposition, which is paid from proceeds); Annualized = (1 + ROI)^(12 ÷ months) − 1.

### 2.10 Rental (`analyzeRental`)
GPR = Σ unit rents × 12; Vacancy = GPR × rate; EGI = GPR − Vacancy + Other income.
OpEx = Tax + Insurance + EGI × Mgmt + GPR × (Maintenance + CapEx) + (HOA + Utilities) × 12 + Other.
**NOI = EGI − OpEx. Cap rate = NOI ÷ Price. Cash flow = NOI − Annual debt service. Cash-on-cash = Cash flow ÷ Cash invested. DSCR = NOI ÷ Annual debt service.**
Cash invested = Price − Loan + Closing + Points + Initial repairs. Also: GRM = Price ÷ GPR; Break-even occupancy = (OpEx + Debt service) ÷ Gross potential income; Rent-to-price = Monthly rent ÷ (Price + Repairs).
Warnings: DSCR < 1.00 (critical), DSCR < 1.25 (caution), negative cash flow, 0% vacancy, no reserves, self-management.

### 2.11 Projection (`projectRental`)
Year *y*: EGI × (1 + rent growth)^(y−1); OpEx × (1 + expense growth)^(y−1); Value = Price × (1 + appreciation)^y; Loan balance by closed form. Exit: Net sale = Value × (1 − exit cost rate) − Balance. **IRR** of [−Cash invested, CF₁ … CFₙ + Net sale] by bracketed bisection on [−99.99%, 1000%] (deterministic; returns null when no sign change). Equity multiple = (Σ CF + Net sale) ÷ Cash invested. Projections are labelled as extrapolations, not forecasts.

### 2.12 Sensitivity and scenarios
Two-way grids at −10%, −5%, base, +5%, +10%: MAO across ARV × repairs; cash-on-cash and DSCR across rent × interest rate. `compareFinancingScenarios` runs identical operating assumptions under multiple loan structures (all cash, conventional, DSCR loan, etc.).

## 3. Numerical policy

- Full double precision internally; outputs rounded to cents with half-away-from-zero using exponent shifting (`1.005 → 1.01`).
- Rates and ratios are returned unrounded for display formatting.
- Invalid inputs (NaN, ±∞, negative where not allowed, rates > 100%, non-integer terms) throw `UnderwritingInputError` naming the field. Nothing is coerced or defaulted silently; defaults (e.g. 70% multiplier, 10% contingency) are recorded as assumptions.

## 4. Reproducibility

Each saved analysis stores the form, the engine input, the full report, `engine_version`, and `inputs_fingerprint` (FNV-1a over key-sorted JSON). The server recomputes every report on save. Finalized analyses are immutable at the database level. Changing any formula requires bumping `ENGINE_VERSION`.

## 5. Verification

`packages/underwriting/test`: 103 tests at ≥99% line coverage, including textbook values (e.g. $200,000 at 6% for 30 years = $1,199.10/month), boundary and invalid inputs, reconciliation tests (cost stack reconciles to MAO; max supportable fee leaves margin exactly at minimum), determinism and fingerprint stability, and seeded property-based invariants (MAO linearity, amortization identities, IRR root property, NOI/cash-flow identities across 300 random deals).
