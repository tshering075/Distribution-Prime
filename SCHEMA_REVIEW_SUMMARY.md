# SQL Schema Review & Fixes Summary

## ✅ Schema Review Complete

I've reviewed your SQL schema against your app requirements and made the following fixes:

## 🔧 Changes Made

### 1. **Orders Table** ✅
- **Status**: Already correct
- **Added**: Index on `orderNumber` for better query performance
- **All fields present**: distributorCode, distributorName, data, timestamp, totalUC, csdUC, waterUC, csdPC, waterPC, orderNumber, tableImageData

### 2. **Sales Data Table** ⚠️ **FIXED**
- **Missing Fields Added**:
  - `distributorCode` - For matching distributors
  - `products` (JSONB) - Array of products: `[{sku, category, quantity, rate, amount}, ...]`
  - `csdPC`, `csdUC`, `waterPC`, `waterUC`, `totalUC` - Aggregated totals
- **Why**: Your app saves sales data in two formats:
  1. **Aggregated records** (from Excel uploads): Uses `products` array + aggregated totals
  2. **Line-item records**: Uses individual `sku`, `category`, `quantity`, `rate`, `amount` fields
- **Added**: Index on `distributorCode` for better performance

### 3. **Schemes Table** ✅
- **Status**: Already updated with all required fields
- **All fields present**: appliesTo, schemeDescription, discountAmount, appliesToSKUs

### 4. **Admins Table** ✅
- **Status**: Already correct
- **All fields present**: id, uid, email, name, role, permissions, last_active, created_at, updated_at

### 5. **Targets Table** ✅
- **Status**: Already correct
- **All fields present**: id, distributorCode, CSD_PC, CSD_UC, Water_PC, Water_UC, updated_at, updated_by

### 6. **Distributors Table** ✅
- **Status**: Already updated with phone and credentials columns
- **All fields present**: id, code, name, email, username, uid, region, address, phone, credentials, target, achieved, created_at, updated_at

## 📋 Migration SQL

If you already created the `sales_data` table, run this to add missing columns:

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

-- Add index for distributorCode
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor_code ON sales_data(distributorCode);
```

## ✅ Final Status

All tables are now properly configured to match your app requirements. The schema supports:
- ✅ Order management with all fields
- ✅ Sales data in both aggregated and line-item formats
- ✅ Scheme management with all required fields
- ✅ Distributor management with credentials
- ✅ Target tracking
- ✅ Admin management

## 🚀 Next Steps

1. Run the migration SQL above if you have an existing `sales_data` table
2. Test creating orders, uploading sales data, and managing schemes
3. All features should now work correctly with Supabase!
