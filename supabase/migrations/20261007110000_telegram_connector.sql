/*
# Telegram connector (optional integration)

Stores ONLY connection metadata for the optional Telegram connector, one row per user.

- The bot token is NEVER stored here. It lives in the server environment
  (TELEGRAM_BOT_TOKEN) and is never sent to the browser.
- status: 'connected' | 'error' | 'disconnected'. A user with no row is "not connected".
- chat_id / chat_title: optional destination chat the user chose (not a secret).

Security
- RLS: authenticated users may only SELECT their own row.
- All writes happen in API routes with the service-role key, so INSERT/UPDATE/DELETE
  are revoked from client roles (defence in depth) and no write policies exist.
- anon gets nothing.

Core features (editing, terminal, tests, git) do not depend on this table.
*/

CREATE TABLE IF NOT EXISTS telegram_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'error', 'disconnected')),
  bot_id bigint,
  bot_username text,
  bot_name text,
  chat_id text,
  chat_title text,
  last_error text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE telegram_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_telegram_connections" ON telegram_connections;
CREATE POLICY "select_own_telegram_connections" ON telegram_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON telegram_connections FROM anon;
REVOKE INSERT, UPDATE, DELETE ON telegram_connections FROM authenticated;
