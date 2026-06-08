-- Allow anon distributor sessions to resolve organization by id (SECURITY DEFINER).
-- Run after TENANT_RLS_STRICT.sql / fix_linter_security.sql (organizations table revoked from anon).

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
