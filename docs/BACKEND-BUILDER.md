# TeleScripts builder backend

A user describes a bot in Khmer. The requirements agent turns that into a
`BotSpec`. The platform then creates a **real Telegram bot owned by the user**
(Telegram Managed Bots), generates its code from a tested template, deploys it
on **our** Vercel team against **our** shared Supabase project, and hands it
over. The user never sees code, tokens or env files.

```
POST /api/builder/projects          spec ──▶ builder_projects (requirements)
POST /api/builder/projects/:id/start      ──▶ builder_runs + background pipeline
GET  /api/builder/projects/:id/events     ◀── SSE from builder_events
POST /api/telegram/managed-webhook        ◀── Telegram `managed_bot` update (manager bot)
POST /api/builder/projects/:id/repair     ──▶ re-run from the failed step
```

## Pipeline (lib/builder/pipeline.ts)

Each step is idempotent: it checks what already exists (`bot_instances`
columns, repo commit, deployment state) before acting. It writes a
`builder_events` row on start, done, retry and failure. The run keeps `step`,
so any request (start, repair, webhook) resumes from there. A DB lease
(`builder_runs.locked_until`) keeps two workers off the same run.

| # | step | what it does | resumable because |
|---|------|--------------|-------------------|
| 1 | requirements | validates the stored spec | pure check |
| 2 | create_bot_link | `https://t.me/newbot/{manager}/{username}?name={name}` saved on the project | link reused if present |
| 3 | await_managed_bot | waits (run status `waiting`) until the webhook stores the encrypted token | token presence is the gate |
| 4 | provision_repo | template + filled config → private repo under the platform account | new commit only when the tree changed |
| 5 | provision_data | registers the tenant and seeds `bot_products` in the shared Supabase | delete+insert per bot_id |
| 6 | deploy | Vercel project, env vars (token decrypted only here), inline-file deployment, waits for READY | skipped when `deployed_commit` = `repo_commit` and READY |
| 7 | set_webhook | `setWebhook` to `<url>/api/webhook` with a per-bot `secret_token`; shop bots also get the Mini App menu button | Telegram replaces the webhook |
| 8 | smoke_test | `GET <url>/api/health` must report token + secret + data config; `getWebhookInfo.url` must match | read-only |
| 9 | handoff | `owner_telegram_id` = creator, project `live`, manager bot sends the owner a Khmer message (best effort) | overwrite |

Failures: at most 2 automatic retries per step (`retryDelaysMs`), then the run
is `failed` with a redacted error. "ឲ្យ AI ជួសជុល" calls `/repair`, which resets
the counters and resumes from the failed step.

## Secrets

- Bot tokens come only from `getManagedBotToken`. They are stored as
  `bot_instances.token_enc` (AES-256-GCM, `lib/crypto.ts`). They are decrypted
  in the deploy, set_webhook and smoke_test steps only, and registered with
  `registerSecret` so `redactSecrets` scrubs them from any accidental echo.
- Per-bot webhook secret: random, stored as `webhook_secret_enc`, injected as
  `TELEGRAM_WEBHOOK_SECRET`.
- Per-bot data token `BOT_DATA_JWT`: HS256, signed with `SUPABASE_JWT_SECRET`,
  `role=authenticated`, claim `bot_id`, 1-year expiry. It is minted at deploy
  time and never stored. RLS on `bot_products`, `bot_customers` and
  `bot_orders` compares `auth.jwt()->>'bot_id'` with each row.
- Events, run errors, audit rows and API responses all go through
  `redactSecrets` (`lib/redact.ts`). Prompts only ever contain the spec.

## Platform env (server only; never sent to the browser)

| Var | Purpose |
|---|---|
| `TELEGRAM_MANAGER_BOT_TOKEN` | manager bot with Bot Management Mode enabled in the BotFather Mini App |
| `TELEGRAM_MANAGER_BOT_USERNAME` | used in the `t.me/newbot/...` link |
| `TELEGRAM_MANAGED_WEBHOOK_SECRET` | `secret_token` of the manager bot webhook |
| `GITHUB_BOTS_TOKEN` (falls back to `GITHUB_ACCESS_TOKEN`) | platform PAT that owns the bot repos |
| `GITHUB_BOTS_ORG` (optional) | create repos in this org instead of the token's user |
| `VERCEL_TOKEN`, `VERCEL_TEAM_ID` | our Vercel team |
| `SUPABASE_JWT_SECRET` | legacy JWT secret of the shared project (mints `BOT_DATA_JWT`) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | given to generated bots (public values) |
| `CONNECTOR_ENCRYPTION_KEY` | AES key (already required) |
| `PUBLIC_APP_URL` | base URL for the manager webhook route |

