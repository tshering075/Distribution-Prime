# Supabase Migration Guide

This guide will help you migrate from Firebase to Supabase for your Coke Calculator application.

## 📋 Prerequisites

1. Create a Supabase account at [https://supabase.com](https://supabase.com)
2. Create a new project in Supabase
3. Note down your project URL and anon key

## 🔧 Step 1: Install Dependencies

The Supabase client has already been installed:
```bash
npm install @supabase/supabase-js
```

## 🔑 Step 2: Configure Environment Variables

Create a `.env` file in your project root (or update existing one) with:

```env
REACT_APP_SUPABASE_URL=your-project-url
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

You can find these values in:
- Supabase Dashboard → Project Settings → API
- Project URL: `https://xxxxx.supabase.co`
- Anon key: The `anon` `public` key

## 🗄️ Step 3: Create Database Tables

Run these SQL commands in Supabase SQL Editor (Dashboard → SQL Editor):

### Distributors Table
```sql
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
```

**Important:** If you already created the distributors table without `phone` and `credentials` columns, run this migration:
```sql
-- Add missing columns to existing distributors table
ALTER TABLE distributors 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS credentials JSONB DEFAULT '{}'::jsonb;
```

**Note:** The `credentials` column stores distributor login credentials as JSONB:
```json
{
  "username": "DIST001",
  "passwordHash": "hashed_password_here"
}
```

### Admins Table
```sql
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
```

### Orders Table
```sql
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributorCode TEXT NOT NULL,
  distributorName TEXT,
  data JSONB NOT NULL,                              -- Order items array with SKU, cases, rate, amounts, etc.
  timestamp TEXT,                                     -- Order timestamp string
  totalUC NUMERIC,                                    -- Total UC (Unit Cases)
  csdUC NUMERIC,                                      -- CSD UC
  waterUC NUMERIC,                                    -- Water UC
  csdPC NUMERIC,                                       -- CSD PC (Piece Cases)
  waterPC NUMERIC,                                    -- Water PC
  orderNumber TEXT,                                   -- 4-digit order number
  tableImageData TEXT,                                -- Base64 PNG image of order table for email
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_distributor_code ON orders(distributorCode);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(orderNumber);
```

### Targets Table
```sql
CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  distributorCode TEXT UNIQUE NOT NULL,
  CSD_PC NUMERIC DEFAULT 0,
  CSD_UC NUMERIC DEFAULT 0,
  Water_PC NUMERIC DEFAULT 0,
  Water_UC NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_targets_distributor_code ON targets(distributorCode);
```

### Schemes Table
```sql
CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                                -- "csd_scheme" or "discount"
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  distributors TEXT[] DEFAULT '{}',                  -- Array of distributor codes
  appliesToSKUs TEXT[] DEFAULT '{}',                 -- Array of SKU codes
  appliesTo TEXT,                                   -- "csd", "water", or "both" (backward compatibility)
  buyQuantity NUMERIC,                              -- For CSD schemes: buy quantity
  freeQuantity NUMERIC,                              -- For CSD schemes: free quantity
  discountAmount NUMERIC,                           -- Discount per case (used by app)
  discountPerCase NUMERIC,                           -- Keep for backward compatibility
  schemeDescription TEXT,                           -- Human-readable description (e.g., "Buy 2, Get 1 Free")
  category TEXT,                                     -- Category (optional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT                                    -- Email or ID of user who updated
);

CREATE INDEX IF NOT EXISTS idx_schemes_dates ON schemes(startDate, endDate);
CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);
```

**Important:** If you already created the schemes table without `schemeDescription`, `appliesTo`, `discountAmount`, or `discountPerCase` columns, run this migration:
```sql
-- Add missing columns to existing schemes table
ALTER TABLE schemes 
ADD COLUMN IF NOT EXISTS schemeDescription TEXT,
ADD COLUMN IF NOT EXISTS appliesTo TEXT,
ADD COLUMN IF NOT EXISTS discountAmount NUMERIC,
ADD COLUMN IF NOT EXISTS discountPerCase NUMERIC;

-- Add additional indexes for better performance
CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);
```

### Sales Data Table
```sql
CREATE TABLE IF NOT EXISTS sales_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributorCode TEXT,                                -- Distributor code (for matching)
  distributorName TEXT,                               -- Distributor name
  invoiceNumber TEXT,                                 -- Invoice number (optional)
  invoiceDate TIMESTAMPTZ,                            -- Invoice date
  products JSONB DEFAULT '[]'::jsonb,                  -- Array of products: [{sku, category, quantity, rate, amount}, ...]
  sku TEXT,                                           -- Individual SKU (for line-item records)
  category TEXT,                                      -- Product category: "CSD" or "Water"
  quantity NUMERIC,                                   -- Quantity (for line-item records)
  rate NUMERIC,                                       -- Rate per unit (for line-item records)
  amount NUMERIC,                                     -- Total amount (for line-item records)
  csdPC NUMERIC DEFAULT 0,                            -- CSD PC (Piece Cases) - aggregated
  csdUC NUMERIC DEFAULT 0,                            -- CSD UC (Unit Cases) - aggregated
  waterPC NUMERIC DEFAULT 0,                           -- Water PC - aggregated
  waterUC NUMERIC DEFAULT 0,                          -- Water UC - aggregated
  totalUC NUMERIC DEFAULT 0,                         -- Total UC - aggregated
  source TEXT,                                        -- Data source: "excel_upload", "reports_upload", etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data(distributorCode);
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_name ON sales_data(distributorName);
CREATE INDEX IF NOT EXISTS idx_sales_data_date ON sales_data(invoiceDate DESC);
CREATE INDEX IF NOT EXISTS idx_sales_data_source ON sales_data(source);
CREATE INDEX IF NOT EXISTS idx_sales_data_sku ON sales_data(sku);
```

**Note:** The `sales_data` table supports both:
- **Aggregated records**: Uses `products` JSONB array, `csdPC`, `csdUC`, `waterPC`, `waterUC`, `totalUC` fields
- **Line-item records**: Uses individual `sku`, `category`, `quantity`, `rate`, `amount` fields

**Important:** If you already created the sales_data table, run this migration:
```sql
-- Add missing columns to existing sales_data table
ALTER TABLE sales_data 
ADD COLUMN IF NOT EXISTS distributorCode TEXT,
ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS csdPC NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS csdUC NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS waterPC NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS waterUC NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS totalUC NUMERIC DEFAULT 0;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data(distributorCode);
```

## 🔄 Step 4: Enable Row Level Security (RLS)

For now, we'll disable RLS for easier migration. You can enable it later with proper policies:

```sql
-- Disable RLS for all tables (for initial migration)
ALTER TABLE distributors DISABLE ROW LEVEL SECURITY;
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE targets DISABLE ROW LEVEL SECURITY;
ALTER TABLE schemes DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_data DISABLE ROW LEVEL SECURITY;
```

## 🔄 Step 5: Enable Realtime (for subscriptions)

Enable Realtime for tables that need real-time updates:

```sql
-- Enable Realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE distributors;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE targets;
ALTER PUBLICATION supabase_realtime ADD TABLE schemes;
ALTER PUBLICATION supabase_realtime ADD TABLE sales_data;
```

Or enable via Supabase Dashboard:
1. Go to Database → Replication
2. Enable replication for: `distributors`, `orders`, `targets`, `schemes`, `sales_data`

## 🔄 Step 6: Update Your Code

### Option A: Complete Migration (Recommended)

Replace all Firebase imports with Supabase:

1. **Update `src/pages/LoginPage.jsx`:**
   ```javascript
   // Change from:
   import { signInDistributor, signInAdmin, auth } from "../services/firebaseService";
   
   // To:
   import { signInDistributor, signInAdmin, supabase } from "../services/supabaseService";
   ```

2. **Update `src/pages/AdminDashboard.jsx`:**
   ```javascript
   // Change from:
   import { ... } from "../services/firebaseService";
   
   // To:
   import { ... } from "../services/supabaseService";
   ```

3. **Update `src/pages/DistributorDashboard.jsx`:**
   ```javascript
   // Change from:
   import { ... } from "../services/firebaseService";
   
   // To:
   import { ... } from "../services/supabaseService";
   ```

4. **Update `src/layout/AppRouter.jsx`:**
   ```javascript
   // Change from:
   import { onAuthStateChange, ... } from "../services/firebaseService";
   
   // To:
   import { onAuthStateChange, ... } from "../services/supabaseService";
   ```

5. **Update all other components** that import from `firebaseService` to use `supabaseService`

### Option B: Gradual Migration

You can keep both Firebase and Supabase running side-by-side and switch gradually by:

1. Adding a feature flag in your code:
   ```javascript
   const USE_SUPABASE = process.env.REACT_APP_USE_SUPABASE === 'true';
   const service = USE_SUPABASE ? supabaseService : firebaseService;
   ```

2. Testing Supabase with one feature at a time
3. Once everything works, remove Firebase code

## 📊 Step 7: Migrate Existing Data

If you have existing Firebase data, you can migrate it:

1. Export data from Firebase Console
2. Convert to Supabase format (JSON)
3. Use Supabase Dashboard → Table Editor → Import data
   OR
4. Create a migration script to copy data

## ✅ Step 8: Test Everything

1. Test login (distributor and admin)
2. Test creating/updating distributors
3. Test placing orders
4. Test schemes and targets
5. Test real-time subscriptions
6. Test sales data upload

## 🚨 Troubleshooting

### "Supabase not initialized" error
- Check that `.env` file has correct values
- Restart your dev server after adding env variables
- Verify Supabase project is active

### "relation does not exist" error
- Make sure you've run all SQL table creation scripts
- Check table names match exactly (case-sensitive)

### Real-time subscriptions not working
- Enable Realtime in Supabase Dashboard → Database → Replication
- Check that tables are added to replication

### Authentication errors
- Make sure Supabase Auth is enabled in project settings
- Check email templates are configured
- Verify email confirmation settings

## 📝 Notes

- Supabase uses PostgreSQL, which is more powerful than Firestore
- Real-time subscriptions work differently (Postgres changes vs Firestore snapshots)
- Authentication is similar but uses Supabase Auth instead of Firebase Auth
- Storage is separate - use Supabase Storage if needed (similar to Firebase Storage)

## 🎉 Next Steps

1. Set up proper Row Level Security policies for production
2. Configure email templates in Supabase Auth
3. Set up backups
4. Monitor usage in Supabase Dashboard
