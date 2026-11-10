# Database Schema

PostgreSQL 16. Source of truth: `packages/db/migrations/*.sql` (applied in order, checksummed in `public.schema_migrations`). Isolation design: [ARCHITECTURE_DECISIONS.md, ADR-003](ARCHITECTURE_DECISIONS.md).

## Roles

| Role | Purpose |
|---|---|
| migration owner (e.g. `postgres`) | Owns all objects; runs migrations. Superuser or `BYPASSRLS`. Never used by the app. |
| `northstar_app` | NOLOGIN group role granted table privileges. `NOBYPASSRLS`. |
| app login role (e.g. `northstar_web`) | Member of `northstar_app`; the only credential in `DATABASE_URL`. |

## Context functions (schema `app`)

| Function | Returns |
|---|---|
| `app.current_user_id()` / `app.current_org_id()` | from transaction-local settings `app.user_id` / `app.org_id` |
| `app.member_role(org)` | caller's active role in `org` (security definer, avoids policy recursion) |
| `app.is_member(org)`, `app.has_role(org, roles[])` | membership checks |
| `app.in_tenant(org)` | `org = current_org_id() AND is_member(org)`: the core tenant predicate |
| `app.can_write(org)` | owner, admin, manager, acquisitions, analyst |
| `app.can_delete(org)` | owner, admin, manager |
| `app.is_suppressed(channel, address)` | opt-out check for the current org |

Security-definer entry points (granted to `northstar_app` only): `app.sign_up`, `app.create_organization`, `app.login_lookup`, `app.create_session`, `app.resolve_session`, `app.switch_session_org`. `app.write_audit` is internal (not granted).

## Tables

### Identity and tenancy (0001)

**organizations**: `id uuid pk`, `name`, `slug citext unique` (DNS-label format), `plan` (default `trial`), `status` (`active|suspended|closed`), `settings jsonb`, timestamps.
RLS: select if member; update if owner/admin of the current org. Insert only via `app.sign_up` / `app.create_organization`.

**users**: `id`, `email citext unique`, `display_name`, `password_hash` (scrypt, nullable for SSO), `email_verified_at`, `status` (`active|disabled`), `last_login_at`, timestamps.
RLS: see yourself and members of the current org; update only yourself.

**memberships**: pk `(org_id, user_id)`, `role app.org_role`, `status app.membership_status` (`active|invited|suspended`), timestamps.
RLS: see your own memberships and all of the current org's; insert/update by owner/admin; delete by owner/admin or self.
Triggers: `guard_last_owner` (an org never loses its last active owner), `guard_owner_grant` (only owners grant/revoke owner), row-change audit.

