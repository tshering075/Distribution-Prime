# Fix: Missing or Insufficient Permissions Error

## Problem
You're getting "Missing or insufficient permissions" when trying to add or update distributors in Firestore.

## Solution: Update Firestore Security Rules

The issue is that your Firestore security rules are blocking write operations. Here are the updated rules:

### Option 1: Allow Authenticated Users (Recommended for Production)

Go to **Firebase Console** → **Firestore Database** → **Rules** and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Distributors collection
    match /distributors/{distributorId} {
      // Allow read/write for authenticated users
      allow read, write: if request.auth != null;
    }
    
    // Orders collection
    match /orders/{orderId} {
      // Allow read/write for authenticated users
      allow read, write: if request.auth != null;
    }
    
    // Admins collection
    match /admins/{adminId} {
      // Users can read/write their own admin document
      allow read, write: if request.auth != null && request.auth.uid == adminId;
    }
  }
}
```

### Option 2: Development Mode (Less Secure - Use for Testing Only)

If you want to test without authentication, use these rules (⚠️ **ONLY FOR DEVELOPMENT**):

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

⚠️ **WARNING**: Option 2 allows anyone to read/write your database. Only use this for development/testing!

## How to Apply the Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `coke-sales-management-system`
3. Go to **Firestore Database** → **Rules** tab
4. Paste one of the rule sets above
5. Click **Publish**

## Why This Happens

The error occurs because:
1. Your app is trying to write to Firestore
2. The current security rules require specific authentication/permissions
3. Either the user isn't authenticated via Firebase Auth, or the rules are too restrictive

## Additional Steps

### If Using Option 1 (Authenticated Users):

You need to ensure users are authenticated via Firebase Auth. The app currently uses localStorage authentication as a fallback, but Firestore requires Firebase Auth.

**To authenticate as admin:**
1. The app should authenticate you via Firebase Auth when you log in
2. If you're using localStorage login, you need to also sign in via Firebase Auth

**Quick Fix - Update Login to Use Firebase Auth:**

The app already tries Firebase Auth first, but if it fails, it falls back to localStorage. Make sure:
- You have an admin account created in Firebase Authentication
- You're logging in with that account

### Create Admin Account in Firebase

1. Go to **Firebase Console** → **Authentication** → **Users**
2. Click **Add user**
3. Enter admin email and password
4. Note the UID
5. Go to **Firestore Database**
6. Create a document in `admins` collection:
   - Document ID: (the UID from step 4)
   - Fields:
     - `email`: (admin email)
     - `name`: "Admin"
     - `uid`: (same as document ID)

## Testing

After updating the rules:

1. **Publish the rules** (important!)
2. Wait a few seconds for rules to propagate
3. Try adding/updating a distributor again
4. Check browser console for any errors

## If Still Not Working

1. **Check Authentication Status:**
   - Open browser console (F12)
   - Check if you're authenticated: `firebase.auth().currentUser`
   - If null, you need to authenticate via Firebase Auth

2. **Check Rules Are Published:**
   - Go to Firestore → Rules
   - Make sure you clicked "Publish"
   - Rules should show "Published" status

3. **Check Browser Console:**
   - Look for specific error messages
   - Check network tab for Firestore requests

4. **Temporary Workaround:**
   - Use Option 2 (development rules) temporarily to test
   - Then switch back to Option 1 once authentication is working

## Recommended Approach

For your use case, I recommend **Option 1** with a slight modification to allow writes for any authenticated user. This is secure enough for most applications where you control who can authenticate.

If you need more granular control (only admins can write), you'll need to:
1. Ensure users are authenticated via Firebase Auth
2. Check if they're in the `admins` collection
3. Update rules accordingly
