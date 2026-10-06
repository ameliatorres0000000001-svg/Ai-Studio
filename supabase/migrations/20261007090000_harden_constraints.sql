/*
# Harden constraints (follow-up to the multi-tenant migration)

1. One GitHub connection per user, one workspace per (user, repo)
   - The app looks these rows up with maybeSingle(); duplicates would make it error.
   - If this migration fails on "could not create unique index", you have duplicate
     rows from earlier testing. Delete the duplicates and re-run.

2. Server-only access for anon
   - Explicitly revoke table privileges from `anon`; every policy is already
     `TO authenticated`, this is defence in depth.

Notes
- The API routes use the service-role key (bypasses RLS) and enforce ownership in code
  (`user_id` filters / getOwnedWorkspace). RLS protects direct PostgREST access with the
  public anon key.
- workspaces.local_path is legacy; the server now derives the path from workspaces.id.
*/

CREATE UNIQUE INDEX IF NOT EXISTS uq_github_connections_user
  ON github_connections(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workspaces_user_repo
  ON workspaces(user_id, repo_full_name);

REVOKE ALL ON github_connections, workspaces, activities, chat_messages, claude_sessions, deployments FROM anon;
