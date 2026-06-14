-- Dispatch primary-sale credit + read-only workspace inventory by slug (distributor calculator).
-- Run after: add_physical_stock_column.sql, add_workspace_inventory.sql, TENANT_RLS_STRICT.sql

-- ------------------------------------------------------------
-- Credit distributor physical_stock.primarySale when shipping dispatches
-- (org member / shipping staff — bypasses RLS edge cases on distributors)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.credit_distributor_primary_sale_on_dispatch(UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.credit_distributor_primary_sale_on_dispatch(
  p_org_id UUID,
  p_distributor_code TEXT,
  p_physical_stock JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.distributors%ROWTYPE;
BEGIN
  IF p_org_id IS NULL OR btrim(coalesce(p_distributor_code, '')) = '' THEN
    RAISE EXCEPTION 'Organization id and distributor code are required';
  END IF;

  IF NOT (public.is_org_member(p_org_id::text) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Not allowed to update distributor physical stock';
  END IF;

  UPDATE public.distributors d
  SET
    physical_stock = COALESCE(p_physical_stock, '{}'::jsonb),
    updated_at = NOW()
  WHERE d.organization_id = p_org_id
    AND upper(trim(d.code)) = upper(trim(p_distributor_code))
  RETURNING d.* INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Distributor % not found in workspace', trim(p_distributor_code);
  END IF;

  RETURN COALESCE(v_row.physical_stock, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_distributor_primary_sale_on_dispatch(UUID, TEXT, JSONB) TO authenticated;

-- ------------------------------------------------------------
-- Read workspace inventory by slug (distributors placing orders — read-only)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_workspace_inventory_by_slug(TEXT);

CREATE OR REPLACE FUNCTION public.get_workspace_inventory_by_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_updated_at TIMESTAMPTZ;
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

  SELECT MAX(l.updated_at)
  INTO v_updated_at
  FROM public.workspace_inventory_lots l
  WHERE l.organization_id = v_org_id;

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
      WHERE l.organization_id = v_org_id
        AND l.quantity > 0
    ),
    'updatedAt', CASE WHEN v_updated_at IS NOT NULL
      THEN to_char(v_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ELSE NULL END,
    'updatedBy', ''
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_inventory_by_slug(TEXT) TO anon, authenticated;

SELECT 'dispatch primary sale + inventory-by-slug RPCs applied.' AS status;
