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

### Market Intelligence (0005)

Global reference tables `geo_areas`, `geo_metric_observations`, `regulatory_factors` are readable by any authenticated user and writable only by `northstar_ingest`; `regulatory_factors` is append-only and observation metric names matching protected characteristics are rejected by a check constraint. Tenant tables `market_score_profiles`, `market_watchlists`, `market_watchlist_items`, `market_alert_rules`, `market_alerts` use the standard policy set with same-org guards; alerts are unique per (org_id, dedupe_key). See `docs/MARKET_INTELLIGENCE_ENGINE.md`. Tests: `packages/db/test/market.test.ts`.

## Invariants proven by tests (`packages/db/test/rls.test.ts`)

- App role is not superuser, not owner, `NOBYPASSRLS`; every public table has RLS enabled and forced.
- No context → zero rows from every table and no inserts.
- Tenant A cannot read, update, delete, insert into, or move rows into tenant B, including via unfiltered queries, forged `app.org_id`, cross-tenant foreign keys, or 20 concurrent mixed-tenant transactions on a shared pool.
- Context never leaks across pooled connections.
- Role matrix (viewer read-only, analyst no delete, audit owner/admin only, membership management, owner grant, last-owner guard, suspended members lose access).
- Audit is automatic, records request ids and changed columns, is append-only even for the owner, and cannot be forged.
- Finalized analyses are immutable; sessions resolve only when valid; sign-up is atomic; metering is idempotent per org.

## Conventions for new tables

1. Add `org_id uuid not null references organizations(id) on delete cascade`.
2. Add the `default_org_id` and `touch_updated_at` triggers.
3. `select app.apply_tenant_policies('public.<table>');`
4. Add same-org guard triggers for every foreign key to another tenant table.
5. Extend `rls.test.ts`: the "every table has forced RLS" test will fail until step 3 is done.
