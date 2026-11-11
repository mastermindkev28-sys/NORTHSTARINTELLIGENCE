-- =============================================================================================
-- 0005_market_intelligence: Northstar Market Intelligence.
--
-- Global reference data (shared by all tenants, written only by the ingest role):
--   geo_areas                 - state / metro / city / zip / neighborhood hierarchy with official codes
--   geo_metric_observations   - one value per area, metric, period and source, with full provenance
--   regulatory_factors        - append-only, cited landlord regulatory factors per jurisdiction
-- Tenant data (org-scoped, FORCE RLS, standard policies, audited):
--   market_score_profiles     - custom Market Score weightings
--   market_watchlists         - monitored sets of areas
--   market_watchlist_items    - areas on a watchlist with their last monitoring snapshot
--   market_alert_rules        - monitoring rules per watchlist
--   market_alerts             - alerts with evidence, idempotent per (org, dedupe_key)
--
-- Shared with the Discover migrations (0003/0004), created idempotently so either may run first:
--   app.investment_strategy enum and the northstar_ingest role.
-- =============================================================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app' and t.typname = 'investment_strategy') then
    create type app.investment_strategy as enum ('wholesale', 'fix_and_flip', 'buy_and_hold', 'brrrr', 'creative_finance', 'section_8', 'small_multifamily', 'land', 'commercial');
  end if;
  if not exists (select 1 from pg_roles where rolname = 'northstar_ingest') then
    create role northstar_ingest nologin nobypassrls;
  end if;
end $$;

grant usage on schema public to northstar_ingest;
grant usage on schema app to northstar_ingest;

-- Applies the reference-table posture: readable by any authenticated user, writable only by ingest.
create or replace function app.apply_reference_policies(tbl regclass, ingest_can_update boolean) returns void
language plpgsql
as $$
declare
  t text := tbl::text;
  n text := replace(tbl::text, 'public.', '');
begin
  execute format('alter table %s enable row level security', t);
  execute format('alter table %s force row level security', t);
  execute format('create policy %I on %s for select to northstar_app using (app.current_user_id() is not null)', n || '_read', t);
  execute format('create policy %I on %s for select to northstar_ingest using (true)', n || '_ingest_read', t);
  execute format('create policy %I on %s for insert to northstar_ingest with check (true)', n || '_ingest_insert', t);
  execute format('grant select on %s to northstar_app', t);
  execute format('grant select, insert on %s to northstar_ingest', t);
  if ingest_can_update then
    execute format('create policy %I on %s for update to northstar_ingest using (true) with check (true)', n || '_ingest_update', t);
    execute format('grant update on %s to northstar_ingest', t);
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Geography
-- ---------------------------------------------------------------------------------------------
create table public.geo_areas (
  key          text primary key check (key ~ '^(state|metro|city|zip|neighborhood):[A-Za-z0-9_-]{1,40}$'),
  level        text not null check (level in ('state', 'metro', 'city', 'zip', 'neighborhood')),
  code         text not null,
  name         text not null check (length(btrim(name)) between 1 and 200),
  parent_key   text references public.geo_areas(key) on delete restrict,
  state_code   char(2) check (state_code ~ '^[A-Z]{2}$'),
  county_fips  char(5) check (county_fips ~ '^\d{5}$'),
  zcta         char(5) check (zcta ~ '^\d{5}$'),
  population   integer check (population >= 0),
  lat          numeric(9,6) check (lat between -90 and 90),
  lon          numeric(9,6) check (lon between -180 and 180),
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (split_part(key, ':', 1) = level),
  check (key <> parent_key)
);
create index geo_areas_parent_idx on public.geo_areas (parent_key);
create index geo_areas_level_state_idx on public.geo_areas (level, state_code);
create index geo_areas_zcta_idx on public.geo_areas (zcta) where zcta is not null;
create index geo_areas_county_idx on public.geo_areas (county_fips) where county_fips is not null;
create trigger geo_areas_touch before update on public.geo_areas for each row execute function app.touch_updated_at();
select app.apply_reference_policies('public.geo_areas', true);

