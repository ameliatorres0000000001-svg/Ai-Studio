-- TeleScripts Agent builder backend: projects, resumable runs, progress events,
-- deployed bot instances, agent audit log, and the shared multi-tenant data
-- tables every generated bot writes into (scoped by bot_id through RLS).
--
-- Builder tables are service-role only (the API routes do ownership checks),
-- matching the lockdown in 20261010010000_drop_allow_all_policies.sql.
-- Generated bots reach the bot_* tables with a per-bot JWT whose `bot_id`
-- claim RLS compares against each row (see lib/builder/data.ts).

-- ── Builder state ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS builder_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  template text NOT NULL CHECK (template IN ('shop-bot', 'faq-bot')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'building', 'waiting_bot', 'live', 'failed', 'deleted')),
  requirements jsonb NOT NULL,
  pending_bot_username text,
  managed_link text,
  -- Admin approval gate for destructive platform-agent actions (set by admins only).
  approved_actions text[] NOT NULL DEFAULT '{}',
  approved_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS builder_projects_user_idx ON builder_projects (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS builder_projects_pending_username_idx
  ON builder_projects (lower(pending_bot_username)) WHERE pending_bot_username IS NOT NULL;

CREATE TABLE IF NOT EXISTS builder_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES builder_projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'waiting', 'failed', 'done')),
  step text NOT NULL DEFAULT 'requirements',
  error text,
  attempts integer NOT NULL DEFAULT 0,
  auto_retries integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS builder_runs_project_idx ON builder_runs (project_id, started_at DESC);

CREATE TABLE IF NOT EXISTS builder_events (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES builder_runs(id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'done', 'failed', 'waiting', 'info', 'retry')),
  message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS builder_events_run_idx ON builder_events (run_id, id);

CREATE TABLE IF NOT EXISTS bot_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES builder_projects(id) ON DELETE CASCADE,
  telegram_bot_id bigint UNIQUE,
  username text,
  token_enc text CHECK (token_enc IS NULL OR token_enc LIKE 'v1:%'),
  webhook_secret_enc text CHECK (webhook_secret_enc IS NULL OR webhook_secret_enc LIKE 'v1:%'),
  creator_telegram_id bigint,
  owner_telegram_id bigint,
  github_repo text,
  repo_commit text,
  vercel_project_id text,
  vercel_deployment_id text,
  deploying_commit text,
  deployed_commit text,
  vercel_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'linked', 'provisioned', 'deployed', 'live', 'failed', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_audit_log (
  id bigserial PRIMARY KEY,
  actor text NOT NULL,
  project_id uuid REFERENCES builder_projects(id) ON DELETE SET NULL,
  action text NOT NULL,
  detail text NOT NULL DEFAULT '' CHECK (char_length(detail) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_audit_log_project_idx ON agent_audit_log (project_id, created_at DESC);

ALTER TABLE builder_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE builder_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE builder_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;
-- No client policies: only the service role (API routes) reads or writes these.
REVOKE ALL ON builder_projects, builder_runs, builder_events, bot_instances, agent_audit_log FROM anon, authenticated;

-- ── Shared tenant data for generated bots ───────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bot_instances(id) ON DELETE CASCADE,
  position integer NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  currency text NOT NULL CHECK (currency IN ('USD', 'KHR')),
  description text,
  UNIQUE (bot_id, position)
);

CREATE TABLE IF NOT EXISTS bot_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bot_instances(id) ON DELETE CASCADE,
  telegram_user_id bigint NOT NULL,
  username text,
  first_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, telegram_user_id)
);

CREATE TABLE IF NOT EXISTS bot_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bot_instances(id) ON DELETE CASCADE,
  customer_telegram_id bigint,
  product text NOT NULL,
  amount numeric,
  currency text,
  details text CHECK (details IS NULL OR char_length(details) <= 2000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'paid', 'shipped', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bot_orders_bot_idx ON bot_orders (bot_id, created_at DESC);

ALTER TABLE bot_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bot_products, bot_customers, bot_orders FROM anon, authenticated;
GRANT SELECT ON bot_products TO authenticated;
GRANT SELECT, INSERT, UPDATE ON bot_customers TO authenticated;
GRANT SELECT, INSERT ON bot_orders TO authenticated;

-- A request only sees rows of the bot named in its JWT. App users' JWTs carry
-- no bot_id claim, so the comparison is NULL and they see nothing.
DROP POLICY IF EXISTS bot_products_tenant ON bot_products;
CREATE POLICY bot_products_tenant ON bot_products FOR SELECT TO authenticated
  USING (bot_id::text = (SELECT auth.jwt() ->> 'bot_id'));

DROP POLICY IF EXISTS bot_customers_tenant_select ON bot_customers;
CREATE POLICY bot_customers_tenant_select ON bot_customers FOR SELECT TO authenticated
  USING (bot_id::text = (SELECT auth.jwt() ->> 'bot_id'));
DROP POLICY IF EXISTS bot_customers_tenant_insert ON bot_customers;
CREATE POLICY bot_customers_tenant_insert ON bot_customers FOR INSERT TO authenticated
  WITH CHECK (bot_id::text = (SELECT auth.jwt() ->> 'bot_id'));
DROP POLICY IF EXISTS bot_customers_tenant_update ON bot_customers;
CREATE POLICY bot_customers_tenant_update ON bot_customers FOR UPDATE TO authenticated
  USING (bot_id::text = (SELECT auth.jwt() ->> 'bot_id'))
  WITH CHECK (bot_id::text = (SELECT auth.jwt() ->> 'bot_id'));

DROP POLICY IF EXISTS bot_orders_tenant_select ON bot_orders;
CREATE POLICY bot_orders_tenant_select ON bot_orders FOR SELECT TO authenticated
  USING (bot_id::text = (SELECT auth.jwt() ->> 'bot_id'));
DROP POLICY IF EXISTS bot_orders_tenant_insert ON bot_orders;
CREATE POLICY bot_orders_tenant_insert ON bot_orders FOR INSERT TO authenticated
  WITH CHECK (bot_id::text = (SELECT auth.jwt() ->> 'bot_id'));
