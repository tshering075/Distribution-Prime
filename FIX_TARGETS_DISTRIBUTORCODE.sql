-- ============================================================
-- FIX TARGETS TABLE: Rename distributorcode to "distributorCode"
-- Run this if you get error: column "distributorcode" does not exist
-- ============================================================

-- Fix Targets Table: Rename lowercase distributorcode to quoted "distributorCode"
DO $$ 
BEGIN
    -- Check if column exists as lowercase
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'targets' 
               AND column_name = 'distributorcode'
               AND column_name != 'distributorCode') THEN
        ALTER TABLE targets RENAME COLUMN distributorcode TO "distributorCode";
        RAISE NOTICE '✅ Renamed distributorcode to "distributorCode" in targets table';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'targets' 
                  AND column_name = 'distributorCode') THEN
        RAISE NOTICE '✅ Column "distributorCode" already exists with correct case';
    ELSE
        RAISE NOTICE '⚠️ Column distributorcode not found in targets table';
    END IF;
END $$;

-- Recreate index with correct column name
DROP INDEX IF EXISTS idx_targets_distributor_code;
CREATE INDEX IF NOT EXISTS idx_targets_distributor_code ON targets("distributorCode");

-- Verify the fix
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'targets' 
AND column_name LIKE '%distributor%'
ORDER BY ordinal_position;
