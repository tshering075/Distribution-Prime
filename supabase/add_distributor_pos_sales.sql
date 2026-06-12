-- Distributor POS sales + session RPCs (rates/discount/GST live on distributors.pos_settings).
-- Run after: TENANT_RLS_STRICT.sql, distributor_orders_rpc.sql, add_distributor_pos_settings.sql

CREATE TABLE IF NOT EXISTS public.distributor_pos_sales (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  distributor_code TEXT NOT NULL,
  sale_number TEXT NOT NULL,
  invoice_number TEXT,
  sale_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS distributor_pos_sales_org_dist_sale_unique
  ON public.distributor_pos_sales (organization_id, distributor_code, sale_number);

CREATE UNIQUE INDEX IF NOT EXISTS distributor_pos_sales_org_invoice_unique
  ON public.distributor_pos_sales (organization_id, invoice_number)
  WHERE invoice_number IS NOT NULL AND btrim(invoice_number) <> '';

CREATE INDEX IF NOT EXISTS distributor_pos_sales_org_dist_created_idx
  ON public.distributor_pos_sales (organization_id, distributor_code, created_at DESC);

ALTER TABLE public.distributor_pos_sales ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_tenant_enable_rls'
  ) THEN
    PERFORM public._tenant_enable_rls('public.distributor_pos_sales'::REGCLASS);
  ELSE
    DROP POLICY IF EXISTS tenant_select ON public.distributor_pos_sales;
    CREATE POLICY tenant_select ON public.distributor_pos_sales
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id::text) OR public.is_platform_admin());

    DROP POLICY IF EXISTS tenant_insert ON public.distributor_pos_sales;
    CREATE POLICY tenant_insert ON public.distributor_pos_sales
      FOR INSERT TO authenticated
      WITH CHECK (public.is_org_member(organization_id::text) OR public.is_platform_admin());

    DROP POLICY IF EXISTS tenant_update ON public.distributor_pos_sales;
    CREATE POLICY tenant_update ON public.distributor_pos_sales
      FOR UPDATE TO authenticated
      USING (public.is_org_member(organization_id::text) OR public.is_platform_admin())
      WITH CHECK (public.is_org_member(organization_id::text) OR public.is_platform_admin());

    DROP POLICY IF EXISTS tenant_delete ON public.distributor_pos_sales;
    CREATE POLICY tenant_delete ON public.distributor_pos_sales
      FOR DELETE TO authenticated
      USING (public.is_org_admin(organization_id::text) OR public.is_platform_admin());
  END IF;
END $$;

REVOKE ALL ON TABLE public.distributor_pos_sales FROM anon;

-- ------------------------------------------------------------
-- Insert POS sale (distributor session)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.insert_distributor_pos_sale(TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.insert_distributor_pos_sale(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT,
  p_sale JSONB
)
RETURNS public.distributor_pos_sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_code TEXT;
  v_row public.distributor_pos_sales;
  v_id UUID;
  v_sale_number TEXT;
  v_invoice_number TEXT;
  v_created TIMESTAMPTZ;
BEGIN
  SELECT r.organization_id, r.distributor_code
  INTO v_org_id, v_code
  FROM public._resolve_distributor_session(p_slug, p_distributor_code, p_session_token) r;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired distributor session';
  END IF;

  v_id := coalesce(
    nullif(trim(p_sale->>'id'), '')::uuid,
    gen_random_uuid()
  );
  v_sale_number := coalesce(nullif(trim(p_sale->>'saleNumber'), ''), nullif(trim(p_sale->>'sale_number'), ''));
  v_invoice_number := coalesce(nullif(trim(p_sale->>'invoiceNumber'), ''), nullif(trim(p_sale->>'invoice_number'), ''));
  v_created := coalesce(
    nullif(trim(p_sale->>'createdAt'), '')::timestamptz,
    nullif(trim(p_sale->>'created_at'), '')::timestamptz,
    NOW()
  );

  IF v_sale_number IS NULL OR v_sale_number = '' THEN
    RAISE EXCEPTION 'POS sale requires saleNumber';
  END IF;

  INSERT INTO public.distributor_pos_sales (
    id,
    organization_id,
    distributor_code,
    sale_number,
    invoice_number,
    sale_data,
    created_at,
    updated_at
  )
  VALUES (
    v_id,
    v_org_id,
    v_code,
    v_sale_number,
    v_invoice_number,
    coalesce(p_sale, '{}'::jsonb),
    v_created,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    sale_data = EXCLUDED.sale_data,
    invoice_number = EXCLUDED.invoice_number,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_distributor_pos_sale(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- ------------------------------------------------------------
-- List POS sales (distributor session)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_distributor_pos_sales(TEXT, TEXT, TEXT, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_distributor_pos_sales(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL
)
RETURNS SETOF public.distributor_pos_sales
LANGUAGE plpgsql
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
  SELECT s.*
  FROM public.distributor_pos_sales s
  WHERE s.organization_id = v_org_id
    AND upper(trim(s.distributor_code)) = upper(trim(v_code))
    AND (p_from_date IS NULL OR s.created_at::date >= p_from_date)
    AND (p_to_date IS NULL OR s.created_at::date <= p_to_date)
  ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_pos_sales(TEXT, TEXT, TEXT, DATE, DATE) TO anon, authenticated;

-- ------------------------------------------------------------
-- Update POS settings on distributor row (distributor session)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_distributor_pos_settings(TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.update_distributor_pos_settings(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT,
  p_settings JSONB
)
RETURNS public.distributors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_code TEXT;
  v_row public.distributors;
BEGIN
  SELECT r.organization_id, r.distributor_code
  INTO v_org_id, v_code
  FROM public._resolve_distributor_session(p_slug, p_distributor_code, p_session_token) r;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired distributor session';
  END IF;

  UPDATE public.distributors d
  SET
    pos_settings = coalesce(p_settings, '{}'::jsonb),
    updated_at = NOW()
  WHERE d.organization_id = v_org_id
    AND upper(trim(d.code)) = upper(trim(v_code))
  RETURNING d.* INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Distributor not found';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_distributor_pos_settings(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- ------------------------------------------------------------
-- Update physical stock after POS sale (distributor session)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_distributor_physical_stock(TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.update_distributor_physical_stock(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT,
  p_physical_stock JSONB
)
RETURNS public.distributors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_code TEXT;
  v_row public.distributors;
BEGIN
  SELECT r.organization_id, r.distributor_code
  INTO v_org_id, v_code
  FROM public._resolve_distributor_session(p_slug, p_distributor_code, p_session_token) r;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired distributor session';
  END IF;

  UPDATE public.distributors d
  SET
    physical_stock = coalesce(p_physical_stock, '{}'::jsonb),
    updated_at = NOW()
  WHERE d.organization_id = v_org_id
    AND upper(trim(d.code)) = upper(trim(v_code))
  RETURNING d.* INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Distributor not found';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_distributor_physical_stock(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- ------------------------------------------------------------
-- Delete POS sale (distributor session)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_distributor_pos_sale(TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.delete_distributor_pos_sale(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT,
  p_sale_id UUID
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

  DELETE FROM public.distributor_pos_sales s
  WHERE s.id = p_sale_id
    AND s.organization_id = v_org_id
    AND upper(trim(s.distributor_code)) = upper(trim(v_code));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_distributor_pos_sale(TEXT, TEXT, TEXT, UUID) TO anon, authenticated;
