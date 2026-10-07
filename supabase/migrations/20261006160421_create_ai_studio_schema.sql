/*
# AI Deploy Studio — Core Schema

1. New Tables
- `github_connections` — stores per-user GitHub OAuth state and connection metadata (not the token itself; tokens stay server-side in env or edge secrets).
- `workspaces` — represents a cloned repository working area. Tracks repo full name, local path, sync status, and timestamps.
- `activities` — append-only audit log for every Claude/Git/Build action performed in a workspace.
- `chat_messages` — conversation history between user and Claude Code for each workspace.

2. Security
- This app is single-tenant for now (no sign-in screen). RLS enabled on all tables with anon+authenticated CRUD.
- If auth is added later, scope policies to `auth.uid()` and add user_id columns.

3. Notes
- GitHub access tokens are NEVER stored in the database. They live in server-side environment variables / edge secrets only.
- The `workspaces.local_path` is a server-side reference to the cloned repo directory; it is not exposed to the browser.
*/

CREATE TABLE IF NOT EXISTS github_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  avatar_url text,
  connected_at timestamptz DEFAULT now(),
  last_synced_at timestamptz
);

ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_github_connections" ON github_connections;
CREATE POLICY "anon_select_github_connections" ON github_connections FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_github_connections" ON github_connections;
CREATE POLICY "anon_insert_github_connections" ON github_connections FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_github_connections" ON github_connections;
CREATE POLICY "anon_update_github_connections" ON github_connections FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_github_connections" ON github_connections;
CREATE POLICY "anon_delete_github_connections" ON github_connections FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_full_name text NOT NULL,
  repo_default_branch text DEFAULT 'main',
  local_path text NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_workspaces" ON workspaces;
CREATE POLICY "anon_select_workspaces" ON workspaces FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_workspaces" ON workspaces;
CREATE POLICY "anon_insert_workspaces" ON workspaces FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_workspaces" ON workspaces;
CREATE POLICY "anon_update_workspaces" ON workspaces FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_workspaces" ON workspaces;
CREATE POLICY "anon_delete_workspaces" ON workspaces FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  detail text,
  status text DEFAULT 'info',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_activities" ON activities;
CREATE POLICY "anon_select_activities" ON activities FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_activities" ON activities;
CREATE POLICY "anon_insert_activities" ON activities FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_activities" ON activities;
CREATE POLICY "anon_update_activities" ON activities FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_activities" ON activities;
CREATE POLICY "anon_delete_activities" ON activities FOR DELETE
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_chat_messages" ON chat_messages;
CREATE POLICY "anon_select_chat_messages" ON chat_messages FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_chat_messages" ON chat_messages;
CREATE POLICY "anon_insert_chat_messages" ON chat_messages FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_chat_messages" ON chat_messages;
CREATE POLICY "anon_delete_chat_messages" ON chat_messages FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_workspaces_repo ON workspaces(repo_full_name);
CREATE INDEX IF NOT EXISTS idx_activities_workspace ON activities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_workspace ON chat_messages(workspace_id, created_at);
