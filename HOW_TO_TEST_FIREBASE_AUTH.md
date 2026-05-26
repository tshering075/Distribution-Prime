# How to Test Firebase Authentication

This guide will help you verify that Firebase Auth is working properly in your app.

## 🚀 Quick Test Methods

### Method 1: Browser Console Test (Fastest)

1. **Start your app:**
   ```bash
   npm start
   ```

2. **Open browser console:**
   - Press `F12` or right-click → Inspect → Console tab
   - Or press `Ctrl+Shift+J` (Windows) / `Cmd+Option+J` (Mac)

3. **Check Firebase Auth initialization:**
   Paste this code in the console:
   ```javascript
   // Check if Firebase Auth is initialized
   import('./firebase').then(({ auth }) => {
     console.log('Firebase Auth initialized:', auth !== null);
     console.log('Current user:', auth?.currentUser);
     if (auth?.currentUser) {
       console.log('✅ User is logged in:', auth.currentUser.email);
     } else {
       console.log('ℹ️ No user logged in');
     }
   });
   ```

4. **Test login function:**
   ```javascript
   // Test admin login (replace with your actual admin email/password)
   import('./services/firebaseService').then(({ signInAdmin }) => {
     signInAdmin('admin@example.com', 'your-password')
       .then(admin => {
         console.log('✅ Admin login successful:', admin);
       })
       .catch(error => {
         console.error('❌ Admin login failed:', error.message);
       });
   });
   ```

---

## 📋 Method 2: Step-by-Step Manual Test

### Step 1: Check Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `coke-sales-management-system`
3. Click **Authentication** in the left sidebar
4. Check:
   - ✅ **Sign-in method** tab → Email/Password should be **Enabled**
   - ✅ **Users** tab → Should show registered users (or be empty if none)

### Step 2: Test Login in Your App

1. **Start your app:**
   ```bash
   npm start
   ```

2. **Open the login page:**
   - Go to `http://localhost:3000`
   - You should see the login form

3. **Test Admin Login:**
   - Enter your admin email and password
   - Click "Sign In"
   - **Expected results:**
     - ✅ Success message appears
     - ✅ Redirects to Admin Dashboard
     - ✅ Browser console shows: `✅ Admin email stored: your-email@example.com`
     - ✅ Firebase Console → Authentication → Users shows your email

4. **Test Distributor Login:**
   - Logout first (if logged in)
   - Enter distributor email and password
   - Click "Sign In"
   - **Expected results:**
     - ✅ Success message appears
     - ✅ Redirects to Distributor Dashboard
     - ✅ Shows distributor name

### Step 3: Check Browser Console for Errors

1. Open browser console (F12)
2. Look for:
   - ✅ **Good signs:**
     - No Firebase Auth errors
     - `✅ Admin email stored: ...` message
     - `Firebase auth failed, trying localStorage fallback` (only if Firebase fails)
   
   - ❌ **Bad signs:**
     - `Firebase initialization error`
     - `auth/user-not-found`
     - `auth/wrong-password`
     - `auth/invalid-email`
     - `auth/email-already-in-use`

---

## 🔍 Method 3: Network Tab Verification

1. **Open Network Tab:**
   - Press `F12` → Network tab
   - Filter by "identitytoolkit" or "firebase"

2. **Try to login:**
   - Enter credentials and click Sign In

3. **Check Network Requests:**
   - Look for requests to `identitytoolkit.googleapis.com`
   - **Success:** Status 200 (green)
   - **Error:** Status 400/401 (red) - check the error message

4. **Check Request Details:**
   - Click on the request
   - Check **Response** tab for error messages
   - Check **Headers** tab for authentication tokens

---

## 🧪 Method 4: Create Test Users

### Create Admin User in Firebase Console:

1. Go to Firebase Console → Authentication → Users
2. Click **Add user**
3. Enter:
   - Email: `admin@test.com`
   - Password: `test123456`
4. Click **Add user**

5. **Create Admin Document in Firestore:**
   - Go to Firestore Database
   - Create collection: `admins`
   - Create document with ID = user's UID (from Authentication → Users)
   - Add fields:
     ```json
     {
       "email": "admin@test.com",
       "role": "admin",
       "createdAt": "2024-01-01"
     }
     ```

### Create Distributor User:

1. **In Firebase Console → Authentication:**
   - Add user with email: `distributor@test.com`
   - Password: `test123456`

2. **In Firestore Database:**
   - Create collection: `distributors`
   - Create document with ID = user's UID
   - Add fields:
     ```json
     {
       "code": "TEST001",
       "name": "Test Distributor",
       "email": "distributor@test.com",
       "region": "Southern",
       "target": { "CSD_PC": 0, "CSD_UC": 0, "Water_PC": 0, "Water_UC": 0 },
       "achieved": { "CSD_PC": 0, "CSD_UC": 0, "Water_PC": 0, "Water_UC": 0 }
     }
     ```

3. **Test Login:**
   - Use `distributor@test.com` / `test123456` to login
   - Should redirect to Distributor Dashboard

---

## 📝 Method 5: Complete Test Script

Create a test file `test-auth.js` in your `src` folder:

