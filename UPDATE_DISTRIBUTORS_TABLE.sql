-- Update Distributors Table to include missing columns
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)

-- Add phone column if it doesn't exist
ALTER TABLE distributors 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add credentials column if it doesn't exist
ALTER TABLE distributors 
ADD COLUMN IF NOT EXISTS credentials JSONB DEFAULT '{}'::jsonb;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'distributors' 
ORDER BY ordinal_position;
