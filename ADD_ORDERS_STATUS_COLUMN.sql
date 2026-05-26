-- Run once in Supabase SQL Editor if distributors never see approve/reject from the database.
-- Without this column, PostgREST drops `status` from UPDATE payloads and only `updated_at` changes.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

COMMENT ON COLUMN orders.status IS 'pending | sent | approved | rejected | canceled | pending_email_failed';

-- For full workflow hardening (audit history, reminder/escalation columns, status constraint),
-- also run: PHASE2_ORDERS_WORKFLOW_MIGRATION.sql
