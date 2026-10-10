# CodingStudio

AI Developer Workspace — GitHub-first coding with Coding Agent. Bilingual
Khmer/English, plan-gated models, manual KHQR subscriptions, admin console.

## Quick start (local dev)

```bash
npm ci
cp .env.example .env.local   # fill in values, see Settings tab in the app
npm run typecheck && npm run build
npm run dev                  # http://localhost:3000
```

## Production (VPS)

One long-running Node host with a persistent disk — see
[docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md):

```bash
npm ci && npm run build
pm2 start ecosystem.config.js && pm2 save
# Caddy (Caddyfile): studio.YOUR_DOMAIN -> 127.0.0.1:3000, TLS automatic
```

Serverless hosts cannot keep cloned workspaces between requests, so Netlify
support was removed. If workspace files disappear, the API returns
`409 syncRequired` and the repo must be synced again.

## Features

- **GitHub** — browse, clone, sync, branch-aware file tree
- **Coding Agent chat** — Code mode (repo-aware, proposes edits) and Research
  mode (no repo access); model picker with plan locks; effort levels on Opus
- **Models** — gateway-routed (Anthropic + OpenAI formats), icons, admin test
  endpoint (`POST /api/models/test`)
- **Plans & quotas** — Free 5/day, Pro 100/day, Premium 500/day; server-side
  tier + quota gate with KH/EN 429 messages; `GET /api/usage`
- **Subscription** — 3-step KHQR flow (ABA Mobile / other banks), receipt
  upload, Pending review; waitlist when payments are off
- **Admin** (`/admin`, ADMIN_EMAILS only) — pending payments + receipt preview,
  approve/reject (approve sets +30d expiry), plan/expiry edit, per-model usage,
  ban toggle; every action logged
- **Dashboard** — plan + usage bar, live connection dots, recent repos/activity
- **Terminal** — allowlisted commands, no shell, minimal env (not a sandbox:
  run in an isolated VM)
- **Telegram connector** (optional), **Vercel deploy**, **activity log**,
  **Ctrl+K palette**, responsive layout

## Setup

1. Supabase project → apply every file in `supabase/migrations/` **in
   filename order** (SQL editor). Enable Email auth.
2. GitHub fine-grained token (Contents read/write, only wanted repos) →
   `GITHUB_ACCESS_TOKEN`.
3. Gateway key + base URLs (`AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`,
   `AI_GATEWAY_OPENAI_BASE_URL`). Direct keys optional.
4. `ALLOWED_USER_EMAILS` (production: empty denies everyone), `ADMIN_EMAILS`.
5. Payments (optional): `FEATURE_PAYMENTS=true`, `PAYMENTS_KHQR_IMAGE_URL`;
   private `receipts` bucket (auto-created on first submit).
6. Telegram login widget: BotFather → `/setdomain` → your domain.

Env var names: `.env.example` (and the Settings tab). Docs:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
[docs/ROADMAP.md](docs/ROADMAP.md) ·
[docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md) ·
[docs/PROGRESS.md](docs/PROGRESS.md)

## Security model

- Secrets live only in server env; service-role key required, never swapped
  for the anon key; responses never include keys, routes, or `local_path`.
- Every route needs a Supabase session (+ allowlist in production);
  workspaces are looked up by `id` **and** `user_id`.
- Plan/price/status are never trusted from the client; quota + tier enforced
  in `lib/entitlements.ts` before any model call.
- RLS on all tables, anon revoked; a safety-net migration drops any
  `USING (true)` policy.
- Paths confined to the workspace; commands run without a shell.
