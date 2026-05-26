# Files to Update for Supabase Migration

This file lists all the files that need to be updated to switch from Firebase to Supabase.

## ✅ Already Created

- ✅ `src/supabase.js` - Supabase configuration
- ✅ `src/services/supabaseService.js` - Complete Supabase service layer
- ✅ `SUPABASE_MIGRATION_GUIDE.md` - Migration guide

## 📝 Files to Update

### 1. **src/pages/LoginPage.jsx**
```javascript
// Change from:
import { signInDistributor, signInAdmin, auth } from "../services/firebaseService";

// To:
import { signInDistributor, signInAdmin, supabase } from "../services/supabaseService";

// Also update:
const isFirebaseConfigured = auth !== null;
// To:
const isSupabaseConfigured = supabase !== null;
```

### 2. **src/pages/AdminDashboard.jsx**
```javascript
// Change from:
import { ... } from "../services/firebaseService";
import { Timestamp } from 'firebase/firestore';

// To:
import { ... } from "../services/supabaseService";
// Remove: import { Timestamp } from 'firebase/firestore';

// Update all references:
const isFirebaseConfigured = auth !== null;
// To:
const isSupabaseConfigured = supabase !== null;
```

### 3. **src/pages/DistributorDashboard.jsx**
```javascript
// Change from:
import { ... } from "../services/firebaseService";

// To:
import { ... } from "../services/supabaseService";

// Update:
const isFirebaseConfigured = auth !== null;
// To:
const isSupabaseConfigured = supabase !== null;
```

### 4. **src/layout/AppRouter.jsx**
```javascript
// Change from:
import { onAuthStateChange, getCurrentUser, signOutUser, getDistributorByUid, getAdminByUid } from "../services/firebaseService";

// To:
import { onAuthStateChange, getCurrentUser, signOutUser, getDistributorByUid, getAdminByUid } from "../services/supabaseService";
```

### 5. **src/components/DistributorsDialog.jsx**
```javascript
// Change from:
import { getAllDistributors, auth } from "../services/firebaseService";

// To:
import { getAllDistributors, supabase } from "../services/supabaseService";

// Update:
const isFirebaseConfigured = auth !== null;
// To:
const isSupabaseConfigured = supabase !== null;
```

### 6. **src/components/AdminManagementDialog.jsx**
```javascript
// Change from:
import { createAdminAccount, auth } from "../services/firebaseService";
import { collection, getDocs, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

// To:
import { createAdminAccount, supabase } from "../services/supabaseService";
// Remove Firebase imports
```

### 7. **src/components/UserPermissionManagementDialog.jsx**
```javascript
// Change from:
import { createAdminAccount, deleteUserFromAuth, deleteUserDocument, getCurrentUser, getAdminByUid } from "../services/firebaseService";
import { collection, getDocs, deleteDoc, doc, query, orderBy, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// To:
import { createAdminAccount, deleteUserFromAuth, deleteUserDocument, getCurrentUser, getAdminByUid } from "../services/supabaseService";
// Remove Firebase imports
```

### 8. **src/components/ReportsDialog.jsx**
```javascript
// Change from:
import { saveSalesDataBatch } from "../services/firebaseService";
import { Timestamp } from "firebase/firestore";

// To:
import { saveSalesDataBatch } from "../services/supabaseService";
// Remove: import { Timestamp } from "firebase/firestore";
```

### 9. **src/services/activityService.js**
```javascript
// Change from:
import { getCurrentUser } from './firebaseService';

// To:
import { getCurrentUser } from './supabaseService';

// Note: getCurrentUser is now async, so update usage:
// From:
const currentUser = getCurrentUser();

// To:
const currentUser = await getCurrentUser();
```

### 10. **src/services/emailService.js**
```javascript
// Change from:
import { getCurrentUser } from './firebaseService';

// To:
import { getCurrentUser } from './supabaseService';

// Update usage to await getCurrentUser()
```

### 11. **src/services/gmailService.js**
```javascript
// Change from:
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// To:
import { supabase } from '../supabase';
// Remove Firebase imports
// Update all Firestore operations to use Supabase
```

### 12. **src/utils/permissions.js**
```javascript
// Change from:
import { getCurrentUser } from '../services/firebaseService';
import { getAdminByUid } from '../services/firebaseService';

// To:
import { getCurrentUser, getAdminByUid } from '../services/supabaseService';

// Update getCurrentUser() calls to await getCurrentUser()
```

## 🔄 Quick Find & Replace

You can use these find/replace patterns (be careful and test each):

1. **Import statements:**
   - Find: `from "../services/firebaseService"`
   - Replace: `from "../services/supabaseService"`
   - Find: `from '../services/firebaseService'`
   - Replace: `from '../services/supabaseService'`

2. **Auth checks:**
   - Find: `const isFirebaseConfigured = auth !== null;`
   - Replace: `const isSupabaseConfigured = supabase !== null;`
   - Find: `isFirebaseConfigured`
   - Replace: `isSupabaseConfigured`

3. **Firebase imports:**
   - Find: `import { auth, db, functions } from '../firebase';`
   - Replace: `import { supabase } from '../supabase';`
   - Find: `import { Timestamp } from 'firebase/firestore';`
   - Replace: (remove - not needed)

4. **getCurrentUser calls:**
   - Find: `const currentUser = getCurrentUser();`
   - Replace: `const currentUser = await getCurrentUser();`
   - Make sure the function is `async` if using `await`

## ⚠️ Important Notes

1. **getCurrentUser is now async** - Update all calls to use `await`
2. **No Timestamp import needed** - Use `new Date().toISOString()` instead
3. **Real-time subscriptions work differently** - Already handled in supabaseService
4. **Database structure** - Make sure you've created all tables in Supabase (see migration guide)

## 🧪 Testing Checklist

After updating each file, test:
- [ ] Login works (distributor and admin)
- [ ] Data loads correctly
- [ ] Create/update/delete operations work
- [ ] Real-time updates work
- [ ] No console errors

## 🚀 Quick Migration Script

You can create a simple script to help with migration, but **always review changes manually**:

```bash
# Backup first!
git add .
git commit -m "Backup before Supabase migration"

# Find all files using Firebase
grep -r "firebaseService" src/ --files-with-matches
grep -r "from.*firebase" src/ --files-with-matches
```
