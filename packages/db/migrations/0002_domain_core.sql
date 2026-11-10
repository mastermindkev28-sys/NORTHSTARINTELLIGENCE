-- =============================================================================================
-- 0002_domain_core: first tenant-owned domain tables.
--   properties                 - canonical property records with per-field provenance
--   leads                      - seller leads (Acquire division)
--   underwriting_analyses      - saved, reproducible underwriting runs (Underwrite division)
--   communication_suppressions - opt-out / do-not-contact list (TCPA / DNC compliance)
--   usage_events               - metered usage for billing, idempotent per org
-- Every table: org_id NOT NULL, FORCE RLS, tenant-scoped policies, row-change audit trigger.
-- =============================================================================================

-- Roles allowed to create and edit operational records.
create or replace function app.can_write(target_org uuid) returns boolean
language sql stable
as $$ select app.has_role(target_org, '{owner,admin,manager,acquisitions,analyst}') $$;

-- Roles allowed to delete operational records.
create or replace function app.can_delete(target_org uuid) returns boolean
language sql stable
as $$ select app.has_role(target_org, '{owner,admin,manager}') $$;

-- Applies the standard tenant policy set and audit trigger to a table.
create or replace function app.apply_tenant_policies(tbl regclass) returns void
language plpgsql
as $$
declare
  t text := tbl::text;
  n text := replace(tbl::text, 'public.', '');
begin
  execute format('alter table %s enable row level security', t);
  execute format('alter table %s force row level security', t);
  execute format('create policy %I on %s for select to northstar_app using (app.in_tenant(org_id))', n || '_select', t);
  execute format('create policy %I on %s for insert to northstar_app with check (app.in_tenant(org_id) and app.can_write(org_id))', n || '_insert', t);
  execute format('create policy %I on %s for update to northstar_app using (app.in_tenant(org_id) and app.can_write(org_id)) with check (app.in_tenant(org_id) and app.can_write(org_id))', n || '_update', t);
  execute format('create policy %I on %s for delete to northstar_app using (app.in_tenant(org_id) and app.can_delete(org_id))', n || '_delete', t);
  execute format('grant select, insert, update, delete on %s to northstar_app', t);
  execute format('create trigger %I after insert or update or delete on %s for each row execute function app.audit_row_change()', n || '_audit', t);
end $$;

-- Default org_id from the tenant context so callers cannot accidentally omit it.
create or replace function app.default_org_id() returns trigger
language plpgsql
as $$
begin
  if new.org_id is null then new.org_id := app.current_org_id(); end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------------------------
