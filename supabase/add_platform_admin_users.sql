-- Platform operator user management (list / add / link / remove).
-- Run AFTER platform_admin.sql

-- ------------------------------------------------------------
-- List all platform operators (platform admins only)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.platform_list_admins();

CREATE OR REPLACE FUNCTION public.platform_list_admins()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
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
  SELECT pa.id, pa.user_id, pa.email, pa.role, pa.created_at
  FROM public.platform_admins pa
  ORDER BY pa.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_admins() TO authenticated;

-- ------------------------------------------------------------
-- Register a new platform operator (after Auth sign-up)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.platform_register_admin(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.platform_register_admin(
  p_user_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'operator'
)
RETURNS public.platform_admins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
  v_row public.platform_admins;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform access required' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22023';
  END IF;

  v_email := lower(trim(coalesce(p_email, '')));
  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Valid email is required' USING ERRCODE = '22023';
  END IF;

  v_role := lower(trim(coalesce(p_role, 'operator')));
  IF v_role NOT IN ('owner', 'operator', 'support') THEN
    RAISE EXCEPTION 'Invalid role. Use owner, operator, or support.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.platform_admins (user_id, email, role)
  VALUES (p_user_id, v_email, v_role)
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_register_admin(UUID, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Link existing Auth user as platform operator
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.platform_link_auth_user_as_platform_admin(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.platform_link_auth_user_as_platform_admin(
  p_email TEXT,
  p_role TEXT DEFAULT 'operator'
)
RETURNS public.platform_admins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_auth_email TEXT;
  v_role TEXT;
  v_row public.platform_admins;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform access required' USING ERRCODE = '42501';
  END IF;

  SELECT au.id, lower(trim(au.email))
  INTO v_user_id, v_auth_email
  FROM auth.users au
  WHERE lower(trim(au.email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No Supabase Auth user found for this email' USING ERRCODE = 'P0002';
  END IF;

  v_role := lower(trim(coalesce(p_role, 'operator')));
  IF v_role NOT IN ('owner', 'operator', 'support') THEN
    RAISE EXCEPTION 'Invalid role. Use owner, operator, or support.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.platform_admins (user_id, email, role)
  VALUES (v_user_id, coalesce(v_auth_email, lower(trim(p_email))), v_role)
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_link_auth_user_as_platform_admin(TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Remove platform operator (does not delete Auth user)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.platform_remove_admin(UUID);

CREATE OR REPLACE FUNCTION public.platform_remove_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
  v_remaining INT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform access required' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove your own platform access' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*)::INT INTO v_remaining FROM public.platform_admins;
  IF v_remaining <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last platform operator' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.platform_admins pa
  WHERE pa.user_id = p_user_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_remove_admin(UUID) TO authenticated;

SELECT 'Platform admin user RPCs ready.' AS status;
