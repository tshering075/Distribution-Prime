-- Historical physical stock — one row per distributor per report date.
-- Required for: admin Excel export by date range, distributor carry-forward by report date.
-- Run after: TENANT_RLS_STRICT.sql, add_physical_stock_column.sql, distributor_orders_rpc.sql

CREATE TABLE IF NOT EXISTS public.distributor_physical_stock_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  distributor_code TEXT NOT NULL,
  report_date DATE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS distributor_physical_stock_snapshots_org_dist_date_unique
  ON public.distributor_physical_stock_snapshots (organization_id, distributor_code, report_date);

CREATE INDEX IF NOT EXISTS distributor_physical_stock_snapshots_org_date_idx
  ON public.distributor_physical_stock_snapshots (organization_id, report_date DESC);

CREATE INDEX IF NOT EXISTS distributor_physical_stock_snapshots_org_dist_saved_idx
  ON public.distributor_physical_stock_snapshots (organization_id, distributor_code, saved_at DESC);

ALTER TABLE public.distributor_physical_stock_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_tenant_enable_rls'
  ) THEN
    PERFORM public._tenant_enable_rls('public.distributor_physical_stock_snapshots'::REGCLASS);
  ELSE
    DROP POLICY IF EXISTS tenant_select ON public.distributor_physical_stock_snapshots;
    CREATE POLICY tenant_select ON public.distributor_physical_stock_snapshots
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id::text) OR public.is_platform_admin());

    DROP POLICY IF EXISTS tenant_insert ON public.distributor_physical_stock_snapshots;
    CREATE POLICY tenant_insert ON public.distributor_physical_stock_snapshots
      FOR INSERT TO authenticated
      WITH CHECK (public.is_org_member(organization_id::text) OR public.is_platform_admin());

    DROP POLICY IF EXISTS tenant_update ON public.distributor_physical_stock_snapshots;
    CREATE POLICY tenant_update ON public.distributor_physical_stock_snapshots
      FOR UPDATE TO authenticated
      USING (public.is_org_member(organization_id::text) OR public.is_platform_admin())
      WITH CHECK (public.is_org_member(organization_id::text) OR public.is_platform_admin());

    DROP POLICY IF EXISTS tenant_delete ON public.distributor_physical_stock_snapshots;
    CREATE POLICY tenant_delete ON public.distributor_physical_stock_snapshots
      FOR DELETE TO authenticated
      USING (public.is_org_admin(organization_id::text) OR public.is_platform_admin());
  END IF;
END $$;

REVOKE ALL ON TABLE public.distributor_physical_stock_snapshots FROM anon;

-- ------------------------------------------------------------
-- Upsert snapshot (distributor session — anon + session token)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_distributor_physical_stock_snapshot(TEXT, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.upsert_distributor_physical_stock_snapshot(
  p_slug TEXT,
  p_distributor_code TEXT,
  p_session_token TEXT,
  p_report_date TEXT,
  p_payload JSONB
)
RETURNS public.distributor_physical_stock_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_code TEXT;
  v_report_date DATE;
  v_row public.distributor_physical_stock_snapshots;
  v_payload JSONB;
BEGIN
  SELECT r.organization_id, r.distributor_code
  INTO v_org_id, v_code
  FROM public._resolve_distributor_session(p_slug, p_distributor_code, p_session_token) r;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired distributor session';
  END IF;

  v_report_date := coalesce(
    nullif(trim(p_report_date), '')::date,
    (p_payload->>'reportDate')::date,
    CURRENT_DATE
  );

  v_payload := jsonb_build_object(
    'reportDate', to_char(v_report_date, 'YYYY-MM-DD'),
    'rows', coalesce(p_payload->'rows', '[]'::jsonb),
    'updatedAt', coalesce(nullif(trim(p_payload->>'updatedAt'), ''), to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  );

  INSERT INTO public.distributor_physical_stock_snapshots (
    organization_id,
    distributor_code,
    report_date,
    payload,
    saved_at
  )
  VALUES (
    v_org_id,
    upper(trim(v_code)),
    v_report_date,
    v_payload,
    NOW()
  )
  ON CONFLICT (organization_id, distributor_code, report_date)
  DO UPDATE SET
    payload = EXCLUDED.payload,
    saved_at = EXCLUDED.saved_at
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_distributor_physical_stock_snapshot(TEXT, TEXT, TEXT, TEXT, JSONB)
  TO anon, authenticated;
