-- Shipping workflow: invoice columns + delivered/dispatched status
-- Run in Supabase SQL Editor (safe to re-run)

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_allowed_check;

ALTER TABLE orders
ADD CONSTRAINT orders_status_allowed_check
CHECK (
  status IN (
    'pending',
    'sent',
    'approved',
    'dispatched',
    'delivered',
    'rejected',
    'canceled',
    'pending_email_failed'
  )
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_invoice_data TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_invoice_file_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_invoice_mime_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Optional: unify legacy rows (skip if you prefer keeping "dispatched" in DB)
-- UPDATE orders SET status = 'delivered' WHERE status = 'dispatched';

UPDATE orders
SET delivered_at = dispatched_at
WHERE delivered_at IS NULL AND dispatched_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
