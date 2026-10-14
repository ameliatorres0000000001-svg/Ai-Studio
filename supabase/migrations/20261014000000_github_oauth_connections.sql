/*
# Per-user GitHub OAuth connections

Stores the user's GitHub OAuth access token ENCRYPTED (AES-256-GCM via
CONNECTOR_ENCRYPTION_KEY) plus public metadata. The plaintext token never
appears in the database or in any API response.

Security
- user_id is the primary key (one connection per user), cascades on user delete.
- RLS enabled; ALL grants revoked from anon and authenticated — only the
  service-role client (server API routes) may read/write, including SELECT.
  This guarantees token_enc can never be returned through PostgREST.
- CHECK enforces the v1: envelope on token_enc.
*/

DO $$
BEGIN
  -- Bring the legacy metadata-only table up to the Phase 3 shape.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'github_connections' AND column_name = 'token_enc') THEN
    ALTER TABLE github_connections ADD COLUMN token_enc text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'github_connections' AND column_name = 'scopes') THEN
    ALTER TABLE github_connections ADD COLUMN scopes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'github_connections' AND column_name = 'github_login') THEN
    ALTER TABLE github_connections ADD COLUMN github_login text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'github_connections' AND column_name = 'updated_at') THEN
    ALTER TABLE github_connections ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'github_connections' AND column_name = 'created_at') THEN
    ALTER TABLE github_connections ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Backfill github_login from the legacy `username` column where present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'github_connections' AND column_name = 'username') THEN
    UPDATE github_connections SET github_login = username WHERE github_login IS NULL;
  END IF;
END $$;

ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;

-- Remove the old owner-scoped client policies: clients get nothing; the
-- service role bypasses RLS for all reads and writes.
DROP POLICY IF EXISTS "select_own_github_connections" ON github_connections;
DROP POLICY IF EXISTS "insert_own_github_connections" ON github_connections;
DROP POLICY IF EXISTS "update_own_github_connections" ON github_connections;
DROP POLICY IF EXISTS "delete_own_github_connections" ON github_connections;
DROP POLICY IF EXISTS "anon_select_github_connections" ON github_connections;
DROP POLICY IF EXISTS "anon_insert_github_connections" ON github_connections;
DROP POLICY IF EXISTS "anon_update_github_connections" ON github_connections;
DROP POLICY IF EXISTS "anon_delete_github_connections" ON github_connections;

REVOKE ALL ON github_connections FROM anon;
REVOKE ALL ON github_connections FROM authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'github_connections_token_enc_v1'
  ) THEN
    ALTER TABLE github_connections
      ADD CONSTRAINT github_connections_token_enc_v1
      CHECK (token_enc IS NULL OR token_enc LIKE 'v1:%');
  END IF;
END $$;
