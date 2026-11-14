-- Northstar Intelligence — foundation schema
-- Multi-tenant: every tenant-owned row carries organization_id and is protected by FORCE ROW LEVEL SECURITY.
-- The application connects as role northstar_app (no BYPASSRLS) and sets app.org_id per transaction.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'northstar_app') THEN
    CREATE ROLE northstar_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

-- Tenant context. NULL when unset, which makes every tenant policy evaluate to false (fail closed).
CREATE OR REPLACE FUNCTION app.current_org_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.org_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- Identity & tenancy
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  slug          text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  plan          text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'professional', 'team', 'enterprise')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  business_name text,
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Global identities (maps 1:1 to the auth provider's user id).
CREATE TABLE users (
  id           uuid PRIMARY KEY,
  email        text NOT NULL UNIQUE,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'acquisitions', 'analyst', 'viewer')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX memberships_user_idx ON memberships (user_id);

-- ---------------------------------------------------------------------------
-- Contacts, properties, provenance
-- ---------------------------------------------------------------------------
CREATE TABLE contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name      text,
  last_name       text,
  full_name       text,
  email           text,
  phones          text[] NOT NULL DEFAULT '{}',
  mailing_address jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contacts_org_phones_idx ON contacts USING gin (phones);
CREATE INDEX contacts_org_email_idx ON contacts (organization_id, email);

CREATE TABLE properties (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  address_key     text NOT NULL,
  line1           text NOT NULL,
  unit            text,
  city            text NOT NULL,
  state           char(2) NOT NULL,
  zip5            char(5) NOT NULL,
  county          text,
  apn             text,
  latitude        double precision,
  longitude       double precision,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, address_key)
);

-- Every property attribute with its origin, source, retrieval time, and confidence. Never overwritten: superseded.
CREATE TABLE property_facts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id      uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  field            text NOT NULL,
  value            jsonb NOT NULL,
  origin           text NOT NULL CHECK (origin IN ('verified', 'user_assumption', 'third_party_estimate', 'ai_generated', 'calculated')),
  source_system    text NOT NULL,
  source_record_id text,
  retrieved_at     timestamptz NOT NULL,
  confidence       numeric(4,3) CHECK (confidence BETWEEN 0 AND 1),
  superseded_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (origin NOT IN ('third_party_estimate', 'ai_generated') OR confidence IS NOT NULL)
);
CREATE INDEX property_facts_current_idx ON property_facts (property_id, field) WHERE superseded_at IS NULL;

-- ---------------------------------------------------------------------------
-- Leads & pipeline
-- ---------------------------------------------------------------------------
CREATE TABLE leads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id         uuid REFERENCES contacts(id) ON DELETE SET NULL,
  property_id        uuid REFERENCES properties(id) ON DELETE SET NULL,
  source             text NOT NULL,
  source_detail      text,
  external_id        text,
  status             text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacting', 'qualifying', 'qualified', 'appointment_set', 'offer_pending', 'under_contract', 'closed_won', 'closed_lost', 'nurture', 'dead', 'duplicate')),
  score              smallint CHECK (score BETWEEN 0 AND 100),
  score_tier         text CHECK (score_tier IN ('hot', 'warm', 'nurture', 'cold')),
  score_factors      jsonb NOT NULL DEFAULT '[]'::jsonb,
  completeness       numeric(4,3),
  missing_fields     text[] NOT NULL DEFAULT '{}',
  duplicate_of       uuid REFERENCES leads(id) ON DELETE SET NULL,
  asking_price       numeric(14,2),
  timeline           text,
  condition          text,
  occupancy          text,
  motivation_summary text,
  notes              text,
  tags               text[] NOT NULL DEFAULT '{}',
  assigned_to        uuid REFERENCES users(id) ON DELETE SET NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  last_contacted_at  timestamptz,
  next_action_at     timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX leads_external_uq ON leads (organization_id, source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX leads_pipeline_idx ON leads (organization_id, status, score DESC);
CREATE INDEX leads_next_action_idx ON leads (organization_id, next_action_at) WHERE next_action_at IS NOT NULL;

CREATE TABLE appointments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id              uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  starts_at            timestamptz NOT NULL,
  ends_at              timestamptz NOT NULL CHECK (ends_at > starts_at),
  kind                 text NOT NULL CHECK (kind IN ('phone', 'video', 'walkthrough', 'closing', 'other')),
  status               text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  assigned_to          uuid REFERENCES users(id) ON DELETE SET NULL,
  external_calendar_id text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES leads(id) ON DELETE CASCADE,
  title           text NOT NULL,
  due_at          timestamptz,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  assigned_to     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_type text NOT NULL CHECK (created_by_type IN ('user', 'agent', 'system')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE underwriting_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               uuid REFERENCES leads(id) ON DELETE SET NULL,
  property_id           uuid REFERENCES properties(id) ON DELETE SET NULL,
  methodology_version   text NOT NULL,
  inputs                jsonb NOT NULL,
  result                jsonb NOT NULL,
  recommended_max_offer numeric(14,2),
  decision              text,
  created_by_type       text NOT NULL CHECK (created_by_type IN ('user', 'agent', 'system')),
  created_by_id         text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE offers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  underwriting_run_id uuid REFERENCES underwriting_runs(id) ON DELETE SET NULL,
  amount              numeric(14,2) NOT NULL CHECK (amount >= 0),
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'rejected', 'accepted', 'withdrawn')),
  approval_id         uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Communications & compliance
