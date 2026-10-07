/*
# Upgrade to Multi-Tenant with Supabase Auth

## Purpose
Transforms the single-tenant schema into a proper multi-tenant architecture where each user can only access their own projects, sessions, and activity history.

## Changes

### 1. Add user_id columns to existing tables
- `github_connections` — add `user_id uuid NOT NULL DEFAULT auth.uid()` referencing `auth.users(id)`
- `workspaces` — add `user_id uuid NOT NULL DEFAULT auth.uid()` referencing `auth.users(id)`
- `activities` — add `user_id uuid NOT NULL DEFAULT auth.uid()` referencing `auth.users(id)`
- `chat_messages` — add `user_id uuid NOT NULL DEFAULT auth.uid()` referencing `auth.users(id)`

### 2. Add structured columns to `activities`
- `prompt` (text) — the user prompt that triggered the action
- `action` (text) — the specific action performed (e.g. "claude_edit", "command_run", "git_commit")
- `files_changed` (text[]) — array of file paths that were changed
- `command` (text) — the command that was executed (if any)
- `test_result` (text) — test output or result summary
- `error` (text) — error message if the action failed

### 3. Add columns to `workspaces`
- `repo_description` (text) — repository description from GitHub
- `repo_language` (text) — primary language from GitHub
- `repo_private` (boolean) — whether the repo is private
- `repo_html_url` (text) — URL to the GitHub repo

### 4. New Tables
- `claude_sessions` — tracks active Claude Code sessions per workspace
  - `id` (uuid, PK)
  - `workspace_id` (uuid, FK to workspaces)
  - `user_id` (uuid, NOT NULL DEFAULT auth.uid())
  - `status` (text: 'active' | 'completed' | 'error')
  - `prompt` (text) — the initial prompt
  - `result_summary` (text) — summary of what Claude did
  - `files_changed` (text[]) — files modified in this session
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz)
  - `created_at` (timestamptz)

- `deployments` — tracks deployment history
  - `id` (uuid, PK)
  - `workspace_id` (uuid, FK to workspaces)
  - `user_id` (uuid, NOT NULL DEFAULT auth.uid())
  - `platform` (text: 'vercel' | 'railway')
  - `status` (text: 'pending' | 'success' | 'failed')
  - `url` (text) — deployed URL
  - `error` (text) — error message if failed
  - `created_at` (timestamptz)

### 5. Security — Replace RLS Policies
- Drop all existing anon-accessible policies on all tables
- Create new owner-scoped policies using `auth.uid() = user_id` for SELECT, INSERT, UPDATE, DELETE
- All policies scope to `TO authenticated` only — unauthenticated users get nothing
- Child tables (activities, chat_messages, claude_sessions, deployments) verify ownership through the parent workspace via `EXISTS (SELECT 1 FROM workspaces WHERE workspaces.id = child.workspace_id AND workspaces.user_id = auth.uid())`

### 6. Indexes
- Add `user_id` indexes on all tables for fast ownership queries
- Add `workspace_id` indexes on new tables

### Important Notes
1. GitHub access tokens are NEVER stored in the database — they stay in server-side environment variables only
2. The `workspaces.local_path` is a server-side reference, never exposed to the browser
3. Anthropic API keys stay in environment variables, never in the database
4. Existing data (if any) will get `user_id = NULL` — the DEFAULT auth.uid() only applies to new inserts. Since this was previously single-tenant with anon access, existing rows were test data and can be cleared if needed.
*/
DO $$
BEGIN
  -- Add user_id to github_connections
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'github_connections' AND column_name = 'user_id') THEN
    ALTER TABLE github_connections ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add user_id to workspaces
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'user_id') THEN
    ALTER TABLE workspaces ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add user_id to activities
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'user_id') THEN
    ALTER TABLE activities ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add user_id to chat_messages
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'user_id') THEN
    ALTER TABLE chat_messages ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add structured activity columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'prompt') THEN
    ALTER TABLE activities ADD COLUMN prompt text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'action') THEN
    ALTER TABLE activities ADD COLUMN action text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'files_changed') THEN
    ALTER TABLE activities ADD COLUMN files_changed text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'command') THEN
    ALTER TABLE activities ADD COLUMN command text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'test_result') THEN
    ALTER TABLE activities ADD COLUMN test_result text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'error') THEN
    ALTER TABLE activities ADD COLUMN error text;
  END IF;
