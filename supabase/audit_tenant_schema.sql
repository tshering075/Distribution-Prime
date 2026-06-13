-- ============================================================
-- BEVFLOW — Supabase tenant schema audit
-- Run in Supabase Dashboard → SQL Editor → New query → Run
-- Copy ALL result tabs/output and share for review.
-- ============================================================

-- 1) All public tables
SELECT '1_tables' AS section, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2) Expected tenant tables — present or MISSING
SELECT
  '2_expected_tables' AS section,
  t.expected_table,
  CASE WHEN it.table_name IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('organizations'),
    ('organization_members'),
    ('organization_invites'),
    ('distributors'),
    ('admins'),
    ('orders'),
    ('sales_data'),
    ('targets'),
    ('schemes'),
    ('app_config'),
    ('distributor_physical_stock_snapshots'),
    ('distributor_pos_sales'),
    ('platform_admins'),
    ('distributor_sessions')
) AS t(expected_table)
LEFT JOIN information_schema.tables it
  ON it.table_schema = 'public'
 AND it.table_name = t.expected_table
 AND it.table_type = 'BASE TABLE'
ORDER BY t.expected_table;

-- 3) organization_id column on tenant tables
SELECT
  '3_organization_id' AS section,
  t.table_name,
  CASE WHEN c.column_name IS NOT NULL THEN c.data_type ELSE 'MISSING COLUMN' END AS organization_id_type
FROM (
  VALUES
    ('distributors'),
    ('admins'),
    ('orders'),
    ('sales_data'),
    ('targets'),
    ('schemes'),
    ('app_config'),
    ('distributor_physical_stock_snapshots')
) AS t(table_name)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = t.table_name
 AND c.column_name = 'organization_id'
ORDER BY t.table_name;

-- 4) distributor login / tax columns
SELECT
  '4_distributor_cols' AS section,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'distributors'
  AND column_name IN ('credentials', 'phone', 'gstin', 'tpn', 'physical_stock', 'pos_settings')
ORDER BY column_name;

-- 5) RLS enabled?
SELECT
  '5_rls_enabled' AS section,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'organizations', 'organization_members', 'organization_invites',
    'distributors', 'admins', 'orders', 'sales_data', 'targets',
    'schemes', 'app_config', 'distributor_physical_stock_snapshots', 'platform_admins'
  )
ORDER BY c.relname;

-- 6) Required RPC functions
SELECT
  '6_rpc_functions' AS section,
  f.expected_fn,
  CASE WHEN p.proname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('is_platform_admin'),
    ('is_org_member'),
    ('is_org_admin'),
    ('get_organization_by_slug'),
    ('get_organization_by_id'),
    ('lookup_distributor_for_login'),
    ('authenticate_distributor'),
    ('create_workspace_for_signup'),
    ('delete_workspace_signup_rollback'),
    ('get_distributor_orders'),
    ('get_workspace_product_rates'),
    ('save_workspace_product_rates'),
    ('get_invite_by_token'),
    ('platform_list_organizations'),
    ('platform_delete_organization'),
    ('platform_list_admins'),
    ('platform_register_admin'),
    ('platform_link_auth_user_as_platform_admin'),
    ('platform_remove_admin'),
    ('update_distributor_physical_stock'),
    ('upsert_distributor_physical_stock_snapshot'),
    ('insert_distributor_pos_sale'),
    ('update_distributor_pos_settings')
) AS f(expected_fn)
LEFT JOIN pg_proc p ON p.proname = f.expected_fn
LEFT JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
GROUP BY f.expected_fn, p.proname
ORDER BY f.expected_fn;

-- 7) Per-org unique indexes (multi-tenant safety)
SELECT
  '7_org_unique_indexes' AS section,
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE '%org%'
    OR indexdef LIKE '%organization_id%'
  )
ORDER BY tablename, indexname;

-- 8) Rows missing organization_id (should be 0 for production)
SELECT '8_null_org_id_counts' AS section, 'distributors' AS table_name, COUNT(*) AS rows_missing_org
FROM distributors WHERE organization_id IS NULL
UNION ALL
SELECT '8_null_org_id_counts', 'admins', COUNT(*) FROM admins WHERE organization_id IS NULL
UNION ALL
SELECT '8_null_org_id_counts', 'orders', COUNT(*) FROM orders WHERE organization_id IS NULL
UNION ALL
SELECT '8_null_org_id_counts', 'sales_data', COUNT(*) FROM sales_data WHERE organization_id IS NULL
UNION ALL
SELECT '8_null_org_id_counts', 'targets', COUNT(*) FROM targets WHERE organization_id IS NULL
UNION ALL
SELECT '8_null_org_id_counts', 'schemes', COUNT(*) FROM schemes WHERE organization_id IS NULL
UNION ALL
SELECT '8_null_org_id_counts', 'app_config', COUNT(*) FROM app_config WHERE organization_id IS NULL;

-- 9) Organization summary
SELECT
  '9_org_summary' AS section,
  o.id,
  o.slug,
  o.name,
  o.status,
  (SELECT COUNT(*) FROM distributors d WHERE d.organization_id::text = o.id::text) AS distributors,
  (SELECT COUNT(*) FROM admins a WHERE a.organization_id::text = o.id::text) AS admins,
  (SELECT COUNT(*) FROM orders ord WHERE ord.organization_id::text = o.id::text) AS orders
FROM organizations o
ORDER BY o.created_at NULLS LAST;

SELECT 'Audit complete — share all result sets above for review.' AS done;