**sessions**: `id`, `token_hash bytea unique` (SHA-256 of the opaque token), `user_id`, `active_org_id`, `ip inet`, `user_agent`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at`.
RLS: a user sees and revokes only their own sessions. Creation/resolution via security-definer functions; TTL capped at 30 days.

**audit_log**: `id bigint identity`, `org_id`, `actor_type` (`user|agent|system|api_key`), `actor_user_id`, `actor_label`, `action` (dotted lowercase, e.g. `underwriting_analyses.update`), `target_type`, `target_id`, `metadata jsonb`, `ip`, `request_id`, `occurred_at`.
Append-only: triggers block UPDATE, DELETE, and TRUNCATE for everyone including the owner; the app role has no UPDATE/DELETE grant. Read by owner/admin of the org. Members may append entries attributed to themselves in their current org only.
`app.audit_row_change()` records **which columns changed, never their values**, so the audit log does not become a second copy of sensitive data.

### Domain (0002)

All tables: `org_id NOT NULL`, FORCE RLS, standard policy set from `app.apply_tenant_policies()` (select: member; insert/update: `can_write`; delete: `can_delete`), `org_id` defaulted from context, row-change audit trigger.

**properties**: address (`address_line1`, `address_line2`, `city`, `state` 2-letter, `postal_code`), `county`, `apn`, `property_type`, `bedrooms`, `bathrooms`, `living_sqft`, `lot_sqft`, `year_built`, `provenance jsonb` (per-field provider, record id, retrieved at, confidence), `created_by`. Unique per org on normalized address.

**leads**: `property_id` (same-org guard), `source`, `external_ref` (unique per org+source for idempotent imports), `status app.lead_status` (`new → contacting → qualified → appointment_set → offer_made → under_contract → closed_won|closed_lost|dormant`), seller contact (`seller_phone` E.164), `asking_price`, `motivation`, `timeline`, `owner_user_id`, `score 0–100`, `next_action_at`.

**underwriting_analyses**: `property_id`, `lead_id` (same-org guards), `name`, `kind` (`wholesale_deal|rental`), `status` (`draft|final|archived`), `engine_version`, `inputs jsonb`, `report jsonb`, `inputs_fingerprint` (16 hex). Trigger `freeze_final_analysis` makes inputs/report/engine version immutable once final.

**communication_suppressions**: `channel` (`sms|voice|email|all`), `address`, `reason` (`opt_out|dnc_registry|litigator|manual|bounce|complaint`), `source`. Unique per org+channel+address. Any member (including viewers) may insert: honoring a stop request is never blocked by role.

**usage_events**: `meter` (dotted), `quantity > 0`, `idempotency_key` (unique per org), `metadata`, `occurred_at`. Insert/select only for the app role.

### Discover (0003, ADR-015)

**Global reference data (schema `discover`)**: written only by `northstar_ingest`; members of the request's organization may read. FORCE RLS on every table.

- **county_sources**: `source_key` (e.g. `phl.rtt_summary`), state, `county_fips`, category, platform (`socrata|arcgis|carto|bulk|licensed|manual|demo`), status (`planned|built|verified|disabled`), `mapping_verified`, license fields (`license_tag`, `automated_access`, `commercial_display`, `attribution_required`, `license_reviewed_on`). A prohibited source cannot be `built`/`verified`; `verified` requires `mapping_verified` and `verified_on`.
- **ingestion_runs**: per-run status and counts (fetched, inserted, unchanged, matched, queued for review, events appended, anomalies), resume cursor, error. Internal.
- **parcels**: state, `county_fips`, `apn`/`apn_normalized` (unique per county), normalized address and `address_key`, ZIP, optional lat/lon.
- **source_records**: append-only versions per (`source_key`, `source_record_id`), `content_hash` (re-ingesting identical content is a no-op), `instrument jsonb` (generic: type, number/book/page, recorded and instrument dates, parties with roles, consideration, APN), `attributes`, `license_tag`, `is_demo`. Mortgage consideration is the original recorded amount, never a current balance.
- **record_links**: record → parcel with `confidence`, reasons, `method` (`auto` requires ≥ 0.85; lower needs `human`).
- **match_reviews**: uncertain matches with candidates, one open review per record; a decision must set `decided_at`, and `linked` must name a parcel. Internal.
- **property_events**: append-only versions (`event_type` from `discover.signal_type`, `status` from `discover.event_status`, event/filed/scheduled dates, amount, `discovered_at`, `supersedes_version` = version − 1, `origin` `source|expiry_rule`, `anomaly`). View `current_property_events` returns the latest version with its parcel link.
- Records, links, and events are visible to members only when the source's `commercial_display` is `permitted` (or the source is demo).

**Tenant tables (standard policies)**: `investor_profiles` (experience, capital, financing list, risk tolerance, hold years, strategies), `buy_boxes` (strategies `app.investment_strategy[]`, criteria jsonb, optional same-org profile), `saved_searches` (filters, alert cadence), `watchlist_items` (unique per org + parcel).

## Invariants proven by tests (`packages/db/test/rls.test.ts`, `discover.test.ts`)

- App role is not superuser, not owner, `NOBYPASSRLS`; every public table has RLS enabled and forced.
- No context → zero rows from every table and no inserts.
- Tenant A cannot read, update, delete, insert into, or move rows into tenant B, including via unfiltered queries, forged `app.org_id`, cross-tenant foreign keys, or 20 concurrent mixed-tenant transactions on a shared pool.
- Context never leaks across pooled connections.
- Role matrix (viewer read-only, analyst no delete, audit owner/admin only, membership management, owner grant, last-owner guard, suspended members lose access).
- Audit is automatic, records request ids and changed columns, is append-only even for the owner, and cannot be forged.
- Finalized analyses are immutable; sessions resolve only when valid; sign-up is atomic; metering is idempotent per org.
- Discover: members cannot write global tables or read internal ones; anonymous or forged-org sessions see no global data; non-displayable sources are invisible; records and events are append-only even for the owner; version chains, the auto-link threshold, license constraints, and review decisions are enforced; the strategy enum matches the TypeScript list; buy boxes, profiles, searches, and watchlists are tenant-isolated.

## Conventions for new tables

1. Add `org_id uuid not null references organizations(id) on delete cascade`.
2. Add the `default_org_id` and `touch_updated_at` triggers.
3. `select app.apply_tenant_policies('public.<table>');`
4. Add same-org guard triggers for every foreign key to another tenant table.
5. Extend `rls.test.ts`: the "every table has forced RLS" test will fail until step 3 is done.
