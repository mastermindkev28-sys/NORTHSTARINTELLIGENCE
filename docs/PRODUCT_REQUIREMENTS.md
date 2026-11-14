# Product Requirements — v1 "AI Acquisitions Desk"

**Status key:** ✅ implemented & tested · 🟡 partial · ⬜ not started. Last updated 2026-11-14.

## 1. Users & jobs

| Persona | Job to be done |
|---|---|
| Acquisition manager (AM) | Spend time only on qualified, underwritten sellers; know the negotiation ceiling before calling. |
| Owner/operator | See funnel, speed to lead, cost per appointment; trust that the team is compliant. |
| Lead manager / VA (replaced or augmented) | Respond instantly, collect facts, book appointments. |
| Compliance owner | Prove consent, opt-out handling, quiet hours, and disclosures for any message. |

## 2. Functional requirements

### Lead intake & intelligence
| ID | Requirement | Status |
|---|---|---|
| L-1 | Accept leads via signed webhook (HMAC-SHA256, 5-min replay window, size limit, schema validation) | ✅ `apps/web/src/app/api/webhooks/leads` |
| L-2 | Normalize phones (E.164), emails, names, addresses (USPS-style key) | ✅ `packages/leads` |
| L-3 | Detect duplicates (external ID, phone, address, email, fuzzy name) without auto-merging weak matches | ✅ |
| L-4 | Explainable lead score with factor breakdown; fair-housing signal allowlist | ✅ |
| L-5 | Identify missing qualification fields and neutral next questions | ✅ |
| L-6 | CSV import and CRM sync (GHL, Podio, REsimpli) | ⬜ |
| L-7 | Carrier line-type lookup before texting (NANP numbers can't be classified offline) | ⬜ |

### Conversations & qualification
| ID | Requirement | Status |
|---|---|---|
| C-1 | Every outbound message passes the compliance gate (consent, suppression, DNC freshness ≤ 31 days, quiet hours 08:00–20:00 recipient-local strictest-state, 3/24h cap, content rules) | ✅ `packages/compliance` |
| C-2 | Opt-out keywords (FCC 26-67 seven words + CTIA) and natural-language revocation honored immediately; one confirmation; revocation applies to all marketing | ✅ |
| C-3 | AI extracts qualification facts with verbatim evidence; unsupported values discarded; values labeled `ai_generated` with confidence | ✅ `packages/agents/qualification.ts` |
| C-4 | Escalate to human on negotiation, legal, attorney, imminent foreclosure, hostility, model refusal | ✅ |
| C-5 | Outbound seller text is templated (AI never free-writes to sellers in v1) | ✅ |
| C-6 | Live SMS via Twilio Messaging Service (A2P 10DLC registered per tenant) | 🟡 adapter built; per-tenant 10DLC onboarding ⬜ |
| C-7 | Voice (inbound AI answering with recording + AI disclosure) | ⬜ |
| C-8 | Appointment booking to calendar (Google/Microsoft/Calendly) | 🟡 task created; calendar integration ⬜ |

### Property research & underwriting
| ID | Requirement | Status |
|---|---|---|
| U-1 | Property facts with provenance (source, retrieval time, confidence); never invented | ✅ `packages/providers` |
| U-2 | Provider fallback chain; demo data refused in production | ✅ |
| U-3 | Comps-based ARV with transparent selection, exclusions, weighting, confidence | ✅ `packages/underwriting/arv.ts` |
| U-4 | Rehab estimate (line items or calibrated $/sqft; placeholders flagged) | ✅ |
| U-5 | MAO (rule and cost-based), assignment analysis, flip, rental (NOI/cap/CoC/DSCR), projections with IRR, sensitivity | ✅ |
| U-6 | Calculation trace and assumption register on every result | ✅ |
| U-7 | Human approval required for any negotiation ceiling/offer | ✅ |
| U-8 | Re-underwrite when seller states a new asking price | ✅ |
| U-9 | User comp adjustments UI and per-org calibration settings UI | ⬜ |

### Platform
| ID | Requirement | Status |
|---|---|---|
| P-1 | Multi-tenant isolation (Postgres FORCE RLS on every tenant table) | ✅ `packages/db` |
| P-2 | RBAC (owner, admin, manager, acquisitions, analyst, viewer) | ✅ model; ⬜ auth integration |
| P-3 | Durable workflows: idempotency, retries, dead-letter, sleeps, approvals, logs | ✅ `packages/workflows` |
| P-4 | Append-only audit log | ✅ |
| P-5 | Usage metering per org (leads, lookups, AI tokens, SMS segments) | ✅ events; ⬜ billing aggregation |
| P-6 | Authentication (Supabase Auth or equivalent), org onboarding | ⬜ |
| P-7 | Postgres domain repository (currently in-memory for demo) | ⬜ **top priority** |
| P-8 | Billing (Stripe subscriptions + metered usage) | ⬜ |

## 3. Non-functional requirements

- **Accuracy:** financial functions reproducible; verified against independent reference values.
- **Latency:** first response < 60 s p95 from lead receipt (inside the contact window).
- **Reliability:** workflow at-least-once execution, exactly-once step memoization; no duplicate outbound messages (idempotency keys).
- **Security:** tenant isolation enforced in the database; secrets never stored in the DB; webhook signatures verified.
- **Accessibility:** WCAG 2.2 AA target; keyboard focus visible; reduced-motion respected.
- **Auditability:** every outbound message stores its compliance decision and reason codes.

## 4. Out of scope (v1)

Native full CRM, list building, bulk skip tracing, AI cold calling, MLS data display, transaction management, portfolio management.
