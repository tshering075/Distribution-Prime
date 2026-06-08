-- Distributor login passwords (JSONB: username, passwordHash, optional password for migration)
-- Required for authenticate_distributor RPC. Run after TENANT_RLS_STRICT.sql.

ALTER TABLE public.distributors
  ADD COLUMN IF NOT EXISTS credentials JSONB;

ALTER TABLE public.distributors
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.distributors.credentials IS
  'Login credentials: { "username": "...", "passwordHash": "..." } — hash matches distributor_client_password_hash()';

COMMENT ON COLUMN public.distributors.phone IS 'Contact phone (optional)';
