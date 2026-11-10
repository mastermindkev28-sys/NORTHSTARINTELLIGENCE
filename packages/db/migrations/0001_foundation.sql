-- =============================================================================================
-- 0001_foundation: tenancy, identity, roles, sessions, audit log.
--
-- Tenancy model: shared database, shared schema, every tenant-owned row carries org_id, and
-- PostgreSQL row-level security (FORCED, so table owners are subject to it too) restricts every
-- query to the organization in the request's tenant context AND requires the requesting user to be
-- an active member of it. See docs/DATABASE_SCHEMA.md and docs/adr/0003-multi-tenancy-rls.md.
--
-- Tenant context is carried in transaction-local settings set by the API layer:
--   app.user_id  -> authenticated user
--   app.org_id   -> organization the request acts within
-- =============================================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists app;

-- Runtime role used by the application. NOLOGIN group role: deployments create a LOGIN role
-- that is a member of it. It never owns tables and never has BYPASSRLS.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'northstar_app') then
    create role northstar_app nologin nobypassrls;
  end if;
end $$;

grant usage on schema app to northstar_app;
grant usage on schema public to northstar_app;

-- ---------------------------------------------------------------------------------------------
-- Context helpers
-- ---------------------------------------------------------------------------------------------

create or replace function app.current_user_id() returns uuid
language sql stable
as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create or replace function app.current_org_id() returns uuid
language sql stable
as $$ select nullif(current_setting('app.org_id', true), '')::uuid $$;

-- ---------------------------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------------------------

create type app.org_role as enum ('owner', 'admin', 'manager', 'acquisitions', 'analyst', 'viewer');
create type app.membership_status as enum ('active', 'invited', 'suspended');
create type app.actor_type as enum ('user', 'agent', 'system', 'api_key');

-- ---------------------------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------------------------

create or replace function app.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Organizations (tenants)
-- ---------------------------------------------------------------------------------------------

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 200),
  slug        citext not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  plan        text not null default 'trial',
  status      text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger organizations_touch before update on public.organizations
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Users (global identities; a user may belong to many organizations)
-- ---------------------------------------------------------------------------------------------

