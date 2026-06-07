-- Optional orders columns for shipping dispatch (transport + timestamps).
-- Run in Supabase SQL Editor if dispatch fails with missing-column errors.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS transporter_vehicle TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vehicle_no TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transportation_charges NUMERIC DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS achievement_applied BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS achievement_applied_at TIMESTAMPTZ;

-- Shipping invoice attachment (if not already present)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_invoice_data TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_invoice_file_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_invoice_mime_type TEXT;

SELECT 'add_shipping_order_columns applied' AS status;
