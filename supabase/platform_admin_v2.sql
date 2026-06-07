-- ============================================================
-- PLATFORM ADMIN v2 — staff listing + delete RPC
-- Run AFTER platform_admin.sql (tenant list RPC lives in platform_admin.sql).
-- ============================================================

DROP FUNCTION IF EXISTS public.platform_list_tenant_staff(UUID);
DROP FUNCTION IF EXISTS public.platform_delete_organization(UUID);

CREATE OR REPLACE FUNCTION public.platform_list_tenant_staff(p_org_id UUID)
RETURNS TABLE (
  staff_type TEXT,
  user_id TEXT,
  email TEXT,
  name TEXT,
  role TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    'admin'::TEXT,
    COALESCE(a.uid, a.id::TEXT),
    a.email,
    a.name,
    a.role,
    a.created_at
  FROM admins a
  WHERE a.organization_id = p_org_id

  UNION ALL

  SELECT
    'member'::TEXT,
    m.user_id,
    COALESCE(a2.email, ''),
    COALESCE(a2.name, 'Member'),
    m.role,
    m.created_at
  FROM organization_members m
  LEFT JOIN admins a2
    ON a2.organization_id = m.organization_id
   AND (a2.uid = m.user_id OR a2.id::TEXT = m.user_id)
  WHERE m.organization_id = p_org_id
    AND NOT EXISTS (
      SELECT 1 FROM admins ax
      WHERE ax.organization_id = p_org_id
        AND (ax.uid = m.user_id OR ax.id::TEXT = m.user_id)
    )

  ORDER BY created_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_tenant_staff(UUID) TO authenticated;

-- Permanent workspace deletion (see also platform_delete_organization.sql)
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

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'distributor_physical_stock_snapshots'
  ) THEN
    DELETE FROM distributor_physical_stock_snapshots WHERE organization_id = p_org_id;
  END IF;

  DELETE FROM sales_data WHERE organization_id = p_org_id;
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

SELECT 'Platform admin v2 applied — staff RPC + delete organization.' AS status;
