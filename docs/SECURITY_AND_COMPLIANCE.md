# Security and Compliance

Status of each control in the operating brief (section 13). **Implemented** means built and covered by tests; **Partial** means foundation built with a stated gap; **Planned** means not started.

## Controls

| Control | Status | Implementation |
|---|---|---|
| Tenant data isolation | Implemented | Forced RLS on every table; membership-verified tenant predicate; same-org FK guards; 35 integration tests (DATABASE_SCHEMA.md) and a browser test proving a second workspace gets 404 on a foreign analysis URL |
| Row-level security | Implemented | `packages/db/migrations`; app role is non-owner, `NOBYPASSRLS` |
| Role-based permissions | Implemented | 6 roles; enforced in SQL policies, mirrored in `@northstar/core/rbac` for UI; owner-grant and last-owner invariants |
| Authentication security | Partial | scrypt hashing with stored parameters and hostile-parameter limits; constant-time verification; equal-time path for unknown users; opaque 256-bit tokens stored only as SHA-256; HttpOnly/SameSite=Lax/Secure cookies; server-side revocation; login rate limit. **Gaps:** email verification, password reset, MFA, shared-store rate limiting (pre-GA) |
| API authorization | Implemented (first-party) | Every Server Action and page runs inside `asTenant`; RBAC pre-checks; RLS as backstop. Public API keys: Planned |
| Audit records | Implemented | Append-only `audit_log`, automatic row-change auditing (changed columns only), request-id correlation, owner/admin viewer |
| Webhook validation | Implemented (library) | HMAC-SHA256 over timestamp+body, constant-time compare, 5-minute replay window, multi-secret rotation (`@northstar/core/webhooks`). Wiring to endpoints lands with the first inbound integration |
| Rate limiting | Partial | Token bucket interface; in-memory implementation. Shared store required for multi-instance production (ADR-007) |
| Input validation | Implemented | zod at every boundary; engine re-validates every number; SQL is parameterized; DB CHECK constraints |
| Encrypted data storage | Partial | TLS in transit and encryption at rest come from the managed Postgres host (verify on provisioning). Field-level encryption for especially sensitive fields (e.g. future SSN/bank data, which we do not collect today): Planned |
| Secrets management | Partial | No secrets in code; `.env.example` documents variables; production secrets in the hosting provider's encrypted env store. Rotation runbook: Planned |
| Security headers | Implemented | HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; `poweredByHeader` off. CSP: Planned (needs nonce support review) |
| Structured logging with redaction | Implemented | Keys matching password/secret/token/cookie/api key/hash are redacted |
| Backup and recovery | Planned | Requires managed Postgres with PITR; restore drill to be documented in DEPLOYMENT_GUIDE |
| Data retention controls | Planned | Per-org retention settings and purge jobs; audit retention policy must be decided (see open decisions) |
| Incident monitoring | Planned | Error tracking + uptime checks + alerting (ADR-013) |
| AI agent least privilege | Designed | ADR-014: agents use tool wrappers inside tenant context with task-scoped roles; human approval for consequential actions |

## Communications compliance (TCPA, DNC, CAN-SPAM)

Implemented in `@northstar/integrations/messaging`, enforced for every send:
- Suppression list checked first (per org, channel or all channels). Any member can record an opt-out.
- SMS/voice require recorded evidence of prior express consent (method, timestamp, reference).
- Recipient-local quiet hours: sends allowed 8:00–21:00 in the recipient's timezone; unknown timezone blocks the send.
- Opt-out keyword recognition (STOP, UNSUBSCRIBE, CANCEL, END, QUIT, REVOKE, OPT OUT) for inbound handling.
- Idempotency prevents duplicate sends on retries.

**Requires counsel before launch:** consent language and capture flows, federal and state DNC registry scrubbing (provider and licensing), state-specific mini-TCPA rules and hours, A2P 10DLC registration, recordkeeping periods. The gate is an engineering floor, not legal advice.

## Fair housing and real estate regulation

Lead scoring and AI-assisted qualification must not use protected characteristics or proxies for them (race, color, religion, sex, handicap, familial status, national origin, plus state/local classes). Scoring features will be documented and reviewed before Acquire launches. Wholesaling and assignment practices are regulated differently by state (some require licensure or disclosure); product copy and workflows must not imply legal compliance without review.

## Data licensing

Property data stays tied to its provider via `licenseTag`; caching and display follow per-provider license configuration. No redistribution of provider data outside the licensed tenant. Mock data is always flagged and labelled DEMO.

## Responsible disclosure and testing

- Security tests run in CI: RLS isolation, authorization boundaries, append-only audit, webhook tampering/replay, password edge cases.
- Before GA: third-party penetration test, dependency scanning (GitHub Dependabot/`pnpm audit`), secret scanning on the repository.

## Open security decisions (need owner input)

1. Audit log retention period (proposal: 7 years for financial-decision records, configurable per enterprise contract).
2. MFA policy: required for owners/admins at GA (proposal) or optional.
3. Whether to support customer-managed keys or dedicated databases for enterprise tier.
