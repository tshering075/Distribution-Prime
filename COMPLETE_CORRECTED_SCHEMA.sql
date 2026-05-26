-- ============================================================
-- COMPLETE CORRECTED SUPABASE SCHEMA
-- All tables with proper case handling and required fields
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- DISTRIBUTORS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS distributors (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  username TEXT,
  uid TEXT,
  region TEXT,
  address TEXT,
  phone TEXT,
  credentials JSONB DEFAULT '{}'::jsonb,
  target JSONB DEFAULT '{"CSD_PC": 0, "CSD_UC": 0, "Water_PC": 0, "Water_UC": 0}'::jsonb,
  achieved JSONB DEFAULT '{"CSD_PC": 0, "CSD_UC": 0, "Water_PC": 0, "Water_UC": 0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distributors_code ON distributors(code);
CREATE INDEX IF NOT EXISTS idx_distributors_uid ON distributors(uid);
CREATE INDEX IF NOT EXISTS idx_distributors_username ON distributors(username);

-- ============================================================
-- ADMINS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'admin',
  permissions JSONB DEFAULT '{}'::jsonb,
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_uid ON admins(uid);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- ============================================================
-- ORDERS TABLE (FIXED - Added quoted identifiers and missing index)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "distributorCode" TEXT NOT NULL,              -- ✅ Quoted for camelCase
  "distributorName" TEXT,                       -- ✅ Quoted for camelCase
  data JSONB NOT NULL,
  timestamp TEXT,
  "totalUC" NUMERIC,                            -- ✅ Quoted for camelCase
  "csdUC" NUMERIC,                              -- ✅ Quoted for camelCase
  "waterUC" NUMERIC,                            -- ✅ Quoted for camelCase
  "csdPC" NUMERIC,                              -- ✅ Quoted for camelCase
  "waterPC" NUMERIC,                            -- ✅ Quoted for camelCase
  "orderNumber" TEXT,                           -- ✅ Quoted for camelCase
  "tableImageData" TEXT,                        -- ✅ Quoted for camelCase
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_distributor_code ON orders("distributorCode");
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders("orderNumber");  -- ✅ ADDED

-- ============================================================
-- TARGETS TABLE (FIXED - Added quoted identifiers)
-- ============================================================
CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  "distributorCode" TEXT UNIQUE NOT NULL,       -- ✅ Quoted for camelCase
  "CSD_PC" NUMERIC DEFAULT 0,                   -- ✅ Quoted for uppercase
  "CSD_UC" NUMERIC DEFAULT 0,                   -- ✅ Quoted for uppercase
  "Water_PC" NUMERIC DEFAULT 0,                -- ✅ Quoted for mixed case
  "Water_UC" NUMERIC DEFAULT 0,                 -- ✅ Quoted for mixed case
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_targets_distributor_code ON targets("distributorCode");

-- ============================================================
-- SCHEMES TABLE (FIXED - Added missing indexes)
-- ============================================================
CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  "startDate" TEXT NOT NULL,                    -- ✅ Quoted for camelCase
  "endDate" TEXT NOT NULL,                      -- ✅ Quoted for camelCase
  distributors TEXT[] DEFAULT '{}',
  "appliesToSKUs" TEXT[] DEFAULT '{}',          -- ✅ Quoted for camelCase
  "appliesTo" TEXT,                             -- ✅ Quoted for camelCase
  "buyQuantity" NUMERIC,                        -- ✅ Quoted for camelCase
  "freeQuantity" NUMERIC,                       -- ✅ Quoted for camelCase
  "discountAmount" NUMERIC,                      -- ✅ Quoted for camelCase
  "discountPerCase" NUMERIC,                    -- ✅ Quoted for camelCase
  "schemeDescription" TEXT,                     -- ✅ Quoted for camelCase
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_schemes_dates ON schemes("startDate", "endDate");
CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);                    -- ✅ ADDED
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);  -- ✅ ADDED

-- ============================================================
-- SALES DATA TABLE (FIXED - Added ALL missing fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "distributorCode" TEXT,                       -- ✅ ADDED: Distributor code (for matching)
  "distributorName" TEXT,                       -- ✅ Quoted for camelCase
  "invoiceNumber" TEXT,                         -- ✅ Quoted for camelCase
  "invoiceDate" TIMESTAMPTZ,                    -- ✅ Quoted for camelCase
  products JSONB DEFAULT '[]'::jsonb,            -- ✅ ADDED: Array of products
  sku TEXT,
  category TEXT,
  quantity NUMERIC,
  rate NUMERIC,
  amount NUMERIC,
  "csdPC" NUMERIC DEFAULT 0,                   -- ✅ ADDED: CSD PC (Piece Cases)
  "csdUC" NUMERIC DEFAULT 0,                    -- ✅ ADDED: CSD UC (Unit Cases)
  "waterPC" NUMERIC DEFAULT 0,                 -- ✅ ADDED: Water PC
  "waterUC" NUMERIC DEFAULT 0,                  -- ✅ ADDED: Water UC
  "totalUC" NUMERIC DEFAULT 0,                  -- ✅ ADDED: Total UC
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data("distributorCode");  -- ✅ ADDED
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_name ON sales_data("distributorName");
CREATE INDEX IF NOT EXISTS idx_sales_data_date ON sales_data("invoiceDate" DESC);
CREATE INDEX IF NOT EXISTS idx_sales_data_source ON sales_data(source);
CREATE INDEX IF NOT EXISTS idx_sales_data_sku ON sales_data(sku);

-- ============================================================
-- MIGRATION: Add missing columns to existing tables
-- ============================================================
-- Run this section if tables already exist

-- Add missing columns to distributors table
ALTER TABLE distributors 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS credentials JSONB DEFAULT '{}'::jsonb;

-- Add missing columns to schemes table
ALTER TABLE schemes 
ADD COLUMN IF NOT EXISTS "schemeDescription" TEXT,
ADD COLUMN IF NOT EXISTS "appliesTo" TEXT,
ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC,
ADD COLUMN IF NOT EXISTS "discountPerCase" NUMERIC;

-- Add missing columns to sales_data table (CRITICAL!)
ALTER TABLE sales_data 
ADD COLUMN IF NOT EXISTS "distributorCode" TEXT,
ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "csdPC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "csdUC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "waterPC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "waterUC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "totalUC" NUMERIC DEFAULT 0;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders("orderNumber");
CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data("distributorCode");

-- ============================================================
-- VERIFY SCHEMA
-- ============================================================
-- Uncomment to verify columns exist:

-- SELECT 'distributors' as table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'distributors' 
-- ORDER BY ordinal_position;

-- SELECT 'sales_data' as table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'sales_data' 
-- ORDER BY ordinal_position;

-- SELECT 'schemes' as table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'schemes' 
-- ORDER BY ordinal_position;
