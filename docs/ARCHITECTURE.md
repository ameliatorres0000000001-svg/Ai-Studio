# Architecture

CodingStudio is a Next.js 14 app (App Router). One Node server does
everything: API routes, git workspaces on disk, model routing.

## Request flow

```
browser ──Bearer Supabase JWT──▶ API route
  ├─ getAuthenticatedUser (Supabase) + ALLOWED_USER_EMAILS allowlist
  ├─ ownership: getOwnedWorkspace(id, userId) — id AND user_id
  ├─ model routes: resolveModel(id) → server-side route creds from env
  ├─ chat: checkEntitlement (tier/quota) → provider → logUsage
  └─ JSON back, scrubbed (no keys, routes, env names, local_path)
```

## Model layer (`lib/ai/`)

- `config/models.json` v2: routes (format + `baseUrlEnv`/`keyEnv`) plus
  models (`id`, `purpose[]`, `tier`, `route`, `upstreamModel`, `provider`,
  `icon`, `effortSupport`). Empty/`TODO` upstream = hidden.
- `registry.ts` reads env by the names in config; `types.ts` keeps
  `ResolvedModel` (has the key) server-only, `PublicModel` safe for browsers.
- Providers: `anthropic.ts` (Messages API, `output_config.effort`),
  `openai.ts` (chat-completions fetch, `reasoning_effort`), chosen by format.
- Code mode (`lib/claude.ts`): repo tree + current file in context, parses
  `<<<FILE>>>` blocks, never writes (apply is a separate user step).
  Research mode (`research.ts`): plain chat, max 5 attachments × 60k chars,
  never touches disk.
- `lib/entitlements.ts`: pure `evaluateEntitlement` (unit-tested by
  `scripts/test-quota.mjs`) + live `checkEntitlement` (plan from
  `user_plans`→`plans`, count from `usage_events` today, ADMIN_EMAILS bypass).

## Data (Supabase Postgres)

| Table | Written by |
|---|---|
| `workspaces` (+`local_path`, server-derived) | sync route (service role) |
| `chat_messages`, `claude_sessions` | chat route |
| `activities` (audit, incl. admin actions) | everywhere, best-effort |
| `usage_events` (model, tokens, no prompts) | after every model call |
| `plans`, `user_plans` (expiry → behaves as Free) | migration seed + admin |
| `payment_submissions` (private receipt, `trx_id` UNIQUE) | submit route + admin review |
| `waitlist` | waitlist route |
| `telegram_connections`, `github_connections`, `deployments` | their routes |

RLS everywhere; anon revoked on all app tables; client roles have no writes
on service-role-only tables (see lockdown migration
`20261010010000_drop_allow_all_policies.sql`).

## Frontend

- `app/page.tsx`: tabs Dashboard / Projects / Workspace / Subscription /
  Settings. `components/Dashboard.tsx` reads health/usage/repos/activities.
- `ClaudeChat.tsx`: model bottom sheet (provider groups, tier locks), effort,
  localStorage memory, KH/EN 429 banner, model icon + tokens per answer.
- `Subscription.tsx`: 3 steps (plans → method → pay), `co-` tokens in
  `public/checkout-theme.css`, icons in `public/assets/pay/`.
- `app/admin/page.tsx`: ADMIN_EMAILS-gated console (also `/api/admin/*`).
- `/dashboard-preview` is an admin-only UI demo, not connected to anything.

## Files on disk

Cloned repos live under `WORKSPACE_ROOT/<workspace-uuid>` (default
`.workspaces/`). The browser never learns the path: routes return
`toPublicWorkspace()` (strips `local_path`); the server re-derives it per
request via `getWorkspacePath(id)`.
