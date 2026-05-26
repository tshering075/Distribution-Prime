# Fix: "Missing or insufficient permissions" Error

## Quick Fix - Update Firestore Security Rules

Your data is being saved locally, but Firestore is blocking cloud writes. Follow these steps:

### Step 1: Open Firebase Console
1. Go to: https://console.firebase.google.com/
2. Select your project: **coke-sales-management-system**

### Step 2: Navigate to Firestore Rules
1. Click **Firestore Database** in the left sidebar
2. Click the **Rules** tab at the top

### Step 3: Replace the Rules
Copy and paste this code into the rules editor:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Distributors collection - allow authenticated users to read/write
    match /distributors/{distributorId} {
      allow read, write: if request.auth != null;
    }
    
    // Orders collection - allow authenticated users to read/write
    match /orders/{orderId} {
      allow read, write: if request.auth != null;
    }
    
    // Admins collection
    match /admins/{adminId} {
      allow read, write: if request.auth != null && request.auth.uid == adminId;
    }
  }
}
```

### Step 4: Publish the Rules
1. Click the **Publish** button (top right)
2. Wait for confirmation: "Rules published successfully"

### Step 5: Test
1. Go back to your app
2. Try adding or updating a distributor
3. Check browser console - you should see "Distributor saved to Firestore successfully"
4. Check Firebase Console - the data should appear in Firestore

## Alternative: Development Rules (Less Secure - Testing Only)

If you need to test immediately without authentication, use these rules temporarily:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **WARNING**: This allows anyone to read/write your database. Only use for testing!

## Why This Happens

The error occurs because:
1. Your app tries to write to Firestore
2. The current security rules require specific authentication/permissions
3. Since you're using localStorage authentication (not Firebase Auth), Firestore blocks the write
4. The app gracefully falls back to localStorage (which is why you see "saving locally")

## Current Status

✅ **Good news:** Your data IS being saved (to localStorage)  
❌ **Issue:** Data is NOT syncing to Firestore cloud  
✅ **Solution:** Update the security rules above

## After Fixing Rules

Once you update and publish the rules:
- ✅ Data will save to both localStorage AND Firestore
- ✅ Data will sync across devices
- ✅ Real-time updates will work
- ✅ No more permission errors

## Still Having Issues?

If you still get errors after updating rules:

1. **Wait a few seconds** - Rules can take 10-30 seconds to propagate
2. **Refresh your app** - Close and reopen the browser
3. **Check the rules were published** - Go back to Rules tab, verify they show "Published"
4. **Check browser console** - Look for specific error messages
5. **Try the development rules** - Use the less secure rules temporarily to test if it's a rules issue

## Verify It's Working

After updating rules, verify:
1. Add a distributor in your app
2. Check browser console - should see "Distributor saved to Firestore successfully" (no warnings)
3. Go to Firebase Console → Firestore Database → `distributors` collection
4. You should see the new distributor document

If all these work, Firestore is now properly configured! 🎉
