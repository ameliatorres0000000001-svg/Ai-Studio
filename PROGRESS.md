# Progress
Done: branch ui-redesign created; rules in CLAUDE.md; admin works via ADMIN_EMAILS; WORKSPACE_ROOT=/home/dev/workspaces.
Next: (1) fix ENOENT scandir '' in app/api/workspace/files/route.ts, (2) hide Connections for non-admins, (3) restyle home dashboard.
Done: returned HTTP 400 when WORKSPACE_ROOT or workspace path is empty.
Files changed: app/api/workspace/files/route.ts; npm run typecheck passed.
Next step: hide Connections for non-admins.
Done: Connections sidebar section now renders only when /api/admin/me reports isAdmin true; health route already enforces isAdminEmail server-side.
Files changed: app/page.tsx; npm run typecheck passed.
Next step: restyle home dashboard.
