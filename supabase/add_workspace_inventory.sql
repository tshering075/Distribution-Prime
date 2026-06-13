-- ============================================================
-- Workspace inventory lots (company stock for shipping dispatch)
-- Run after: TENANT_RLS_STRICT.sql, fix_app_config_tenant_pkey.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspace_inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'CSD',
  mfg_date DATE,
  batch_no TEXT NOT NULL DEFAULT '',
  bbd_date DATE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_inventory_lots_org_sku_idx
  ON public.workspace_inventory_lots (organization_id, sku);

CREATE INDEX IF NOT EXISTS workspace_inventory_lots_org_updated_idx
  ON public.workspace_inventory_lots (organization_id, updated_at DESC);

ALTER TABLE public.workspace_inventory_lots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_tenant_enable_rls'
  ) THEN
    PERFORM public._tenant_enable_rls('public.workspace_inventory_lots'::REGCLASS);
  ELSE
    DROP POLICY IF EXISTS tenant_select ON public.workspace_inventory_lots;
    CREATE POLICY tenant_select ON public.workspace_inventory_lots
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id::text) OR public.is_platform_admin());

    DROP POLICY IF EXISTS tenant_insert ON public.workspace_inventory_lots;
    CREATE POLICY tenant_insert ON public.workspace_inventory_lots
      FOR INSERT TO authenticated
      WITH CHECK (public.is_org_admin(organization_id::text) OR public.is_platform_admin());

    DROP POLICY IF EXISTS tenant_update ON public.workspace_inventory_lots;
    CREATE POLICY tenant_update ON public.workspace_inventory_lots
      FOR UPDATE TO authenticated
      USING (public.is_org_admin(organization_id::text) OR public.is_platform_admin())
      WITH CHECK (public.is_org_admin(organization_id::text) OR public.is_platform_admin());

    DROP POLICY IF EXISTS tenant_delete ON public.workspace_inventory_lots;
    CREATE POLICY tenant_delete ON public.workspace_inventory_lots
      FOR DELETE TO authenticated
      USING (public.is_org_admin(organization_id::text) OR public.is_platform_admin());
  END IF;
END $$;

REVOKE ALL ON TABLE public.workspace_inventory_lots FROM anon;

-- ------------------------------------------------------------
-- Replace all inventory lots for the active workspace (admin save)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_workspace_inventory(UUID, JSONB);
DROP FUNCTION IF EXISTS public.save_workspace_inventory(JSONB);