create table public.users (
  id                 uuid primary key default gen_random_uuid(),
  email              citext not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name       text not null check (length(btrim(display_name)) between 1 and 120),
  -- scrypt hash in PHC-like format; null when the identity is managed by an external IdP.
  password_hash      text,
  email_verified_at  timestamptz,
  status             text not null default 'active' check (status in ('active', 'disabled')),
  last_login_at      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger users_touch before update on public.users
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Memberships (user <-> organization, with role)
-- ---------------------------------------------------------------------------------------------

create table public.memberships (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role        app.org_role not null,
  status      app.membership_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);
create trigger memberships_touch before update on public.memberships
  for each row execute function app.touch_updated_at();

-- Membership lookups used by RLS. SECURITY DEFINER so policies on memberships itself do not recurse.
create or replace function app.member_role(target_org uuid) returns app.org_role
language sql stable security definer set search_path = pg_catalog, public
as $$
  select m.role from public.memberships m
  where m.org_id = target_org and m.user_id = app.current_user_id() and m.status = 'active'
$$;

create or replace function app.is_member(target_org uuid) returns boolean
language sql stable
as $$ select app.member_role(target_org) is not null $$;

create or replace function app.has_role(target_org uuid, allowed app.org_role[]) returns boolean
language sql stable
as $$ select coalesce(app.member_role(target_org) = any(allowed), false) $$;

-- True when the row belongs to the request's organization and the user is an active member of it.
create or replace function app.in_tenant(row_org uuid) returns boolean
language sql stable
as $$ select row_org = app.current_org_id() and app.is_member(row_org) $$;

-- Never allow an organization to lose its last active owner.
create or replace function app.guard_last_owner() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  target_org uuid := coalesce(old.org_id, new.org_id);
  remaining int;
begin
  if (tg_op = 'DELETE' and old.role = 'owner' and old.status = 'active')
     or (tg_op = 'UPDATE' and old.role = 'owner' and old.status = 'active'
         and (new.role <> 'owner' or new.status <> 'active')) then
    select count(*) into remaining from public.memberships
      where org_id = target_org and role = 'owner' and status = 'active' and user_id <> old.user_id;
    if remaining = 0 then
      raise exception 'organization % must keep at least one active owner', target_org
        using errcode = 'check_violation';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger memberships_guard_last_owner before update or delete on public.memberships
  for each row execute function app.guard_last_owner();

-- Only owners may grant or revoke the owner role.
create or replace function app.guard_owner_grant() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if app.current_user_id() is null then
    return new; -- migrations / sign-up (security-definer path)
  end if;
  if tg_op = 'INSERT' and not exists (select 1 from public.memberships where org_id = new.org_id) then
    return new; -- founding owner of a brand-new organization
  end if;
  if (new.role = 'owner' or (tg_op = 'UPDATE' and old.role = 'owner'))
     and coalesce(app.member_role(new.org_id) <> 'owner', true) then
    raise exception 'only an owner can grant or revoke the owner role'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger memberships_guard_owner_grant before insert or update on public.memberships
  for each row execute function app.guard_owner_grant();

-- ---------------------------------------------------------------------------------------------
-- Sessions (opaque bearer tokens; only the SHA-256 hash is stored)
-- ---------------------------------------------------------------------------------------------

create table public.sessions (
  id             uuid primary key default gen_random_uuid(),
  token_hash     bytea not null unique,
  user_id        uuid not null references public.users(id) on delete cascade,
  active_org_id  uuid references public.organizations(id) on delete set null,
  ip             inet,
  user_agent     text,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  expires_at     timestamptz not null,
  revoked_at     timestamptz
);
create index sessions_user_idx on public.sessions(user_id);

-- ---------------------------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------------------------

create table public.audit_log (
  id             bigint generated always as identity primary key,
  org_id         uuid references public.organizations(id) on delete restrict,
  actor_type     app.actor_type not null,
  actor_user_id  uuid references public.users(id) on delete set null,
  actor_label    text,
  action         text not null check (action ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  target_type    text,
  target_id      text,
  metadata       jsonb not null default '{}'::jsonb,
  ip             inet,
  request_id     text,
  occurred_at    timestamptz not null default now()
);
create index audit_log_org_time_idx on public.audit_log(org_id, occurred_at desc);
create index audit_log_target_idx on public.audit_log(org_id, target_type, target_id);

create or replace function app.audit_log_immutable() returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only (% blocked)', tg_op using errcode = 'insufficient_privilege';
end $$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function app.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function app.audit_log_immutable();

-- Write an audit record from trusted code paths (triggers and security-definer functions).
create or replace function app.write_audit(
  p_org uuid, p_action text, p_target_type text, p_target_id text, p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = pg_catalog, public
as $$
  insert into public.audit_log (org_id, actor_type, actor_user_id, action, target_type, target_id, metadata, request_id)
  values (
    p_org,
    case when app.current_user_id() is null then 'system'::app.actor_type else 'user'::app.actor_type end,
    app.current_user_id(),
    p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb),
    nullif(current_setting('app.request_id', true), '')
  )
$$;

-- Generic row-change audit trigger for tenant tables. Records which columns changed, not values,
-- so the audit log never becomes a secondary copy of sensitive data.
create or replace function app.audit_row_change() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  changed text[];
  rec jsonb;
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into changed
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
      where n.value is distinct from o.value and n.key not in ('updated_at');
    if changed is null then return new; end if;
  end if;
  rec := to_jsonb(coalesce(new, old));
  perform app.write_audit(
    (rec ->> 'org_id')::uuid,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'user_id'),
    case when changed is null then '{}'::jsonb else jsonb_build_object('changed', to_jsonb(changed)) end
  );
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Row-level security: identity tables
-- ---------------------------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.users enable row level security;
alter table public.users force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
alter table public.sessions enable row level security;
alter table public.sessions force row level security;
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

-- Organizations: a user sees every org they belong to (needed for the org switcher);
-- owners/admins of the current org may update it. Creation goes through app.create_organization().
create policy organizations_select on public.organizations for select to northstar_app
  using (app.is_member(id));
create policy organizations_update on public.organizations for update to northstar_app
  using (id = app.current_org_id() and app.has_role(id, '{owner,admin}'))
  with check (id = app.current_org_id() and app.has_role(id, '{owner,admin}'));

-- Users: see yourself and members of your current organization; edit only yourself.
create policy users_select on public.users for select to northstar_app
  using (
    id = app.current_user_id()
    or exists (
      select 1 from public.memberships m
      where m.user_id = users.id and app.in_tenant(m.org_id)
    )
  );
create policy users_update_self on public.users for update to northstar_app
  using (id = app.current_user_id()) with check (id = app.current_user_id());

-- Memberships: see your own memberships everywhere, and all memberships of the current org;
-- owners/admins of the current org manage them.
create policy memberships_select on public.memberships for select to northstar_app
  using (user_id = app.current_user_id() or app.in_tenant(org_id));
create policy memberships_insert on public.memberships for insert to northstar_app
  with check (app.in_tenant(org_id) and app.has_role(org_id, '{owner,admin}'));
create policy memberships_update on public.memberships for update to northstar_app
  using (app.in_tenant(org_id) and app.has_role(org_id, '{owner,admin}'))
  with check (app.in_tenant(org_id) and app.has_role(org_id, '{owner,admin}'));
create policy memberships_delete on public.memberships for delete to northstar_app
  using (app.in_tenant(org_id) and (app.has_role(org_id, '{owner,admin}') or user_id = app.current_user_id()));

-- Sessions: a user sees and revokes only their own. Creation/resolution via security-definer functions.
create policy sessions_select on public.sessions for select to northstar_app
  using (user_id = app.current_user_id());
create policy sessions_update on public.sessions for update to northstar_app
  using (user_id = app.current_user_id()) with check (user_id = app.current_user_id());

-- Audit: owners/admins of the current org read it; any member may append entries attributed to themselves.
create policy audit_select on public.audit_log for select to northstar_app
  using (app.in_tenant(org_id) and app.has_role(org_id, '{owner,admin}'));
create policy audit_insert on public.audit_log for insert to northstar_app
  with check (app.in_tenant(org_id) and actor_user_id = app.current_user_id() and actor_type = 'user');

grant select, update on public.organizations to northstar_app;
grant select, update on public.users to northstar_app;
grant select, insert, update, delete on public.memberships to northstar_app;
grant select, update on public.sessions to northstar_app;
grant select, insert on public.audit_log to northstar_app;
grant usage on sequence public.audit_log_id_seq to northstar_app;

create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function app.audit_row_change();
create trigger organizations_audit after update on public.organizations
  for each row execute function app.audit_row_change();

-- ---------------------------------------------------------------------------------------------
-- Security-definer entry points for flows that precede a tenant context.
-- Each validates its own inputs and touches only the rows it must.
-- ---------------------------------------------------------------------------------------------

-- Sign up: create user + organization + owner membership atomically.
create or replace function app.sign_up(
  p_email citext, p_display_name text, p_password_hash text, p_org_name text, p_org_slug citext
) returns table (user_id uuid, org_id uuid)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_user uuid;
  v_org uuid;
begin
  if p_password_hash is null or p_password_hash !~ '^scrypt\$' then
    raise exception 'password hash must be a scrypt hash' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.users (email, display_name, password_hash)
    values (p_email, p_display_name, p_password_hash) returning id into v_user;
  insert into public.organizations (name, slug) values (p_org_name, p_org_slug) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, v_user, 'owner');
  perform set_config('app.user_id', v_user::text, true);
  perform app.write_audit(v_org, 'organization.create', 'organization', v_org::text,
    jsonb_build_object('via', 'sign_up'));
  return query select v_user, v_org;
