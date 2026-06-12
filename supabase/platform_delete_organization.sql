-- ============================================================
-- PLATFORM: permanently delete a workspace (organization)
-- Run in Supabase SQL Editor (requires platform_admin.sql).
-- ============================================================

CREATE OR REPLACE FUNCTION public.platform_delete_organization(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform access required' USING ERRCODE = '42501';
  END IF;

  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required' USING ERRCODE = '22023';
  END IF;

  IF p_org_id = '00000000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'The default legacy workspace cannot be deleted' USING ERRCODE = '22023';
  END IF;

  SELECT o.slug INTO v_slug FROM organizations o WHERE o.id = p_org_id;
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'Organization not found' USING ERRCODE = 'P0002';
  END IF;

  -- Tenant data (explicit deletes — safe even without ON DELETE CASCADE)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'distributor_physical_stock_snapshots'
  ) THEN
    DELETE FROM distributor_physical_stock_snapshots WHERE organization_id = p_org_id;
  END IF;

  DELETE FROM sales_data WHERE organization_id = p_org_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'distributor_pos_sales'
  ) THEN
    DELETE FROM distributor_pos_sales WHERE organization_id = p_org_id;
  END IF;
  DELETE FROM orders WHERE organization_id = p_org_id;
  DELETE FROM targets WHERE organization_id = p_org_id;
  DELETE FROM schemes WHERE organization_id = p_org_id;
  DELETE FROM distributors WHERE organization_id = p_org_id;
  DELETE FROM admins WHERE organization_id = p_org_id;
  DELETE FROM app_config WHERE organization_id = p_org_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_invites'
  ) THEN
    DELETE FROM organization_invites WHERE organization_id = p_org_id;
  END IF;

  DELETE FROM organization_members WHERE organization_id = p_org_id;
  DELETE FROM organizations WHERE id = p_org_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_delete_organization(UUID) TO authenticated;

SELECT 'platform_delete_organization RPC ready.' AS status;