create table public.properties (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  address_line1  text not null check (length(btrim(address_line1)) between 1 and 200),
  address_line2  text,
  city           text not null,
  state          char(2) not null check (state ~ '^[A-Z]{2}$'),
  postal_code    text not null check (postal_code ~ '^\d{5}(-\d{4})?$'),
  county         text,
  apn            text,
  property_type  text check (property_type in ('single_family', 'multi_family', 'condo', 'townhouse', 'manufactured', 'land', 'commercial', 'other')),
  bedrooms       numeric(4,1) check (bedrooms >= 0),
  bathrooms      numeric(4,1) check (bathrooms >= 0),
  living_sqft    integer check (living_sqft > 0),
  lot_sqft       integer check (lot_sqft > 0),
  year_built     smallint check (year_built between 1600 and 2100),
  -- Per-field provenance: { "living_sqft": { "source": "...", "providerRecordId": "...", "retrievedAt": "...", "confidence": 0.9 } }
  provenance     jsonb not null default '{}'::jsonb,
  created_by     uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index properties_org_address_uq on public.properties
  (org_id, lower(address_line1), coalesce(lower(address_line2), ''), postal_code);
create index properties_org_apn_idx on public.properties (org_id, apn) where apn is not null;
create trigger properties_default_org before insert on public.properties for each row execute function app.default_org_id();
create trigger properties_touch before update on public.properties for each row execute function app.touch_updated_at();
select app.apply_tenant_policies('public.properties');

-- ---------------------------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------------------------
create type app.lead_status as enum ('new', 'contacting', 'qualified', 'appointment_set', 'offer_made', 'under_contract', 'closed_won', 'closed_lost', 'dormant');

create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  property_id      uuid references public.properties(id) on delete set null,
  source           text not null,
  external_ref     text,
  status           app.lead_status not null default 'new',
  seller_name      text,
  seller_phone     text check (seller_phone is null or seller_phone ~ '^\+[1-9]\d{6,14}$'),
  seller_email     citext,
  asking_price     numeric(14,2) check (asking_price >= 0),
  motivation       text,
  timeline         text,
  owner_user_id    uuid references public.users(id) on delete set null,
  score            smallint check (score between 0 and 100),
  next_action_at   timestamptz,
  created_by       uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index leads_org_external_uq on public.leads (org_id, source, external_ref) where external_ref is not null;
create index leads_org_status_idx on public.leads (org_id, status, next_action_at);
create index leads_org_phone_idx on public.leads (org_id, seller_phone) where seller_phone is not null;
create trigger leads_default_org before insert on public.leads for each row execute function app.default_org_id();
create trigger leads_touch before update on public.leads for each row execute function app.touch_updated_at();
select app.apply_tenant_policies('public.leads');

-- Cross-tenant FK guard: a lead may only reference a property in the same organization.
create or replace function app.guard_same_org_property() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if new.property_id is not null and not exists (
    select 1 from public.properties p where p.id = new.property_id and p.org_id = new.org_id
  ) then
    raise exception 'property % does not belong to organization %', new.property_id, new.org_id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;
create trigger leads_same_org before insert or update of property_id, org_id on public.leads
  for each row execute function app.guard_same_org_property();

-- ---------------------------------------------------------------------------------------------
-- Underwriting analyses
-- ---------------------------------------------------------------------------------------------
create table public.underwriting_analyses (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  property_id         uuid references public.properties(id) on delete set null,
  lead_id             uuid references public.leads(id) on delete set null,
  name                text not null check (length(btrim(name)) between 1 and 200),
  kind                text not null check (kind in ('wholesale_deal', 'rental')),
  status              text not null default 'draft' check (status in ('draft', 'final', 'archived')),
  engine_version      text not null,
  inputs              jsonb not null,
  report              jsonb not null,
  inputs_fingerprint  text not null check (inputs_fingerprint ~ '^[0-9a-f]{16}$'),
  created_by          uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index underwriting_org_created_idx on public.underwriting_analyses (org_id, created_at desc);
create trigger underwriting_default_org before insert on public.underwriting_analyses for each row execute function app.default_org_id();
create trigger underwriting_touch before update on public.underwriting_analyses for each row execute function app.touch_updated_at();
create trigger underwriting_same_org before insert or update of property_id, org_id on public.underwriting_analyses
  for each row execute function app.guard_same_org_property();
create or replace function app.guard_same_org_lead() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if new.lead_id is not null and not exists (
    select 1 from public.leads l where l.id = new.lead_id and l.org_id = new.org_id
  ) then
    raise exception 'lead % does not belong to organization %', new.lead_id, new.org_id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;
create trigger underwriting_same_org_lead before insert or update of lead_id, org_id on public.underwriting_analyses
  for each row execute function app.guard_same_org_lead();
select app.apply_tenant_policies('public.underwriting_analyses');

-- A finalized analysis is a record of what was decided: its inputs and report are frozen.
create or replace function app.freeze_final_analysis() returns trigger
language plpgsql
as $$
begin
  if old.status = 'final' and (new.inputs is distinct from old.inputs or new.report is distinct from old.report
       or new.engine_version is distinct from old.engine_version) then
    raise exception 'final analyses are immutable; duplicate it to revise' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger underwriting_freeze before update on public.underwriting_analyses
  for each row execute function app.freeze_final_analysis();

-- ---------------------------------------------------------------------------------------------
-- Communication suppressions (opt-outs). Checked before every outbound message.
-- ---------------------------------------------------------------------------------------------
create table public.communication_suppressions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  channel     text not null check (channel in ('sms', 'voice', 'email', 'all')),
  -- E.164 phone or lower-cased email
  address     text not null,
  reason      text not null check (reason in ('opt_out', 'dnc_registry', 'litigator', 'manual', 'bounce', 'complaint')),
  source      text,
  created_by  uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at  timestamptz not null default now()
);
create unique index suppressions_org_channel_address_uq on public.communication_suppressions (org_id, channel, address);
create trigger suppressions_default_org before insert on public.communication_suppressions for each row execute function app.default_org_id();
select app.apply_tenant_policies('public.communication_suppressions');

-- Any member (including viewers) may record an opt-out: honoring a stop request must never be blocked by role.
create policy communication_suppressions_insert_any_member on public.communication_suppressions
  for insert to northstar_app with check (app.in_tenant(org_id));

create or replace function app.is_suppressed(p_channel text, p_address text) returns boolean
language sql stable
as $$
  select exists (
    select 1 from public.communication_suppressions s
    where s.org_id = app.current_org_id() and s.address = p_address and (s.channel = p_channel or s.channel = 'all')
  )
$$;
grant execute on function app.is_suppressed(text, text) to northstar_app;

-- ---------------------------------------------------------------------------------------------
-- Usage events (metering). Idempotent per (org, idempotency_key); append-only for the app role.
-- ---------------------------------------------------------------------------------------------
create table public.usage_events (
  id               bigint generated always as identity primary key,
  org_id           uuid not null references public.organizations(id) on delete cascade,
  meter            text not null check (meter ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  quantity         numeric(14,4) not null check (quantity > 0),
  idempotency_key  text not null,
  metadata         jsonb not null default '{}'::jsonb,
  occurred_at      timestamptz not null default now()
);
create unique index usage_events_idem_uq on public.usage_events (org_id, idempotency_key);
create index usage_events_org_meter_time_idx on public.usage_events (org_id, meter, occurred_at);
create trigger usage_default_org before insert on public.usage_events for each row execute function app.default_org_id();
alter table public.usage_events enable row level security;
alter table public.usage_events force row level security;
create policy usage_events_select on public.usage_events for select to northstar_app using (app.in_tenant(org_id));
create policy usage_events_insert on public.usage_events for insert to northstar_app with check (app.in_tenant(org_id));
grant select, insert on public.usage_events to northstar_app;
grant usage on sequence public.usage_events_id_seq to northstar_app;
