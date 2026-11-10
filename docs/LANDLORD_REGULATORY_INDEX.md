# Landlord Regulatory Index (Pilot States)

**Status:** First pass, pilot states only · **Research date:** 2026-11-10 · **Scope:** Market Intelligence addendum §2
**Not legal advice.** Facts are taken from official statute or government pages where linked; a few local items rely on secondary summaries and are marked. Counsel must review before any customer-facing use.

The index is a set of **individual, cited factors** that users weight themselves. We do not publish a single "landlord-friendly" rank.

---

## 1. Factor schema (for the registry)

Each factor row: `jurisdiction` (state / city), `factor`, `value`, `unit`, `citation`, `source_url`, `effective_date`, `retrieved_at`, `verification` (official / secondary), `notes`. Changes create a new row with a new effective date (append-only, like the property event model).

---

## 2. State-level factors

| Factor | Pennsylvania | Illinois | Ohio |
|---|---|---|---|
| Notice before eviction for nonpayment | 10 days notice to quit after rent demand (§ 501(b)) [R1] | 5 days after service of demand; notice must carry the "Only FULL PAYMENT..." statement (735 ILCS 5/9-209; last amended P.A. 100-173, eff. 2018-01-01) [R2] | 3 days notice to leave before filing forcible entry and detainer, with required tenant statement (ORC 1923.04(A)) [R3] |
| Notice for end of term / breach | 15 days (lease ≤ 1 year or indeterminate); 30 days (lease > 1 year) (§ 501(b)) [R1] | Not verified | Not verified |
| Security deposit cap | 2 months' rent in year 1; 1 month in year 2+ (§ 511.1) [R1] | No state cap found (not verified) | No cap found (not verified) |
| Deposit return deadline | 30 days with written itemized list; forfeiture and up to double damages if missed (§ 512) [R1] | Security Deposit Return Act 765 ILCS 710 (official page blocked to automated fetch; terms not verified) | 30 days with itemized notice; damages equal to amount wrongfully withheld plus attorney fees (ORC 5321.16) [R4] |
| Interest on deposits | After 2nd anniversary; landlord may keep 1%/yr administrative fee (§ 511.2) [R1] | Not verified at state level | 5%/yr on the portion over the greater of $50 or one month's rent, if tenant stays ≥ 6 months (ORC 5321.16) [R4] |
| Local rent control | No state preemption statute found (not verified) | **Preempted**: local governments may not control rents on private residential or commercial property (50 ILCS 825/5) [R5] | **Preempted**: rent control/stabilization is a statewide concern; political subdivisions preempted (ORC 5321.20, eff. 2022-09-23) [R6] |

---

## 3. Local factors (pilot cities)

### Philadelphia, PA

| Factor | Value | Citation / source | Verification |
|---|---|---|---|
| Good cause to terminate or not renew | Required for **any** lease length, and before any action to terminate a tenancy | Bill 250330-AA amending Phila. Code § 9-804(12); signed 2026-05-07; **effective 2026-11-01** [R7] | Official (bill text) |
| Notice of nonrenewal for owner-occupant sale | 60 days | Bill 250330-AA [R7] | Official |
| Rental license | Required; generally annual; without it landlord may not collect rent or evict | City Fair Housing guide [R8] | Official (guide) |
| Certificate of Rental Suitability | Required for licensed rentals; copy and "Partners for Good Housing Handbook" to tenant | [R8] | Official (guide) |
| Lead certification | Pre-1978 rentals must be tested and certified even without children; required to collect rent or evict | [R8] | Official (guide) |
| Eviction diversion | Notice of Diversion Rights and ≥ 30 days in the Eviction Diversion Program before filing (§ 9-811); expiration removed by Bill 240245 | [R9] | **Secondary** (forum summary); verify against Code |
| No termination with open violations | Illegal to end a lease while City violations remain unresolved | [R8] | Official (guide) |

### Chicago, IL (RLTO, Municipal Code ch. 5-12)

