# AI Deploy Studio

GitHub-first developer dashboard for managing projects with Claude Code.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Setup

1. Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

2. **GitHub**: Create a Personal Access Token at https://github.com/settings/tokens with `repo` scope. Set `GITHUB_ACCESS_TOKEN`.

3. **Claude**: Get an API key from https://console.anthropic.com. Set `ANTHROPIC_API_KEY`.

4. **Supabase**: Already auto-configured (URL, anon key, service role key).

## How It Works

1. **Connect GitHub** — The dashboard reads your GitHub repositories using a Personal Access Token (server-side only, never exposed to the browser).
2. **Select a Repository** — Browse your repos and click one to clone it into an isolated server-side workspace.
3. **Browse Files** — View the project file tree and read any source file.
4. **Ask Claude** — Send natural language instructions like "Add a Telegram button" or "Explain this file." Claude reads the project file tree and responds. When editing, Claude outputs file changes you can apply.
5. **Review Diff** — See exactly what changed before committing.
6. **Approve / Rollback** — Commit and push to GitHub, or rollback to a pre-commit backup tag.
7. **Run Commands** — Execute allowlisted commands (npm, npx, node, tsc, git, etc.) inside the workspace with live output.
8. **Activity Log** — Every action is logged to Supabase with timestamps and status.

## Architecture

### Backend (API Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/github/status` | GET | Check GitHub connection and authenticated user |
| `/api/github/repos` | GET | List user's repositories |
| `/api/workspace/sync` | POST | Clone or pull a repository into a workspace |
| `/api/workspace/list` | GET | List all synced workspaces |
| `/api/workspace/files` | GET | Get file tree or file content |
| `/api/workspace/diff` | GET | Get uncommitted git diff |
| `/api/workspace/commit` | POST | Commit and push changes (creates backup tag) |
| `/api/workspace/rollback` | POST | Rollback to a backup tag |
| `/api/workspace/run` | POST | Run an allowlisted command in the workspace |
| `/api/claude/chat` | POST | Send a message to Claude with project context |
| `/api/claude/messages` | GET | Get chat history for a workspace |
| `/api/activities` | GET | Get activity log |

### Database (Supabase)

| Table | Purpose |
|-------|---------|
| `github_connections` | GitHub connection metadata (tokens stay in env vars) |
| `workspaces` | Cloned repository working areas |
| `activities` | Append-only audit log |
| `chat_messages` | Claude conversation history |

### Security

- **No secrets in the browser** — GitHub tokens and Anthropic API keys are server-side only (environment variables).
- **Command allowlist** — Only `npm`, `npx`, `node`, `yarn`, `pnpm`, `tsc`, `eslint`, `prettier`, `git`, `cat`, `ls`, `test` can run. Shell chaining (`;`, `&&`, `|`), `sudo`, `rm -rf`, `eval`, and other dangerous patterns are blocked.
- **Workspace isolation** — Commands only run inside the selected project's workspace directory. No filesystem access outside it.
- **Command timeouts** — All commands have a 120-second timeout.
- **Backup tags** — Every commit creates a git tag for rollback.
- **RLS enabled** on all database tables.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_ACCESS_TOKEN` | Yes | GitHub Personal Access Token (repo scope) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `NEXT_PUBLIC_SUPABASE_URL` | Auto | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auto | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Supabase service role key |

## Remaining Integration Steps

- **GitHub OAuth**: Currently uses Personal Access Tokens. For multi-user support, implement OAuth flow with `@octokit/oauth-app`.
- **Deployment integration**: Connect Vercel/Railway APIs for one-click deploys.
- **Telegram Bot**: Add bot management and notification webhooks.
- **Real-time streaming**: Use Server-Sent Events or WebSocket for streaming Claude responses and terminal output.
- **Container isolation**: Use Docker containers per workspace for stronger isolation.