-- ---------------------------------------------------------------------------
CREATE TABLE consent_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id        uuid REFERENCES contacts(id) ON DELETE SET NULL,
  phone_e164        text,
  email             text,
  channel           text NOT NULL CHECK (channel IN ('sms', 'voice', 'email')),
  kind              text NOT NULL CHECK (kind IN ('express_written', 'express', 'inquiry')),
  captured_at       timestamptz NOT NULL,
  source            text NOT NULL,
  disclosure_text   text,
  evidence_ref      text,
  revoked_at        timestamptz,
  revocation_source text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'express_written' OR disclosure_text IS NOT NULL),
  CHECK (phone_e164 IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX consent_phone_idx ON consent_records (organization_id, phone_e164);

CREATE TABLE suppression_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('sms', 'voice', 'email', 'all')),
  value           text NOT NULL,
  reason          text NOT NULL CHECK (reason IN ('opt_out', 'dnc_internal', 'wrong_number', 'litigation_risk', 'manual')),
  source          text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, channel, value)
);

CREATE TABLE dnc_scrubs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_e164      text NOT NULL,
  national_listed boolean NOT NULL,
  state_listed    boolean,
  provider        text NOT NULL,
  scrubbed_at     timestamptz NOT NULL
);
CREATE INDEX dnc_scrubs_latest_idx ON dnc_scrubs (organization_id, phone_e164, scrubbed_at DESC);

CREATE TABLE conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id          uuid REFERENCES leads(id) ON DELETE CASCADE,
  contact_id       uuid REFERENCES contacts(id) ON DELETE SET NULL,
  channel          text NOT NULL CHECK (channel IN ('sms', 'voice', 'email')),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paused', 'escalated', 'closed')),
  ai_enabled       boolean NOT NULL DEFAULT true,
  last_inbound_at  timestamptz,
  last_outbound_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id     uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction           text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel             text NOT NULL CHECK (channel IN ('sms', 'voice', 'email')),
  body                text NOT NULL,
  status              text NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'received', 'blocked', 'pending_review')),
  provider            text,
  provider_message_id text,
  compliance_decision jsonb,
  author_type         text NOT NULL CHECK (author_type IN ('user', 'agent', 'contact', 'system')),
  author_id           text,
  ai_generated        boolean NOT NULL DEFAULT false,
  idempotency_key     text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX messages_idem_uq ON messages (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Automation infrastructure
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            text NOT NULL,
  payload         jsonb NOT NULL,
  idempotency_key text NOT NULL,
  occurred_at     timestamptz NOT NULL,
  actor_type      text NOT NULL,
  actor_id        text NOT NULL,
  actor_display   text,
  correlation_id  text,
  causation_id    text,
  UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX events_type_idx ON events (organization_id, type, occurred_at DESC);

CREATE TABLE workflow_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id      text NOT NULL,
  workflow_version integer NOT NULL,
  event_id         uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status           text NOT NULL CHECK (status IN ('queued', 'running', 'sleeping', 'awaiting_approval', 'succeeded', 'cancelled', 'dead_lettered')),
  attempt          integer NOT NULL DEFAULT 0,
  max_attempts     integer NOT NULL CHECK (max_attempts > 0),
  next_run_at      timestamptz NOT NULL,
  locked_by        text,
  locked_until     timestamptz,
  last_error       jsonb,
  output           jsonb,
  created_at       timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL,
  finished_at      timestamptz,
  UNIQUE (workflow_id, event_id)
);
CREATE INDEX workflow_runs_due_idx ON workflow_runs (next_run_at) WHERE status IN ('queued', 'sleeping');
CREATE INDEX workflow_runs_lease_idx ON workflow_runs (locked_until) WHERE status = 'running';
CREATE INDEX workflow_runs_org_idx ON workflow_runs (organization_id, created_at DESC);

CREATE TABLE workflow_steps (
  run_id          uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  output          jsonb,
  completed_at    timestamptz NOT NULL,
  PRIMARY KEY (run_id, name)
);

CREATE TABLE workflow_logs (
  id              bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_id          uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  level           text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message         text NOT NULL,
  step_name       text,
  data            jsonb,
  at              timestamptz NOT NULL
);
CREATE INDEX workflow_logs_run_idx ON workflow_logs (run_id, id);

