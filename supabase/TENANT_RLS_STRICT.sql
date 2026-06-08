-- ============================================================
-- TENANT RLS — strict organization isolation
-- Run in Supabase SQL Editor (platform_admin.sql optional but recommended).
-- ============================================================

-- Platform admin helper (no-op if platform_admins table missing)
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
  RETURN EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- Drop legacy UUID signatures if re-running after a failed attempt
DROP FUNCTION IF EXISTS public.is_org_member(UUID);
DROP FUNCTION IF EXISTS public.is_org_admin(UUID);

-- Compare auth user to text/uuid columns safely (legacy schemas use TEXT ids).
CREATE OR REPLACE FUNCTION public.auth_user_id_text()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.uid()::text;
$$;

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_org_id IS NOT NULL
    AND btrim(p_org_id) <> ''
    AND (
      public.is_platform_admin()
      OR EXISTS (
        SELECT 1 FROM organization_members m
        WHERE m.organization_id::text = p_org_id::text
          AND m.user_id::text = public.auth_user_id_text()
      )
      OR EXISTS (
        SELECT 1 FROM admins a
        WHERE a.organization_id::text = p_org_id::text
          AND (a.uid::text = public.auth_user_id_text() OR a.id::text = public.auth_user_id_text())
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_org_id IS NOT NULL
    AND btrim(p_org_id) <> ''
    AND (
      public.is_platform_admin()
      OR EXISTS (
        SELECT 1 FROM organization_members m
        WHERE m.organization_id::text = p_org_id::text
          AND m.user_id::text = public.auth_user_id_text()
          AND m.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM admins a
        WHERE a.organization_id::text = p_org_id::text
          AND (a.uid::text = public.auth_user_id_text() OR a.id::text = public.auth_user_id_text())
          AND COALESCE(a.role, 'admin') IN ('admin', 'administrator', 'owner')
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_admin(TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Composite unique keys (per-organization IDs)
-- Safe to re-run; skips if constraint/index already exists.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'distributors' AND column_name = 'organization_id'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS distributors_org_id_id_unique
      ON public.distributors (organization_id, id);
    CREATE UNIQUE INDEX IF NOT EXISTS distributors_org_code_unique
      ON public.distributors (organization_id, code)
      WHERE code IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'targets' AND column_name = 'organization_id'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS targets_org_id_unique
      ON public.targets (organization_id, id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schemes' AND column_name = 'organization_id'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS schemes_org_id_unique
      ON public.schemes (organization_id, id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_config' AND column_name = 'organization_id'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS app_config_org_id_unique
      ON public.app_config (organization_id, id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admins' AND column_name = 'organization_id'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS admins_org_uid_unique
      ON public.admins (organization_id, uid)
      WHERE uid IS NOT NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- RPC: workspace lookup (login / branding)
-- DROP first when OUT/return type changed (CREATE OR REPLACE cannot alter return type).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_organization_by_slug(TEXT);
DROP FUNCTION IF EXISTS public.lookup_distributor_for_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_invite_by_token(TEXT);

CREATE OR REPLACE FUNCTION public.get_organization_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  plan TEXT,
  status TEXT,
  settings JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.slug, o.name, o.plan, o.status, o.settings
  FROM organizations o
  WHERE o.slug = lower(trim(p_slug))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_by_slug(TEXT) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_organization_by_id(UUID);

CREATE OR REPLACE FUNCTION public.get_organization_by_id(p_id UUID)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  plan TEXT,
  status TEXT,
  settings JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.slug, o.name, o.plan, o.status, o.settings
  FROM public.organizations o
  WHERE o.id = p_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_by_id(UUID) TO anon, authenticated;

-- ------------------------------------------------------------
-- RPC: distributor login (code + password checked in app)
-- Returns row including credentials for password verification.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_distributor_for_login(p_slug TEXT, p_code TEXT)
RETURNS SETOF distributors
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.*
  FROM distributors d
  INNER JOIN organizations o ON o.id = d.organization_id
  WHERE o.slug = lower(trim(p_slug))
    AND o.status IS DISTINCT FROM 'suspended'
    AND (
      upper(trim(d.code)) = upper(trim(p_code))
      OR upper(trim(d.username)) = upper(trim(p_code))
      OR upper(trim(d.credentials->>'username')) = upper(trim(p_code))
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_distributor_for_login(TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- RPC: invite acceptance
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  email TEXT,
  role TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  org_id UUID,
  org_slug TEXT,
  org_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.organization_id,
    i.email,
    i.role,
    i.status,
    i.expires_at,
    o.id AS org_id,
    o.slug AS org_slug,
    o.name AS org_name
  FROM organization_invites i
  INNER JOIN organizations o ON o.id = i.organization_id
  WHERE i.token = trim(p_token)
    AND i.status = 'pending'
    AND (i.expires_at IS NULL OR i.expires_at > NOW())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- Macro: tenant table policies
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tenant_enable_rls(p_table REGCLASS)
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

-- Tenant data tables
SELECT public._tenant_enable_rls('public.distributors'::REGCLASS);
SELECT public._tenant_enable_rls('public.admins'::REGCLASS);

-- admins: allow own-row read/insert during signup before org membership exists
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

SELECT public._tenant_enable_rls('public.orders'::REGCLASS);
SELECT public._tenant_enable_rls('public.targets'::REGCLASS);
SELECT public._tenant_enable_rls('public.schemes'::REGCLASS);
SELECT public._tenant_enable_rls('public.sales_data'::REGCLASS);
SELECT public._tenant_enable_rls('public.app_config'::REGCLASS);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'distributor_physical_stock_snapshots'
  ) THEN
    PERFORM public._tenant_enable_rls('public.distributor_physical_stock_snapshots'::REGCLASS);
  END IF;
END $$;

-- ------------------------------------------------------------
-- organization_members
-- ------------------------------------------------------------
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_select ON organization_members;
CREATE POLICY org_members_select ON organization_members
  FOR SELECT TO authenticated
  USING (
    user_id::text = public.auth_user_id_text()
    OR public.is_org_member(organization_id::text)
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS org_members_insert ON organization_members;
CREATE POLICY org_members_insert ON organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin(organization_id::text)
    OR public.is_platform_admin()
    OR user_id::text = public.auth_user_id_text()
  );

DROP POLICY IF EXISTS org_members_update ON organization_members;
CREATE POLICY org_members_update ON organization_members
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id::text) OR public.is_platform_admin())
  WITH CHECK (public.is_org_admin(organization_id::text) OR public.is_platform_admin());

DROP POLICY IF EXISTS org_members_delete ON organization_members;
CREATE POLICY org_members_delete ON organization_members
  FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id::text) OR public.is_platform_admin());

-- ------------------------------------------------------------
-- organization_invites (staff only; accept uses RPC)
-- ------------------------------------------------------------
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

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

-- ------------------------------------------------------------
-- organizations
-- ------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orgs_select_member ON organizations;
CREATE POLICY orgs_select_member ON organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id::text) OR public.is_platform_admin());

DROP POLICY IF EXISTS orgs_update_admin ON organizations;
CREATE POLICY orgs_update_admin ON organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(id::text) OR public.is_platform_admin())
  WITH CHECK (public.is_org_admin(id::text) OR public.is_platform_admin());

DROP POLICY IF EXISTS orgs_delete_platform ON organizations;
CREATE POLICY orgs_delete_platform ON organizations
  FOR DELETE TO authenticated
  USING (public.is_platform_admin());

-- Signup inserts org row before membership exists — use service role or signup RPC in production.
-- Allow authenticated insert for workspace creation flow:
DROP POLICY IF EXISTS orgs_insert_signup ON organizations;
CREATE POLICY orgs_insert_signup ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND slug IS NOT NULL
    AND char_length(btrim(slug)) >= 3
    AND name IS NOT NULL
    AND btrim(name) <> ''
  );

DROP FUNCTION IF EXISTS public._tenant_enable_rls(REGCLASS);

SELECT 'TENANT_RLS_STRICT applied. Run add_distributor_gstin_tpn.sql if needed.' AS status;