-- ---------------------------------------------------------------------------------------------
-- Metric observations. The metric allow-list lives in @northstar/market (metrics.ts); this check is
-- defense in depth so protected characteristics or obvious proxies can never be stored as metrics.
-- ---------------------------------------------------------------------------------------------
create table public.geo_metric_observations (
  id                  bigint generated always as identity primary key,
  area_key            text not null references public.geo_areas(key) on delete cascade,
  metric              text not null check (metric ~ '^[a-z0-9_]{2,64}$'),
  value               double precision not null check (value not in ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)),
  period              text not null,
  period_end          date not null,
  measured_at         text not null check (measured_at in ('state', 'metro', 'city', 'zip', 'neighborhood')),
  source_id           text not null,
  source_class        text not null check (source_class in ('official', 'licensed', 'third_party', 'user', 'demo')),
  dataset             text,
  retrieved_at        timestamptz not null,
  is_projection       boolean not null default false,
  is_developmental    boolean not null default false,
  reporting_coverage  numeric(5,4) check (reporting_coverage between 0 and 1),
  note                text,
  constraint geo_metric_not_protected check (metric !~* '(race|racial|ethnic|hispanic|latino|minority|nonwhite|national_?origin|foreign_?born|immigra|citizenship|religio|gender|female|familial|children|single_?parent|disab|median_?age|elderly|over_?65|under_?18|voucher_?holder|school_?demograph)')
);
create unique index geo_metric_obs_uq on public.geo_metric_observations (area_key, metric, period_end, source_id, is_projection);
create index geo_metric_obs_area_idx on public.geo_metric_observations (area_key, metric, period_end desc);
select app.apply_reference_policies('public.geo_metric_observations', false);
grant usage on sequence public.geo_metric_observations_id_seq to northstar_ingest;

-- ---------------------------------------------------------------------------------------------
-- Regulatory factors (append-only: a change is a new row with a new effective date)
-- ---------------------------------------------------------------------------------------------
create table public.regulatory_factors (
  id                 bigint generated always as identity primary key,
  jurisdiction_key   text not null references public.geo_areas(key) on delete restrict,
  factor             text not null check (factor ~ '^[a-z0-9_]{2,64}$'),
  value              jsonb not null,
  unit               text,
  citation_title     text not null check (length(btrim(citation_title)) between 1 and 300),
  citation_section   text,
  source_url         text check (source_url is null or source_url ~ '^https://'),
  effective_date     date,
  retrieved_at       timestamptz not null,
  verification       text not null check (verification in ('official', 'secondary', 'unverified', 'demo')),
  notes              text,
  created_at         timestamptz not null default now()
);
create unique index regulatory_factors_uq on public.regulatory_factors (jurisdiction_key, factor, coalesce(effective_date, '-infinity'::date), retrieved_at);
create index regulatory_factors_lookup_idx on public.regulatory_factors (jurisdiction_key, factor, effective_date desc nulls last);
select app.apply_reference_policies('public.regulatory_factors', false);
grant usage on sequence public.regulatory_factors_id_seq to northstar_ingest;

create or replace function app.forbid_mutation() returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only; insert a new row with a new effective date', tg_table_name using errcode = 'check_violation';
end $$;
create trigger regulatory_factors_append_only before update or delete on public.regulatory_factors
  for each row execute function app.forbid_mutation();