CREATE TABLE dead_letters (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_id          uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  workflow_id     text NOT NULL,
  event_id        uuid NOT NULL,
  error           jsonb NOT NULL,
  attempts        integer NOT NULL,
  created_at      timestamptz NOT NULL,
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE approvals (
  id                  uuid PRIMARY KEY,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_id              uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_name           text NOT NULL,
  summary             text NOT NULL,
  required_permission text NOT NULL,
  payload             jsonb,
  status              text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by          text,
  decided_at          timestamptz,
  reason              text,
  created_at          timestamptz NOT NULL,
  UNIQUE (run_id, step_name)
);
CREATE INDEX approvals_pending_idx ON approvals (organization_id, created_at) WHERE status = 'pending';

-- Append-only audit trail of consequential actions.
CREATE TABLE audit_log (
  id              bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_type      text NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
  actor_id        text NOT NULL,
  action          text NOT NULL,
  target_type     text NOT NULL,
  target_id       text NOT NULL,
  data            jsonb,
  at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_idx ON audit_log (organization_id, at DESC);

CREATE OR REPLACE FUNCTION app.reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END $$;
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION app.reject_audit_mutation();

CREATE TABLE usage_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric          text NOT NULL CHECK (metric IN ('ai_input_tokens', 'ai_output_tokens', 'property_lookup', 'comps_lookup', 'skip_trace', 'sms_segment', 'voice_minute', 'lead_processed', 'underwriting_run')),
  quantity        numeric(18,4) NOT NULL CHECK (quantity >= 0),
  unit_cost_usd   numeric(12,6),
  ref             text,
  idempotency_key text,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usage_events_idem_uq ON usage_events (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX usage_events_period_idx ON usage_events (organization_id, metric, occurred_at);

CREATE TABLE integration_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'error', 'disconnected')),
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Pointer into the secret manager. Secrets are never stored in this database.
  secret_ref      text,
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

-- Replay protection for inbound webhooks.
CREATE TABLE inbound_webhook_receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  delivery_id     text NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider, delivery_id)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER organizations_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
CREATE TRIGGER contacts_updated BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
CREATE TRIGGER properties_updated BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
CREATE TRIGGER leads_updated BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY org_self ON organizations USING (id = app.current_org_id()) WITH CHECK (id = app.current_org_id());

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON memberships USING (organization_id = app.current_org_id()) WITH CHECK (organization_id = app.current_org_id());

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_in_org ON users USING (
  EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = users.id AND m.organization_id = app.current_org_id())
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts', 'properties', 'property_facts', 'leads', 'appointments', 'tasks', 'underwriting_runs', 'offers',
    'consent_records', 'suppression_entries', 'dnc_scrubs', 'conversations', 'messages', 'events', 'workflow_runs',
    'workflow_steps', 'workflow_logs', 'dead_letters', 'approvals', 'audit_log', 'usage_events',
    'integration_connections', 'inbound_webhook_receipts'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (organization_id = app.current_org_id()) WITH CHECK (organization_id = app.current_org_id())', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Worker functions (cross-tenant, SECURITY DEFINER, narrowly scoped)
-- ---------------------------------------------------------------------------
-- Leases due runs across all tenants. Returns only scheduling metadata; the worker then sets app.org_id
-- to each run's organization before reading any tenant data.
CREATE OR REPLACE FUNCTION app.claim_due_runs(p_worker text, p_lease_ms integer, p_limit integer, p_now timestamptz)
RETURNS SETOF workflow_runs
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE workflow_runs r
     SET status = 'running', locked_by = p_worker,
         locked_until = p_now + make_interval(secs => p_lease_ms / 1000.0), updated_at = p_now
   WHERE r.id IN (
     SELECT id FROM workflow_runs
      WHERE (status IN ('queued', 'sleeping') AND next_run_at <= p_now)
         OR (status = 'running' AND locked_until < p_now)
      ORDER BY next_run_at
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING r.*
$$;
REVOKE ALL ON FUNCTION app.claim_due_runs(text, integer, integer, timestamptz) FROM PUBLIC;

-- Resolves an organization membership for request authentication (before tenant context exists).
CREATE OR REPLACE FUNCTION app.membership_for(p_user uuid, p_org uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM memberships WHERE user_id = p_user AND organization_id = p_org
$$;
REVOKE ALL ON FUNCTION app.membership_for(uuid, uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Grants for the application role
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA app TO northstar_app;
GRANT EXECUTE ON FUNCTION app.current_org_id() TO northstar_app;
GRANT EXECUTE ON FUNCTION app.claim_due_runs(text, integer, integer, timestamptz) TO northstar_app;
GRANT EXECUTE ON FUNCTION app.membership_for(uuid, uuid) TO northstar_app;
GRANT USAGE ON SCHEMA public TO northstar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO northstar_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO northstar_app;
REVOKE UPDATE, DELETE ON audit_log FROM northstar_app;
REVOKE INSERT, UPDATE, DELETE ON users FROM northstar_app;
