-- ============================================================
-- COMPLETE SUPABASE SCHEMA FOR COKE CALCULATOR APP
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
  phone TEXT,                                    -- Phone number
  credentials JSONB DEFAULT '{}'::jsonb,        -- Login credentials: {username, passwordHash}
  target JSONB DEFAULT '{"CSD_PC": 0, "CSD_UC": 0, "Water_PC": 0, "Water_UC": 0}'::jsonb,
  achieved JSONB DEFAULT '{"CSD_PC": 0, "CSD_UC": 0, "Water_PC": 0, "Water_UC": 0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distributors_code ON distributors(code);
CREATE INDEX IF NOT EXISTS idx_distributors_uid ON distributors(uid);
CREATE INDEX IF NOT EXISTS idx_distributors_username ON distributors(username);

-- Disable Row Level Security (RLS) for distributors
ALTER TABLE distributors DISABLE ROW LEVEL SECURITY;

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

-- Disable Row Level Security (RLS) for admins
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- ORDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "distributorCode" TEXT NOT NULL,
  "distributorName" TEXT,
  data JSONB NOT NULL,                              -- Order items array
  timestamp TEXT,                                    -- Order timestamp string
  "totalUC" NUMERIC,                                -- Total UC (Unit Cases)
  "csdUC" NUMERIC,                                  -- CSD UC
  "waterUC" NUMERIC,                                -- Water UC
  "csdPC" NUMERIC,                                  -- CSD PC (Piece Cases)
  "waterPC" NUMERIC,                                -- Water PC
  "orderNumber" TEXT,                               -- 4-digit order number
  "tableImageData" TEXT,                            -- Base64 PNG image for email
  status TEXT DEFAULT 'pending',                      -- pending | sent | approved | delivered | rejected | canceled | pending_email_failed
  shipping_invoice_data TEXT,
  shipping_invoice_file_name TEXT,
  shipping_invoice_mime_type TEXT,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ,
  status_history JSONB DEFAULT '[]'::jsonb,
  approval_source TEXT,
  approval_sent_at TIMESTAMPTZ,
  approval_due_at TIMESTAMPTZ,
  last_reminder_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  escalation_level INTEGER DEFAULT 0,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_status_allowed_check'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_status_allowed_check
    CHECK (
      status IN (
        'pending',
        'sent',
        'approved',
        'delivered',
        'rejected',
        'canceled',
        'pending_email_failed'
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_distributor_code ON orders("distributorCode");
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders("orderNumber");
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_approval_due_at ON orders(approval_due_at);
CREATE INDEX IF NOT EXISTS idx_orders_sent_due_lookup ON orders(status, approval_due_at);

-- Disable Row Level Security (RLS) for orders
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- TARGETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  "distributorCode" TEXT UNIQUE NOT NULL,
  CSD_PC NUMERIC DEFAULT 0,
  CSD_UC NUMERIC DEFAULT 0,
  Water_PC NUMERIC DEFAULT 0,
  Water_UC NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_targets_distributor_code ON targets("distributorCode");

-- Disable Row Level Security (RLS) for targets
ALTER TABLE targets DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SCHEMES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                                -- "csd_scheme" or "discount"
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  distributors TEXT[] DEFAULT '{}',                  -- Array of distributor codes
  "appliesToSKUs" TEXT[] DEFAULT '{}',                 -- Array of SKU codes
  "appliesTo" TEXT,                                    -- "csd", "water", or "both"
  "buyQuantity" NUMERIC,                               -- For CSD schemes
  "freeQuantity" NUMERIC,                              -- For CSD schemes
  "discountAmount" NUMERIC,                            -- Discount per case
  "discountPerCase" NUMERIC,                           -- Backward compatibility
  "schemeDescription" TEXT,                            -- Human-readable description
  category TEXT,                                     -- Optional category
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT                                    -- User who updated
);

CREATE INDEX IF NOT EXISTS idx_schemes_dates ON schemes("startDate", "endDate");
CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);

-- Disable Row Level Security (RLS) for schemes
ALTER TABLE schemes DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SALES DATA TABLE (FIXED - Added missing fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "distributorCode" TEXT,                           -- ✅ ADDED: Distributor code (for matching)
  "distributorName" TEXT,                            -- Distributor name
  "invoiceNumber" TEXT,                              -- Invoice number (optional)
  "invoiceDate" TIMESTAMPTZ,                        -- Invoice date
  products JSONB DEFAULT '[]'::jsonb,                -- ✅ ADDED: Array of products: [{sku, category, quantity, rate, amount}, ...]
  sku TEXT,                                          -- Individual SKU (for line-item records)
  category TEXT,                                     -- Product category: "CSD" or "Water"
  quantity NUMERIC,                                  -- Quantity (for line-item records)
  rate NUMERIC,                                      -- Rate per unit (for line-item records)
  amount NUMERIC,                                    -- Total amount (for line-item records)
  "csdPC" NUMERIC DEFAULT 0,                         -- ✅ ADDED: CSD PC (Piece Cases) - aggregated
  "csdUC" NUMERIC DEFAULT 0,                         -- ✅ ADDED: CSD UC (Unit Cases) - aggregated
  "waterPC" NUMERIC DEFAULT 0,                      -- ✅ ADDED: Water PC - aggregated
  "waterUC" NUMERIC DEFAULT 0,                      -- ✅ ADDED: Water UC - aggregated
  "totalUC" NUMERIC DEFAULT 0,                       -- ✅ ADDED: Total UC - aggregated
  source TEXT,                                       -- Data source: "excel_upload", "reports_upload", etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data("distributorCode");
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_name ON sales_data("distributorName");
CREATE INDEX IF NOT EXISTS idx_sales_data_date ON sales_data("invoiceDate" DESC);
CREATE INDEX IF NOT EXISTS idx_sales_data_source ON sales_data(source);
CREATE INDEX IF NOT EXISTS idx_sales_data_sku ON sales_data(sku);

-- Disable Row Level Security (RLS) for sales_data
ALTER TABLE sales_data DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- APP CONFIG TABLE (Gmail Credentials)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_config (
  id TEXT PRIMARY KEY,
  "clientId" TEXT,
  "apiKey" TEXT,
  "gmail_client_id" TEXT,                              -- Alternative column name for backward compatibility
  "gmail_api_key" TEXT,                                -- Alternative column name for backward compatibility
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_config_id ON app_config(id);

-- Disable Row Level Security (RLS) for app_config
ALTER TABLE app_config DISABLE ROW LEVEL SECURITY;

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

-- Add missing columns to sales_data table (CRITICAL - App will fail without these!)
-- Use quoted identifiers to preserve camelCase for Supabase PostgREST
ALTER TABLE sales_data 
ADD COLUMN IF NOT EXISTS "distributorCode" TEXT,
ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "csdPC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "csdUC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "waterPC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "waterUC" NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS "totalUC" NUMERIC DEFAULT 0;

-- Add missing indexes (use quoted identifiers for camelCase columns)
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders("orderNumber");
CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data("distributorCode");

-- ============================================================
-- VERIFY SCHEMA
-- ============================================================
-- Run these queries to verify all columns exist:

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'sales_data' 
-- ORDER BY ordinal_position;

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'schemes' 
-- ORDER BY ordinal_position;

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'app_config' 
-- ORDER BY ordinal_position;
