-- ============================================================
-- STEP 1: Fix Existing Columns (Run this FIRST)
-- This handles tables that already exist with lowercase columns
-- ============================================================

-- Fix Sales Data Table
DO $$ 
BEGIN
    -- Add columns as lowercase first (if they don't exist)
    ALTER TABLE sales_data ADD COLUMN IF NOT EXISTS distributorcode TEXT;
    ALTER TABLE sales_data ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE sales_data ADD COLUMN IF NOT EXISTS csdpc NUMERIC DEFAULT 0;
    ALTER TABLE sales_data ADD COLUMN IF NOT EXISTS csduc NUMERIC DEFAULT 0;
    ALTER TABLE sales_data ADD COLUMN IF NOT EXISTS waterpc NUMERIC DEFAULT 0;
    ALTER TABLE sales_data ADD COLUMN IF NOT EXISTS wateruc NUMERIC DEFAULT 0;
    ALTER TABLE sales_data ADD COLUMN IF NOT EXISTS totaluc NUMERIC DEFAULT 0;
    
    -- Rename to camelCase
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'distributorcode') THEN
        ALTER TABLE sales_data RENAME COLUMN distributorcode TO "distributorCode";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'csdpc') THEN
        ALTER TABLE sales_data RENAME COLUMN csdpc TO "csdPC";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'csduc') THEN
        ALTER TABLE sales_data RENAME COLUMN csduc TO "csdUC";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'waterpc') THEN
        ALTER TABLE sales_data RENAME COLUMN waterpc TO "waterPC";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'wateruc') THEN
        ALTER TABLE sales_data RENAME COLUMN wateruc TO "waterUC";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'totaluc') THEN
        ALTER TABLE sales_data RENAME COLUMN totaluc TO "totalUC";
    END IF;
    
    -- Create columns as camelCase if they still don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'distributorCode') THEN
        ALTER TABLE sales_data ADD COLUMN "distributorCode" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'csdPC') THEN
        ALTER TABLE sales_data ADD COLUMN "csdPC" NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'csdUC') THEN
        ALTER TABLE sales_data ADD COLUMN "csdUC" NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'waterPC') THEN
        ALTER TABLE sales_data ADD COLUMN "waterPC" NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'waterUC') THEN
        ALTER TABLE sales_data ADD COLUMN "waterUC" NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'totalUC') THEN
        ALTER TABLE sales_data ADD COLUMN "totalUC" NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Fix Orders Table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'distributorcode') THEN
        ALTER TABLE orders RENAME COLUMN distributorcode TO "distributorCode";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'ordernumber') THEN
        ALTER TABLE orders RENAME COLUMN ordernumber TO "orderNumber";
    END IF;
END $$;

-- Fix Targets Table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'targets' AND column_name = 'distributorcode') THEN
        ALTER TABLE targets RENAME COLUMN distributorcode TO "distributorCode";
    END IF;
END $$;

-- Fix Schemes Table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schemes' AND column_name = 'startdate') THEN
        ALTER TABLE schemes RENAME COLUMN startdate TO "startDate";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schemes' AND column_name = 'enddate') THEN
        ALTER TABLE schemes RENAME COLUMN enddate TO "endDate";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schemes' AND column_name = 'appliestoskus') THEN
        ALTER TABLE schemes RENAME COLUMN appliestoskus TO "appliesToSKUs";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schemes' AND column_name = 'appliesto') THEN
        ALTER TABLE schemes RENAME COLUMN appliesto TO "appliesTo";
    END IF;
END $$;

-- Add missing scheme columns
ALTER TABLE schemes 
ADD COLUMN IF NOT EXISTS "schemeDescription" TEXT,
ADD COLUMN IF NOT EXISTS "appliesTo" TEXT,
ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC,
ADD COLUMN IF NOT EXISTS "discountPerCase" NUMERIC;

SELECT 'Columns fixed! Now run the complete schema script.' as status;
