# Bulk Distributor Registration - Supabase Integration

## Overview
When you register distributors in bulk from the app (via Excel upload), they **should be automatically saved to your Supabase database**.

## How It Works

1. **Excel Upload**: You upload an Excel file with distributor data
2. **Validation**: Each distributor is validated (code, name, username, etc.)
3. **Duplicate Check**: System checks against existing distributors in both localStorage and Supabase
4. **Save to Supabase**: For each valid distributor:
   - Calls `saveDistributor()` from `supabaseService.js`
   - Saves to the `distributors` table in Supabase
   - Uses `upsert` (insert or update) based on distributor `code`
5. **Local Storage**: Also saves to browser localStorage as backup
6. **Results**: Shows success/failed/skipped counts

## Verification

### Check Console Logs
When bulk uploading, check the browser console (F12) for:
- `💾 Attempting to save distributor to Supabase: [name] (Code: [code])`
- `✅ Distributor saved to Supabase successfully: [code]`

### Check Supabase Dashboard
1. Go to Supabase Dashboard → Your Project
2. Navigate to **Table Editor** → **distributors** table
3. Verify that new distributors appear in the table

### Check Bulk Upload Results
After bulk upload completes, the dialog shows:
- **Success**: Distributors saved to Supabase ✅
- **Failed**: Distributors that couldn't be saved (check error messages)
- **Skipped**: Distributors that already exist

## Troubleshooting

### Distributors Not Appearing in Supabase

1. **Check Console for Errors**
   - Open browser console (F12)
   - Look for red error messages during bulk upload
   - Common errors:
     - `Supabase not initialized` - Check your Supabase configuration
     - `Permission denied` - Check Supabase RLS (Row Level Security) policies
     - `Distributor code is required` - Excel file missing code column

2. **Check Supabase RLS Policies**
   - Go to Supabase Dashboard → Authentication → Policies
   - Ensure `distributors` table has INSERT/UPDATE policies for authenticated users
   - Or temporarily disable RLS for testing (not recommended for production)

3. **Verify Supabase Connection**
   - Check that `isSupabaseConfigured` is `true` in the app
   - Verify your Supabase URL and anon key in `.env` file

4. **Check Distributor Data**
   - Ensure each distributor has a valid `code` (required, 2-20 alphanumeric)
   - Ensure `name` is provided
   - Check that codes are unique

### Common Issues

**Issue**: "Failed to save to Supabase" errors during bulk upload
- **Solution**: Check Supabase RLS policies allow INSERT/UPDATE operations
- **Solution**: Verify your user has proper permissions in Supabase

**Issue**: Distributors saved locally but not in Supabase
- **Solution**: Check console for specific error messages
- **Solution**: Verify Supabase connection is working (check network tab)

**Issue**: Some distributors succeed, others fail
- **Solution**: Check the "Failed" list in bulk upload results for specific error messages
- **Solution**: Common causes: duplicate codes, missing required fields, invalid data format

## Best Practices

1. **Always Check Results**: Review the success/failed/skipped counts after bulk upload
2. **Verify in Supabase**: Check Supabase Dashboard to confirm distributors were saved
3. **Check Console**: Monitor browser console for any errors during upload
4. **Test with Small Batch**: Try uploading 2-3 distributors first to verify everything works
5. **Keep Excel Format**: Ensure Excel file has required columns: name, code, region, phone, address, username, password

## Excel File Format

Required columns:
- **name**: Distributor name (required)
- **code**: Distributor code (required, 2-20 alphanumeric, unique)
- **region**: Region (Southern, Western, Eastern, PLING, THIM)
- **phone**: Phone number (optional)
- **address**: Address (optional)
- **username**: Username (should match code)
- **password**: Password (will be hashed)

## Code Flow

```
Bulk Upload (DistributorsDialog.jsx)
  ↓
handleBulkUpload()
  ↓
For each distributor:
  ↓
onAdd(payload, true)  // suppressAlert=true
  ↓
handleAddDistributor() (AdminDashboard.jsx)
  ↓
if (isSupabaseConfigured):
  ↓
saveDistributor(payload)  // supabaseService.js
  ↓
Supabase upsert to 'distributors' table
  ↓
Success: ✅ Saved to Supabase
Error: ❌ Marked as failed in bulk upload results
```

## Need Help?

If distributors are still not saving to Supabase:
1. Check browser console for specific error messages
2. Verify Supabase RLS policies
3. Test with a single distributor first (not bulk)
4. Check Supabase Dashboard → Logs for any database errors