```javascript
// Test Firebase Authentication
import { auth, db } from './firebase';
import { signInAdmin, signInDistributor, getCurrentUser, signOutUser } from './services/firebaseService';
import { collection, doc, getDoc } from 'firebase/firestore';

async function testFirebaseAuth() {
  console.log('=== Firebase Auth Test ===\n');
  
  // Test 1: Check Firebase initialization
  console.log('1. Checking Firebase initialization...');
  if (auth === null) {
    console.log('   ❌ Firebase Auth is NOT initialized');
    console.log('   → Check src/firebase.js configuration');
    return;
  }
  console.log('   ✅ Firebase Auth is initialized');
  
  // Test 2: Check current user
  console.log('\n2. Checking current user...');
  const currentUser = getCurrentUser();
  if (currentUser) {
    console.log('   ✅ User is logged in:', currentUser.email);
  } else {
    console.log('   ℹ️ No user logged in');
  }
  
  // Test 3: Test admin login (replace with your credentials)
  console.log('\n3. Testing admin login...');
  try {
    const admin = await signInAdmin('admin@test.com', 'test123456');
    console.log('   ✅ Admin login successful');
    console.log('   Admin data:', admin);
    
    // Test logout
    await signOutUser();
    console.log('   ✅ Logout successful');
  } catch (error) {
    console.log('   ❌ Admin login failed:', error.message);
    if (error.message.includes('user-not-found')) {
      console.log('   → Create admin user in Firebase Console first');
    }
  }
  
  // Test 4: Test distributor login
  console.log('\n4. Testing distributor login...');
  try {
    const distributor = await signInDistributor('distributor@test.com', 'test123456');
    console.log('   ✅ Distributor login successful');
    console.log('   Distributor data:', distributor);
    
    // Test logout
    await signOutUser();
    console.log('   ✅ Logout successful');
  } catch (error) {
    console.log('   ❌ Distributor login failed:', error.message);
    if (error.message.includes('user-not-found')) {
      console.log('   → Create distributor user in Firebase Console first');
    }
  }
  
  // Test 5: Check Firestore connection
  console.log('\n5. Testing Firestore connection...');
  try {
    const adminsRef = collection(db, 'admins');
    console.log('   ✅ Firestore connection successful');
  } catch (error) {
    console.log('   ❌ Firestore connection failed:', error.message);
  }
  
  console.log('\n=== Test Complete ===');
}

// Run test
testFirebaseAuth();
```

Then import it in `src/index.js` temporarily:
```javascript
import './test-auth';
```

---

## ✅ Success Indicators

### Firebase Auth is Working When:

1. ✅ **Login succeeds** without errors
2. ✅ **User appears in Firebase Console** → Authentication → Users
3. ✅ **No console errors** related to Firebase Auth
4. ✅ **Network requests return 200** status
5. ✅ **Admin email stored** in localStorage after login
6. ✅ **Redirects to correct dashboard** after login
7. ✅ **User persists** after page refresh (if using Firebase Auth)

---

## ❌ Common Issues & Solutions

### Issue 1: "auth/user-not-found"
**Meaning:** User doesn't exist in Firebase Authentication
**Solution:**
- Create user in Firebase Console → Authentication → Users
- Or use the registration function in your app

### Issue 2: "auth/wrong-password"
**Meaning:** Password is incorrect
**Solution:**
- Check password in Firebase Console
- Reset password if needed

### Issue 3: "auth/invalid-email"
**Meaning:** Email format is invalid
**Solution:**
- Use valid email format: `user@example.com`

### Issue 4: "auth/email-already-in-use"
**Meaning:** Email is already registered
**Solution:**
- Use different email or login with existing account

### Issue 5: "Firebase initialization error"
**Meaning:** Firebase config is incorrect
**Solution:**
- Check `src/firebase.js` configuration
- Verify API keys in Firebase Console → Project Settings

### Issue 6: "Admin account not found" or "Distributor account not found"
**Meaning:** User exists in Auth but not in Firestore
**Solution:**
- Create corresponding document in Firestore:
  - For admin: Create in `admins` collection with UID as document ID
  - For distributor: Create in `distributors` collection with UID as document ID

### Issue 7: Login falls back to localStorage
**Meaning:** Firebase Auth is not working, using fallback
**Solution:**
- Check browser console for Firebase errors
- Verify Firebase is initialized: `auth !== null`
- Check network tab for failed requests

---

## 🎯 Quick Checklist

- [ ] Firebase Console → Authentication → Sign-in method → Email/Password is **Enabled**
- [ ] Firebase Console → Authentication → Users shows registered users
- [ ] Can login with admin credentials
- [ ] Can login with distributor credentials
- [ ] Admin email stored in localStorage after login
- [ ] No Firebase Auth errors in browser console
- [ ] Network requests return 200 status
- [ ] User persists after page refresh
- [ ] Logout works correctly

---

## 🔧 Debugging Tips

1. **Enable verbose logging:**
   ```javascript
   // In browser console
   localStorage.setItem('firebase:debug', '*');
   ```

2. **Check Firebase Auth state:**
   ```javascript
   // In browser console
   import('./firebase').then(({ auth }) => {
     auth.onAuthStateChanged(user => {
       console.log('Auth state changed:', user);
     });
   });
   ```

3. **Check localStorage:**
   ```javascript
   // In browser console
   console.log('Admin email:', localStorage.getItem('admin_email'));
   console.log('Role:', localStorage.getItem('role'));
   ```

4. **Check Firestore documents:**
   - Go to Firebase Console → Firestore Database
   - Verify `admins` and `distributors` collections exist
   - Check document IDs match user UIDs from Authentication

---

## 📞 Still Having Issues?

1. **Check Browser Console:**
   - Press F12 → Console tab
   - Look for red error messages
   - Copy error messages

2. **Check Network Tab:**
   - Press F12 → Network tab
   - Filter by "identitytoolkit" or "firebase"
   - Check failed requests

3. **Verify Firebase Configuration:**
   - Check `src/firebase.js` matches your Firebase project
   - Verify API keys in Firebase Console → Project Settings → General

4. **Check Firebase Console:**
   - Authentication → Users should show registered users
   - Firestore Database → Collections should exist

---

## 🎉 Success!

If all tests pass, your Firebase Auth is working correctly! You should be able to:
- Login as admin
- Login as distributor
- See users in Firebase Console
- No errors in browser console
