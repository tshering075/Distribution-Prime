-- Optional: persist invoice numbers separately from order numbers
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders (invoice_number)
  WHERE invoice_number IS NOT NULL AND invoice_number <> '';
