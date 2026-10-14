# Progress
Done: branch ui-redesign created; rules in CLAUDE.md; admin works via ADMIN_EMAILS; WORKSPACE_ROOT=/home/dev/workspaces.
Next: (1) fix ENOENT scandir '' in app/api/workspace/files/route.ts, (2) hide Connections for non-admins, (3) restyle home dashboard.
Done: returned HTTP 400 when WORKSPACE_ROOT or workspace path is empty.
Files changed: app/api/workspace/files/route.ts; npm run typecheck passed.
Next step: hide Connections for non-admins.
Done: Connections sidebar section now renders only when /api/admin/me reports isAdmin true; health route already enforces isAdminEmail server-side.
Files changed: app/page.tsx; npm run typecheck passed.
Next step: restyle home dashboard.
Done: workspace now uses a Claude-style dark studio shell with session navigation, artifacts, GitHub attachment menu, execution chat, code and diff panes; root redirects to /workspace.
Files changed: app/page.tsx; app/workspace/page.tsx; components/WorkspaceStudio.tsx; app/globals.css.
Next step: verify with npm run typecheck.
Done: Phase 0 — added scripts/test-gateway.mjs (tool use / streaming / prompt caching checks against claude-haiku-4-5 via AI_GATEWAY_*), test:gateway script, docs/REDESIGN.md skeleton (phase table was not included in the request).
Files changed: scripts/test-gateway.mjs; package.json; docs/REDESIGN.md.
Next step: user to paste full CLAUDE.md replacement text and the Phase 0–7 table.
Done: Phase 1 — added Tokyo Night tokens, next/font wiring, typed UI primitives, UI styles, and /ui-kit reference page.
Files changed: app/styles/tokens.css; app/globals.css; app/layout.tsx; components/ui/primitives.tsx; components/ui/ui.css; components/ui/index.ts; app/(dev)/ui-kit/page.tsx.
Next step: verify with npm run typecheck.
Done: Phase 2 — added Google + Telegram login screen, OAuth callback, AuthGate redirect, translated auth strings, and Google setup checklist.
Files changed: app/login/; app/auth/callback/; components/auth/; components/AuthGate.tsx; lib/i18n.tsx; docs/REDESIGN.md.
Next step: verify with npm run typecheck.
Done: Phase 3 — per-user GitHub OAuth (AES-256-GCM token store, start/callback/status/delete routes, signed state cookie bound to user via Bearer-authenticated start returning authUrl), per-user getOctokit with admin-only env fallback, listBranches, user-scoped workspace paths (WORKSPACE_ROOT/<userId>/<workspaceId>), GitHubConnectCard + RepoPickerDialog + /settings/connectors page, and connectRequired flow in RepoSelector.
Files changed: lib/crypto.ts; lib/github.ts; lib/workspace.ts; lib/route-helpers.ts; lib/types.ts; lib/api.ts; app/api/connectors/github/*; app/api/github/*; app/api/workspace/sync|commit; app/api/bot-builder/generate|project; app/api/health; components/connectors/; components/repo/; app/settings/connectors/page.tsx; components/RepoSelector.tsx; supabase/migrations/20261014000000_github_oauth_connections.sql; docs/REDESIGN.md.
Note: .env.example was blocked by permissions and could not be updated; add GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, CONNECTOR_ENCRYPTION_KEY manually (commands in docs/REDESIGN.md). npm run typecheck passed.
Done: Phase 4 — installed @anthropic-ai/claude-agent-sdk + zod, added lib/agent/run.ts (Agent SDK query() with fixed tools, MCP run_command, path/security PreToolUse deny hook, minimal env, SSE event mapping), /api/agent/stream + /api/agent/changes routes, sdk_session_id migration, docs/AGENT-PROMPT.md, scripts/test-agent.mjs, sendToClaude deprecation note.
Files changed: package.json; lib/agent/run.ts; app/api/agent/stream/route.ts; app/api/agent/changes/route.ts; lib/claude.ts; supabase/migrations/20261014010000_claude_sessions_sdk.sql; docs/AGENT-PROMPT.md; scripts/test-agent.mjs; package-lock.json.
Note: .env.example was still blocked by permissions; add AGENT_AUTH_HEADER= manually. npm run typecheck passed.
