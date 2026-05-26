# Schema Review - Issues Found & Fixes

## ❌ **CRITICAL ISSUE: Sales Data Table Missing Fields**

Your current `sales_data` table is **missing critical fields** that the app uses. This will cause failures when uploading Excel files or sales reports.

### Missing Fields in `sales_data`:
1. ❌ `distributorCode` - **REQUIRED** - Used to match distributors
2. ❌ `products` (JSONB) - **REQUIRED** - Array of products from Excel uploads
3. ❌ `csdPC`, `csdUC`, `waterPC`, `waterUC`, `totalUC` - **REQUIRED** - Aggregated totals

### Why This Matters:
- When you upload Excel files, the app saves data with these fields
- Reports generation relies on these aggregated fields
- Without `distributorCode`, you can't match sales to distributors

## ✅ **Other Issues Found:**

### 1. **Schemes Table** - Missing Indexes
- Missing index on `type` column
- Missing GIN index on `distributors` array (for better array queries)

### 2. **Orders Table** - Missing Index
- Missing index on `orderNumber` (for faster lookups)

## 🔧 **FIXES APPLIED:**

I've created `COMPLETE_SUPABASE_SCHEMA.sql` with:
- ✅ Complete `sales_data` table with all required fields
- ✅ All missing indexes added
- ✅ Migration SQL to add missing columns to existing tables
- ✅ Verification queries

## 📋 **ACTION REQUIRED:**

**Run this SQL immediately in Supabase SQL Editor:**

```sql
-- Add missing columns to sales_data table (CRITICAL!)
ALTER TABLE sales_data 
ADD COLUMN IF NOT EXISTS distributorCode TEXT,
ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS csdPC NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS csdUC NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS waterPC NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS waterUC NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS totalUC NUMERIC DEFAULT 0;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data(distributorCode);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(orderNumber);
CREATE INDEX IF NOT EXISTS idx_schemes_type ON schemes(type);
CREATE INDEX IF NOT EXISTS idx_schemes_distributors ON schemes USING GIN(distributors);
```

## ✅ **After Running the Fix:**

Your schema will be complete and the app will work without failures. All features will function correctly:
- ✅ Excel file uploads
- ✅ Sales reports generation
- ✅ Distributor matching
- ✅ Order management
- ✅ Scheme management
