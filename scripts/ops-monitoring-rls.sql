-- Enable row-level security on the Ops Monitoring `public.skills` table.
--
-- Background (16 Oct 2026 audit): the project's anon key can currently read
-- AND write the table, because RLS is off and the default Postgres grant is
-- wide. A future commit that ships anon-key reads in a public client (this
-- dashboard does not) would leak the table immediately. The fix is one line.
--
-- This script is idempotent: re-running is a no-op.
--
-- How to apply (pick one):
--   1. Supabase dashboard → SQL editor → paste and run.
--   2. psql against the project connection string:
--        psql "$OPS_MONITORING_DATABASE_URL" -f scripts/ops-monitoring-rls.sql
--   3. supabase db execute --project-ref <ref> -f scripts/ops-monitoring-rls.sql
--      (after `supabase link --project-ref <ref>` and an admin login).
--
-- Rollback (only if you really want to undo):
--   ALTER TABLE public.skills DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

-- Default-deny policy: until the application defines a real policy, the
-- table rejects all access (anon and authenticated). The application
-- connects with the service role key, which bypasses RLS and keeps working.
DROP POLICY IF EXISTS "skills_default_deny" ON public.skills;
CREATE POLICY "skills_default_deny" ON public.skills
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Verify
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'skills' AND relnamespace = 'public'::regnamespace;
