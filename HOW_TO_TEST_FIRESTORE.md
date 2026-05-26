# How to Test if Firebase Firestore is Working

## Method 1: Check Firebase Console (Visual Verification)

### Step 1: Open Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `coke-sales-management-system`
3. Click on **Firestore Database** in the left sidebar

### Step 2: Check for Data
- If Firestore is working, you should see:
  - **Collections** listed (like `distributors`, `orders`, `admins`)
  - **Documents** in those collections
  - **Data** when you click on a collection

### Step 3: Test Real-time Updates
1. Open your app in one browser tab
2. Open Firebase Console in another tab
3. Add or update a distributor in your app
4. Watch the Firestore Console - you should see the data appear/update in real-time

## Method 2: Browser Console Testing

### Step 1: Open Browser Console
1. Open your app: `http://localhost:3000` (or your app URL)
2. Press `F12` or right-click → Inspect → Console tab

### Step 2: Check Firebase Connection
Paste this in the console and press Enter:

```javascript
// Check if Firebase is initialized
console.log("Firebase Auth:", firebase?.auth?.currentUser);
console.log("Firestore DB:", firebase?.firestore?.app);
```

### Step 3: Test Reading Data
Paste this to test reading from Firestore:

```javascript
// Import Firebase functions (if needed)
import { getAllDistributors } from './services/firebaseService';

// Or test directly
const { db } = require('./firebase');
const { collection, getDocs } = require('firebase/firestore');

// Test read
getDocs(collection(db, 'distributors'))
  .then(snapshot => {
    console.log('Distributors from Firestore:', snapshot.docs.map(doc => doc.data()));
  })
  .catch(error => {
    console.error('Firestore read error:', error);
  });
```

### Step 4: Check for Errors
Look for these in the console:
- ✅ **Good signs:**
  - No Firebase errors
  - "Distributor saved to Firestore successfully" messages
  - Data appears in console logs

- ❌ **Bad signs:**
  - "Missing or insufficient permissions" errors
  - "Firebase initialization error" messages
  - Network errors (404, 403)

## Method 3: Test in Your App

### Test 1: Add a Distributor
1. Log in as admin
2. Go to Admin Dashboard
3. Click "Distributors" in sidebar
4. Enter password to access
5. Fill in distributor form:
   - Name: "Test User"
   - Code: Should auto-generate (e.g., "TU123")
   - Username: "testuser"
   - Password: "test123"
6. Click "Register"
7. Check browser console for:
   - ✅ "Distributor saved to Firestore successfully"
   - ❌ "Error saving to Firestore" (if there's an issue)

### Test 2: Check Firebase Console After Adding
1. After adding distributor, go to Firebase Console
2. Navigate to Firestore Database → `distributors` collection
3. You should see a new document with the distributor code as ID
4. Click on it to see the data

### Test 3: Update a Distributor
1. Edit an existing distributor
2. Change some fields (e.g., region, address)
3. Click "Update"
4. Check Firebase Console - the document should update

### Test 4: Real-time Sync Test
1. Open your app in **two different browser windows**
2. In Window 1: Add/update a distributor
3. In Window 2: The distributor list should update automatically (if real-time listeners are working)

## Method 4: Network Tab Verification

### Step 1: Open Network Tab
1. Press `F12` → Network tab
2. Filter by "firestore" or "googleapis"

### Step 2: Perform an Action
1. Add or update a distributor
2. Look for Firestore requests:
   - ✅ **Success:** Status 200, green requests
   - ❌ **Error:** Status 403 (permission denied), 404 (not found), red requests

### Step 3: Check Request Details
Click on a Firestore request to see:
- **Request URL:** Should contain `firestore.googleapis.com`
- **Status Code:** 200 = success, 403 = permission denied
- **Response:** Should contain your data

## Method 5: Quick Diagnostic Script

Add this to your browser console to run a complete test:

```javascript
// Complete Firestore Test
async function testFirestore() {
  console.log("=== Firestore Test ===");
  
  // 1. Check Firebase initialization
  const { db, auth } = await import('./firebase');
  console.log("1. Firebase initialized:", db ? "✅" : "❌");
  
  // 2. Check authentication
  const { getCurrentUser } = await import('./services/firebaseService');
  const user = getCurrentUser();
  console.log("2. User authenticated:", user ? "✅" : "❌ (using localStorage)");
  
  // 3. Test read
  try {
    const { getAllDistributors } = await import('./services/firebaseService');
    const distributors = await getAllDistributors();
    console.log("3. Read test:", distributors.length > 0 ? `✅ Found ${distributors.length} distributors` : "⚠️ No distributors found");
  } catch (error) {
    console.log("3. Read test: ❌ Error:", error.message);
  }
  
  // 4. Test write (create a test document)
  try {
    const { saveDistributor } = await import('./services/firebaseService');
    const testData = {
      code: "TEST" + Date.now(),
      name: "Test Distributor",
      region: "Southern",
      phone: "",
      credentials: { username: "test" },
      target: { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 },
      achieved: { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 }
    };
    await saveDistributor(testData);
    console.log("4. Write test: ✅ Success");
    
    // Clean up - delete test document
    const { deleteDistributor } = await import('./services/firebaseService');
    await deleteDistributor(testData.code);
    console.log("5. Cleanup: ✅ Test document deleted");
  } catch (error) {
    console.log("4. Write test: ❌ Error:", error.message);
    if (error.message.includes("permission")) {
      console.log("   → Fix: Update Firestore security rules");
    }
  }
  
  console.log("=== Test Complete ===");
}

// Run the test
testFirestore();
```

## Common Issues and Solutions

### Issue 1: "Missing or insufficient permissions"
**Solution:** Update Firestore security rules (see `FIREBASE_SECURITY_RULES_FIX.md`)

### Issue 2: "Firebase initialization error"
**Solution:** 
- Check `src/firebase.js` has correct configuration
- Verify Firebase project is active
- Check network connection

### Issue 3: Data not appearing in Firestore
**Possible causes:**
- Security rules blocking writes
- Not authenticated via Firebase Auth
- Data is saving to localStorage only

**Solution:**
- Check browser console for errors
- Verify security rules allow writes
- Check if `isFirebaseConfigured` is true

### Issue 4: Real-time updates not working
**Solution:**
- Check if `subscribeToDistributors` is being called
- Verify security rules allow reads
- Check browser console for subscription errors

## Quick Checklist

- [ ] Firebase Console shows Firestore Database
- [ ] Collections (`distributors`, `orders`) exist
- [ ] Can see documents in collections
- [ ] Adding distributor creates document in Firestore
- [ ] Updating distributor updates document in Firestore
- [ ] Browser console shows no Firestore errors
- [ ] Network tab shows successful Firestore requests (200 status)
- [ ] Real-time updates work (changes appear in other browser windows)

## Expected Behavior

### ✅ Firestore is Working:
- Data appears in Firebase Console
- No permission errors in console
- Success messages when saving
- Real-time updates work
- Network requests return 200 status

### ❌ Firestore is NOT Working:
- Permission errors in console
- Data only in localStorage (not in Firebase Console)
- Network requests return 403/404 errors
- "Firebase initialization error" messages

## Next Steps

If Firestore is not working:
1. Check security rules (most common issue)
2. Verify Firebase configuration
3. Check authentication status
4. Review browser console errors
5. Check network tab for failed requests

See `FIREBASE_SECURITY_RULES_FIX.md` for fixing permission issues.
