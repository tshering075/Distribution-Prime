-- Per-distributor POS selling rates, default discount, and GST toggle.
ALTER TABLE distributors
  ADD COLUMN IF NOT EXISTS pos_settings JSONB DEFAULT NULL;

COMMENT ON COLUMN distributors.pos_settings IS
  'POS config: { rates: { SKU: number }, discountType, discountValue, gstEnabled, updatedAt }';
