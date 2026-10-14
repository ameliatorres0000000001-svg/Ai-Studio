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
