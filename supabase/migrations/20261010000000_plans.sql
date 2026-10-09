/*
# Plans, quotas, waitlist and payment submissions

New tables only — this migration never touches existing tables.

- `plans` — seeded catalog: Free (5/day, free tier), Pro (100/day, free+pro),
  Premium (500/day, all tiers).
- `user_plans` — one active row per user: which plan, optional expiry.
  An expired row behaves like Free (enforced in lib/entitlements.ts).
- `waitlist` — emails waiting for access (public interest list, no user link).
- `payment_submissions` — manual ABA/bank proof uploads: amount, receipt path,
  status workflow, globally-unique transaction id.

Security
- RLS enabled everywhere. Authenticated users may SELECT only their own rows
  on user_plans and payment_submissions. `plans` is readable by all
  authenticated users (names and limits only — no secrets).
- All writes happen in API routes with the service-role key, so INSERT/UPDATE/
  DELETE are revoked from client roles and no write policies exist.
- anon gets nothing.
*/

CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY,
  label text NOT NULL,
  daily_limit integer NOT NULL CHECK (daily_limit >= 0),
  tiers text[] NOT NULL DEFAULT '{free}',
  price_usd numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email_unique ON waitlist (email);

CREATE TABLE IF NOT EXISTS payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id),
  amount numeric(10, 2) NOT NULL CHECK (amount >= 0),
  method text,
  receipt_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  trx_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_user_created
  ON payment_submissions(user_id, created_at DESC);

INSERT INTO plans (id, label, daily_limit, tiers, price_usd) VALUES
  ('free', 'Free', 5, '{free}', 0),
  ('pro', 'Pro', 100, '{free,pro}', 9),
  ('premium', 'Premium', 500, '{free,pro,premium}', 29)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  daily_limit = EXCLUDED.daily_limit,
  tiers = EXCLUDED.tiers,
  price_usd = EXCLUDED.price_usd;

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_plans" ON plans;
CREATE POLICY "select_plans" ON plans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "select_own_user_plans" ON user_plans;
CREATE POLICY "select_own_user_plans" ON user_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_payment_submissions" ON payment_submissions;
CREATE POLICY "select_own_payment_submissions" ON payment_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON plans FROM anon;
REVOKE ALL ON user_plans FROM anon;
REVOKE ALL ON waitlist FROM anon;
REVOKE ALL ON payment_submissions FROM anon;

REVOKE INSERT, UPDATE, DELETE ON plans FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON user_plans FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON payment_submissions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON waitlist FROM authenticated;
