-- ============================================================
-- FIX SCHEMES TABLE: Rename lowercase columns to camelCase
-- Run this if you get errors about columns like "startdate" not existing
-- ============================================================

-- Fix Schemes Table: Rename lowercase columns to quoted camelCase
DO $$ 
BEGIN
    -- Fix startDate
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' 
               AND column_name = 'startdate'
               AND column_name != 'startDate') THEN
        ALTER TABLE schemes RENAME COLUMN startdate TO "startDate";
        RAISE NOTICE '✅ Renamed startdate to "startDate"';
    END IF;
    
    -- Fix endDate
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' 
               AND column_name = 'enddate'
               AND column_name != 'endDate') THEN
        ALTER TABLE schemes RENAME COLUMN enddate TO "endDate";
        RAISE NOTICE '✅ Renamed enddate to "endDate"';
    END IF;
    
    -- Fix appliesToSKUs
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' 
               AND column_name = 'appliestoskus'
               AND column_name != 'appliesToSKUs') THEN
        ALTER TABLE schemes RENAME COLUMN appliestoskus TO "appliesToSKUs";
        RAISE NOTICE '✅ Renamed appliestoskus to "appliesToSKUs"';
    END IF;
    
    -- Fix appliesTo
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' 
               AND column_name = 'appliesto'
               AND column_name != 'appliesTo') THEN
        ALTER TABLE schemes RENAME COLUMN appliesto TO "appliesTo";
        RAISE NOTICE '✅ Renamed appliesto to "appliesTo"';
    END IF;
    
    -- Fix buyQuantity
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' 
               AND column_name = 'buyquantity'
               AND column_name != 'buyQuantity') THEN
        ALTER TABLE schemes RENAME COLUMN buyquantity TO "buyQuantity";
        RAISE NOTICE '✅ Renamed buyquantity to "buyQuantity"';
    END IF;
    
    -- Fix freeQuantity
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' 
               AND column_name = 'freequantity'
               AND column_name != 'freeQuantity') THEN
        ALTER TABLE schemes RENAME COLUMN freequantity TO "freeQuantity";
        RAISE NOTICE '✅ Renamed freequantity to "freeQuantity"';
    END IF;
    
    -- Fix discountAmount
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' 
               AND column_name = 'discountamount'
               AND column_name != 'discountAmount') THEN
        ALTER TABLE schemes RENAME COLUMN discountamount TO "discountAmount";
        RAISE NOTICE '✅ Renamed discountamount to "discountAmount"';
    END IF;
    
    -- Fix discountPerCase
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' 
               AND column_name = 'discountpercase'
               AND column_name != 'discountPerCase') THEN
        ALTER TABLE schemes RENAME COLUMN discountpercase TO "discountPerCase";
        RAISE NOTICE '✅ Renamed discountpercase to "discountPerCase"';
    END IF;
    
    -- Fix schemeDescription
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'schemes' 
               AND column_name = 'schemedescription'
               AND column_name != 'schemeDescription') THEN
        ALTER TABLE schemes RENAME COLUMN schemedescription TO "schemeDescription";
        RAISE NOTICE '✅ Renamed schemedescription to "schemeDescription"';
    END IF;
END $$;

-- Recreate indexes with correct column names
DROP INDEX IF EXISTS idx_schemes_dates;
CREATE INDEX IF NOT EXISTS idx_schemes_dates ON schemes("startDate", "endDate");

-- Verify the fix
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'schemes' 
ORDER BY ordinal_position;
