-- ============================================================
-- COMPLETE SUPABASE SCHEMA - ALL TABLES
-- Copy and paste this entire script into Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. DISTRIBUTORS TABLE
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
  physical_stock JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distributors_code ON distributors(code);
CREATE INDEX IF NOT EXISTS idx_distributors_uid ON distributors(uid);
CREATE INDEX IF NOT EXISTS idx_distributors_username ON distributors(username);

-- ============================================================
-- 1b. PHYSICAL STOCK SNAPSHOTS (history by report date)
-- ============================================================
CREATE TABLE IF NOT EXISTS distributor_physical_stock_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_code TEXT NOT NULL,
  report_date DATE NOT NULL,
  payload JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT distributor_physical_stock_snapshots_dist_date_key
    UNIQUE (distributor_code, report_date)
);

CREATE INDEX IF NOT EXISTS idx_physical_stock_snapshots_report_date
  ON distributor_physical_stock_snapshots (report_date DESC);

CREATE INDEX IF NOT EXISTS idx_physical_stock_snapshots_dist_code
  ON distributor_physical_stock_snapshots (distributor_code);

-- ============================================================
-- 2. ADMINS TABLE
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
-- 3. ORDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "distributorCode" TEXT NOT NULL,
  "distributorName" TEXT,
  data JSONB NOT NULL,
  timestamp TEXT,
  "totalUC" NUMERIC,
  "csdUC" NUMERIC,
  "waterUC" NUMERIC,
  "csdPC" NUMERIC,
  "waterPC" NUMERIC,
  "orderNumber" TEXT,
  "tableImageData" TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_distributor_code ON orders("distributorCode");
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders("orderNumber");

-- ============================================================
-- 4. TARGETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  "distributorCode" TEXT UNIQUE NOT NULL,
  "CSD_PC" NUMERIC DEFAULT 0,
  "CSD_UC" NUMERIC DEFAULT 0,
  "Water_PC" NUMERIC DEFAULT 0,
  "Water_UC" NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_targets_distributor_code ON targets("distributorCode");

-- ============================================================
-- 5. SCHEMES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  distributors TEXT[] DEFAULT '{}',
  "appliesToSKUs" TEXT[] DEFAULT '{}',
  "appliesTo" TEXT,
  "buyQuantity" NUMERIC,
  "freeQuantity" NUMERIC,
  "discountAmount" NUMERIC,
  "discountPerCase" NUMERIC,
  "schemeDescription" TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_schemes_dates ON schemes("startDate", "endDate");
CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);

-- ============================================================
-- 6. SALES DATA TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "distributorCode" TEXT,
  "distributorName" TEXT,
  "invoiceNumber" TEXT,
  "invoiceDate" TIMESTAMPTZ,
  products JSONB DEFAULT '[]'::jsonb,
  sku TEXT,
  category TEXT,
  quantity NUMERIC,
  rate NUMERIC,
  amount NUMERIC,
  "csdPC" NUMERIC DEFAULT 0,
  "csdUC" NUMERIC DEFAULT 0,
  "waterPC" NUMERIC DEFAULT 0,
  "waterUC" NUMERIC DEFAULT 0,
  "totalUC" NUMERIC DEFAULT 0,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data("distributorCode");
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
ADD COLUMN IF NOT EXISTS credentials JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS physical_stock JSONB DEFAULT NULL;

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

-- Add missing indexes (only if columns exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'orderNumber') THEN
        CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders("orderNumber");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'distributorCode') THEN
        CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data("distributorCode");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);

-- ============================================================
-- VERIFY: Check all tables were created
-- ============================================================
SELECT 'Tables created successfully!' as status;

-- Uncomment to verify columns:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('distributors', 'admins', 'orders', 'targets', 'schemes', 'sales_data')
-- ORDER BY table_name, ordinal_position;
