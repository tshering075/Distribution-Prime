-- ============================================================
-- FIX: Distributor login from the app (anonymous / not signed in)
-- The login page reads `distributors` BEFORE Supabase Auth runs.
-- If RLS only allows `authenticated`, every distributor login fails with
-- "No distributor found with this code".
-- ============================================================

-- Option A (simplest): disable RLS on distributors (matches COMPLETE_SUPABASE_SCHEMA.sql)
ALTER TABLE distributors DISABLE ROW LEVEL SECURITY;

-- Option B (keep RLS on): allow read for login lookup
-- ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "Allow anon read distributors for login" ON distributors;
-- CREATE POLICY "Allow anon read distributors for login"
--   ON distributors
--   FOR SELECT
--   TO anon, authenticated
--   USING (true);
--
-- -- Writes stay admin-only (adjust if you use service role from admin dashboard only)
-- DROP POLICY IF EXISTS "Allow authenticated users to insert distributors" ON distributors;
-- DROP POLICY IF EXISTS "Allow authenticated users to update distributors" ON distributors;
-- DROP POLICY IF EXISTS "Allow authenticated users to delete distributors" ON distributors;

-- Verify
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'distributors';
