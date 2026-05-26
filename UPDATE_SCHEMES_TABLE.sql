-- Update Schemes Table to include all required fields
-- Run this in Supabase SQL Editor

-- Add missing columns to existing schemes table
ALTER TABLE schemes 
ADD COLUMN IF NOT EXISTS schemeDescription TEXT,
ADD COLUMN IF NOT EXISTS appliesTo TEXT,
ADD COLUMN IF NOT EXISTS discountAmount NUMERIC;

-- Complete updated schema (for reference or if recreating the table)
-- If you need to recreate the table, use this complete schema:

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
  appliesTo TEXT,                                    -- ✅ ADD THIS: "csd", "water", or "both"
  buyQuantity NUMERIC,
  freeQuantity NUMERIC,
  discountAmount NUMERIC,                             -- ✅ ADD THIS: Discount per case (used by app)
  discountPerCase NUMERIC,                            -- Keep for backward compatibility
  schemeDescription TEXT,                             -- ✅ ADD THIS: Human-readable description
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_schemes_dates ON schemes(startDate, endDate);
*/
