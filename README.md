# Claude Code Studio

AI Developer Workspace — GitHub-first coding with Claude Code.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Features

- **GitHub Integration** — Browse and clone your repositories
- **Claude Code** — AI-powered code analysis, editing, and testing
- **IDE Workspace** — Three-panel layout with file tree, Claude chat, and code viewer
- **Terminal** — Run allowlisted commands in an isolated workspace
- **Git Diff** — Review changes, approve, commit & push, or rollback
- **Activity Log** — Full audit trail of every action
- **Command Palette** — Press Ctrl+K for quick navigation
- **Bilingual UI** — Khmer (KH) and English (EN), defaults to Khmer
- **Responsive** — Works on desktop, tablet, and mobile

## Setup

1. `cp .env.example .env.local` and fill in the values (see **Environment Variables**).
2. **Supabase**: create a project, then apply every file in `supabase/migrations/` in order
   (SQL editor or `supabase db push`). Enable Email auth under Authentication → Providers.
3. **GitHub**: create a fine-grained token (Contents: read & write, only on the repos you want) and set `GITHUB_ACCESS_TOKEN`.
4. **Claude**: set `ANTHROPIC_API_KEY` from https://console.anthropic.com.
5. **Access control**: set `ALLOWED_USER_EMAILS` to the emails allowed to sign in. All users share the server's GitHub and Anthropic credentials, so in production an empty list denies everyone.
6. `npm install && npm run typecheck && npm run build`, then `npm run dev` / `npm start`.

## Deployment requirement

The server clones repositories to disk and runs git/npm in them (`WORKSPACE_ROOT`, default `./.workspaces`).
It therefore needs a **long-running Node host with a persistent disk** (VM, Docker, Railway, Fly, etc.).
Serverless platforms (including the Netlify config in this repo) have ephemeral, read-only or per-invocation
filesystems and cannot keep workspaces between requests. If workspace files disappear, the API returns
`409 syncRequired` and the repo must be synced again.

## Workflow

GitHub → Select Project → Claude Code → Read/Explain → Edit → Diff → Run/Test → Logs → Approve → Commit/Push → Deploy

## Architecture

### Backend (API Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/github/status` | GET | Check GitHub connection |
| `/api/github/repos` | GET | List user's repositories |
| `/api/workspace/sync` | POST | Clone or pull a repository |
| `/api/workspace/list` | GET | List all synced workspaces |
| `/api/workspace/files` | GET | Get file tree or file content |
| `/api/workspace/diff` | GET | Get uncommitted git diff |
| `/api/workspace/commit` | POST | Commit and push changes |
| `/api/workspace/rollback` | POST | Reset the local workspace to a backup tag |
| `/api/workspace/run` | POST | Run an allowlisted command |
| `/api/claude/chat` | POST | Ask Claude; returns reply + proposed file edits (never writes files) |
| `/api/claude/apply` | POST | Write user-approved file edits into the workspace |
| `/api/deploy/vercel` | POST/GET | Deploy pushed branch to Vercel (preview; production needs confirmation) / list status |
| `/api/health` | GET | Which server integrations are configured (booleans) |
| `/api/claude/messages` | GET | Get chat history |
| `/api/activities` | GET | Get activity log |

### Database (Supabase)

| Table | Purpose |
|-------|---------|
| `github_connections` | GitHub connection metadata |
| `workspaces` | Cloned repository working areas |
| `activities` | Append-only audit log |
| `chat_messages` | Claude conversation history |

### Security

- Secrets (`GITHUB_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are read only on the server. The service-role key is required and is never substituted by the anon key.
- Every API route requires a valid Supabase session and (in production) an email in `ALLOWED_USER_EMAILS`; workspaces are looked up by `id` **and** `user_id`.
- The GitHub token is used only per git operation and is not left in `.git/config`; command output and errors are redacted.
- All file paths are confined to the workspace (traversal, absolute paths and symlink escapes rejected; `.git` is not writable).
- Commands run **without a shell** from an allowlist, with a minimal environment (no server secrets), a 120 s timeout and capped output.
  **This is not a sandbox**: `npm run`, `npx` and `node script.js` execute repository code. Run the service in an isolated container/VM with only the secrets it needs.
- Claude proposes edits; files are written only after the user applies them. Commit/push is a separate explicit step and pushes to the workspace's checked-out branch (the default branch) - use GitHub branch protection if you do not want direct pushes there.
- Rollback is local only (tag created before each commit); it does not revert commits already pushed.
- RLS is enabled on all tables, scoped to `auth.uid()`.

## Environment Variables

See `.env.example`.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; bypasses RLS |
| `ALLOWED_USER_EMAILS` | Yes (production) | Comma-separated emails allowed to use the app |
| `GITHUB_ACCESS_TOKEN` | Yes | Fine-grained PAT, Contents read/write |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `VERCEL_TOKEN` | Optional | Enables the Vercel deploy button; also `VERCEL_TEAM_ID`, `VERCEL_PROJECT_NAME` |
| `TELEGRAM_BOT_TOKEN` | Optional | Enables the optional Telegram connector (Settings → Connectors / Integrations). Server-only; never sent to the browser or stored in the database |
| `GITHUB_ALLOWED_REPOS` | Optional | `owner/repo,owner/*` allowlist |
| `ANTHROPIC_MODEL` / `ANTHROPIC_MAX_TOKENS` | Optional | Override model / output limit |
| `GIT_COMMIT_NAME` / `GIT_COMMIT_EMAIL` | Optional | Commit identity |
| `WORKSPACE_ROOT` | Optional | Clone directory (persistent disk) |