| Factor | Value | Citation | Verification |
|---|---|---|---|
| Coverage | Exempts owner-occupied buildings of 6 or fewer units, among others | 5-12-010, 5-12-020 [R10] | Official (City summary) |
| Deposit handling | Receipt; federally insured interest-bearing Illinois account; disclose institution within 14 days | 5-12-080, 5-12-081 [R10] | Official (City summary) |
| Deposit interest | Annually on deposits held > 6 months at City Comptroller rate | [R10][R11] | Official |
| Deposit return | Itemized damages within 30 days; return within 45 days; up to 2x deposit plus interest for violations | [R10] | Official (City summary) |
| Entry notice | 2 days except emergencies | 5-12-050 [R10] | Official (City summary) |
| Late fees | $10/month on first $500 of rent, plus 5% of rent over $500 | 5-12-140(h) [R10] | Official (City summary) |
| Termination / nonrenewal / rent increase notice | 30 days (< 6 months tenancy), 60 days (6 months to 3 years), 120 days (> 3 years) | Fair Notice Ordinance [R10] | Official (City summary) |
| Disclosures | Foreclosure within 7 days; code citations from past 12 months; utility shutoff notices | 5-12-095, 5-12-100 [R10] | Official (City summary) |

### Cleveland, OH

| Factor | Value | Citation | Verification |
|---|---|---|---|
| Rental registration | Required for non-owner-occupied rentals; LLCs need Ohio Certificate of Good Standing | 2026 Rental Registration Guide [R12]; fee in Cod. Ord. § 365.03 (not fetched) | Official (guide) |
| Lead Safe Certificate | Required for rental units built before 1978 | [R12] | Official (guide) |
| Local agent | Required if owner lives outside Cuyahoga, Summit, Lake, Portage, Medina, Lorain or Geauga County | [R12] | Official (guide) |
| Rent control | Preempted by state (ORC 5321.20) | [R6] | Official |

---

## 4. What this means for investors (illustrative, not a ranking)

- **Philadelphia** has the heaviest operating requirements of the three cities (license, suitability certificate, lead certification, eviction diversion, and expanded good cause from 2026-11-01). That is a cost and timeline factor, and a compliance feature opportunity for Northstar.
- **Illinois and Ohio** preempt local rent control statewide; **Chicago** still adds substantial deposit, notice and disclosure rules.
- **Ohio** has the shortest pre-filing nonpayment notice of the three (3 days).

Court timelines (filing to judgment to possession) are not yet sourced; candidates are state court annual reports and municipal court statistics.

---

## 5. Next research steps

1. Verify Illinois Security Deposit Return Act terms via an alternate official copy.
2. Confirm Pennsylvania has no state rent control preemption, and capture PA and IL end-of-term notice rules.
3. Fetch Cleveland Cod. Ord. ch. 365 and Philadelphia § 9-811 directly.
4. Add court timeline data, habitability statutes, entry notice (PA, OH state law), rental inspection programs.
5. Set up a monitoring list (legislature and council bill trackers) for the monitoring agent.

---

## Sources (all retrieved 2026-11-10)

- [R1] Pennsylvania Landlord and Tenant Act of 1951 (official PDF). https://www.legis.state.pa.us/wu01/li/li/us/pdf/1951/0/0020..pdf
- [R2] 735 ILCS 5/9-209. https://www.ilga.gov/legislation/ilcs/documents/073500050K9-209.htm
- [R3] Ohio Revised Code 1923.04. https://codes.ohio.gov/ohio-revised-code/section-1923.04
- [R4] Ohio Revised Code 5321.16. https://codes.ohio.gov/ohio-revised-code/section-5321.16
- [R5] 50 ILCS 825/5 (Rent Control Preemption Act). https://ilga.gov/legislation/ilcs/documents/005008250K5.htm
- [R6] Ohio Revised Code 5321.20. https://codes.ohio.gov/ohio-revised-code/section-5321.20
- [R7] Philadelphia Bill No. 250330-AA. https://files.amlegal.com/pdffiles/Philadelphia/250330-AA.pdf
- [R8] City of Philadelphia, Fair Housing guide (landlord duties). https://www.phila.gov/media/20251106145008/Fair-Housing-guide-1.pdf
- [R9] BiggerPockets forum, "Philadelphia Eviction Diversion and Good Cause" (secondary). https://www.biggerpockets.com/posts/7323275
- [R10] City of Chicago, RLTO Summary 2023. https://www.chicago.gov/content/dam/city/depts/doh/RLTO/RLTO%20Summary_2023_EN_FINAL.pdf
- [R11] City of Chicago, Security Deposit Interest Rates. https://www.chicago.gov/city/en/depts/doh/supp_info/security_depositinterestrates.html
- [R12] City of Cleveland, 2026 Rental Registration Guide. https://www.clevelandohio.gov/sites/clevelandohio/files/Building%20and%20Housing/2026%20Rental%20Registration%20Guide.pdf
