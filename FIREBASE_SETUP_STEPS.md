# Firebase Setup - Step by Step Guide

Follow these steps to complete your Firebase setup. **Time: 10-15 minutes**

## Step 1: Enable Authentication ✅

1. In Firebase Console, click on **"Authentication"** in the left sidebar
2. Click on **"Get started"** (if you see it) or go to the **"Sign-in method"** tab
3. Click on **"Email/Password"**
4. Toggle **"Enable"** to ON
5. Click **"Save"**

✅ **You should see:** Email/Password is now enabled

---

## Step 2: Create Firestore Database ✅

1. Click on **"Firestore Database"** in the left sidebar
2. Click **"Create database"** button
3. Choose **"Start in production mode"** (recommended)
   - Don't worry, we'll set security rules next
4. Select a location (choose the closest to you or your users)
   - Examples: `us-east1`, `us-central`, `asia-south1`, etc.
5. Click **"Enable"**
   - Wait for database creation (takes ~30 seconds)

✅ **You should see:** A Firestore Database dashboard with "Start collection" button

---

## Step 3: Set Security Rules 🔒

1. In Firestore Database, click on the **"Rules"** tab at the top
2. You'll see default rules. **Replace everything** with the rules below:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Distributors collection
    match /distributors/{distributorId} {
      // Admins can read/write all distributors
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
      
      // Distributors can only read their own data
      allow read: if request.auth != null && 
        resource.data.uid == request.auth.uid;
      
      // Distributors can update their own data
      allow update: if request.auth != null && 
        resource.data.uid == request.auth.uid;
    }
    
    // Orders collection
    match /orders/{orderId} {
      // Admins can read/write all orders
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
      
      // Distributors can create and read their own orders
      allow create: if request.auth != null;
      allow read: if request.auth != null && 
        (resource.data.distributorCode == request.auth.uid || 
         exists(/databases/$(database)/documents/admins/$(request.auth.uid)));
    }
    
    // Admins collection
    match /admins/{adminId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == adminId;
    }
  }
}
```

3. Click **"Publish"** button

✅ **You should see:** "Rules published successfully"

---

## Step 4: Create Your First Admin Account 👤

### Option A: Create Admin Through Console (Recommended)

#### Part A: Create Authentication User

1. Go to **"Authentication"** → **"Users"** tab
2. Click **"Add user"** button
3. Enter:
   - **Email:** your admin email (e.g., `admin@coke.com`)
   - **Password:** your secure password (e.g., `Admin123!`)
4. Click **"Add user"**
5. **IMPORTANT:** Copy the **User UID** (you'll see it in the list - looks like: `abc123xyz456...`)
   - Click on the user to see full details
   - Copy the UID

#### Part B: Create Admin Document in Firestore

1. Go to **"Firestore Database"** → **"Data"** tab
2. Click **"Start collection"**
3. Collection ID: type `admins` (exactly as shown)
4. Click **"Next"**
5. Document ID: **Paste the UID you copied** (or click "Auto-ID" and paste UID after)
6. Add these fields one by one:

   **Field 1:**
   - Field name: `email`
   - Type: `string`
   - Value: (your admin email)
   
   **Field 2:**
   - Field name: `name`
   - Type: `string`
   - Value: `Admin`
   
   **Field 3:**
   - Field name: `uid`
   - Type: `string`
   - Value: (paste the same UID again)
   
   **Field 4:**
   - Field name: `createdAt`
   - Type: `timestamp`
   - Value: (click the clock icon, select "now")

7. Click **"Save"**

✅ **You should see:** An `admins` collection with your admin document

---

## Step 5: Verify Your Firebase Configuration 🔍

1. Go to **"Project Settings"** (gear icon next to "Project Overview")
2. Scroll down to **"Your apps"** section
3. Make sure you see a Web app configured
4. If not, click **"Add app"** → **Web icon (</>)** → Register app
5. Copy the config if needed and verify it matches your `src/firebase.js` file

**Your config should match:**
- Project ID: `coke-sales-management-system`
- API Key should match
- Auth Domain should match

---

## ✅ Setup Complete Checklist

- [ ] Authentication enabled (Email/Password)
- [ ] Firestore Database created
- [ ] Security rules published
- [ ] Admin user created in Authentication
- [ ] Admin document created in Firestore `admins` collection
- [ ] Firebase config verified

---

## 🎯 What's Next?

Once all steps above are complete, you can:

1. **Test Firebase connection** - Run your app and check browser console
2. **Start integrating** - Use Firebase functions in your app
3. **Create distributors** - They'll be stored in Firestore automatically

---

## 🆘 Troubleshooting

### "Permission denied" error
- Make sure you published the security rules (Step 3)
- Check that rules are saved correctly

### "Collection not found"
- Collections are created automatically when you add data
- Or create them manually in Firestore Console

### "User not found"
- Verify admin user exists in Authentication
- Verify admin document exists in Firestore `admins` collection
- Check that UID in admin document matches Authentication UID

### Can't find "Firestore Database"
- Make sure you're in the correct Firebase project
- Try refreshing the page
- Check if database is still creating (wait a minute)

---

## 📞 Need Help?

1. Check browser console for specific error messages
2. Verify each step was completed
3. Check `FIREBASE_SETUP_GUIDE.md` for detailed explanations

**Once all steps are done, your Firebase backend is ready to use! 🎉**