One-time admin setup: `POST /api/admin/builder/manager-webhook` (admin only)
points the manager bot webhook at `/api/telegram/managed-webhook` with
`allowed_updates: ["managed_bot","message"]`.

## External endpoints used (and where they were verified)

The sandbox could not resolve core.telegram.org, vercel.com or docs.github.com
(DNS failure), so each endpoint below was checked against the vendor's own
published source on GitHub instead.

### Telegram Bot API (Managed Bots, Bot API 9.6)
Sources: python-telegram-bot `src/telegram/_managedbot.py`, `_botaccesssettings.py` and `_bot.py`; NousResearch/hermes-agent#10591. The task brief gave the link format and the flow.

| Call | Shape used |
|---|---|
| link | `https://t.me/newbot/{manager_username}/{new_username}?name={name}` |
| update | `Update.managed_bot`: `ManagedBotUpdated { user: User (creator), bot: User (the managed bot) }` |
| `getManagedBotToken` | `{ user_id: <managed bot id> }` → token string |
| `replaceManagedBotToken` | `{ user_id }` → new token (not used yet; rotation is handled when an update arrives) |
| `getManagedBotAccessSettings` | `{ user_id }` → `BotAccessSettings { is_access_restricted, added_users? }` |
| `setManagedBotAccessSettings` | `{ user_id, is_access_restricted, added_user_ids? }` → `true` |
| `setWebhook` | `{ url, secret_token, allowed_updates, drop_pending_updates }`; header `X-Telegram-Bot-Api-Secret-Token` |
| `getWebhookInfo` | `→ { url, last_error_message?, last_error_date? }` |
| `setChatMenuButton` | `{ menu_button: { type: "web_app", text, web_app: { url } } }` |
| `sendMessage` | `{ chat_id, text, parse_mode }` |

### Vercel REST API
Source: official `vercel/sdk` docs (`docs/sdks/projects/README.md`, `docs/sdks/deployments/README.md`, `docs/models/inlinedfile.md`).

| Call | Endpoint |
|---|---|
| create project | `POST /v11/projects?teamId=…` body `{ name, framework: null }` |
| get project | `GET /v9/projects/{idOrName}?teamId=…` |
| env vars | `POST /v10/projects/{idOrName}/env?upsert=true&teamId=…` body `{ key, value, type: "encrypted"\|"plain", target: ["production","preview"] }` |
| deploy | `POST /v13/deployments?skipAutoDetectionConfirmation=1&teamId=…` body `{ name, project, target: "production", files: [{ file, data }], projectSettings: { framework: null } }` |
| status | `GET /v13/deployments/{idOrUrl}` → `readyState` ∈ QUEUED, INITIALIZING, BUILDING, READY, ERROR, CANCELED; `alias[]` |

The webhook uses the production alias (`alias[0]`), not the per-deployment
URL, because Vercel's standard deployment protection covers deployment URLs.
Assumption: the team keeps default protection settings. If production
domains are protected too, the smoke test fails with a 401 and says so.

### GitHub REST API (via @octokit/rest, already a dependency)
Source: route table in `@octokit/plugin-rest-endpoint-methods` (installed version).

| Call | Endpoint |
|---|---|
| create repo (org) | `POST /orgs/{org}/repos` `{ name, private: true, auto_init: true }` |
| create repo (user) | `POST /user/repos` `{ name, private: true, auto_init: true }` |
| get repo | `GET /repos/{owner}/{repo}` |
| head ref | `GET /repos/{owner}/{repo}/git/ref/heads/{branch}` |
| commit | `GET /repos/{owner}/{repo}/git/commits/{sha}` |
| tree | `POST /repos/{owner}/{repo}/git/trees` (inline `content` entries) |
| new commit | `POST /repos/{owner}/{repo}/git/commits` `{ message, tree, parents }` |
| move branch | `PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}` `{ sha }` |

`auto_init: true` gives the repo a first commit, because the git data API rejects writes to an empty repository.

