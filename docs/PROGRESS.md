# PROGRESS

## Done (Phase A+B+C, 2026-10-10)

Phase A — real models + picker
- `public/icon/chrome.jpg` renamed from `images (12).jfif`.
- `config/models.json` v2: 11 models (free/pro/premium + gemini hidden until
  upstream set), `purpose` is an array, new `provider` + `icon` fields.
- `ModelIcon.tsx`: /icon/ image with colored-initials fallback.
- `POST /api/models/test` (admin only): "reply OK", max_tokens 16,
  `{ok, latencyMs, error}`, never returns keys.
- Chat header picker: bottom sheet grouped by provider, tier badges, plan
  locks, Code/Research toggle, effort when `effortSupport`, last choice in
  localStorage, model icon + tokens under answers, KH/EN 429 banner.
- Titles: chat "Coding Agent", app "CodingStudio".

Phase B — plans, quotas, real dashboard
- Migration `20261010000000_plans.sql` (NEW file only, never run): plans,
  user_plans, waitlist, payment_submissions; RLS on; seed Free 5/day,
  Pro 100/day, Premium 500/day.
- `lib/entitlements.ts`: `checkEntitlement` (tier/quota/expiry server-side,
  ADMIN_EMAILS unlimited), pure `evaluateEntitlement`.
- Chat route gates before the model call, logs usage after, 429 KH/EN.
- `GET /api/usage` (today + 7 days, counts only).
- Real Dashboard tab (plan + usage bar, status dots, recent repos/activity,
  quick actions). Demo connect form removed; `/dashboard-preview` admin-only.
- `scripts/test-quota.mjs`: 7/7 pass (`npm run test:quota`).

Phase C — subscription + admin
- Subscription screen (3 steps: plans -> method -> pay), KH/EN,
  `co-` tokens in `public/checkout-theme.css`, icons in `public/assets/pay/`,
  Premium = Coming soon + waitlist when FEATURE_PAYMENTS=false.
- `POST /api/payments/submit`: server validates plan+amount, rate limit,
  private receipt upload. New `method` column added to the plans migration.
- `/admin` (ADMIN_EMAILS only): pending + receipt preview, Approve/Reject
  (sets user_plans.expires_at +30d), plan/expiry edit, per-model usage,
  ban toggle; every action logged to activities.
- Client never trusted for plan/price/status.

Verify: `npm run typecheck` ✅ · `npm run build` ✅ · `npm run test:quota` 7/7 ✅

## Done (Phase D, 2026-10-10)

- Removed `netlify.toml` + `@netlify/plugin-nextjs` (VPS-only; serverless
  can't keep workspaces).
- `npm start` → `next start -p 3000 -H 127.0.0.1`; new `ecosystem.config.js`
  (PM2 fork, 1G restart) + `Caddyfile` (studio.YOUR_DOMAIN → 127.0.0.1:3000).
- `next.config.js` security headers: CSP (self + fonts.googleapis.com,
  fonts.gstatic.com, telegram.org, oauth.telegram.org; Supabase origin in
  connect-src), nosniff, SAMEORIGIN, strict referrer, no camera/mic/geo, HSTS.
- `local_path` never reaches the browser: list + sync routes return
  `toPublicWorkspace()`; server re-derives the path per request.
- NEW migration `20261010010000_drop_allow_all_policies.sql` (never run):
  drops any `USING (true)` policy on any app table + revokes anon everywhere
  and client writes on service-only tables. Rerunnable.
- README rewritten (CodingStudio, VPS quick start, feature/setup/security
  summary). New docs: ARCHITECTURE.md, ROADMAP.md, DEPLOY-VPS.md
  (env NAMES, migration order 1–8, BotFather /setdomain).

Verify: typecheck ✅ · build ✅

## Next
- Apply migrations in Supabase dashboard (SQL editor), set env vars
  (see Settings tab env list), create `receipts` bucket (private; auto-created
  on first submit as fallback).
- Set PAYMENTS_KHQR_IMAGE_URL + FEATURE_PAYMENTS=true when ready.

## Env var NAMES (no values stored here)
GITHUB_ACCESS_TOKEN, GITHUB_ALLOWED_REPOS, AI_GATEWAY_API_KEY,
AI_GATEWAY_BASE_URL, AI_GATEWAY_OPENAI_BASE_URL, ANTHROPIC_API_KEY,
GOOGLE_AI_BASE_URL, GOOGLE_AI_API_KEY, OPENROUTER_BASE_URL,
OPENROUTER_API_KEY, BEDROCK_BASE_URL, BEDROCK_API_KEY, AI_MAX_TOKENS,
ANTHROPIC_MAX_TOKENS, ADMIN_EMAILS, ALLOWED_USER_EMAILS,
FEATURE_PAYMENTS, PAYMENTS_KHQR_IMAGE_URL, TELEGRAM_BOT_TOKEN,
TELEGRAM_ALLOWED_USER_IDS, VERCEL_TOKEN, VERCEL_PROJECT_NAME,
VERCEL_TEAM_ID, RAILWAY_TOKEN, GIT_COMMIT_NAME, GIT_COMMIT_EMAIL,
WORKSPACE_ROOT, NODE_ENV, NEXT_PUBLIC_SUPABASE_URL,
NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

## How to test
- `npm run typecheck && npm run build`
- `npm run test:quota` (mocked gate: free 429 at limit, tier locks, admin bypass)
- Manual: plans tab → KHQR pay → /admin approve → chat works on new tier.
