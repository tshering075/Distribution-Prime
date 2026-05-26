-- Phase 2 migration for resilient order approval workflow
-- Safe to run multiple times.

-- 1) Ensure status column exists
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 2) Add audit + reminder/escalation columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS approval_source TEXT,
ADD COLUMN IF NOT EXISTS approval_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approval_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 3) Normalize existing values
UPDATE orders
SET status = LOWER(TRIM(status))
WHERE status IS NOT NULL;

UPDATE orders
SET status = 'pending'
WHERE status IS NULL OR TRIM(status) = '';

UPDATE orders
SET status_updated_at = COALESCE(status_updated_at, updated_at, created_at, NOW())
WHERE status_updated_at IS NULL;

UPDATE orders
SET status_history = '[]'::jsonb
WHERE status_history IS NULL;

UPDATE orders
SET reminder_count = COALESCE(reminder_count, 0)
WHERE reminder_count IS NULL;

UPDATE orders
SET escalation_level = COALESCE(escalation_level, 0)
WHERE escalation_level IS NULL;

-- 4) Keep only workflow-supported statuses
UPDATE orders
SET status = 'pending'
WHERE status NOT IN (
  'pending',
  'sent',
  'approved',
  'rejected',
  'canceled',
  'pending_email_failed'
);

-- 5) Enforce status enum-like constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_status_allowed_check'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_status_allowed_check
    CHECK (
      status IN (
        'pending',
        'sent',
        'approved',
        'rejected',
        'canceled',
        'pending_email_failed'
      )
    );
  END IF;
END $$;

-- 6) Add useful indexes for reminders/escalation jobs
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_approval_due_at ON orders(approval_due_at);
CREATE INDEX IF NOT EXISTS idx_orders_sent_due_lookup ON orders(status, approval_due_at);

COMMENT ON COLUMN orders.status IS 'pending | sent | approved | rejected | canceled | pending_email_failed';
COMMENT ON COLUMN orders.status_history IS 'JSON audit trail for status transitions';
COMMENT ON COLUMN orders.approval_due_at IS 'When approval SLA expires';
COMMENT ON COLUMN orders.reminder_count IS 'Number of reminders sent for this order';
COMMENT ON COLUMN orders.escalation_level IS 'Escalation stage for overdue approval';
