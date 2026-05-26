# Firebase Setup Guide

This guide will help you set up Firebase for your Coke Calculator application to use as backend for authentication, data storage, and real-time updates.

## Prerequisites

✅ Firebase is already installed in your project (version 12.3.0)
✅ Firebase configuration is already set up in `src/firebase.js`

## Firebase Console Setup

### 1. Enable Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `coke-sales-management-system`
3. Navigate to **Authentication** → **Sign-in method**
4. Enable **Email/Password** authentication:
   - Click on "Email/Password"
   - Toggle "Enable"
   - Click "Save"

### 2. Set Up Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Production mode** (or Test mode for development)
4. Select a location (choose closest to your users)
5. Click **Enable**

### 3. Set Up Security Rules

Go to **Firestore Database** → **Rules** and add these rules:

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
      
      // Distributors can update their own data (limited fields)
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

### 4. Create Initial Admin Account

You have two options:

#### Option A: Through Firebase Console (Recommended for first admin)
1. Go to **Authentication** → **Users**
2. Click **Add user**
3. Enter admin email and password
4. Create the user
5. Note the UID
6. Go to **Firestore Database**
7. Create a document in `admins` collection with:
   - Document ID: (the UID from step 5)
   - Fields:
     - `email`: (admin email)
     - `name`: "Admin"
     - `uid`: (same as document ID)
     - `createdAt`: (current timestamp)

#### Option B: Through the Application
Once you've integrated Firebase auth, you can create admin accounts through the app.

## Implementation Status

### ✅ Completed

1. **Firebase Configuration** (`src/firebase.js`)
   - Firebase app initialized
   - Auth, Firestore, and Storage initialized

2. **Firebase Service Layer** (`src/services/firebaseService.js`)
   - Authentication functions (sign in, sign up, sign out)
   - Distributor CRUD operations
   - Order management
   - Real-time listeners
   - Admin management

### 📋 Next Steps

1. **Update Authentication System**
   - Replace localStorage-based auth with Firebase Auth
   - Update LoginPage to use Firebase Authentication
   - Update AppRouter to handle Firebase auth state

2. **Update Admin Dashboard**
   - Replace localStorage with Firestore
   - Use real-time listeners for distributor updates
   - Implement Firestore CRUD operations

3. **Update Distributor Dashboard**
   - Save orders to Firestore
   - Load distributor data from Firestore
   - Real-time updates

## Data Structure

### Distributors Collection
```
distributors/{distributorCode}
  - name: string
  - code: string (document ID)
  - region: string
  - address: string
  - email: string
  - username: string
  - uid: string (Firebase Auth UID)
  - target: {
      CSD_PC: number
      CSD_UC: number
      Water_PC: number
      Water_UC: number
    }
  - achieved: {
      CSD_PC: number
      CSD_UC: number
      Water_PC: number
      Water_UC: number
    }
  - createdAt: timestamp
  - updatedAt: timestamp
```

### Orders Collection
```
orders/{orderId}
  - distributorCode: string
  - distributorName: string
  - orderData: array
  - totalUC: number
  - totalTon: number
  - createdAt: timestamp
  - updatedAt: timestamp
```

### Admins Collection
```
admins/{uid}
  - email: string
  - name: string
  - uid: string
  - createdAt: timestamp
```

## Migration Strategy

### Phase 1: Authentication (Current)
- ✅ Firebase service layer created
- ⏳ Update LoginPage to use Firebase Auth
- ⏳ Update AppRouter for auth state management

### Phase 2: Distributor Management
- ⏳ Update AdminDashboard to use Firestore
- ⏳ Migrate existing localStorage data (if any)
- ⏳ Implement real-time updates

### Phase 3: Orders & Other Data
- ⏳ Store orders in Firestore
- ⏳ Add real-time order tracking
- ⏳ Implement data export features

## Testing Checklist

- [ ] Create admin account in Firebase Console
- [ ] Test admin login with Firebase Auth
- [ ] Create distributor through Admin Dashboard
- [ ] Test distributor login
- [ ] Verify data appears in Firestore
- [ ] Test real-time updates
- [ ] Test CRUD operations
- [ ] Verify security rules work correctly

## Troubleshooting

### Common Issues

1. **"Permission denied" errors**
   - Check Firestore security rules
   - Verify user is authenticated
   - Check user role/permissions

2. **Authentication not working**
   - Verify Email/Password is enabled in Firebase Console
   - Check Firebase configuration matches your project
   - Verify network connectivity

3. **Data not saving**
   - Check browser console for errors
   - Verify Firestore is enabled
   - Check security rules

4. **Real-time updates not working**
   - Verify onSnapshot listeners are properly set up
   - Check network connection
   - Verify Firestore rules allow read access

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Check Firebase Console for authentication/logs
3. Verify all setup steps are completed
4. Check Firebase service layer functions in `src/services/firebaseService.js`

