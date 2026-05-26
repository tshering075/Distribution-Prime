# Fix Missing Credentials Column in Supabase

## Problem
You're getting this error when saving distributors:
```
Error: Failed to save to Supabase: Could not find the 'credentials' column of 'distributors' in the schema cache
```

This means your `distributors` table in Supabase doesn't have the `credentials` column.

## Solution: Add the Credentials Column

### Option 1: Add the Column (Recommended)

Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor):

```sql
-- Add credentials column to distributors table
ALTER TABLE distributors 
ADD COLUMN IF NOT EXISTS credentials JSONB DEFAULT '{}'::jsonb;
```

This will:
- Add the `credentials` column as a JSONB type
- Set default value to empty JSON object `{}`
- Won't fail if the column already exists

### Option 2: Keep Current Behavior (Temporary Fix)

The code has been updated to automatically retry without the `credentials` field if the column doesn't exist. However, this means:
- ✅ Distributors will save successfully
- ✅ Username will be saved in the `username` column
- ❌ Password hash won't be stored in Supabase (only in localStorage)

## After Adding the Column

1. Run the SQL command above
2. Try bulk uploading distributors again
3. The `credentials` field will now be saved as JSONB containing:
   ```json
   {
     "username": "DIST001",
     "passwordHash": "hashed_password_here"
   }
   ```

## Verify the Column Was Added

1. Go to Supabase Dashboard → Table Editor → `distributors`
2. Check if `credentials` column appears in the table
3. Or run this query:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'distributors' 
   AND column_name = 'credentials';
   ```

## Complete Distributors Table Schema

If you want to ensure your table has all required columns, here's the complete schema:

```sql
-- Add missing columns if they don't exist
ALTER TABLE distributors 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS credentials JSONB DEFAULT '{}'::jsonb;
```

## Notes

- The `credentials` column stores password hashes for distributor authentication
- If you don't add this column, passwords will only be stored in browser localStorage
- For production, it's recommended to add this column for proper data persistence
