/*
# Usage events (model cost tracking)

One row per successful model request: who, which model/route, and token counts.

- No prompts or responses are stored here, only metadata and counts.
- upstream_model is recorded because the config can point a model id at a different upstream
  model later; cost reports should use the value that was actually called.

Security
- RLS: authenticated users may only SELECT their own rows.
- All writes happen in API routes with the service-role key, so INSERT/UPDATE/DELETE are
  revoked from client roles and no write policies exist.
- anon gets nothing.
*/

CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  model_id text NOT NULL,
  upstream_model text NOT NULL,
  route text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('code', 'research')),
  effort text CHECK (effort IN ('low', 'medium', 'high')),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_created
  ON usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_model_created
  ON usage_events(model_id, created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_usage_events" ON usage_events;
CREATE POLICY "select_own_usage_events" ON usage_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON usage_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON usage_events FROM authenticated;
