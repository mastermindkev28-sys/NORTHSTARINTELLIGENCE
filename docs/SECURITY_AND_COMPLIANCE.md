# Security & Compliance

Last updated 2026-11-14. This document describes controls as implemented and planned. It is not legal advice; compliance policy data requires counsel review (`research/messaging-compliance-research.md`).

## 1. Tenant isolation & access control
| Control | Status |
|---|---|
| FORCE RLS on every tenant table; app role without BYPASSRLS; fail-closed without context | ✅ tested against Postgres |
| Transaction-local tenant context (no pooled-connection leakage) | ✅ tested |
| Cross-tenant worker access only via narrow SECURITY DEFINER functions | ✅ |
| Application-level `assertSameTenant` (returns NOT_FOUND to avoid existence leaks) | ✅ |
| RBAC roles and permissions; agents get least-privilege grants; agents cannot approve | ✅ model + engine enforcement; ⬜ route-level auth integration |
| Authentication (MFA, SSO for enterprise) | ⬜ ADR-005 |

## 2. Data protection
- Secrets only in the platform secret manager; DB stores `secret_ref` pointers. `.env` git-ignored; `.env.example` documents required keys.
- Logs: structured JSON with automatic redaction of phone, email, tokens, keys, cookies, SSN, DOB.
- Encryption: TLS in transit; managed-Postgres encryption at rest (provider). Field-level encryption for skip-trace data planned.
- Audit: append-only `audit_log` (trigger blocks UPDATE/DELETE); hash chaining planned (`0002`).
- Backups: managed PITR (≥ 7 days) + quarterly restore drill (planned).
- Retention: messaging/consent evidence and internal DNC ≥ 5 years (per research); configurable per org (planned).

## 3. Application security
| Control | Status |
|---|---|
| Webhook HMAC verification, timestamp window, constant-time compare, size limit, schema validation | ✅ |
| Twilio signature validation | ✅ (verified vs. documented example) |
| Idempotency on events, runs, messages, usage | ✅ |
| Input validation with Zod at every boundary | ✅ |
| Security headers (nosniff, frame deny, referrer, permissions policy) | ✅ |
| Rate limiting on public endpoints | ⬜ (edge/WAF + per-tenant token bucket) |
| CSP with nonces | ⬜ |
| Dependency scanning / secret scanning in CI | ⬜ |

## 4. AI safety controls
- Structured outputs only; evidence-verified extraction; AI values labeled `ai_generated` with confidence.
- Opt-out detection never delegated to the model.
- No AI free-text to sellers in v1; templates reviewed for compliance.
- Prohibited claims blocked (binding offers, guarantees, licensing representations, legal/tax advice).
- Human approval for offers, contracts, financial commitments, destructive actions.
- Model refusals escalate to humans (server-side fallback enabled).
- Protected characteristics never extracted, stored, or used.

## 5. Messaging compliance (TCPA, DNC, state law, CTIA) — implemented in `packages/compliance`
| Rule | Implementation |
|---|---|
| Consent | Automated marketing and AI/artificial voice require **prior express written consent** with stored disclosure text (DB CHECK); informational automated messages require express consent; inquiry EBR (90 days) only exempts manual calls from DNC |
| Revocation (FCC 26-67, eff. 2026-11-25) | Seven required keywords + CTIA variants + natural-language phrases; immediate suppression; consent revoked; one confirmation; **revocation of marketing applies to all channels** |
| Quiet hours | 08:00–20:00 recipient local time (platform policy); strictest across area-code state (FL/OK/MD presumptions), property state, mailing state; multi-zone states use most restrictive zone; unknown location → no send (review); orgs may only tighten |
| Frequency | ≤ 3 solicitation attempts per rolling 24 h (FL/OK/MD), platform-wide |
| DNC | National registry scrub required within 31 days for non-EWC marketing; unknown → block; internal suppression always blocks |
| Number source | Skip-traced/purchased-list numbers never receive automated SMS or AI voice |
| Content | Sender identification + "Reply STOP" on first message; AI disclosure; prohibited claims; fair-housing screen |
| A2P 10DLC | Per-tenant brand/campaign registration required before SMS (⬜ onboarding flow) |
| Call recording / AI voice disclosure | Required on every call (⬜ voice not yet built) |

## 6. Fair housing
Lead scoring uses an allowlist of property/transaction/engagement signals (test proves name changes don't change scores). Targeting criteria are checked against prohibited attributes. Outbound content is screened for discriminatory/steering language (escalation, not auto-send).

## 7. Real estate regulation
Wholesaling laws in 22 states + Philadelphia (licensing, disclosure, marketing equitable interest, cancellation rights). Assignment analysis warns on every run; state rule packs and required disclosures are planned with counsel.

## 8. Data licensing
Provider terms default to internal use. Before production: signed rights to display to tenants, cache (with refresh limits, e.g. BatchData 30 days), and send data to an LLM. Demo data refused in production by the registry.

## 9. Incident response (to formalize)
Severity matrix, on-call, customer notification within contractual/legal timelines, post-incident review. Compliance incidents (e.g., message sent after opt-out) are Sev-1.