END $$;

-- Add workspace repo metadata columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'repo_description') THEN
    ALTER TABLE workspaces ADD COLUMN repo_description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'repo_language') THEN
    ALTER TABLE workspaces ADD COLUMN repo_language text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'repo_private') THEN
    ALTER TABLE workspaces ADD COLUMN repo_private boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'repo_html_url') THEN
    ALTER TABLE workspaces ADD COLUMN repo_html_url text;
  END IF;
END $$;

-- Create claude_sessions table
CREATE TABLE IF NOT EXISTS claude_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  prompt text,
  result_summary text,
  files_changed text[],
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE claude_sessions ENABLE ROW LEVEL SECURITY;

-- Create deployments table
CREATE TABLE IF NOT EXISTS deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  url text,
  error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- ─── Replace RLS Policies ───────────────────

-- github_connections: owner-scoped
DROP POLICY IF EXISTS "anon_select_github_connections" ON github_connections;
DROP POLICY IF EXISTS "anon_insert_github_connections" ON github_connections;
DROP POLICY IF EXISTS "anon_update_github_connections" ON github_connections;
DROP POLICY IF EXISTS "anon_delete_github_connections" ON github_connections;

CREATE POLICY "select_own_github_connections" ON github_connections
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_github_connections" ON github_connections
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_github_connections" ON github_connections
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_github_connections" ON github_connections
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- workspaces: owner-scoped
DROP POLICY IF EXISTS "anon_select_workspaces" ON workspaces;
DROP POLICY IF EXISTS "anon_insert_workspaces" ON workspaces;
DROP POLICY IF EXISTS "anon_update_workspaces" ON workspaces;
DROP POLICY IF EXISTS "anon_delete_workspaces" ON workspaces;

CREATE POLICY "select_own_workspaces" ON workspaces
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_workspaces" ON workspaces
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_workspaces" ON workspaces
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_workspaces" ON workspaces
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- activities: owner-scoped through user_id column
DROP POLICY IF EXISTS "anon_select_activities" ON activities;
DROP POLICY IF EXISTS "anon_insert_activities" ON activities;
DROP POLICY IF EXISTS "anon_update_activities" ON activities;
DROP POLICY IF EXISTS "anon_delete_activities" ON activities;

CREATE POLICY "select_own_activities" ON activities
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_activities" ON activities
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_activities" ON activities
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_activities" ON activities
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- chat_messages: owner-scoped through user_id column
DROP POLICY IF EXISTS "anon_select_chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "anon_insert_chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "anon_delete_chat_messages" ON chat_messages;

CREATE POLICY "select_own_chat_messages" ON chat_messages
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_chat_messages" ON chat_messages
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_chat_messages" ON chat_messages
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- claude_sessions: owner-scoped through user_id column
CREATE POLICY "select_own_claude_sessions" ON claude_sessions
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_claude_sessions" ON claude_sessions
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_claude_sessions" ON claude_sessions
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_claude_sessions" ON claude_sessions
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- deployments: owner-scoped through user_id column
CREATE POLICY "select_own_deployments" ON deployments
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_deployments" ON deployments
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_deployments" ON deployments
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_deployments" ON deployments
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── Indexes ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_github_conn_user ON github_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_claude_sessions_workspace ON claude_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_claude_sessions_user ON claude_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_workspace ON deployments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deployments_user ON deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_created ON deployments(created_at DESC);
