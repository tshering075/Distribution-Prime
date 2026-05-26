-- Links an existing Supabase Auth user (by email) to the admins table.
-- Run once in Supabase Dashboard → SQL Editor.
-- Fixes: "A user with this email already exists in Supabase Auth" when creating admins.

CREATE OR REPLACE FUNCTION public.link_auth_user_as_admin(
  user_email text,
  user_name text DEFAULT NULL,
  user_role text DEFAULT 'admin',
  user_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  auth_uid uuid;
  auth_email text;
  caller_uid uuid;
  caller_perms jsonb;
  admin_row admins%ROWTYPE;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT a.permissions
  INTO caller_perms
  FROM public.admins a
  WHERE a.uid = caller_uid::text OR a.id::text = caller_uid::text
  LIMIT 1;

  IF caller_perms IS NULL OR COALESCE((caller_perms->>'manageUsers')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Permission denied: manageUsers required';
  END IF;

  SELECT u.id, u.email
  INTO auth_uid, auth_email
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(user_email))
  LIMIT 1;

  IF auth_uid IS NULL THEN
    RAISE EXCEPTION 'No Supabase Auth account found for this email';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.admins a WHERE lower(a.email) = lower(trim(user_email))
  ) THEN
    RAISE EXCEPTION 'An admin record already exists for this email';
  END IF;

  INSERT INTO public.admins (uid, id, email, name, role, permissions, created_at, updated_at)
  VALUES (
    auth_uid::text,
    auth_uid,
    auth_email,
    COALESCE(NULLIF(trim(user_name), ''), split_part(auth_email, '@', 1)),
    COALESCE(NULLIF(trim(user_role), ''), 'admin'),
    COALESCE(user_permissions, '{}'::jsonb),
    NOW(),
    NOW()
  )
  RETURNING * INTO admin_row;

  RETURN to_jsonb(admin_row);
END;
$$;

REVOKE ALL ON FUNCTION public.link_auth_user_as_admin(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_auth_user_as_admin(text, text, text, jsonb) TO authenticated;
