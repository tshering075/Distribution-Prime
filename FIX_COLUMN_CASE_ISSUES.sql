-- Fix Column Case Issues - Diagnostic and Fix Script
-- Run this in Supabase SQL Editor step by step

-- ============================================================
-- STEP 1: Check what columns actually exist
-- ============================================================
SELECT 'sales_data columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales_data' 
ORDER BY ordinal_position;

SELECT 'orders columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;

SELECT 'targets columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'targets' 
ORDER BY ordinal_position;

SELECT 'schemes columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'schemes' 
ORDER BY ordinal_position;

-- ============================================================
-- STEP 2: Fix Sales Data Table
-- ============================================================
-- Try to add columns - if they exist as lowercase, this will fail
-- In that case, we'll rename them in STEP 3

-- Add missing columns (will create as lowercase if unquoted)
ALTER TABLE sales_data 
ADD COLUMN IF NOT EXISTS distributorcode TEXT,
ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS csdpc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS csduc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS waterpc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS wateruc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS totaluc NUMERIC DEFAULT 0;

-- Now rename to camelCase with quoted identifiers
-- This will work even if columns already exist
DO $$ 
BEGIN
    -- Rename distributorcode to "distributorCode" if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'distributorcode') THEN
        ALTER TABLE sales_data RENAME COLUMN distributorcode TO "distributorCode";
    END IF;
    
    -- Rename csdpc to "csdPC" if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'csdpc') THEN
        ALTER TABLE sales_data RENAME COLUMN csdpc TO "csdPC";
    END IF;
    
    -- Rename csduc to "csdUC" if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'csduc') THEN
        ALTER TABLE sales_data RENAME COLUMN csduc TO "csdUC";
    END IF;
    
    -- Rename waterpc to "waterPC" if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'waterpc') THEN
        ALTER TABLE sales_data RENAME COLUMN waterpc TO "waterPC";
    END IF;
    
    -- Rename wateruc to "waterUC" if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'wateruc') THEN
        ALTER TABLE sales_data RENAME COLUMN wateruc TO "waterUC";
    END IF;
    
    -- Rename totaluc to "totalUC" if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'totaluc') THEN
        ALTER TABLE sales_data RENAME COLUMN totaluc TO "totalUC";
    END IF;
END $$;

-- If columns don't exist yet, create them with quoted identifiers
ALTER TABLE sales_data 
ADD COLUMN IF NOT EXISTS "distributorCode" TEXT,
ADD COLUMN IF NOT EXISTS "csdPC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "csdUC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "waterPC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "waterUC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "totalUC" NUMERIC DEFAULT 0;

-- ============================================================
-- STEP 3: Fix Orders Table
-- ============================================================
DO $$ 
BEGIN
    -- Rename orders columns if they exist as lowercase
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'distributorcode') THEN
        ALTER TABLE orders RENAME COLUMN distributorcode TO "distributorCode";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'distributorname') THEN
        ALTER TABLE orders RENAME COLUMN distributorname TO "distributorName";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'totaluc') THEN
        ALTER TABLE orders RENAME COLUMN totaluc TO "totalUC";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'csduc') THEN
        ALTER TABLE orders RENAME COLUMN csduc TO "csdUC";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'wateruc') THEN
        ALTER TABLE orders RENAME COLUMN wateruc TO "waterUC";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'csdpc') THEN
        ALTER TABLE orders RENAME COLUMN csdpc TO "csdPC";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'waterpc') THEN
        ALTER TABLE orders RENAME COLUMN waterpc TO "waterPC";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'ordernumber') THEN
        ALTER TABLE orders RENAME COLUMN ordernumber TO "orderNumber";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'tableimagedata') THEN
        ALTER TABLE orders RENAME COLUMN tableimagedata TO "tableImageData";
    END IF;
END $$;

-- ============================================================
-- STEP 4: Fix Targets Table
-- ============================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'targets' AND column_name = 'distributorcode') THEN
        ALTER TABLE targets RENAME COLUMN distributorcode TO "distributorCode";
    END IF;
END $$;

-- ============================================================
-- STEP 5: Fix Schemes Table
-- ============================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' AND column_name = 'startdate') THEN
        ALTER TABLE schemes RENAME COLUMN startdate TO "startDate";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' AND column_name = 'enddate') THEN
        ALTER TABLE schemes RENAME COLUMN enddate TO "endDate";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' AND column_name = 'appliestoskus') THEN
        ALTER TABLE schemes RENAME COLUMN appliestoskus TO "appliesToSKUs";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' AND column_name = 'appliesto') THEN
        ALTER TABLE schemes RENAME COLUMN appliesto TO "appliesTo";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' AND column_name = 'buyquantity') THEN
        ALTER TABLE schemes RENAME COLUMN buyquantity TO "buyQuantity";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' AND column_name = 'freequantity') THEN
        ALTER TABLE schemes RENAME COLUMN freequantity TO "freeQuantity";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' AND column_name = 'discountamount') THEN
        ALTER TABLE schemes RENAME COLUMN discountamount TO "discountAmount";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' AND column_name = 'discountpercase') THEN
        ALTER TABLE schemes RENAME COLUMN discountpercase TO "discountPerCase";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' AND column_name = 'schemedescription') THEN
        ALTER TABLE schemes RENAME COLUMN schemedescription TO "schemeDescription";
    END IF;
END $$;

-- ============================================================
-- STEP 6: Create/Update Indexes
-- ============================================================
-- Drop old indexes if they exist and create new ones with correct case
DROP INDEX IF EXISTS idx_sales_data_distributor_code;
DROP INDEX IF EXISTS idx_orders_order_number;
DROP INDEX IF EXISTS idx_orders_distributor_code;

-- Create indexes with quoted identifiers
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data("distributorCode");
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_name ON sales_data("distributorName");
CREATE INDEX IF NOT EXISTS idx_sales_data_date ON sales_data("invoiceDate" DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders("orderNumber");
CREATE INDEX IF NOT EXISTS idx_orders_distributor_code ON orders("distributorCode");
CREATE INDEX IF NOT EXISTS idx_targets_distributor_code ON targets("distributorCode");
CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);

-- ============================================================
-- STEP 7: Verify - Check final column names
-- ============================================================
SELECT 'Final sales_data columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales_data' 
ORDER BY ordinal_position;
