/*
# Drop any remaining allow-all anon policies (safety net)

The multi-tenant migration already replaced the original anon policies with
owner-scoped ones, but this migration guarantees no `USING (true)` /
`WITH CHECK (true)` policy survives on any app table — even if an older
migration file is re-applied or a table was added later without hardening.

It also revokes direct client writes on tables that must only be written
through the service-role key in API routes:

- usage_events, telegram_connections, plans, user_plans,
  payment_submissions, waitlist (read-own or read-catalog only)

Owner-scoped authenticated write policies on user-content tables
(github_connections, workspaces, activities, chat_messages, claude_sessions,
deployments) are intentionally kept.

How it works: PostgreSQL has no "drop policy by predicate", so this
enumerates pg_policy rows whose qual or with_check is the constant TRUE and
drops each one, then applies the revokes.
*/

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, p.polname AS policy_name
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (pg_get_expr(p.polqual, p.polrelid) = 'true'
        OR pg_get_expr(p.polwithcheck, p.polrelid) = 'true')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policy_name, r.schema_name, r.table_name);
    RAISE NOTICE 'dropped allow-all policy % on %.%', r.policy_name, r.schema_name, r.table_name;
  END LOOP;
END $$;

-- Defence in depth: anon gets nothing on any app table, client roles get no
-- writes on service-role-only tables. IF EXISTS-style guards via DO blocks so
-- this file runs cleanly whether or not earlier migrations applied.
DO $$
DECLARE
  t TEXT;
  service_only TEXT[] := ARRAY[
    'usage_events', 'telegram_connections', 'plans',
    'user_plans', 'payment_submissions', 'waitlist'
  ];
  all_app TEXT[] := ARRAY[
    'github_connections', 'workspaces', 'activities', 'chat_messages',
    'claude_sessions', 'deployments', 'usage_events', 'telegram_connections',
    'plans', 'user_plans', 'payment_submissions', 'waitlist'
  ];
BEGIN
  FOREACH t IN ARRAY all_app LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY service_only LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;
