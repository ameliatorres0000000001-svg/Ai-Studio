# Deploy to a VPS (PM2 + Caddy)

One Ubuntu host, one persistent disk. The server clones repos under
`WORKSPACE_ROOT`, so keep that directory on durable storage.

## 1. Provision

```bash
# Ubuntu 22.04+, Node 20, plus:
sudo apt install caddy postgresql-client  # caddy from cloudsmith repo
npm i -g pm2
```

DNS: point `studio.YOUR_DOMAIN` (A record) at the VPS.

## 2. App

```bash
git clone <repo> /opt/codingstudio && cd /opt/codingstudio
npm ci
cp .env.example .env.local   # fill in — NAMES below, values never committed
npm run typecheck && npm run build
pm2 start ecosystem.config.js && pm2 save && pm2 startup
```

`ecosystem.config.js` binds `127.0.0.1:3000` (fork, 1 instance, 1G restart).
`npm start` does the same bind for manual runs.

## 3. Caddy

```bash
# Caddyfile: replace studio.YOUR_DOMAIN with the real domain
sudo cp Caddyfile /etc/caddy/Caddyfile && sudo caddy reload
```

TLS is automatic. Caddy proxies to `127.0.0.1:3000`.

## 4. Env vars (NAMES only — set real values in `.env.local`)

```
GITHUB_ACCESS_TOKEN, GITHUB_ALLOWED_REPOS,
AI_GATEWAY_API_KEY, AI_GATEWAY_BASE_URL, AI_GATEWAY_OPENAI_BASE_URL,
ANTHROPIC_API_KEY, GOOGLE_AI_BASE_URL, GOOGLE_AI_API_KEY,
OPENROUTER_BASE_URL, OPENROUTER_API_KEY,
BEDROCK_BASE_URL, BEDROCK_API_KEY, AI_MAX_TOKENS, ANTHROPIC_MAX_TOKENS,
ADMIN_EMAILS, ALLOWED_USER_EMAILS,
FEATURE_PAYMENTS, PAYMENTS_KHQR_IMAGE_URL,
TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_IDS,
VERCEL_TOKEN, VERCEL_PROJECT_NAME, VERCEL_TEAM_ID, RAILWAY_TOKEN,
GIT_COMMIT_NAME, GIT_COMMIT_EMAIL,
WORKSPACE_ROOT, NODE_ENV,
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
```

`ADMIN_EMAILS` (comma-separated) gates `/admin` and the model-test route and
bypasses quotas — set it first. `ALLOWED_USER_EMAILS` gates sign-in
(production: empty denies everyone).

## 5. Migrations (in order, Supabase SQL editor)

1. `20261006160421_create_ai_studio_schema.sql`
2. `20261006165614_upgrade_to_multi_tenant_with_auth.sql`
3. `20261007090000_harden_constraints.sql`
4. `20261007100000_deployments_external_id.sql`
5. `20261007110000_telegram_connector.sql`
6. `20261009090000_usage_events.sql`
7. `20261010000000_plans.sql` (seeds Free/Pro/Premium, adds `method` column)
8. `20261010010000_drop_allow_all_policies.sql` (safety net, rerunnable)

The private `receipts` bucket is auto-created on first payment submit; create
it manually beforehand if you prefer.

## 6. Telegram login — BotFather `/setdomain`

Talk to **@BotFather** → `/setdomain` → pick the bot → send exactly:

```
studio.YOUR_DOMAIN
```

(no scheme, no path). This authorises the Login Widget on the auth screen.
The bot token stays in `TELEGRAM_BOT_TOKEN` (server-only).

## 7. Operate

```bash
pm2 logs codingstudio     # app logs
pm2 restart codingstudio  # after git pull + rebuild
caddy reload              # after Caddyfile changes
```

Back up `WORKSPACE_ROOT` and the Supabase project on a schedule. Never run
as root; firewall everything except 80/443 (and SSH).
