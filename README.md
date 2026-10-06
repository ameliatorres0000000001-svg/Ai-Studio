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

1. Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

2. **GitHub**: Create a Personal Access Token at https://github.com/settings/tokens with `repo` scope. Set `GITHUB_ACCESS_TOKEN`.

3. **Claude Code**: Get an API key from https://console.anthropic.com. Set `ANTHROPIC_API_KEY`.

4. **Vercel** (optional): Create a token at https://vercel.com/account/tokens. Set `VERCEL_TOKEN`.

5. **Railway** (optional): Create a token at https://railway.app/account/tokens. Set `RAILWAY_TOKEN`.

6. **Supabase**: Already auto-configured.

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
| `/api/workspace/rollback` | POST | Rollback to a backup tag |
| `/api/workspace/run` | POST | Run an allowlisted command |
| `/api/claude/chat` | POST | Send a message to Claude Code |
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

- All secrets stay server-side (environment variables)
- Command allowlist with blocked patterns (no sudo, rm -rf, eval, shell chaining)
- Workspace isolation — commands run only inside the selected project
- 120-second command timeout
- RLS enabled on all database tables
- Backup tags for rollback before every commit

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_ACCESS_TOKEN` | Yes | GitHub Personal Access Token (repo scope) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude Code |
| `VERCEL_TOKEN` | Optional | Vercel API token for web deployment |
| `RAILWAY_TOKEN` | Optional | Railway API token for server/bot deployment |
| `NEXT_PUBLIC_SUPABASE_URL` | Auto | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auto | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Supabase service role key |
