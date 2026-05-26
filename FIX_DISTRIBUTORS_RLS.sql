-- ============================================================
-- FIX DISTRIBUTORS TABLE: Disable RLS or Create Policy
-- Run this if distributors are not loading from Supabase
-- ============================================================

-- Option 1: Disable RLS (Easier for development/testing)
-- Uncomment the line below if you want to disable RLS:
-- ALTER TABLE distributors DISABLE ROW LEVEL SECURITY;

-- Option 2: Create a policy to allow access (Recommended for production)
-- First, enable RLS
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;

-- Then create a policy that allows authenticated users to read/write
-- Adjust this policy based on your security requirements

-- Policy to allow authenticated users to read distributors
DROP POLICY IF EXISTS "Allow authenticated users to read distributors" ON distributors;
CREATE POLICY "Allow authenticated users to read distributors"
  ON distributors
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy to allow authenticated users to insert distributors
DROP POLICY IF EXISTS "Allow authenticated users to insert distributors" ON distributors;
CREATE POLICY "Allow authenticated users to insert distributors"
  ON distributors
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy to allow authenticated users to update distributors
DROP POLICY IF EXISTS "Allow authenticated users to update distributors" ON distributors;
CREATE POLICY "Allow authenticated users to update distributors"
  ON distributors
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy to allow authenticated users to delete distributors
DROP POLICY IF EXISTS "Allow authenticated users to delete distributors" ON distributors;
CREATE POLICY "Allow authenticated users to delete distributors"
  ON distributors
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Verify RLS status
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'distributors';

-- Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'distributors';
