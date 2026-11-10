-- =============================================================================================
-- 0003_discover: Northstar Discover public-records model (ADR-015).
--
-- Two kinds of data:
--   GLOBAL reference data (schema `discover`): county source registry, ingestion runs, parcels,
--     append-only source records, record-to-parcel links, a human match-review queue, and append-only
--     property event versions. Public records are the same for every customer, so they are stored
--     once. Readable by any active member of the request's organization, and only for sources whose
--     license permits customer display (or demo data). Writable only by `northstar_ingest`.
--   TENANT data (schema `public`): investor profiles, buy boxes, saved searches, watchlists. Standard
--     tenant RLS via app.apply_tenant_policies.
--
-- Enum app.investment_strategy and role northstar_ingest are created idempotently because the
-- Market Intelligence migration (0005) creates the same objects with the same definitions.
-- =============================================================================================

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'northstar_ingest') then
    create role northstar_ingest nologin nobypassrls;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app' and t.typname = 'investment_strategy') then
    create type app.investment_strategy as enum
      ('wholesale', 'fix_and_flip', 'buy_and_hold', 'brrrr', 'creative_finance', 'section_8', 'small_multifamily', 'land', 'commercial');
  end if;
end $$;

create schema discover;
grant usage on schema discover to northstar_app, northstar_ingest;
grant usage on schema app to northstar_ingest;

create type discover.record_category as enum ('assessor', 'recorder', 'tax', 'foreclosure', 'code_enforcement', 'vacancy', 'court', 'probate', 'permit');
-- Property-level signals only. No type describes a person's circumstances or a protected characteristic.
create type discover.signal_type as enum (
  'tax_delinquency', 'tax_sale_listed', 'lis_pendens', 'foreclosure_filing', 'sheriff_sale_scheduled', 'code_violation',
  'unsafe_building', 'vacancy_indicator', 'probate_filing', 'absentee_owner', 'long_ownership', 'recent_sale', 'permit_activity');
create type discover.event_status as enum ('active', 'scheduled', 'postponed', 'resolved', 'dismissed', 'withdrawn', 'cancelled', 'expired', 'completed');
create type discover.license_permission as enum ('permitted', 'not_stated', 'prohibited');

-- Global reference rows are visible to any active member of the request's organization.
create or replace function app.is_signed_in_member() returns boolean
language sql stable
as $$ select app.current_org_id() is not null and app.is_member(app.current_org_id()) $$;

-- Append-only guard for record and event tables (blocks UPDATE and DELETE even for the owner).
create or replace function discover.append_only() returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end $$;

-- ---------------------------------------------------------------------------------------------
-- County source registry
-- ---------------------------------------------------------------------------------------------
create table discover.county_sources (
  source_key          text primary key check (source_key ~ '^[a-z0-9_]+\.[a-z0-9_]+$'),
  state               char(2) not null check (state ~ '^[A-Z]{2}$'),
  county_fips         char(5) not null check (county_fips ~ '^\d{5}$'),
  county_name         text not null,
  category            discover.record_category not null,
  title               text not null,
  platform            text not null check (platform in ('socrata', 'arcgis', 'carto', 'bulk', 'licensed', 'manual', 'demo')),
  status              text not null default 'planned' check (status in ('planned', 'built', 'verified', 'disabled')),
  mapping_verified    boolean not null default false,
  verified_on         date,
  refresh_cadence     text,
  license_tag         text not null,
  license_name        text not null,
  license_url         text,
  automated_access    discover.license_permission not null,
  commercial_display  discover.license_permission not null,
  attribution_required boolean not null default true,
  license_reviewed_on date,
  is_demo             boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- A source whose terms prohibit automated access may be listed (for the record) but never enabled.
  constraint county_sources_no_prohibited_ingest check (automated_access <> 'prohibited' or status in ('planned', 'disabled')),
  constraint county_sources_verified_has_date check (status <> 'verified' or (mapping_verified and verified_on is not null))
);
create trigger county_sources_touch before update on discover.county_sources for each row execute function app.touch_updated_at();

