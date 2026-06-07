-- ============================================================
-- app_config — per-workspace keys (fixes app_config_pkey duplicate)
-- Symptom: Rate Master save fails with
--   duplicate key value violates unique constraint "app_config_pkey"
-- Safe to re-run.
-- ============================================================

-- 1) Tenant column
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 2) Optional catalogue columns (Rate Master RPC read/write)
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS products JSONB;
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS settings JSONB;

-- 3) Backfill NULL organization_id onto the default / first workspace
DO $$
DECLARE
  v_default UUID;
BEGIN
  SELECT id INTO v_default
  FROM public.organizations
  WHERE slug = 'default'
  LIMIT 1;

  IF v_default IS NULL THEN
    SELECT id INTO v_default
    FROM public.organizations
    ORDER BY created_at NULLS LAST
    LIMIT 1;
  END IF;

  IF v_default IS NOT NULL THEN
    UPDATE public.app_config
    SET organization_id = v_default
    WHERE organization_id IS NULL;
  END IF;
END $$;

-- 4) Drop legacy primary key on id alone (allows one row per workspace)
ALTER TABLE public.app_config DROP CONSTRAINT IF EXISTS app_config_pkey;

-- 5) Composite primary key — one config id per workspace
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_config_pkey'
      AND conrelid = 'public.app_config'::regclass
  ) THEN
    ALTER TABLE public.app_config
      ADD CONSTRAINT app_config_pkey PRIMARY KEY (organization_id, id);
  END IF;
END $$;

-- 6) Keep named unique index in sync (linter / docs)
CREATE UNIQUE INDEX IF NOT EXISTS app_config_org_id_unique
  ON public.app_config (organization_id, id);

SELECT 'app_config tenant primary key applied.' AS status;
