-- Distributor session: read own stock lifting rows from sales_data (anon cannot SELECT table directly).
-- Run in Supabase SQL Editor after distributor_orders_rpc.sql and TENANT_RLS_STRICT.sql.

DROP FUNCTION IF EXISTS public.get_distributor_stock_lifting_records(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_distributor_stock_lifting_records(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF public.sales_data
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
  SELECT sd.*
  FROM public.sales_data sd
  WHERE sd.organization_id = v_org_id
    AND upper(trim(coalesce(sd."distributorCode", sd.distributor_code, ''))) IN (
      upper(trim(v_code)),
      upper(trim(p_distributor_code))
    )
    AND (
      p_start_date IS NULL
      OR coalesce(sd."invoiceDate", sd.invoice_date) >= p_start_date
    )
    AND (
      p_end_date IS NULL
      OR coalesce(sd."invoiceDate", sd.invoice_date) <= p_end_date
    )
  ORDER BY coalesce(sd."invoiceDate", sd.invoice_date) DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distributor_stock_lifting_records(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ)
  TO anon, authenticated;
