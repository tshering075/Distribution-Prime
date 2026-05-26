-- Complete Schemes Table Schema
-- Run this in Supabase SQL Editor to ensure all required columns exist

-- Add missing columns to existing schemes table (if table already exists)
ALTER TABLE schemes 
ADD COLUMN IF NOT EXISTS schemeDescription TEXT,
ADD COLUMN IF NOT EXISTS appliesTo TEXT,
ADD COLUMN IF NOT EXISTS discountAmount NUMERIC,
ADD COLUMN IF NOT EXISTS discountPerCase NUMERIC;

-- Complete schema (for reference or if recreating the table)
-- If you need to recreate the table, uncomment and run this:

/*
DROP TABLE IF EXISTS schemes CASCADE;

CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  distributors TEXT[] DEFAULT '{}',
  appliesToSKUs TEXT[] DEFAULT '{}',
  appliesTo TEXT,                                    -- "csd", "water", or "both"
  buyQuantity NUMERIC,                               -- For CSD schemes: buy quantity
  freeQuantity NUMERIC,                              -- For CSD schemes: free quantity
  discountAmount NUMERIC,                            -- Discount per case (used by app)
  discountPerCase NUMERIC,                           -- Keep for backward compatibility
  schemeDescription TEXT,                            -- Human-readable description
  category TEXT,                                     -- Category (optional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT                                    -- Email or ID of user who updated
);

CREATE INDEX IF NOT EXISTS idx_schemes_dates ON schemes(startDate, endDate);
CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);
*/

-- Verify the schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'schemes'
ORDER BY ordinal_position;
