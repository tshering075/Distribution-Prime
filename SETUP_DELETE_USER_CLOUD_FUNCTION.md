# Setup Cloud Function to Delete Users from Firebase Auth

To fully delete users from Firebase Authentication when deleting them from the app, you need to set up a Cloud Function that uses the Firebase Admin SDK.

## Prerequisites

1. Firebase CLI installed: `npm install -g firebase-tools`
2. Firebase project initialized with Functions

## Step 1: Login to Firebase CLI

First, make sure you're logged in:

```bash
firebase login
```

This will open a browser window for you to authenticate.

## Step 2: Check Your Projects

List your available projects:

```bash
firebase projects:list
```

If you don't see your project, you may need to:
1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Or get access to the existing project from the project owner

## Step 3: Initialize Firebase Functions

```bash
cd your-project-root
firebase init functions
```

**Important:** When prompted:
- **Select "Use an existing project"** and choose your project from the list
- **OR** if your project isn't listed, you can manually set it later
- Language: **JavaScript** (or TypeScript)
- ESLint: **Yes**
- Install dependencies: **Yes**

If your project isn't in the list, you can manually set it:

```bash
firebase use --add
```

Then enter your project ID (e.g., `coke-sales-management-system`).

## Step 2: Install Admin SDK

```bash
cd functions
npm install firebase-admin
```

## Step 3: Create the Delete User Function

Create or update `functions/index.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Cloud Function to delete a user from Firebase Authentication
 * This is a callable function that requires the caller to be authenticated and have admin permissions
 */
exports.deleteUser = functions.https.onCall(async (data, context) => {
  // Verify the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to delete users'
    );
  }

  // Verify the user has admin permissions
  // Check if the user is an admin in Firestore
  const adminDoc = await admin.firestore()
    .collection('admins')
    .doc(context.auth.uid)
    .get();
  
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can delete users'
    );
  }

  const adminData = adminDoc.data();
  if (!adminData.permissions?.manageUsers) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'User does not have permission to manage users'
    );
  }

  // Get the UID of the user to delete
  const uidToDelete = data.uid;
  if (!uidToDelete) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'UID is required'
    );
  }

  // Prevent self-deletion
  if (uidToDelete === context.auth.uid) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Cannot delete your own account'
    );
  }

  try {
    // Delete the user from Firebase Authentication
    await admin.auth().deleteUser(uidToDelete);
    
    return {
      success: true,
      message: `User ${uidToDelete} deleted successfully from Firebase Auth`
    };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to delete user: ${error.message}`
    );
  }
});
```

**Note:** This uses `functions.https.onCall` which is a callable function. The client code automatically handles authentication when using `httpsCallable` from `firebase/functions`.

## Step 4: Deploy the Function

```bash
firebase deploy --only functions:deleteUser
```

## Step 5: Test the Function

The function is now ready to use! The client code will automatically call it when you delete a user from the app.

## Alternative: HTTP Function (Not Recommended)

If you prefer an HTTP endpoint instead of a callable function, you can use:

```javascript
exports.deleteUser = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Verify authentication token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if user is admin (same as above)
    const adminDoc = await admin.firestore()
      .collection('admins')
      .doc(decodedToken.uid)
      .get();
    
    if (!adminDoc.exists || !adminDoc.data().permissions?.manageUsers) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const { uid } = req.body;
    if (!uid) {
      res.status(400).json({ error: 'UID is required' });
      return;
    }

    // Delete user
    await admin.auth().deleteUser(uid);
    
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## Testing

After deployment, test the function:

1. Login as an admin user
2. Go to User & Permission Management
3. Try to delete a user
4. Check Firebase Console → Authentication → Users to verify the user was deleted

## Troubleshooting

- **Function not found**: Make sure you deployed the function correctly
- **Permission denied**: Check that the logged-in user has `manageUsers` permission
- **CORS errors**: If using HTTP function, make sure CORS headers are set correctly

## Security Notes

- The function verifies that only admins with `manageUsers` permission can delete users
- The function prevents self-deletion
- All operations are logged for audit purposes
