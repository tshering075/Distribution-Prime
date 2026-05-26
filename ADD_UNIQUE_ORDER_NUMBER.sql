-- Optional: enforce unique order numbers in the database (run in Supabase SQL Editor).
-- The app also checks uniqueness before insert; this prevents duplicates from other clients.

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_unique
  ON orders ("orderNumber")
  WHERE "orderNumber" IS NOT NULL AND trim("orderNumber") <> '';
