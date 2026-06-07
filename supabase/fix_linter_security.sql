-- ============================================================
-- Supabase linter — security hardening (run after consolidate)
-- Fixes: search_path, org signup policy, anon table/RPC exposure
-- ============================================================

-- 1) auth_user_id_text — immutable search_path
CREATE OR REPLACE FUNCTION public.auth_user_id_text()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (SELECT auth.uid())::text;
$$;

-- 2) orgs_insert_signup — not literally WITH CHECK (true)
--    Signup before auth uses create_workspace_for_signup RPC instead.
DROP POLICY IF EXISTS orgs_insert_signup ON public.organizations;
CREATE POLICY orgs_insert_signup ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND slug IS NOT NULL
    AND char_length(btrim(slug)) >= 3
    AND name IS NOT NULL
    AND btrim(name) <> ''
  );

-- 3) Revoke anon direct table access (app uses authenticated client + RPCs)
REVOKE ALL ON TABLE public.admins FROM anon;
REVOKE ALL ON TABLE public.app_config FROM anon;
REVOKE ALL ON TABLE public.distributor_physical_stock_snapshots FROM anon;
REVOKE ALL ON TABLE public.distributors FROM anon;
REVOKE ALL ON TABLE public.orders FROM anon;
REVOKE ALL ON TABLE public.organization_invites FROM anon;
REVOKE ALL ON TABLE public.organization_members FROM anon;
REVOKE ALL ON TABLE public.organizations FROM anon;
REVOKE ALL ON TABLE public.platform_admins FROM anon;
REVOKE ALL ON TABLE public.sales_data FROM anon;
REVOKE ALL ON TABLE public.schemes FROM anon;
REVOKE ALL ON TABLE public.targets FROM anon;

-- 4) Revoke anon EXECUTE on internal / privileged RPCs
--    Keep anon on: get_organization_by_slug, lookup_distributor_for_login,
--    get_invite_by_token, create_workspace_for_signup, delete_workspace_signup_rollback
REVOKE EXECUTE ON FUNCTION public.is_org_member(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_organization_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_auth_user_as_admin(text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_list_organizations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_list_tenant_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_update_organization(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_delete_organization(uuid) FROM anon;

-- 5) Hide internal helpers from anon REST RPC — authenticated MUST keep EXECUTE (RLS calls them)
REVOKE EXECUTE ON FUNCTION public.is_org_member(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(text) TO authenticated;

SELECT 'Security hardening applied. Enable leaked-password protection in Auth settings.' AS status;
