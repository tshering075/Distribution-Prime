-- ============================================================
-- PLATFORM ADMIN (SaaS operator console)
-- Run once in Supabase → SQL Editor.
-- Then add yourself:
--   INSERT INTO platform_admins (user_id, email, role)
--   SELECT id, email, 'owner' FROM auth.users WHERE email = 'you@example.com';
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator'
    CHECK (role IN ('owner', 'operator', 'support')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_user ON platform_admins(user_id);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admins_select_self" ON platform_admins;
CREATE POLICY "platform_admins_select_self" ON platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- Helpers (SECURITY DEFINER)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- DROP first when return/OUT signature changed (e.g. after platform_admin_v2).
DROP FUNCTION IF EXISTS public.platform_list_organizations();
DROP FUNCTION IF EXISTS public.platform_update_organization(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.platform_list_organizations()
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  plan TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  distributor_count BIGINT,
  admin_count BIGINT,
  member_count BIGINT,
  orders_count BIGINT,
  sales_count BIGINT,
  targets_count BIGINT,
  schemes_count BIGINT,
  pending_invites_count BIGINT
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
    o.id,
    o.slug,
    o.name,
    o.plan,
    o.status,
    o.created_at,
    o.updated_at,
    (SELECT COUNT(*)::BIGINT FROM distributors d WHERE d.organization_id = o.id),
    (SELECT COUNT(*)::BIGINT FROM admins a WHERE a.organization_id = o.id),
    (SELECT COUNT(*)::BIGINT FROM organization_members m WHERE m.organization_id = o.id),
    (SELECT COUNT(*)::BIGINT FROM orders ord WHERE ord.organization_id = o.id),
    (SELECT COUNT(*)::BIGINT FROM sales_data sd WHERE sd.organization_id = o.id),
    (SELECT COUNT(*)::BIGINT FROM targets t WHERE t.organization_id = o.id),
    (SELECT COUNT(*)::BIGINT FROM schemes s WHERE s.organization_id = o.id),
    (
      SELECT COUNT(*)::BIGINT FROM organization_invites i
      WHERE i.organization_id = o.id
        AND i.status = 'pending'
        AND (i.expires_at IS NULL OR i.expires_at > NOW())
    )
  FROM organizations o
  ORDER BY o.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_organizations() TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_update_organization(
  p_org_id UUID,
  p_status TEXT DEFAULT NULL,
  p_plan TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  plan TEXT,
  status TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_plan TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform access required' USING ERRCODE = '42501';
  END IF;

  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required' USING ERRCODE = '22023';
  END IF;

  IF p_status IS NOT NULL THEN
    v_status := lower(trim(p_status));
    IF v_status NOT IN ('active', 'suspended', 'trial') THEN
      RAISE EXCEPTION 'Invalid status' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_plan IS NOT NULL THEN
    v_plan := lower(trim(p_plan));
    IF v_plan NOT IN ('trial', 'pro', 'enterprise') THEN
      RAISE EXCEPTION 'Invalid plan' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE organizations o
  SET
    status = COALESCE(v_status, o.status),
    plan = COALESCE(v_plan, o.plan),
    name = COALESCE(NULLIF(trim(p_name), ''), o.name),
    updated_at = NOW()
  WHERE o.id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT o.id, o.slug, o.name, o.plan, o.status, o.updated_at
  FROM organizations o
  WHERE o.id = p_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_update_organization(UUID, TEXT, TEXT, TEXT) TO authenticated;

SELECT 'Platform admin schema ready. Insert your auth user into platform_admins.' AS status;
