-- Per-report-date physical stock history (one row per distributor + report_date).
-- Run in Supabase SQL Editor after distributors.physical_stock exists.
-- Re-saving the same report date overwrites that row (corrections).

CREATE TABLE IF NOT EXISTS distributor_physical_stock_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_code TEXT NOT NULL,
  report_date DATE NOT NULL,
  payload JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT distributor_physical_stock_snapshots_dist_date_key
    UNIQUE (distributor_code, report_date)
);

CREATE INDEX IF NOT EXISTS idx_physical_stock_snapshots_report_date
  ON distributor_physical_stock_snapshots (report_date DESC);

CREATE INDEX IF NOT EXISTS idx_physical_stock_snapshots_dist_code
  ON distributor_physical_stock_snapshots (distributor_code);

COMMENT ON TABLE distributor_physical_stock_snapshots IS
  'Daily physical stock payloads from distributors; keyed by business report_date.';

-- Align RLS with your project (see FIX_DISTRIBUTORS_RLS.sql). If distributors use the anon key
-- without Supabase Auth, use permissive policies or DISABLE ROW LEVEL SECURITY on this table.
