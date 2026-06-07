-- ============================================================
-- Distributor RPCs (anon-safe, session-token authenticated)
-- Run after TENANT_RLS_STRICT.sql and workspace_signup_rpc.sql
-- ============================================================

-- Client-side password hash (matches hashPasswordSync in src/utils/distributorAuth.js)
CREATE OR REPLACE FUNCTION public.distributor_client_password_hash(p_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  h BIGINT := 0;
  i INT;
  c INT;
  signed_h INT;
BEGIN
  IF p_password IS NULL THEN
    RETURN NULL;
  END IF;

  FOR i IN 1..length(p_password) LOOP
    c := ascii(substr(p_password, i, 1));
    h := ((h << 5) - h) + c;
    signed_h := (h & 4294967295)::INT;
    IF signed_h >= 2147483648 THEN
      signed_h := signed_h - 4294967296;
    END IF;
    h := signed_h;
  END LOOP;

  RETURN to_hex(abs(h)::BIGINT);
END;
$$;

CREATE OR REPLACE FUNCTION public._distributor_password_matches(p_credentials JSONB, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_credentials IS NOT NULL
    AND p_password IS NOT NULL
    AND (
      (
        p_credentials->>'passwordHash' IS NOT NULL
        AND p_credentials->>'passwordHash' = public.distributor_client_password_hash(p_password)
      )
      OR (
        p_credentials->>'password' IS NOT NULL
        AND p_credentials->>'password' = p_password
      )
    );
$$;

CREATE TABLE IF NOT EXISTS public.distributor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  distributor_code TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS distributor_sessions_token_active_idx
  ON public.distributor_sessions (token, expires_at);

ALTER TABLE public.distributor_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._resolve_distributor_in_org(p_slug TEXT, p_code TEXT)
RETURNS TABLE (
  organization_id UUID,
  distributor_code TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.organization_id, trim(d.code)
  FROM distributors d
  INNER JOIN organizations o ON o.id = d.organization_id
  WHERE o.slug = lower(trim(p_slug))
    AND o.status IS DISTINCT FROM 'suspended'
    AND (
      upper(trim(d.code)) = upper(trim(p_code))
      OR upper(trim(coalesce(d.username, ''))) = upper(trim(p_code))
      OR upper(trim(coalesce(d.credentials->>'username', ''))) = upper(trim(p_code))
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._resolve_distributor_in_org(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._resolve_distributor_in_org(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public._resolve_distributor_session(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT
)
RETURNS TABLE (
  organization_id UUID,
  distributor_code TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ds.organization_id, trim(ds.distributor_code)
  FROM distributor_sessions ds
  INNER JOIN organizations o ON o.id = ds.organization_id
  WHERE o.slug = lower(trim(p_slug))
    AND o.status IS DISTINCT FROM 'suspended'
    AND ds.token = trim(p_session_token)
    AND ds.expires_at > NOW()
    AND (
      upper(trim(ds.distributor_code)) = upper(trim(p_distributor_code))
      OR upper(trim(ds.distributor_code)) = upper(trim(p_distributor_code))
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._resolve_distributor_session(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._resolve_distributor_session(TEXT, TEXT, TEXT) TO service_role;

-- Login: verify password server-side, return session token (no credentials exposed)
DROP FUNCTION IF EXISTS public.authenticate_distributor(TEXT, TEXT, TEXT);

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
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No distributor found with this code';
  END IF;

  IF NOT public._distributor_password_matches(v_row.credentials, p_password) THEN
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

GRANT EXECUTE ON FUNCTION public.authenticate_distributor(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- List orders for a distributor (dashboard)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_distributor_orders(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_distributor_orders(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_distributor_orders(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT
)
RETURNS SETOF orders
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_code TEXT;
BEGIN
  SELECT r.organization_id, r.distributor_code
  INTO v_org_id, v_code
  FROM public._resolve_distributor_session(p_slug, p_distributor_code, p_session_token) r;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired distributor session';
  END IF;

  RETURN QUERY
  SELECT o.*
  FROM orders o
  WHERE o.organization_id = v_org_id
    AND (
      upper(trim(coalesce(o."distributorCode", o.distributor_code, ''))) = upper(trim(v_code))
      OR upper(trim(coalesce(o."distributorCode", o.distributor_code, ''))) = upper(trim(p_distributor_code))
    )
  ORDER BY o.created_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_orders(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- Order numbers in workspace (unique allocation for distributor UI)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_workspace_order_numbers(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_workspace_order_numbers(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_workspace_order_numbers(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT
)
RETURNS TABLE (order_number TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT r.organization_id INTO v_org_id
  FROM public._resolve_distributor_session(p_slug, p_distributor_code, p_session_token) r;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired distributor session';
  END IF;

  RETURN QUERY
  SELECT DISTINCT trim(coalesce(o."orderNumber"::text, o.order_number::text, ''))
  FROM orders o
  WHERE o.organization_id = v_org_id
    AND trim(coalesce(o."orderNumber"::text, o.order_number::text, '')) <> '';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_order_numbers(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- Insert order (place order)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.insert_distributor_order(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.insert_distributor_order(TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.insert_distributor_order(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT,
  p_order JSONB
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_code TEXT;
  v_merged JSONB;
  v_row orders;
BEGIN
  SELECT r.organization_id, r.distributor_code
  INTO v_org_id, v_code
  FROM public._resolve_distributor_session(p_slug, p_distributor_code, p_session_token) r;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired distributor session';
  END IF;

  v_merged :=
    coalesce(p_order, '{}'::jsonb)
    || jsonb_build_object(
      'organization_id', v_org_id,
      'distributorCode', coalesce(nullif(trim(p_order->>'distributorCode'), ''), v_code)
    );

  IF coalesce(nullif(trim(v_merged->>'id'), ''), '') = '' THEN
    v_merged := v_merged || jsonb_build_object('id', gen_random_uuid());
  END IF;

  IF coalesce(nullif(trim(v_merged->>'created_at'), ''), '') = '' THEN
    v_merged := v_merged || jsonb_build_object('created_at', NOW());
  END IF;

  IF coalesce(nullif(trim(v_merged->>'updated_at'), ''), '') = '' THEN
    v_merged := v_merged || jsonb_build_object('updated_at', NOW());
  END IF;

  INSERT INTO orders
  SELECT r.*
  FROM jsonb_populate_record(NULL::orders, v_merged) AS r
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_distributor_order(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- ------------------------------------------------------------
-- Update order (edit / resubmit)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_distributor_order(TEXT, TEXT, UUID, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.update_distributor_order(TEXT, TEXT, TEXT, UUID, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.update_distributor_order(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT,
  p_order_id UUID,
  p_patch JSONB,
  p_status TEXT DEFAULT NULL
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_code TEXT;
  v_merged JSONB;
  v_row orders;
  v_existing orders;
BEGIN
  SELECT r.organization_id, r.distributor_code
  INTO v_org_id, v_code
  FROM public._resolve_distributor_session(p_slug, p_distributor_code, p_session_token) r;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired distributor session';
  END IF;

  SELECT * INTO v_existing
  FROM orders o
  WHERE o.id = p_order_id
    AND o.organization_id = v_org_id
    AND upper(trim(coalesce(o."distributorCode", o.distributor_code, ''))) IN (
      upper(trim(v_code)), upper(trim(p_distributor_code))
    )
  LIMIT 1;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Order not found for this distributor';
  END IF;

  v_merged := to_jsonb(v_existing) || coalesce(p_patch, '{}'::jsonb);
  IF p_status IS NOT NULL AND trim(p_status) <> '' THEN
    v_merged := v_merged || jsonb_build_object('status', lower(trim(p_status)));
  END IF;
  v_merged := v_merged || jsonb_build_object('updated_at', NOW());
  v_merged := v_merged - 'id' - 'organization_id';

  SELECT t INTO v_row FROM jsonb_populate_record(v_existing, v_merged) AS t;

  UPDATE orders o
  SET
    "distributorCode" = v_row."distributorCode",
    "distributorName" = v_row."distributorName",
    data = v_row.data,
    timestamp = v_row.timestamp,
    "totalUC" = v_row."totalUC",
    "csdUC" = v_row."csdUC",
    "waterUC" = v_row."waterUC",
    "csdPC" = v_row."csdPC",
    "waterPC" = v_row."waterPC",
    "orderNumber" = v_row."orderNumber",
    "tableImageData" = v_row."tableImageData",
    status = v_row.status,
    caption = v_row.caption,
    "status_updated_at" = v_row."status_updated_at",
    status_history = v_row.status_history,
    "isEdited" = v_row."isEdited",
    "editedAt" = v_row."editedAt",
    "editedCount" = v_row."editedCount",
    updated_at = v_row.updated_at
  WHERE o.id = p_order_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_distributor_order(TEXT, TEXT, TEXT, UUID, JSONB, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- Delete order
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_distributor_order(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.delete_distributor_order(TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.delete_distributor_order(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT,
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_code TEXT;
  v_deleted INT;
BEGIN
  SELECT r.organization_id, r.distributor_code
  INTO v_org_id, v_code
  FROM public._resolve_distributor_session(p_slug, p_distributor_code, p_session_token) r;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired distributor session';
  END IF;

  DELETE FROM orders o
  WHERE o.id = p_order_id
    AND o.organization_id = v_org_id
    AND upper(trim(coalesce(o."distributorCode", o.distributor_code, ''))) IN (
      upper(trim(v_code)), upper(trim(p_distributor_code))
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_distributor_order(TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

-- ------------------------------------------------------------
-- Workspace product rates (Rate Master catalogue) for anon distributors
-- Read-only catalogue by workspace slug — no session required.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_workspace_product_rates(TEXT);

CREATE OR REPLACE FUNCTION public.get_workspace_product_rates(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_row public.app_config%ROWTYPE;
  v_raw TEXT;
  v_parsed JSONB;
BEGIN
  SELECT o.id
  INTO v_org_id
  FROM public.organizations o
  WHERE o.slug = lower(trim(p_slug))
    AND o.status IS DISTINCT FROM 'suspended'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ac.*
  INTO v_row
  FROM public.app_config ac
  WHERE ac.organization_id = v_org_id
    AND ac.id = 'product_rates'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.products IS NOT NULL
     AND jsonb_typeof(v_row.products) = 'array'
     AND jsonb_array_length(v_row.products) > 0 THEN
    RETURN jsonb_build_object(
      'products', v_row.products,
      'settings', COALESCE(v_row.settings, '{}'::jsonb),
      'skuRates', COALESCE(v_row."skuRates", '{}'::jsonb),
      'canRate', v_row."canRate",
      'customProducts', COALESCE(v_row."customProducts", '[]'::jsonb)
    );
  END IF;

  FOR v_raw IN
    SELECT unnest(ARRAY[
      v_row."clientId"::text,
      v_row."apiKey"::text,
      v_row.gmail_client_id::text
    ])
  LOOP
    IF v_raw IS NULL OR btrim(v_raw) = '' THEN
      CONTINUE;
    END IF;
    BEGIN
      v_parsed := v_raw::jsonb;
      IF v_parsed ? 'products' OR v_parsed ? 'skuRates' OR v_parsed ? 'canRate' THEN
        RETURN jsonb_build_object(
          'products', COALESCE(v_parsed->'products', '[]'::jsonb),
          'settings', COALESCE(v_parsed->'settings', '{}'::jsonb),
          'skuRates', COALESCE(v_parsed->'skuRates', '{}'::jsonb),
          'canRate', v_parsed->'canRate',
          'customProducts', COALESCE(v_parsed->'customProducts', '[]'::jsonb)
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        CONTINUE;
    END;
  END LOOP;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_product_rates(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- Save workspace product rates (Rate Master) — admin only, bypasses RLS edge cases
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_workspace_product_rates(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.save_workspace_product_rates(p_org_id UUID, p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text TEXT;
  v_products JSONB;
  v_settings JSONB;
  v_updated INT;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Workspace id is required';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid product rates payload';
  END IF;

  IF NOT public.is_org_admin(p_org_id::text) AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized to update Rate Master for this workspace';
  END IF;

  v_text := p_payload::text;
  v_products := COALESCE(p_payload->'products', '[]'::jsonb);
  v_settings := COALESCE(p_payload->'settings', '{}'::jsonb);

  -- Per-workspace row (composite PK or org_id + id unique)
  UPDATE public.app_config
  SET
    "clientId" = v_text,
    "apiKey" = v_text,
    products = v_products,
    settings = v_settings,
    updated_at = now()
  WHERE organization_id = p_org_id
    AND id = 'product_rates';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    RETURN TRUE;
  END IF;

  -- Legacy schema: single-column PK on id only (one product_rates row globally)
  IF EXISTS (
    SELECT 1 FROM public.app_config ac WHERE ac.id = 'product_rates' LIMIT 1
  ) THEN
    BEGIN
      UPDATE public.app_config
      SET
        organization_id = p_org_id,
        "clientId" = v_text,
        "apiKey" = v_text,
        products = v_products,
        settings = v_settings,
        updated_at = now()
      WHERE id = 'product_rates';
    EXCEPTION
      WHEN undefined_column THEN
        UPDATE public.app_config
        SET
          organization_id = p_org_id,
          "clientId" = v_text,
          "apiKey" = v_text
        WHERE id = 'product_rates';
    END;
    RETURN TRUE;
  END IF;

  -- First save for this workspace
  BEGIN
    INSERT INTO public.app_config (organization_id, id, "clientId", "apiKey", products, settings, updated_at)
    VALUES (p_org_id, 'product_rates', v_text, v_text, v_products, v_settings, now());
  EXCEPTION
    WHEN unique_violation THEN
      UPDATE public.app_config
      SET
        organization_id = p_org_id,
        "clientId" = v_text,
        "apiKey" = v_text,
        products = v_products,
        settings = v_settings,
        updated_at = now()
      WHERE id = 'product_rates';
    WHEN undefined_column THEN
      INSERT INTO public.app_config (organization_id, id, "clientId", "apiKey")
      VALUES (p_org_id, 'product_rates', v_text, v_text);
  END;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_workspace_product_rates(UUID, JSONB) TO authenticated;
