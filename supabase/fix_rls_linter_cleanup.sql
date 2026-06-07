-- ============================================================
-- RLS linter cleanup — run AFTER TENANT_RLS_STRICT.sql
-- Removes legacy permissive policies, duplicate indexes, and
-- fixes auth_rls_initplan warnings in helper functions.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Drop LEGACY policies (any authenticated user — bypasses org isolation)
--    Permissive policies are OR'd; these weaken tenant RLS.
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname LIKE 'Allow authenticated users to %'
        OR policyname IN (
          'tenant_select_authenticated',
          'tenant_insert_authenticated',
          'tenant_update_authenticated',
          'tenant_delete_authenticated',
          'tenant_anon_app_filtered'
        )
        -- Duplicate org/member/invite policy names from older migrations
        OR policyname IN (
          'organizations_insert_signup',
          'organizations_select_member',
          'organizations_update_member',
          'organization_members_select',
          'organization_members_insert',
          'organization_members_update',
          'organization_invites_select_member',
          'organization_invites_insert_member',
          'organization_invites_update_member'
        )
        -- platform_select overlaps with platform_all (FOR ALL)
        OR policyname = 'platform_select'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Keep signup helpers on admins only if you still need them; drop duplicates
-- after verifying invite/signup flow uses RPCs + org-scoped inserts.
-- Uncomment if signup still works without these:
-- DROP POLICY IF EXISTS admins_select_own ON public.admins;
-- DROP POLICY IF EXISTS admins_insert_signup ON public.admins;

-- ------------------------------------------------------------
-- 2) Fix auth_rls_initplan in SECURITY DEFINER helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_user_id_text()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (SELECT auth.uid())::text;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'platform_admins'
  ) THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.user_id = (SELECT auth.uid())
  );
END;
$$;

DROP POLICY IF EXISTS platform_admins_select_self ON platform_admins;
CREATE POLICY platform_admins_select_self ON platform_admins
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Signup/invite policies are merged in fix_rls_consolidate_policies.sql
DROP POLICY IF EXISTS organization_members_select ON organization_members;
DROP POLICY IF EXISTS organization_invites_update_invitee ON organization_invites;
DROP POLICY IF EXISTS admins_select_own ON public.admins;
DROP POLICY IF EXISTS admins_insert_signup ON public.admins;

-- ------------------------------------------------------------
-- 3) Duplicate index on app_config
-- ------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_app_config_org_id_unique;

SELECT 'RLS linter cleanup applied. Re-check Database → Linter in Supabase.' AS status;
