-- Quick Fix for Sales Data Table - Run this first
-- This handles the case where columns might exist as lowercase

-- Step 1: Add columns as lowercase (PostgreSQL default)
ALTER TABLE sales_data 
ADD COLUMN IF NOT EXISTS distributorcode TEXT,
ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS csdpc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS csduc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS waterpc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS wateruc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS totaluc NUMERIC DEFAULT 0;

-- Step 2: Rename to camelCase (if they exist as lowercase)
ALTER TABLE sales_data RENAME COLUMN distributorcode TO "distributorCode";
ALTER TABLE sales_data RENAME COLUMN csdpc TO "csdPC";
ALTER TABLE sales_data RENAME COLUMN csduc TO "csdUC";
ALTER TABLE sales_data RENAME COLUMN waterpc TO "waterPC";
ALTER TABLE sales_data RENAME COLUMN wateruc TO "waterUC";
ALTER TABLE sales_data RENAME COLUMN totaluc TO "totalUC";

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data("distributorCode");

-- Note: If you get "column does not exist" errors on the RENAME statements,
-- it means the columns don't exist yet. In that case, create them directly:
-- ALTER TABLE sales_data 
-- ADD COLUMN "distributorCode" TEXT,
-- ADD COLUMN "csdPC" NUMERIC DEFAULT 0,
-- ADD COLUMN "csdUC" NUMERIC DEFAULT 0,
-- ADD COLUMN "waterPC" NUMERIC DEFAULT 0,
-- ADD COLUMN "waterUC" NUMERIC DEFAULT 0,
-- ADD COLUMN "totalUC" NUMERIC DEFAULT 0;
