-- Allow distributor sign-in by code, username, or email (workspace-scoped).
-- Run in Supabase SQL Editor after distributor_orders_rpc.sql.

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
      OR upper(trim(coalesce(d.username, ''))) = upper(trim(p_code))
      OR upper(trim(coalesce(d.credentials->>'username', ''))) = upper(trim(p_code))
      OR (
        position('@' in trim(p_code)) > 0
        AND lower(trim(coalesce(d.email, ''))) = lower(trim(p_code))
      )
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.authenticate_distributor(
  p_slug TEXT,
  p_code TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.distributors%ROWTYPE;
  v_token TEXT;
  v_exp TIMESTAMPTZ;
BEGIN
  SELECT d.*
  INTO v_row
  FROM distributors d
  INNER JOIN organizations o ON o.id = d.organization_id
  WHERE o.slug = lower(trim(p_slug))
    AND o.status IS DISTINCT FROM 'suspended'
    AND (
      upper(trim(d.code)) = upper(trim(p_code))
      OR upper(trim(coalesce(d.username, ''))) = upper(trim(p_code))
      OR upper(trim(coalesce(d.credentials->>'username', ''))) = upper(trim(p_code))
      OR (
        position('@' in trim(p_code)) > 0
        AND lower(trim(coalesce(d.email, ''))) = lower(trim(p_code))
      )
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No distributor found with this code in workspace %', lower(trim(p_slug));
  END IF;

  IF NOT public._distributor_password_matches(v_row.credentials, p_password) THEN
    IF v_row.credentials IS NULL
      OR (v_row.credentials->>'passwordHash' IS NULL AND v_row.credentials->>'password' IS NULL) THEN
      RAISE EXCEPTION 'This distributor has no password saved. Ask your admin to set a password in Distributors.';
    END IF;
    RAISE EXCEPTION 'Wrong password for this distributor code';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_exp := NOW() + INTERVAL '7 days';

  INSERT INTO distributor_sessions (organization_id, distributor_code, token, expires_at)
  VALUES (v_row.organization_id, trim(v_row.code), v_token, v_exp);

  RETURN jsonb_build_object(
    'session_token', v_token,
    'expires_at', v_exp,
    'distributor', to_jsonb(v_row) - 'credentials'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_distributor_for_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authenticate_distributor(TEXT, TEXT, TEXT) TO anon, authenticated;