-- ---------------------------------------------------------------------------------------------
-- Tenant: custom score profiles
-- ---------------------------------------------------------------------------------------------
create table public.market_score_profiles (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  name                text not null check (length(btrim(name)) between 1 and 120),
  base_profile        text not null default 'balanced' check (base_profile = 'balanced' or base_profile in ('wholesale', 'fix_and_flip', 'buy_and_hold', 'brrrr', 'creative_finance', 'section_8', 'small_multifamily', 'land', 'commercial')),
  category_weights    jsonb not null check (jsonb_typeof(category_weights) = 'object'),
  variable_emphasis   jsonb not null default '{}'::jsonb check (jsonb_typeof(variable_emphasis) = 'object'),
  regulatory_weights  jsonb not null default '{}'::jsonb check (jsonb_typeof(regulatory_weights) = 'object'),
  created_by          uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index market_score_profiles_org_name_uq on public.market_score_profiles (org_id, lower(name));
create trigger market_score_profiles_default_org before insert on public.market_score_profiles for each row execute function app.default_org_id();
create trigger market_score_profiles_touch before update on public.market_score_profiles for each row execute function app.touch_updated_at();
select app.apply_tenant_policies('public.market_score_profiles');

-- ---------------------------------------------------------------------------------------------
-- Tenant: watchlists, items, rules, alerts
-- ---------------------------------------------------------------------------------------------
create table public.market_watchlists (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 120),
  strategy     app.investment_strategy,
  profile_id   uuid references public.market_score_profiles(id) on delete set null,
  created_by   uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index market_watchlists_org_name_uq on public.market_watchlists (org_id, lower(name));
create trigger market_watchlists_default_org before insert on public.market_watchlists for each row execute function app.default_org_id();
create trigger market_watchlists_touch before update on public.market_watchlists for each row execute function app.touch_updated_at();
select app.apply_tenant_policies('public.market_watchlists');

create or replace function app.guard_same_org_watchlist() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if new.watchlist_id is not null and not exists (
    select 1 from public.market_watchlists w where w.id = new.watchlist_id and w.org_id = new.org_id
  ) then
    raise exception 'watchlist % does not belong to organization %', new.watchlist_id, new.org_id using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;

create or replace function app.guard_same_org_profile() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if new.profile_id is not null and not exists (
    select 1 from public.market_score_profiles p where p.id = new.profile_id and p.org_id = new.org_id
  ) then
    raise exception 'profile % does not belong to organization %', new.profile_id, new.org_id using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;
create trigger market_watchlists_same_org_profile before insert or update of profile_id, org_id on public.market_watchlists
  for each row execute function app.guard_same_org_profile();

create table public.market_watchlist_items (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  watchlist_id     uuid not null references public.market_watchlists(id) on delete cascade,
  -- Not a foreign key: areas may come from the bundled demo dataset as well as geo_areas.
  area_key         text not null check (area_key ~ '^(state|metro|city|zip|neighborhood):[A-Za-z0-9_-]{1,40}$'),
  area_name        text not null,
  notes            text,
  last_snapshot    jsonb,
  last_checked_at  timestamptz,
  created_by       uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index market_watchlist_items_uq on public.market_watchlist_items (watchlist_id, area_key);
create trigger market_watchlist_items_default_org before insert on public.market_watchlist_items for each row execute function app.default_org_id();
create trigger market_watchlist_items_touch before update on public.market_watchlist_items for each row execute function app.touch_updated_at();
create trigger market_watchlist_items_same_org before insert or update of watchlist_id, org_id on public.market_watchlist_items
  for each row execute function app.guard_same_org_watchlist();
select app.apply_tenant_policies('public.market_watchlist_items');

create table public.market_alert_rules (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  watchlist_id  uuid not null references public.market_watchlists(id) on delete cascade,
  rule          jsonb not null check (rule ->> 'kind' in ('score_change', 'category_change', 'new_risk_flag', 'metric_threshold', 'regulatory_change', 'confidence_drop')),
  enabled       boolean not null default true,
  created_by    uuid references public.users(id) on delete set null default app.current_user_id(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index market_alert_rules_watchlist_idx on public.market_alert_rules (watchlist_id);
create trigger market_alert_rules_default_org before insert on public.market_alert_rules for each row execute function app.default_org_id();
create trigger market_alert_rules_touch before update on public.market_alert_rules for each row execute function app.touch_updated_at();
create trigger market_alert_rules_same_org before insert or update of watchlist_id, org_id on public.market_alert_rules
  for each row execute function app.guard_same_org_watchlist();
select app.apply_tenant_policies('public.market_alert_rules');

create table public.market_alerts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  watchlist_id     uuid references public.market_watchlists(id) on delete cascade,
  area_key         text not null,
  area_name        text not null,
  kind             text not null,
  severity         text not null check (severity in ('info', 'caution', 'critical')),
  title            text not null,
  detail           text not null,
  evidence         jsonb not null,
  dedupe_key       text not null,
  acknowledged_at  timestamptz,
  acknowledged_by  uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index market_alerts_dedupe_uq on public.market_alerts (org_id, dedupe_key);
create index market_alerts_org_created_idx on public.market_alerts (org_id, created_at desc);
create trigger market_alerts_default_org before insert on public.market_alerts for each row execute function app.default_org_id();
create trigger market_alerts_touch before update on public.market_alerts for each row execute function app.touch_updated_at();
create trigger market_alerts_same_org before insert or update of watchlist_id, org_id on public.market_alerts
  for each row execute function app.guard_same_org_watchlist();
select app.apply_tenant_policies('public.market_alerts');
