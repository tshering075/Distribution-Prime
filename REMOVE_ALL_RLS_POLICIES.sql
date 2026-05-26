-- ============================================================
-- REMOVE ALL RLS POLICIES AND DISABLE RLS
-- Run this script to remove all RLS policies and disable RLS on all tables
-- ============================================================

-- Drop all policies from distributors table
DROP POLICY IF EXISTS "Allow authenticated users to read distributors" ON distributors;
DROP POLICY IF EXISTS "Allow authenticated users to insert distributors" ON distributors;
DROP POLICY IF EXISTS "Allow authenticated users to update distributors" ON distributors;
DROP POLICY IF EXISTS "Allow authenticated users to delete distributors" ON distributors;

-- Drop all policies from admins table
DROP POLICY IF EXISTS "Allow authenticated users to read admins" ON admins;
DROP POLICY IF EXISTS "Allow authenticated users to insert admins" ON admins;
DROP POLICY IF EXISTS "Allow authenticated users to update admins" ON admins;
DROP POLICY IF EXISTS "Allow authenticated users to delete admins" ON admins;

-- Drop all policies from orders table
DROP POLICY IF EXISTS "Allow authenticated users to read orders" ON orders;
DROP POLICY IF EXISTS "Allow authenticated users to insert orders" ON orders;
DROP POLICY IF EXISTS "Allow authenticated users to update orders" ON orders;
DROP POLICY IF EXISTS "Allow authenticated users to delete orders" ON orders;

-- Drop all policies from targets table
DROP POLICY IF EXISTS "Allow authenticated users to read targets" ON targets;
DROP POLICY IF EXISTS "Allow authenticated users to insert targets" ON targets;
DROP POLICY IF EXISTS "Allow authenticated users to update targets" ON targets;
DROP POLICY IF EXISTS "Allow authenticated users to delete targets" ON targets;

-- Drop all policies from schemes table
DROP POLICY IF EXISTS "Allow authenticated users to read schemes" ON schemes;
DROP POLICY IF EXISTS "Allow authenticated users to insert schemes" ON schemes;
DROP POLICY IF EXISTS "Allow authenticated users to update schemes" ON schemes;
DROP POLICY IF EXISTS "Allow authenticated users to delete schemes" ON schemes;

-- Drop all policies from sales_data table
DROP POLICY IF EXISTS "Allow authenticated users to read sales_data" ON sales_data;
DROP POLICY IF EXISTS "Allow authenticated users to insert sales_data" ON sales_data;
DROP POLICY IF EXISTS "Allow authenticated users to update sales_data" ON sales_data;
DROP POLICY IF EXISTS "Allow authenticated users to delete sales_data" ON sales_data;

-- Drop all policies from app_config table
DROP POLICY IF EXISTS "Allow authenticated users to manage app config" ON app_config;

-- Disable RLS on all tables
ALTER TABLE distributors DISABLE ROW LEVEL SECURITY;
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE targets DISABLE ROW LEVEL SECURITY;
ALTER TABLE schemes DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_config DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('distributors', 'admins', 'orders', 'targets', 'schemes', 'sales_data', 'app_config')
ORDER BY tablename;
