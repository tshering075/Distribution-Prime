-- Run in Supabase SQL editor if physical stock save fails with "column does not exist"
ALTER TABLE distributors
  ADD COLUMN IF NOT EXISTS physical_stock JSONB DEFAULT NULL;
