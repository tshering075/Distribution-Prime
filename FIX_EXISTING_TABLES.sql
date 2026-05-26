-- ============================================================
-- FIX EXISTING TABLES - Handles lowercase column names
-- Run this if you get "column does not exist" errors
-- ============================================================

-- ============================================================
-- STEP 1: Fix Sales Data Table
-- ============================================================
-- First, add columns as lowercase (will work if they don't exist)
ALTER TABLE sales_data 
ADD COLUMN IF NOT EXISTS distributorcode TEXT,
ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS csdpc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS csduc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS waterpc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS wateruc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS totaluc NUMERIC DEFAULT 0;

-- Rename lowercase columns to camelCase (if they exist)
DO $$ 
BEGIN
    -- Check and rename distributorcode
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'distributorcode'
               AND column_name != 'distributorCode') THEN
        ALTER TABLE sales_data RENAME COLUMN distributorcode TO "distributorCode";
    END IF;
    
    -- Check and rename csdpc
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'csdpc'
               AND column_name != 'csdPC') THEN
        ALTER TABLE sales_data RENAME COLUMN csdpc TO "csdPC";
    END IF;
    
    -- Check and rename csduc
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'csduc'
               AND column_name != 'csdUC') THEN
        ALTER TABLE sales_data RENAME COLUMN csduc TO "csdUC";
    END IF;
    
    -- Check and rename waterpc
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'waterpc'
               AND column_name != 'waterPC') THEN
        ALTER TABLE sales_data RENAME COLUMN waterpc TO "waterPC";
    END IF;
    
    -- Check and rename wateruc
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'wateruc'
               AND column_name != 'waterUC') THEN
        ALTER TABLE sales_data RENAME COLUMN wateruc TO "waterUC";
    END IF;
    
    -- Check and rename totaluc
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'totaluc'
               AND column_name != 'totalUC') THEN
        ALTER TABLE sales_data RENAME COLUMN totaluc TO "totalUC";
    END IF;
END $$;

-- If columns still don't exist as camelCase, create them
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sales_data' AND column_name = 'distributorCode') THEN
        ALTER TABLE sales_data ADD COLUMN "distributorCode" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sales_data' AND column_name = 'csdPC') THEN
        ALTER TABLE sales_data ADD COLUMN "csdPC" NUMERIC DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sales_data' AND column_name = 'csdUC') THEN
        ALTER TABLE sales_data ADD COLUMN "csdUC" NUMERIC DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sales_data' AND column_name = 'waterPC') THEN
        ALTER TABLE sales_data ADD COLUMN "waterPC" NUMERIC DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sales_data' AND column_name = 'waterUC') THEN
        ALTER TABLE sales_data ADD COLUMN "waterUC" NUMERIC DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sales_data' AND column_name = 'totalUC') THEN
        ALTER TABLE sales_data ADD COLUMN "totalUC" NUMERIC DEFAULT 0;
    END IF;
END $$;

-- ============================================================
-- STEP 2: Fix Orders Table
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
-- STEP 3: Fix Targets Table
-- ============================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'targets' AND column_name = 'distributorcode') THEN
        ALTER TABLE targets RENAME COLUMN distributorcode TO "distributorCode";
    END IF;
END $$;

-- ============================================================
-- STEP 4: Fix Schemes Table
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

-- Add missing scheme columns if they don't exist
ALTER TABLE schemes 
ADD COLUMN IF NOT EXISTS "schemeDescription" TEXT,
ADD COLUMN IF NOT EXISTS "appliesTo" TEXT,
ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC,
ADD COLUMN IF NOT EXISTS "discountPerCase" NUMERIC;

-- ============================================================
-- STEP 5: Create/Update Indexes (only if columns exist)
-- ============================================================
-- Drop old indexes first
DROP INDEX IF EXISTS idx_sales_data_distributor_code;
DROP INDEX IF EXISTS idx_orders_order_number;
DROP INDEX IF EXISTS idx_orders_distributor_code;

-- Create indexes only if columns exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'distributorCode') THEN
        CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data("distributorCode");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'distributorName') THEN
        CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_name ON sales_data("distributorName");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'sales_data' AND column_name = 'invoiceDate') THEN
        CREATE INDEX IF NOT EXISTS idx_sales_data_date ON sales_data("invoiceDate" DESC);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'orderNumber') THEN
        CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders("orderNumber");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'distributorCode') THEN
        CREATE INDEX IF NOT EXISTS idx_orders_distributor_code ON orders("distributorCode");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'targets' AND column_name = 'distributorCode') THEN
        CREATE INDEX IF NOT EXISTS idx_targets_distributor_code ON targets("distributorCode");
    END IF;
END $$;

-- Create indexes that don't depend on camelCase columns
CREATE INDEX IF NOT EXISTS idx_sales_data_source ON sales_data(source);
CREATE INDEX IF NOT EXISTS idx_sales_data_sku ON sales_data(sku);
CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);

-- ============================================================
-- VERIFY: Check what columns exist now
-- ============================================================
SELECT 'sales_data columns:' as table_name;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales_data' 
ORDER BY ordinal_position;

SELECT 'orders columns:' as table_name;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;
