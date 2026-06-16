-- Platform-wide Gmail API credentials (all workspaces).
-- Run AFTER platform_admin.sql and fix_app_config_tenant_pkey.sql.

DROP FUNCTION IF EXISTS public.platform_get_gmail_credentials();
DROP FUNCTION IF EXISTS public.platform_save_gmail_credentials(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.platform_get_gmail_credentials()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.app_config%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform access required' USING ERRCODE = '42501';
  END IF;

  SELECT ac.*
  INTO v_row
  FROM public.app_config ac
  WHERE ac.id = 'gmail_credentials'
    AND (
      COALESCE(btrim(ac."clientId"::text), '') <> ''
      OR COALESCE(btrim(ac."apiKey"::text), '') <> ''
      OR COALESCE(btrim(ac.gmail_client_id::text), '') <> ''
      OR COALESCE(btrim(ac.gmail_api_key::text), '') <> ''
    )
  ORDER BY ac.updated_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('clientId', NULL, 'apiKey', NULL, 'configured', false);
  END IF;

  RETURN jsonb_build_object(
    'clientId', COALESCE(NULLIF(btrim(v_row."clientId"::text), ''), NULLIF(btrim(v_row.gmail_client_id::text), '')),
    'apiKey', COALESCE(NULLIF(btrim(v_row."apiKey"::text), ''), NULLIF(btrim(v_row.gmail_api_key::text), '')),
    'configured', true,
    'updatedAt', v_row.updated_at,
    'updatedBy', v_row.updated_by
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_save_gmail_credentials(
  p_client_id TEXT,
  p_api_key TEXT,
  p_updated_by TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org RECORD;
  v_count INTEGER := 0;
  v_client TEXT;
  v_key TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform access required' USING ERRCODE = '42501';
  END IF;

  v_client := btrim(COALESCE(p_client_id, ''));
  v_key := btrim(COALESCE(p_api_key, ''));

  IF v_client = '' OR v_key = '' THEN
    RAISE EXCEPTION 'Client ID and API Key are required' USING ERRCODE = '22023';
  END IF;

  FOR v_org IN SELECT o.id FROM public.organizations o
  LOOP
    INSERT INTO public.app_config (
      organization_id,
      id,
      "clientId",
      "apiKey",
      updated_at,
      updated_by
    )
    VALUES (
      v_org.id,
      'gmail_credentials',
      v_client,
      v_key,
      now(),
      NULLIF(btrim(COALESCE(p_updated_by, '')), '')
    )
    ON CONFLICT (organization_id, id) DO UPDATE SET
      "clientId" = EXCLUDED."clientId",
      "apiKey" = EXCLUDED."apiKey",
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Copy platform Gmail credentials into a workspace (new signups / missing rows).
CREATE OR REPLACE FUNCTION public.provision_gmail_credentials_for_organization(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.app_config%ROWTYPE;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.app_config ac
    WHERE ac.organization_id = p_org_id
      AND ac.id = 'gmail_credentials'
      AND COALESCE(btrim(ac."clientId"::text), '') <> ''
      AND COALESCE(btrim(ac."apiKey"::text), '') <> ''
  ) THEN
    RETURN TRUE;
  END IF;

  SELECT ac.*
  INTO v_row
  FROM public.app_config ac
  WHERE ac.id = 'gmail_credentials'
    AND ac.organization_id IS DISTINCT FROM p_org_id
    AND COALESCE(btrim(ac."clientId"::text), '') <> ''
    AND COALESCE(btrim(ac."apiKey"::text), '') <> ''
  ORDER BY ac.updated_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.app_config (
    organization_id,
    id,
    "clientId",
    "apiKey",
    updated_at,
    updated_by
  )
  VALUES (
    p_org_id,
    'gmail_credentials',
    v_row."clientId",
    v_row."apiKey",
    now(),
    v_row.updated_by
  )
  ON CONFLICT (organization_id, id) DO UPDATE SET
    "clientId" = EXCLUDED."clientId",
    "apiKey" = EXCLUDED."apiKey",
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_organizations_provision_gmail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.provision_gmail_credentials_for_organization(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_provision_gmail ON public.organizations;

CREATE TRIGGER organizations_provision_gmail
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_organizations_provision_gmail();

GRANT EXECUTE ON FUNCTION public.provision_gmail_credentials_for_organization(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.platform_get_gmail_credentials() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_save_gmail_credentials(TEXT, TEXT, TEXT) TO authenticated;

SELECT 'Platform Gmail credentials RPCs ready.' AS status;