-- Rows from a source may be shown to customers only when its license permits display (or it is demo data).
create or replace function discover.source_displayable(key text) returns boolean
language sql stable security definer set search_path = pg_catalog, discover
as $$ select exists (select 1 from discover.county_sources s where s.source_key = key and (s.commercial_display = 'permitted' or s.is_demo)) $$;

-- ---------------------------------------------------------------------------------------------
-- Ingestion runs
-- ---------------------------------------------------------------------------------------------
create table discover.ingestion_runs (
  id                 uuid primary key default gen_random_uuid(),
  source_key         text not null references discover.county_sources(source_key),
  status             text not null check (status in ('running', 'succeeded', 'failed', 'partial')),
  started_at         timestamptz not null,
  finished_at        timestamptz,
  since              date,
  pages              integer not null default 0,
  fetched            integer not null default 0,
  inserted           integer not null default 0,
  unchanged          integer not null default 0,
  skipped            integer not null default 0,
  matched            integer not null default 0,
  queued_for_review  integer not null default 0,
  unmatched          integer not null default 0,
  events_appended    integer not null default 0,
  anomalies          integer not null default 0,
  next_cursor        text,
  error              text
);
create index ingestion_runs_source_idx on discover.ingestion_runs (source_key, started_at desc);

-- ---------------------------------------------------------------------------------------------
-- Parcels (global spine; APNs are only unique within a county)
-- ---------------------------------------------------------------------------------------------
create table discover.parcels (
  id              uuid primary key default gen_random_uuid(),
  state           char(2) not null check (state ~ '^[A-Z]{2}$'),
  county_fips     char(5) not null check (county_fips ~ '^\d{5}$'),
  apn             text,
  apn_normalized  text check (apn_normalized is null or apn_normalized ~ '^[A-Z0-9]+$'),
  address_line1   text,
  unit            text,
  city            text,
  postal_code     char(5) check (postal_code ~ '^\d{5}$'),
  address_key     text,
  latitude        numeric(9,6) check (latitude between -90 and 90),
  longitude       numeric(9,6) check (longitude between -180 and 180),
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index parcels_county_apn_uq on discover.parcels (county_fips, apn_normalized) where apn_normalized is not null;
create index parcels_county_address_idx on discover.parcels (county_fips, address_key);
create index parcels_postal_idx on discover.parcels (postal_code);
create trigger parcels_touch before update on discover.parcels for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Source records (append-only; a changed record is a new version)
-- ---------------------------------------------------------------------------------------------
create table discover.source_records (
  id                bigserial primary key,
  source_key        text not null references discover.county_sources(source_key),
  source_record_id  text not null check (length(source_record_id) between 1 and 200),
  version           integer not null check (version >= 1),
  content_hash      text not null check (content_hash ~ '^[0-9a-f]{16}$'),
  category          discover.record_category not null,
  retrieved_at      timestamptz not null,
  license_tag       text not null,
  apn               text,
  address           jsonb,
  -- Recorded instrument. For mortgages, consideration is the original recorded amount: never a current balance.
  instrument        jsonb,
  attributes        jsonb not null default '{}'::jsonb,
  is_demo           boolean not null default false,
  ingestion_run_id  uuid references discover.ingestion_runs(id),
  created_at        timestamptz not null default now(),
  unique (source_key, source_record_id, version),
  unique (source_key, source_record_id, content_hash)
);
create trigger source_records_append_only before update or delete on discover.source_records
  for each row execute function discover.append_only();

-- ---------------------------------------------------------------------------------------------
-- Record → parcel links and the human review queue
-- ---------------------------------------------------------------------------------------------
create table discover.record_links (
  source_key        text not null references discover.county_sources(source_key),
  source_record_id  text not null,
  parcel_id         uuid not null references discover.parcels(id),
  confidence        numeric(4,3) not null check (confidence between 0 and 1),
  reasons           text[] not null default '{}',
  method            text not null check (method in ('auto', 'human')),
  -- Auto links require at least the auto-match threshold; lower-confidence links must come from a person.
  constraint record_links_auto_threshold check (method = 'human' or confidence >= 0.85),
  decided_by        text,
  linked_at         timestamptz not null default now(),
  primary key (source_key, source_record_id)
);
create index record_links_parcel_idx on discover.record_links (parcel_id);

create table discover.match_reviews (
  id                  uuid primary key default gen_random_uuid(),
  source_key          text not null references discover.county_sources(source_key),
  source_record_id    text not null,
  confidence          numeric(4,3) not null check (confidence between 0 and 1),
  reasons             text[] not null default '{}',
  candidates          jsonb not null,
  status              text not null default 'open' check (status in ('open', 'linked', 'rejected', 'no_match')),
  resolved_parcel_id  uuid references discover.parcels(id),
  decided_by          text,
  decided_at          timestamptz,
  queued_at           timestamptz not null default now(),
  constraint match_reviews_decision check ((status = 'open') = (decided_at is null)),
  constraint match_reviews_linked_parcel check ((status = 'linked') = (resolved_parcel_id is not null))
);
create unique index match_reviews_open_uq on discover.match_reviews (source_key, source_record_id) where status = 'open';

-- ---------------------------------------------------------------------------------------------
-- Property events (append-only versions; current state = highest version)
-- ---------------------------------------------------------------------------------------------
create table discover.property_events (
  id                  bigserial primary key,
  source_key          text not null references discover.county_sources(source_key),
  source_record_id    text not null,
  version             integer not null check (version >= 1),
  event_type          discover.signal_type not null,
  status              discover.event_status not null,
  event_date          date,
  filed_date          date,
  scheduled_date      date,
  amount              numeric(14,2),
  discovered_at       timestamptz not null,
  supersedes_version  integer check (supersedes_version is null or supersedes_version = version - 1),
  origin              text not null default 'source' check (origin in ('source', 'expiry_rule')),
  anomaly             text,
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (source_key, source_record_id, version),
  constraint property_events_first_version check ((version = 1) = (supersedes_version is null))
);
create index property_events_type_idx on discover.property_events (event_type, status);
create trigger property_events_append_only before update or delete on discover.property_events
  for each row execute function discover.append_only();

create view discover.current_property_events with (security_invoker = true) as
  select distinct on (e.source_key, e.source_record_id) e.*, l.parcel_id
  from discover.property_events e
  left join discover.record_links l using (source_key, source_record_id)
  order by e.source_key, e.source_record_id, e.version desc;

-- ---------------------------------------------------------------------------------------------
-- Access control for global data
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['county_sources', 'ingestion_runs', 'parcels', 'source_records', 'record_links', 'match_reviews', 'property_events'] loop
    execute format('alter table discover.%I enable row level security', t);
    execute format('alter table discover.%I force row level security', t);
    execute format('create policy %I on discover.%I for all to northstar_ingest using (true) with check (true)', t || '_ingest', t);
  end loop;
end $$;

-- Members read the registry and parcels; records, links and events only from displayable sources.
create policy county_sources_read on discover.county_sources for select to northstar_app using (app.is_signed_in_member());
create policy parcels_read on discover.parcels for select to northstar_app using (app.is_signed_in_member());
create policy source_records_read on discover.source_records for select to northstar_app
  using (app.is_signed_in_member() and discover.source_displayable(source_key));
create policy record_links_read on discover.record_links for select to northstar_app
  using (app.is_signed_in_member() and discover.source_displayable(source_key));
create policy property_events_read on discover.property_events for select to northstar_app
  using (app.is_signed_in_member() and discover.source_displayable(source_key));
-- ingestion_runs and match_reviews are internal (no member policy).

grant select on discover.county_sources, discover.parcels, discover.source_records, discover.record_links, discover.property_events, discover.current_property_events to northstar_app;
grant select, insert, update on discover.county_sources, discover.ingestion_runs, discover.parcels, discover.record_links, discover.match_reviews to northstar_ingest;
grant select, insert on discover.source_records, discover.property_events to northstar_ingest;
grant select on discover.current_property_events to northstar_ingest;
grant usage on all sequences in schema discover to northstar_ingest;
grant execute on function app.current_org_id(), app.current_user_id() to northstar_ingest;

-- ---------------------------------------------------------------------------------------------
-- Tenant tables: investor profiles, buy boxes, saved searches, watchlists
-- ---------------------------------------------------------------------------------------------
create table public.investor_profiles (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  name               text not null check (length(btrim(name)) between 1 and 120),
  experience         text not null check (experience in ('new', 'some', 'experienced', 'professional')),
  capital_available  numeric(14,2) check (capital_available >= 0),
  financing          text[] not null default '{}' check (financing <@ array['cash', 'conventional', 'dscr', 'hard_money', 'private', 'seller_finance']),
  risk_tolerance     text not null check (risk_tolerance in ('low', 'moderate', 'high')),
  hold_years         smallint check (hold_years between 0 and 50),
  strategies         app.investment_strategy[] not null default '{}',
  created_by         uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger investor_profiles_default_org before insert on public.investor_profiles for each row execute function app.default_org_id();
create trigger investor_profiles_touch before update on public.investor_profiles for each row execute function app.touch_updated_at();
select app.apply_tenant_policies('public.investor_profiles');

create table public.buy_boxes (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  investor_profile_id  uuid references public.investor_profiles(id) on delete set null,
  name                 text not null check (length(btrim(name)) between 1 and 120),
  strategies           app.investment_strategy[] not null check (cardinality(strategies) > 0),
  -- Criteria validated by @northstar/core (geography, property attributes, return thresholds).
  -- Must never contain protected characteristics or demographic proxies.
  criteria             jsonb not null default '{}'::jsonb check (jsonb_typeof(criteria) = 'object'),
  active               boolean not null default true,
  created_by           uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger buy_boxes_default_org before insert on public.buy_boxes for each row execute function app.default_org_id();
create trigger buy_boxes_touch before update on public.buy_boxes for each row execute function app.touch_updated_at();
select app.apply_tenant_policies('public.buy_boxes');

create or replace function app.guard_same_org_profile() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if new.investor_profile_id is not null and not exists (
    select 1 from public.investor_profiles p where p.id = new.investor_profile_id and p.org_id = new.org_id
  ) then
    raise exception 'investor profile % does not belong to organization %', new.investor_profile_id, new.org_id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;
create trigger buy_boxes_same_org before insert or update of investor_profile_id, org_id on public.buy_boxes
  for each row execute function app.guard_same_org_profile();

create table public.saved_searches (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 120),
  filters       jsonb not null check (jsonb_typeof(filters) = 'object'),
  buy_box_id    uuid references public.buy_boxes(id) on delete set null,
  alert_cadence text not null default 'none' check (alert_cadence in ('none', 'daily', 'weekly')),
  created_by    uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger saved_searches_default_org before insert on public.saved_searches for each row execute function app.default_org_id();
create trigger saved_searches_touch before update on public.saved_searches for each row execute function app.touch_updated_at();
select app.apply_tenant_policies('public.saved_searches');

create table public.watchlist_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  parcel_id   uuid not null references discover.parcels(id),
  note        text check (length(note) <= 2000),
  created_by  uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at  timestamptz not null default now(),
  unique (org_id, parcel_id)
);
create trigger watchlist_items_default_org before insert on public.watchlist_items for each row execute function app.default_org_id();
select app.apply_tenant_policies('public.watchlist_items');