CREATE OR REPLACE FUNCTION public.save_workspace_inventory(p_org_id UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_row JSONB;
  v_updated_at TIMESTAMPTZ := NOW();
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Workspace id is required';
  END IF;

  IF NOT (public.is_org_admin(p_org_id::text) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Only workspace admins can save inventory';
  END IF;

  v_rows := COALESCE(p_payload->'rows', '[]'::jsonb);
  IF jsonb_typeof(v_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid inventory payload';
  END IF;

  DELETE FROM public.workspace_inventory_lots
  WHERE organization_id = p_org_id;

  FOR v_row IN SELECT value FROM jsonb_array_elements(v_rows)
  LOOP
    INSERT INTO public.workspace_inventory_lots (
      organization_id,
      product_name,
      sku,
      category,
      mfg_date,
      batch_no,
      bbd_date,
      quantity,
      updated_at
    )
    VALUES (
      p_org_id,
      COALESCE(NULLIF(btrim(v_row->>'productName'), ''), NULLIF(btrim(v_row->>'product_name'), ''), ''),
      COALESCE(NULLIF(btrim(v_row->>'sku'), ''), ''),
      COALESCE(NULLIF(btrim(v_row->>'category'), ''), 'CSD'),
      NULLIF(btrim(v_row->>'mfgDate'), '')::date,
      COALESCE(NULLIF(btrim(v_row->>'batchNo'), ''), NULLIF(btrim(v_row->>'batch_no'), ''), ''),
      NULLIF(btrim(COALESCE(v_row->>'bbdDate', v_row->>'bbd_date')), '')::date,
      GREATEST(0, COALESCE((v_row->>'quantity')::int, 0)),
      v_updated_at
    );
  END LOOP;

  RETURN public.get_workspace_inventory(p_org_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_workspace_inventory(UUID, JSONB) TO authenticated;

-- ------------------------------------------------------------
-- List inventory lots for a workspace
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_workspace_inventory(UUID);
DROP FUNCTION IF EXISTS public.get_workspace_inventory();

CREATE OR REPLACE FUNCTION public.get_workspace_inventory(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_at TIMESTAMPTZ;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT (public.is_org_member(p_org_id::text) OR public.is_platform_admin()) THEN
    RETURN NULL;
  END IF;

  SELECT MAX(l.updated_at)
  INTO v_updated_at
  FROM public.workspace_inventory_lots l
  WHERE l.organization_id = p_org_id;

  RETURN jsonb_build_object(
    'rows', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'productName', l.product_name,
          'sku', l.sku,
          'category', l.category,
          'mfgDate', l.mfg_date,
          'batchNo', l.batch_no,
          'bbdDate', l.bbd_date,
          'quantity', l.quantity
        )
        ORDER BY l.sku, l.mfg_date NULLS LAST, l.batch_no
      ), '[]'::jsonb)
      FROM public.workspace_inventory_lots l
      WHERE l.organization_id = p_org_id
    ),
    'updatedAt', CASE WHEN v_updated_at IS NOT NULL
      THEN to_char(v_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ELSE NULL END,
    'updatedBy', ''
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_inventory(UUID) TO authenticated;

-- ------------------------------------------------------------
-- Deduct inventory when shipping marks an order dispatched
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.deduct_workspace_inventory_for_dispatch(UUID, JSONB);
DROP FUNCTION IF EXISTS public.deduct_workspace_inventory_for_dispatch(JSONB);

CREATE OR REPLACE FUNCTION public.deduct_workspace_inventory_for_dispatch(p_org_id UUID, p_lines JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line JSONB;
  v_sku TEXT;
  v_mfg DATE;
  v_batch TEXT;
  v_bbd DATE;
  v_cases INT;
  v_remaining INT;
  v_lot public.workspace_inventory_lots%ROWTYPE;
  v_shortages JSONB := '[]'::jsonb;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Workspace id is required';
  END IF;

  IF NOT (public.is_org_member(p_org_id::text) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Not allowed to update inventory';
  END IF;

  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('shortages', '[]'::jsonb);
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_sku := btrim(COALESCE(v_line->>'sku', ''));
    v_cases := GREATEST(0, COALESCE((v_line->>'cases')::int, (v_line->>'quantity')::int, 0));
    IF v_sku = '' OR v_cases <= 0 THEN
      CONTINUE;
    END IF;

    v_mfg := NULLIF(btrim(COALESCE(v_line->>'mfgDate', v_line->>'mfg_date')), '')::date;
    v_batch := btrim(COALESCE(v_line->>'batchNo', v_line->>'batch_no', ''));
    v_bbd := NULLIF(btrim(COALESCE(v_line->>'bbdDate', v_line->>'bbd_date')), '')::date;
    v_remaining := v_cases;

    FOR v_lot IN
      SELECT *
      FROM public.workspace_inventory_lots l
      WHERE l.organization_id = p_org_id
        AND upper(l.sku) = upper(v_sku)
        AND l.quantity > 0
        AND (v_mfg IS NULL OR l.mfg_date IS NOT DISTINCT FROM v_mfg)
        AND (v_batch = '' OR l.batch_no = v_batch)
        AND (v_bbd IS NULL OR l.bbd_date IS NOT DISTINCT FROM v_bbd)
      ORDER BY l.mfg_date NULLS LAST, l.created_at
    LOOP
      EXIT WHEN v_remaining <= 0;
      IF v_lot.quantity <= 0 THEN
        CONTINUE;
      END IF;

      IF v_lot.quantity >= v_remaining THEN
        UPDATE public.workspace_inventory_lots
        SET quantity = quantity - v_remaining, updated_at = NOW()
        WHERE id = v_lot.id;
        v_remaining := 0;
      ELSE
        UPDATE public.workspace_inventory_lots
        SET quantity = 0, updated_at = NOW()
        WHERE id = v_lot.id;
        v_remaining := v_remaining - v_lot.quantity;
      END IF;
    END LOOP;

    IF v_remaining > 0 THEN
      v_shortages := v_shortages || jsonb_build_array(
        jsonb_build_object('sku', v_sku, 'short', v_remaining)
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('shortages', v_shortages);
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_workspace_inventory_for_dispatch(UUID, JSONB) TO authenticated;

SELECT 'workspace_inventory_lots table and RPCs applied.' AS status;
