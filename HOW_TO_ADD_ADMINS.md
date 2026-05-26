# How to Add More Admins in Firebase

This guide shows you how to add additional admin users to your Firebase project.

## 🚀 Method 1: Using Firebase Console (Easiest - Recommended)

### Step 1: Create User in Firebase Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `coke-sales-management-system`
3. Click **Authentication** in the left sidebar
4. Click **Users** tab
5. Click **Add user** button (top right)
6. Enter:
   - **Email:** `newadmin@example.com` (use the admin's email)
   - **Password:** `SecurePassword123!` (choose a strong password)
7. Click **Add user**
8. **Copy the User UID** (you'll need this in the next step)
   - The UID appears in the user list or when you click on the user

### Step 2: Create Admin Document in Firestore

1. In Firebase Console, click **Firestore Database** in the left sidebar
2. Check if `admins` collection exists:
   - If it exists, click on it
   - If it doesn't exist, click **Start collection** and name it `admins`
3. Click **Add document** (or click on existing collection)
4. **Set Document ID:**
   - Click the document ID field
   - **IMPORTANT:** Paste the **User UID** from Step 1 (not a random ID!)
   - This must match the UID from Authentication
5. Add these fields:
   - Click **Add field** for each:
   
   | Field Name | Type | Value |
   |------------|------|-------|
   | `email` | string | `newadmin@example.com` |
   | `name` | string | `Admin Full Name` |
   | `role` | string | `admin` |
   | `createdAt` | timestamp | Click "Set" to use current time |

6. Click **Save**

### Step 3: Test the New Admin

1. Go to your app login page
2. Login with:
   - **User ID:** `newadmin@example.com`
   - **Password:** The password you set in Step 1
3. You should be redirected to Admin Dashboard ✅

---

## 🔧 Method 2: Using Code (Programmatic)

If you want to add admins programmatically, you can use the `createAdminAccount` function.

### Option A: Browser Console Script

1. **Login as existing admin** in your app
2. **Open browser console** (F12)
3. **Paste and run this code:**

```javascript
// Import Firebase functions
import('./services/firebaseService').then(({ createAdminAccount }) => {
  // Create new admin
  createAdminAccount({
    email: 'newadmin@example.com',
    password: 'SecurePassword123!',
    name: 'New Admin Name'
  })
    .then(admin => {
      console.log('✅ Admin created successfully:', admin);
      alert('Admin created! They can now login with: ' + admin.email);
    })
    .catch(error => {
      console.error('❌ Error creating admin:', error);
      alert('Error: ' + error.message);
    });
});
```

### Option B: Create Admin Management Component

You can add an admin management section to your Admin Dashboard. Here's a simple component:

**Create `src/components/AdminManagementDialog.jsx`:**

```javascript
import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
} from "@mui/material";
import { createAdminAccount } from "../services/firebaseService";

function AdminManagementDialog({ open, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCreateAdmin = async () => {
    setError("");
    setSuccess(false);
    
    if (!email || !password || !name) {
      setError("All fields are required");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    try {
      const admin = await createAdminAccount({
        email: email.trim(),
        password: password,
        name: name.trim()
      });
      
      setSuccess(true);
      setEmail("");
      setPassword("");
      setName("");
      
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (error) {
      setError(error.message || "Failed to create admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Admin</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Admin created successfully! They can now login.
          </Alert>
        )}
        
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            fullWidth
            label="Admin Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            helperText="Minimum 6 characters"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleCreateAdmin} 
          variant="contained" 
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Admin"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AdminManagementDialog;
```

Then add it to your Admin Dashboard:

```javascript
// In AdminDashboard.jsx
import AdminManagementDialog from "../components/AdminManagementDialog";

// Add state
const [adminDialogOpen, setAdminDialogOpen] = useState(false);

// Add button in sidebar or settings
<Button onClick={() => setAdminDialogOpen(true)}>
  Manage Admins
</Button>

// Add dialog
<AdminManagementDialog 
  open={adminDialogOpen} 
  onClose={() => setAdminDialogOpen(false)} 
/>
```

---

## 📋 Method 3: Bulk Import (Multiple Admins)

If you need to add multiple admins at once:

### Step 1: Prepare CSV/Excel File

Create a file with columns:
- `email`
- `password` (temporary, will be changed)
- `name`

Example:
```csv
email,password,name
admin1@example.com,Password123!,Admin One
admin2@example.com,Password123!,Admin Two
admin3@example.com,Password123!,Admin Three
```

### Step 2: Use Firebase Console Import

1. Go to Firebase Console → Authentication → Users
2. Click **Import users** (if available)
3. Upload your CSV file
4. Map columns correctly
5. Click **Import**

### Step 3: Create Firestore Documents

For each imported user:
1. Get their UID from Authentication → Users
2. Create document in Firestore `admins` collection with:
   - Document ID = User UID
   - Fields: `email`, `name`, `role: "admin"`

---

## ✅ Verification Checklist

After adding an admin, verify:

- [ ] User appears in Firebase Console → Authentication → Users
- [ ] Document exists in Firestore → `admins` collection
- [ ] Document ID matches User UID
- [ ] Can login with email/password
- [ ] Redirects to Admin Dashboard
- [ ] Has admin permissions

---

## 🔍 Troubleshooting

### Issue 1: "Admin account not found"
**Cause:** User exists in Authentication but not in Firestore
**Solution:** Create document in `admins` collection with UID as document ID

### Issue 2: "auth/email-already-in-use"
**Cause:** Email is already registered
**Solution:** Use different email or check existing users

### Issue 3: "auth/invalid-email"
**Cause:** Email format is invalid
**Solution:** Use valid email format: `user@example.com`

### Issue 4: "auth/weak-password"
**Cause:** Password is too weak
**Solution:** Use password with at least 6 characters

### Issue 5: Can login but no admin access
**Cause:** Document ID doesn't match User UID
**Solution:** 
1. Get User UID from Authentication → Users
2. Update Firestore document ID to match UID

---

## 📝 Admin Document Structure

Each admin document in Firestore should have:

```json
{
  "email": "admin@example.com",
  "name": "Admin Full Name",
  "role": "admin",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Important:** Document ID must be the User UID from Authentication!

---

## 🎯 Quick Reference

### Required Steps:
1. ✅ Create user in Firebase Authentication
2. ✅ Copy User UID
3. ✅ Create document in Firestore `admins` collection
4. ✅ Use UID as document ID
5. ✅ Add email, name, role fields
6. ✅ Test login

### Quick Test:
```javascript
// In browser console after login
import('./services/firebaseService').then(({ getCurrentUser, getAdminByUid }) => {
  const user = getCurrentUser();
  if (user) {
    getAdminByUid(user.uid).then(admin => {
      console.log('Admin data:', admin);
    });
  }
});
```

---

## 💡 Best Practices

1. **Use strong passwords** (minimum 8 characters, mix of letters, numbers, symbols)
2. **Store UID correctly** - Document ID must match User UID
3. **Verify after creation** - Always test login after adding admin
4. **Keep admin list secure** - Don't share admin credentials
5. **Use email as username** - Makes login easier
6. **Set up password reset** - Enable password reset in Firebase Console

---

## 🔐 Security Notes

- Admins have full access to the Admin Dashboard
- Only create admins for trusted users
- Consider implementing role-based permissions in the future
- Regularly review admin list in Firebase Console
- Remove unused admin accounts

---

## 📞 Need Help?

If you encounter issues:
1. Check browser console for errors (F12)
2. Verify Firebase Console shows the user
3. Check Firestore document structure
4. Ensure UID matches between Authentication and Firestore