### Supabase
Sources: `supabase/supabase` docs `guides/database/postgres/row-level-security.mdx` and `guides/auth/signing-keys.mdx`.

- RLS policies target `authenticated` and read claims via `auth.jwt()`.
- A self-minted JWT needs `role` (an existing Postgres role) and a future `exp`. The legacy HS256 secret stays trusted until it is revoked. If the project moves fully to asymmetric keys, import a shared secret as a signing key and set it as `SUPABASE_JWT_SECRET`.
- Generated bots call PostgREST with `fetch`: `{SUPABASE_URL}/rest/v1/<table>`, headers `apikey: <anon>` and `Authorization: Bearer <BOT_DATA_JWT>`.

## Ownership

The Telegram bot belongs to the user from creation (Managed Bots). The bot's
admin chat (`ADMIN_CHAT_ID`) is the creator's Telegram id. The repo and Vercel
project are ours and maintained by the platform agent. "Export to my GitHub"
is deliberately out of scope for now.

## API routes

All `/api/builder/*` routes are Bearer-authenticated (`getAuthenticatedUser`)
and gated by `canUseBotBuilder`. They find a project by **id AND user_id**
(`lib/builder/access.ts`) and return browser-safe views only
(`toPublicProject`: no tokens, secrets, encrypted columns or approvals).

| Route | Purpose |
|---|---|
| `GET /api/builder/projects` | list (status, @username, orders today) |
| `POST /api/builder/projects` | save spec; per-plan bot limit (`BOT_LIMITS`: free 1, pro 5, premium 20, admins unlimited) |
| `GET /api/builder/projects/:id` | one project; re-kicks a stale run |
| `POST …/start` | create/resume the run; quota check before the AI fill |
| `GET …/events` | SSE (`progress`, `state`), read with fetch + reader |
| `POST …/repair` | resume the failed step with a fresh retry budget |
| `PUT …/config` | validated owner edit → rebuild + redeploy |
| `GET …/data` | orders, counts, build log; `?format=csv` export |
| `POST …/agent` | owner asks the platform agent (quota + usage logged) |
| `GET /api/builder/limits` | bots used / plan limit |
| `POST /api/telegram/managed-webhook` | manager-bot webhook (secret_token header) |
| `POST /api/admin/builder/manager-webhook` | admin: set the manager webhook |
| `POST/DELETE /api/admin/builder/approve` | admin: grant/revoke destructive approvals (≤ 60 min) |
| `POST /api/admin/builder/agent` | admin ("dev superadmin") runs the agent on one project |
| `GET /api/admin/builder/audit` | admin: agent_audit_log |

## Platform agent (lib/builder/agent.ts)

`runToolAgent` (lib/agent/run.ts) runs the Agent SDK with **no built-in tools**
in an empty scratch dir. The agent's whole surface is these project-bound MCP tools:

| Tool | Kind |
|---|---|
| `get_project_status`, `get_bot_config`, `get_build_log` | read |
| `update_bot_config` | validated config → rebuild + redeploy |
| `rerun_step` | resume or re-run from provision_repo … smoke_test |
| `change_env` | **destructive**: admin approval; reserved keys (token, secret, data JWT, Supabase, BOT_ID, ADMIN_CHAT_ID) refused |
| `delete_project` | **destructive**: admin approval; removes webhook, hides project |

"Force redeploy of all bots" is not exposed to the per-project agent at all.
Approvals live on `builder_projects.approved_actions` / `approved_until`. Only
ADMIN_EMAILS can set them, and each one is consumed when used. Every tool call
(allowed or denied), plus agent start and finish, is written to
`agent_audit_log` through `redactSecrets`. The agent's context holds exactly one
project's name, template, status and config, with no secrets. Instructions that
look like tokens or keys are refused at the route.

## Tests

`npm run test:builder` (scripts/test-builder.mjs) compiles the real pipeline,
managed-bot handler, template assembly, crypto, redaction, approval gate and
bot-limit code, then runs them end to end against in-memory mocks of
Telegram, GitHub, Vercel and Supabase. It covers waiting for the bot, the
managed_bot webhook (creator check, encrypted token), all 9 steps, auto-retry,
failure → repair, idempotent reruns, config-edit redeploy, token rotation,
the run lease, and a scan proving no secret appears in events, run errors,
audit rows or project rows, even when an upstream error echoes the token.
