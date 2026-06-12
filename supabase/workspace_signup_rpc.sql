-- ============================================================
-- Workspace signup RPCs (anon-safe org creation before Auth user exists)
-- Run after organizations table exists. Required for /signup self-serve flow.
-- Safe to re-run: drops prior signatures when return type changed.
-- ============================================================

DROP FUNCTION IF EXISTS public.create_workspace_for_signup(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.create_workspace_for_signup(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_workspace_for_signup(
  p_slug TEXT,
  p_name TEXT,
  p_settings JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_name TEXT;
  v_settings JSONB;
BEGIN
  v_slug := lower(trim(p_slug));
  v_name := trim(p_name);
  v_settings := COALESCE(p_settings, '{}'::jsonb);

  IF v_slug IS NULL OR length(v_slug) < 3 OR length(v_slug) > 64 THEN
    RAISE EXCEPTION 'Invalid workspace ID: use 3–64 lowercase letters, numbers, and hyphens';
  END IF;

  IF v_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'Invalid workspace ID: use 3–64 lowercase letters, numbers, and hyphens';
  END IF;

  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  RETURN QUERY
  INSERT INTO organizations (slug, name, plan, status, settings)
  VALUES (v_slug, v_name, 'trial', 'active', v_settings)
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace_for_signup(TEXT, TEXT, JSONB) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.delete_workspace_signup_rollback(UUID);

CREATE OR REPLACE FUNCTION public.delete_workspace_signup_rollback(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  DELETE FROM organizations o
  WHERE o.id = p_org_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_workspace_signup_rollback(UUID) TO anon, authenticated;
