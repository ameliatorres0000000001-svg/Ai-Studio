# បញ្ជីត្រួតពិនិត្យ Setup (CodingStudio)

ធ្វើតាមលំដាប់ ១ → ៥។ ឈ្មោះខាងក្រោមជា env NAMES ប៉ុណ្ណោះ — តម្លៃពិតដាក់ក្នុង `.env.local` ហើយកុំ commit។

## ១. បំពេញ `.env.local`

```bash
cp .env.example .env.local
```

បំពេញតម្លៃតាមក្រុម (ឈ្មោះប៉ុណ្ណោះ)៖

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`
- GitHub: `GITHUB_ACCESS_TOKEN`, `GITHUB_ALLOWED_REPOS`
- Models: `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, `AI_GATEWAY_OPENAI_BASE_URL`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_BASE_URL`, `GOOGLE_AI_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_API_KEY`, `BEDROCK_BASE_URL`, `BEDROCK_API_KEY`, `AI_MAX_TOKENS`, `ANTHROPIC_MAX_TOKENS`
- Access: `ADMIN_EMAILS`, `ALLOWED_USER_EMAILS`
- Payments: `FEATURE_PAYMENTS`, `PAYMENTS_KHQR_IMAGE_URL`
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS`
- Deploy: `VERCEL_TOKEN`, `VERCEL_PROJECT_NAME`, `VERCEL_TEAM_ID`, `RAILWAY_TOKEN`
- Git: `GIT_COMMIT_NAME`, `GIT_COMMIT_EMAIL`
- App: `WORKSPACE_ROOT`, `NODE_ENV`

## ២. Apply migrations តាមលំដាប់

ក្នុង Supabase dashboard → SQL editor រត់តាមលេខ ១ → ៨៖

1. `20261006160421_create_ai_studio_schema.sql`
2. `20261006165614_upgrade_to_multi_tenant_with_auth.sql`
3. `20261007090000_harden_constraints.sql`
4. `20261007100000_deployments_external_id.sql`
5. `20261007110000_telegram_connector.sql`
6. `20261009090000_usage_events.sql`
7. `20261010000000_plans.sql`
8. `20261010010000_drop_allow_all_policies.sql`

បើ `check` ប្រាប់ថា table ខ្លះ missing — មើល migration file ដែលសរសេរក្បែរវា រួចរត់ file នោះឡើងវិញ។

## ៣. Admin ដំបូង

ដាក់ email របស់អ្នកក្នុង `ADMIN_EMAILS` (អាចមានច្រើន បំបែកដោយក្បៀស) រួច restart app។
Admin នោះចូល `/admin` បាន ហើយ bypass quota។ `ALLOWED_USER_EMAILS` ទទេ = production បដិសេធគ្រប់គ្នា។

## ៤. Telegram — BotFather `/setdomain`

និយាយជាមួយ **@BotFather** → `/setdomain` → ជ្រើស bot → ផ្ញើ domain យ៉ាងពិតប្រាកដ (គ្មាន scheme គ្មាន path)៖

```
studio.YOUR_DOMAIN
```

Token នៅតែក្នុង `TELEGRAM_BOT_TOKEN` លើ server ប៉ុណ្ណោះ។

## ៥. រត់ check

```bash
npm run check:setup
```

ត្រូវ `OK` ទាំងអស់។ បើមាន `FAIL` — ជួសជុលតាម hint (missing env, migration file, token) រួចរត់ឡើងវិញ។
Script នេះ print តែ OK/FAIL មិន print តម្លៃ secret ទេ។
