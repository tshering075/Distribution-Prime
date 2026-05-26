-- ============================================================
-- CREATE APP_CONFIG TABLE FOR GMAIL CREDENTIALS
-- Run this script in Supabase SQL Editor
-- ============================================================

-- Create app_config table for storing Gmail API credentials
CREATE TABLE IF NOT EXISTS app_config (
  id TEXT PRIMARY KEY,
  "clientId" TEXT,
  "apiKey" TEXT,
  "gmail_client_id" TEXT,                              -- Alternative column name for backward compatibility
  "gmail_api_key" TEXT,                                -- Alternative column name for backward compatibility
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_config_id ON app_config(id);

-- Enable Row Level Security (RLS) - Optional but recommended
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read/write app config
-- Adjust this policy based on your security requirements
-- Drop existing policy first to avoid errors if running script multiple times
DROP POLICY IF EXISTS "Allow authenticated users to manage app config" ON app_config;
CREATE POLICY "Allow authenticated users to manage app config"
  ON app_config
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Verify table was created
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'app_config' 
ORDER BY ordinal_position;
