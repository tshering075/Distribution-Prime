# Debug: Distributor Not Showing in Firebase Database

## Quick Diagnostic Steps

### Step 1: Check Browser Console
1. Open your app
2. Press `F12` to open Developer Tools
3. Go to **Console** tab
4. Try adding a distributor
5. Look for these messages:

**✅ Good signs:**
- "Distributor saved to Firestore successfully"
- No error messages

**❌ Bad signs:**
- "Missing or insufficient permissions"
- "Error saving to Firestore"
- "Firestore permission denied"

### Step 2: Check Network Tab
1. Press `F12` → **Network** tab
2. Filter by "firestore" or "googleapis"
3. Try adding a distributor
4. Look for Firestore requests:
   - **Status 200** = Success ✅
   - **Status 403** = Permission denied ❌
   - **Status 404** = Not found ❌

### Step 3: Check Firebase Console
1. Go to https://console.firebase.google.com/
2. Select project: `coke-sales-management-system`
3. Go to **Firestore Database**
4. Check if `distributors` collection exists
5. If it exists, check if there are any documents

---

## Most Likely Issue: Security Rules

If you see "Missing or insufficient permissions" in console, your Firestore security rules are blocking writes.

### Fix: Update Security Rules

1. Go to Firebase Console → Firestore Database → **Rules** tab
2. Replace with this code:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Distributors - allow authenticated users
    match /distributors/{distributorId} {
      allow read, write: if request.auth != null;
    }
    
    // Orders - allow authenticated users
    match /orders/{orderId} {
      allow read, write: if request.auth != null;
    }
    
    // Admins
    match /admins/{adminId} {
      allow read, write: if request.auth != null && request.auth.uid == adminId;
    }
  }
}
```

3. Click **Publish**
4. Wait 10-30 seconds
5. Try adding distributor again

---

## Alternative: Development Rules (Testing Only)

If you need to test immediately without authentication:

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

⚠️ **WARNING**: This allows anyone to read/write. Only for testing!

---

## Check Current Status

Run this in browser console to check Firebase status:

```javascript
// Check Firebase status
console.log("Firebase Auth:", firebase?.auth?.currentUser);
console.log("Firebase DB:", firebase?.firestore?.app?.name);

// Check if distributor was saved locally
const local = localStorage.getItem("coke_distributors");
console.log("Local distributors:", local ? JSON.parse(local).length : 0);
```

---

## Common Issues

### Issue 1: Permission Denied
**Symptom:** "Missing or insufficient permissions" error
**Fix:** Update security rules (see above)

### Issue 2: Not Authenticated
**Symptom:** Rules require `request.auth != null` but user isn't authenticated
**Fix:** Either authenticate via Firebase Auth OR use development rules

### Issue 3: Rules Not Published
**Symptom:** Updated rules but still getting errors
**Fix:** Make sure you clicked "Publish" and wait 30 seconds

### Issue 4: Data Saving Locally Only
**Symptom:** Distributor appears in app but not in Firebase Console
**Fix:** This means Firestore write failed, but localStorage saved it. Fix security rules.

---

## Verify It's Working

After fixing rules:

1. Add a distributor
2. Check browser console - should see "Distributor saved to Firestore successfully"
3. Go to Firebase Console → Firestore Database
4. You should see:
   - `distributors` collection
   - Document with distributor code as ID
   - All distributor data

If all these work, Firestore is now working! 🎉
