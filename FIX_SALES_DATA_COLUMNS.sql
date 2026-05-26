-- Fix Sales Data Table - Add Missing Columns
-- Run this in Supabase SQL Editor
-- IMPORTANT: Use quoted identifiers to preserve camelCase for Supabase PostgREST

-- First, check what columns currently exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales_data' 
ORDER BY ordinal_position;

-- Add missing columns with quoted identifiers to preserve camelCase
-- Supabase PostgREST expects exact case matching
ALTER TABLE sales_data 
ADD COLUMN IF NOT EXISTS "distributorCode" TEXT,
ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "csdPC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "csdUC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "waterPC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "waterUC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "totalUC" NUMERIC DEFAULT 0;

-- Add indexes (use quoted identifiers for camelCase columns)
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data("distributorCode");
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_name ON sales_data("distributorName");
CREATE INDEX IF NOT EXISTS idx_sales_data_date ON sales_data("invoiceDate" DESC);
CREATE INDEX IF NOT EXISTS idx_sales_data_source ON sales_data(source);
CREATE INDEX IF NOT EXISTS idx_sales_data_sku ON sales_data(sku);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales_data' 
ORDER BY ordinal_position;
