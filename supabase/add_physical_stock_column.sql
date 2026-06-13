-- Current physical stock JSON on each distributor (latest save).
-- Run before: add_distributor_physical_stock_snapshots.sql

ALTER TABLE public.distributors
  ADD COLUMN IF NOT EXISTS physical_stock JSONB DEFAULT NULL;

COMMENT ON COLUMN public.distributors.physical_stock IS
  'Latest physical stock payload: { reportDate, rows[], updatedAt } with FIFO lots per SKU.';
