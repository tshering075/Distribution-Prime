-- Add optional tax fields for distributor master (GSTIN + TPN).
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.

ALTER TABLE distributors ADD COLUMN IF NOT EXISTS gstin text;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS tpn text;

COMMENT ON COLUMN distributors.gstin IS 'GST identification number (optional)';
COMMENT ON COLUMN distributors.tpn IS 'Tax payer number — shown on shipping invoices (optional)';