end $$;

-- Create an additional organization for the current user (who becomes its owner).
create or replace function app.create_organization(p_name text, p_slug citext) returns uuid
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
  v_user uuid := app.current_user_id();
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;
  insert into public.organizations (name, slug) values (p_name, p_slug) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, v_user, 'owner');
  perform app.write_audit(v_org, 'organization.create', 'organization', v_org::text, '{}'::jsonb);
  return v_org;
end $$;

-- Login lookup: returns the hash for verification in application code (constant-time compare there).
create or replace function app.login_lookup(p_email citext)
returns table (user_id uuid, password_hash text, status text)
language sql stable security definer set search_path = pg_catalog, public
as $$ select id, password_hash, status from public.users where email = p_email $$;

create or replace function app.create_session(
  p_user uuid, p_token_hash bytea, p_ttl interval, p_ip inet, p_user_agent text
) returns table (session_id uuid, active_org_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
  v_id uuid;
  v_exp timestamptz := now() + p_ttl;
begin
  if p_ttl > interval '30 days' or p_ttl <= interval '0' then
    raise exception 'invalid session ttl' using errcode = 'invalid_parameter_value';
  end if;
  select m.org_id into v_org from public.memberships m
    where m.user_id = p_user and m.status = 'active' order by m.created_at limit 1;
  insert into public.sessions (token_hash, user_id, active_org_id, ip, user_agent, expires_at)
    values (p_token_hash, p_user, v_org, p_ip, left(p_user_agent, 500), v_exp) returning id into v_id;
  update public.users set last_login_at = now() where id = p_user;
  perform set_config('app.user_id', p_user::text, true);
  if v_org is not null then
    perform app.write_audit(v_org, 'auth.login', 'user', p_user::text, '{}'::jsonb);
  end if;
  return query select v_id, v_org, v_exp;
end $$;

-- Resolve a bearer token to an identity. Returns nothing for unknown, expired, revoked sessions,
-- disabled users, or a session whose active org membership is no longer active.
create or replace function app.resolve_session(p_token_hash bytea)
returns table (session_id uuid, user_id uuid, active_org_id uuid, role app.org_role, expires_at timestamptz)
language sql security definer set search_path = pg_catalog, public
as $$
  update public.sessions s set last_seen_at = now()
  from public.users u
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and u.id = s.user_id
    and u.status = 'active'
    and (
      s.active_org_id is null
      or exists (select 1 from public.memberships m
                 where m.org_id = s.active_org_id and m.user_id = s.user_id and m.status = 'active')
    )
  returning s.id, s.user_id, s.active_org_id,
    (select m.role from public.memberships m
      where m.org_id = s.active_org_id and m.user_id = s.user_id and m.status = 'active'),
    s.expires_at
$$;

-- Switch the active organization of a session (membership required).
create or replace function app.switch_session_org(p_session uuid, p_org uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  update public.sessions s set active_org_id = p_org
  where s.id = p_session and s.user_id = app.current_user_id() and s.revoked_at is null
    and exists (select 1 from public.memberships m
                where m.org_id = p_org and m.user_id = s.user_id and m.status = 'active');
  return found;
end $$;

revoke all on function app.sign_up(citext, text, text, text, citext) from public;
revoke all on function app.create_organization(text, citext) from public;
revoke all on function app.login_lookup(citext) from public;
revoke all on function app.create_session(uuid, bytea, interval, inet, text) from public;
revoke all on function app.resolve_session(bytea) from public;
revoke all on function app.switch_session_org(uuid, uuid) from public;
revoke all on function app.write_audit(uuid, text, text, text, jsonb) from public;
grant execute on function app.sign_up(citext, text, text, text, citext) to northstar_app;
grant execute on function app.create_organization(text, citext) to northstar_app;
grant execute on function app.login_lookup(citext) to northstar_app;
grant execute on function app.create_session(uuid, bytea, interval, inet, text) to northstar_app;
grant execute on function app.resolve_session(bytea) to northstar_app;
grant execute on function app.switch_session_org(uuid, uuid) to northstar_app;
