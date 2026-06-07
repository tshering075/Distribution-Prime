-- ============================================================
-- RLS policy consolidation — run AFTER fix_rls_linter_cleanup.sql
-- Merges overlapping permissive policies (platform + tenant + signup)
-- into one policy per action to clear Supabase linter warnings.
-- ============================================================

CREATE OR REPLACE FUNCTION public._tenant_consolidate_rls(p_table REGCLASS)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  t TEXT := p_table::TEXT;
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);

  EXECUTE format('DROP POLICY IF EXISTS platform_all ON %s', p_table);
  EXECUTE format('DROP POLICY IF EXISTS platform_select ON %s', p_table);
  EXECUTE format('DROP POLICY IF EXISTS tenant_select ON %s', p_table);
  EXECUTE format(
    'CREATE POLICY tenant_select ON %s FOR SELECT TO authenticated USING (
      public.is_org_member(organization_id::text) OR public.is_platform_admin()
    )',
    p_table
  );

  EXECUTE format('DROP POLICY IF EXISTS tenant_insert ON %s', p_table);
  EXECUTE format(
    'CREATE POLICY tenant_insert ON %s FOR INSERT TO authenticated WITH CHECK (
      public.is_org_member(organization_id::text) OR public.is_platform_admin()
    )',
    p_table
  );

  EXECUTE format('DROP POLICY IF EXISTS tenant_update ON %s', p_table);
  EXECUTE format(
    'CREATE POLICY tenant_update ON %s FOR UPDATE TO authenticated
      USING (public.is_org_member(organization_id::text) OR public.is_platform_admin())
      WITH CHECK (public.is_org_member(organization_id::text) OR public.is_platform_admin())',
    p_table
  );

  EXECUTE format('DROP POLICY IF EXISTS tenant_delete ON %s', p_table);
  EXECUTE format(
    'CREATE POLICY tenant_delete ON %s FOR DELETE TO authenticated USING (
      public.is_org_admin(organization_id::text) OR public.is_platform_admin()
    )',
    p_table
  );
END;
$$;

-- Standard tenant tables
SELECT public._tenant_consolidate_rls('public.distributors'::REGCLASS);
SELECT public._tenant_consolidate_rls('public.orders'::REGCLASS);
SELECT public._tenant_consolidate_rls('public.targets'::REGCLASS);
SELECT public._tenant_consolidate_rls('public.schemes'::REGCLASS);
SELECT public._tenant_consolidate_rls('public.sales_data'::REGCLASS);
SELECT public._tenant_consolidate_rls('public.app_config'::REGCLASS);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'distributor_physical_stock_snapshots'
  ) THEN
    PERFORM public._tenant_consolidate_rls('public.distributor_physical_stock_snapshots'::REGCLASS);
  END IF;
END $$;

-- admins — merge signup/bootstrap into tenant policies
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_all ON public.admins;
DROP POLICY IF EXISTS platform_select ON public.admins;
DROP POLICY IF EXISTS admins_select_own ON public.admins;
DROP POLICY IF EXISTS admins_insert_signup ON public.admins;
DROP POLICY IF EXISTS tenant_select ON public.admins;
CREATE POLICY tenant_select ON public.admins
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id::text)
    OR public.is_platform_admin()
    OR uid::text = public.auth_user_id_text()
    OR id::text = public.auth_user_id_text()
  );

DROP POLICY IF EXISTS tenant_insert ON public.admins;
CREATE POLICY tenant_insert ON public.admins
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id::text)
    OR public.is_platform_admin()
    OR uid::text = public.auth_user_id_text()
    OR id::text = public.auth_user_id_text()
  );

DROP POLICY IF EXISTS tenant_update ON public.admins;
CREATE POLICY tenant_update ON public.admins
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id::text) OR public.is_platform_admin())
  WITH CHECK (public.is_org_member(organization_id::text) OR public.is_platform_admin());

DROP POLICY IF EXISTS tenant_delete ON public.admins;
CREATE POLICY tenant_delete ON public.admins
  FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id::text) OR public.is_platform_admin());

-- organization_members — drop redundant platform + duplicate select policies
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_platform ON organization_members;
DROP POLICY IF EXISTS organization_members_select ON organization_members;

-- organizations — orgs_platform overlaps member/signup policies; delete uses RPC
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orgs_platform ON organizations;

DROP POLICY IF EXISTS orgs_delete_platform ON organizations;
CREATE POLICY orgs_delete_platform ON organizations
  FOR DELETE TO authenticated
  USING (public.is_platform_admin());

-- organization_invites — split FOR ALL write policy into per-action policies
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_invites_write ON organization_invites;
DROP POLICY IF EXISTS organization_invites_update_invitee ON organization_invites;

DROP POLICY IF EXISTS org_invites_select ON organization_invites;
CREATE POLICY org_invites_select ON organization_invites
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id::text) OR public.is_platform_admin());

DROP POLICY IF EXISTS org_invites_insert ON organization_invites;
CREATE POLICY org_invites_insert ON organization_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id::text) OR public.is_platform_admin());

DROP POLICY IF EXISTS org_invites_update ON organization_invites;
CREATE POLICY org_invites_update ON organization_invites
  FOR UPDATE TO authenticated
  USING (
    public.is_org_admin(organization_id::text)
    OR public.is_platform_admin()
    OR lower(trim(email)) = lower(trim(COALESCE((SELECT auth.jwt()) ->> 'email', '')))
  )
  WITH CHECK (
    public.is_org_admin(organization_id::text)
    OR public.is_platform_admin()
    OR lower(trim(email)) = lower(trim(COALESCE((SELECT auth.jwt()) ->> 'email', '')))
  );

DROP POLICY IF EXISTS org_invites_delete ON organization_invites;
CREATE POLICY org_invites_delete ON organization_invites
  FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id::text) OR public.is_platform_admin());

DROP FUNCTION IF EXISTS public._tenant_consolidate_rls(REGCLASS);

SELECT 'RLS policies consolidated. Re-check Database → Linter.' AS status;
