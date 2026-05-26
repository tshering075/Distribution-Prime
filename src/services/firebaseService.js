/**
 * Firebase Service Layer
 * Provides all Firebase operations for authentication and data management
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { auth, db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

// Re-export auth so other files can check if Firebase is configured
export { auth };

// ==================== AUTHENTICATION ====================

/**
 * Sign in a distributor with email and password
 * @param {string} email - Distributor email
 * @param {string} password - Distributor password
 * @returns {Promise<Object>} User object with distributor data
 */
export async function signInDistributor(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get distributor data from Firestore
    const distributorDoc = await getDistributorByUid(user.uid);
    if (!distributorDoc) {
      throw new Error('Distributor account not found');
    }
    
    return {
      uid: user.uid,
      email: user.email,
      ...distributorDoc
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to sign in distributor');
  }
}

/**
 * Sign in an admin with email and password
 * @param {string} email - Admin email
 * @param {string} password - Admin password
 * @returns {Promise<Object>} User object with admin data
 */
export async function signInAdmin(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Check if user is an admin
    const adminDoc = await getAdminByUid(user.uid);
    if (!adminDoc) {
      throw new Error('Admin account not found');
    }
    
    // Update lastActive timestamp
    try {
      await updateUserLastActive(user.uid);
    } catch (e) {
      console.warn("Could not update lastActive:", e);
    }
    
    return {
      uid: user.uid,
      email: user.email,
      ...adminDoc
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to sign in admin');
  }
}

/**
 * Create a new distributor account with Firebase Auth
 * @param {Object} distributorData - Distributor information
 * @returns {Promise<Object>} Created distributor data
 */
export async function createDistributorAccount(distributorData) {
  try {
    const { email, password, name, code, region, address, username, target, achieved } = distributorData;
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create distributor document in Firestore
    const distributorDoc = {
      name,
      code,
      region: region || 'Southern',
      address: address || '',
      email,
      username,
      uid: user.uid,
      target: target || {
        CSD_PC: 0,
        CSD_UC: 0,
        Water_PC: 0,
        Water_UC: 0
      },
      achieved: achieved || {
        CSD_PC: 0,
        CSD_UC: 0,
        Water_PC: 0,
        Water_UC: 0
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'distributors', code), distributorDoc);
    
    return distributorDoc;
  } catch (error) {
    throw new Error(error.message || 'Failed to create distributor account');
  }
}

/**
 * Sign out the current user
 */
export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error(error.message || 'Failed to sign out');
  }
}

/**
 * Get the current authenticated user
 * @returns {Object|null} Current user or null
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Listen to authentication state changes
 * @param {Function} callback - Callback function that receives user object
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Send password reset email
 * @param {string} email - User email
 */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw new Error(error.message || 'Failed to send password reset email');
  }
}

/**
 * Update user password
 * @param {string} newPassword - New password
 */
export async function updateUserPassword(newPassword) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }
    await updatePassword(user, newPassword);
  } catch (error) {
    throw new Error(error.message || 'Failed to update password');
  }
}

// ==================== DISTRIBUTOR MANAGEMENT ====================

/**
 * Get all distributors from Firestore
 * @returns {Promise<Array>} Array of distributor objects
 */
export async function getAllDistributors() {
  try {
    const distributorsRef = collection(db, 'distributors');
    const snapshot = await getDocs(distributorsRef);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      // CRITICAL: Ensure code is included (it might only be in document ID)
      // The document ID is the code, so use it if code field is missing
      const code = data.code || doc.id;
      return {
        id: doc.id,
        ...data,
        code: code // Ensure code is not overwritten by spread (put it last)
      };
    });
  } catch (error) {
    console.error('Error getting distributors:', error);
    return [];
  }
}

/**
 * Get distributor by code
 * @param {string} code - Distributor code
 * @returns {Promise<Object|null>} Distributor object or null
 */
export async function getDistributorByCode(code) {
  try {
    const docRef = doc(db, 'distributors', code);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting distributor:', error);
    return null;
  }
}

/**
 * Get distributor by Firebase UID
 * @param {string} uid - Firebase Auth UID
 * @returns {Promise<Object|null>} Distributor object or null
 */
export async function getDistributorByUid(uid) {
  try {
    const distributorsRef = collection(db, 'distributors');
    const q = query(distributorsRef, where('uid', '==', uid));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting distributor by UID:', error);
    return null;
  }
}

/**
 * Get distributor by username
 * @param {string} username - Distributor username
 * @returns {Promise<Object|null>} Distributor object or null
 */
export async function getDistributorByUsername(username) {
  try {
    const distributorsRef = collection(db, 'distributors');
    const q = query(distributorsRef, where('username', '==', username));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting distributor by username:', error);
    return null;
  }
}

/**
 * Save or update a distributor in Firestore
 * @param {Object} distributorData - Distributor data
 * @returns {Promise<Object>} Saved distributor data
 */
export async function saveDistributor(distributorData) {
  try {
    // Validate input
    if (!distributorData) {
      throw new Error('Distributor data is required');
    }
    
    const { code, ...data } = distributorData;
    
    // Validate code
    if (!code || typeof code !== 'string') {
      throw new Error(`Invalid distributor code: ${code}. Code must be a non-empty string.`);
    }
    
    const distributorRef = doc(db, 'distributors', code);
    
    // CRITICAL: Include code in the saved data so it's preserved when loaded
    const updateData = {
      code: code, // Ensure code is saved as a field, not just as document ID
      ...data,
      updatedAt: serverTimestamp()
    };
    
    // If creating new, add createdAt
    const existingDoc = await getDoc(distributorRef);
    if (!existingDoc.exists()) {
      updateData.createdAt = serverTimestamp();
    }
    
    await setDoc(distributorRef, updateData, { merge: true });
    
    return {
      id: code,
      code,
      ...updateData
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to save distributor');
  }
}

/**
 * Update distributor fields
 * @param {string} distributorId - Distributor code
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateDistributor(distributorId, updates) {
  try {
    const distributorRef = doc(db, 'distributors', distributorId);
    await updateDoc(distributorRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw new Error(error.message || 'Failed to update distributor');
  }
}

/**
 * Delete a distributor
 * @param {string} distributorId - Distributor code
 * @returns {Promise<void>}
 */
export async function deleteDistributor(distributorId) {
  try {
    const distributorRef = doc(db, 'distributors', distributorId);
    await deleteDoc(distributorRef);
  } catch (error) {
    throw new Error(error.message || 'Failed to delete distributor');
  }
}

/**
 * Subscribe to real-time updates for all distributors
 * @param {Function} callback - Callback function that receives distributors array
 * @returns {Function} Unsubscribe function
 */
export function subscribeToDistributors(callback) {
  try {
    const distributorsRef = collection(db, 'distributors');
    return onSnapshot(distributorsRef, (snapshot) => {
      const distributors = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(distributors);
    });
  } catch (error) {
    console.error('Error subscribing to distributors:', error);
    return () => {}; // Return no-op unsubscribe function
  }
}

/**
 * Subscribe to real-time updates for a single distributor
 * @param {string} distributorId - Distributor code
 * @param {Function} callback - Callback function that receives distributor object
 * @returns {Function} Unsubscribe function
 */
export function subscribeToDistributor(distributorId, callback) {
  try {
    const distributorRef = doc(db, 'distributors', distributorId);
    return onSnapshot(distributorRef, (doc) => {
      if (doc.exists()) {
        callback({
          id: doc.id,
          ...doc.data()
        });
      } else {
        callback(null);
      }
    });
  } catch (error) {
    console.error('Error subscribing to distributor:', error);
    return () => {}; // Return no-op unsubscribe function
  }
}

// ==================== ORDER MANAGEMENT ====================

/**
 * Save an order to Firestore
 * @param {Object} orderData - Order data
 * @returns {Promise<Object>} Saved order data with ID
 */
export async function saveOrder(orderData) {
  try {
    const ordersRef = collection(db, 'orders');
    const orderDoc = {
      ...orderData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = doc(ordersRef);
    await setDoc(docRef, orderDoc);
    
    return {
      id: docRef.id,
      ...orderDoc
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to save order');
  }
}

/**
 * Get orders for a specific distributor
 * @param {string} distributorCode - Distributor code
 * @returns {Promise<Array>} Array of order objects
 */
export async function getOrdersByDistributor(distributorCode) {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('distributorCode', '==', distributorCode),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting orders:', error);
    return [];
  }
}

/**
 * Get all orders (admin only)
 * @returns {Promise<Array>} Array of all order objects
 */
export async function getAllOrders() {
  try {
    if (!db) {
      console.warn('Firestore not initialized, returning empty array');
      return [];
    }
    
    const ordersRef = collection(db, 'orders');
    
    // Try with orderBy first (preferred)
    try {
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log(`✅ Retrieved ${orders.length} orders from Firestore (with orderBy)`);
      return orders;
    } catch (orderByError) {
      // If orderBy fails (e.g., missing index), try without orderBy
      console.warn('⚠️ Query with orderBy failed, trying without orderBy:', orderByError);
      
      if (orderByError.code === 'failed-precondition' || orderByError.message?.includes('index')) {
        console.warn('⚠️ Firestore index required. Creating index or using fallback query...');
      }
      
      try {
        // Fallback: Get all orders without orderBy
        const snapshot = await getDocs(ordersRef);
        const orders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort manually by createdAt if available, otherwise by id
        orders.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
          return bTime - aTime; // Descending
        });
        
        console.log(`✅ Retrieved ${orders.length} orders from Firestore (without orderBy, sorted manually)`);
        return orders;
      } catch (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError);
        throw fallbackError;
      }
    }
  } catch (error) {
    console.error('❌ Error getting all orders:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    // If it's a permission error, provide helpful guidance
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      console.warn('⚠️ Firestore permission error. Please update your Firestore security rules in Firebase Console.');
      console.warn('Go to: Firebase Console → Firestore Database → Rules');
      console.warn('Make sure authenticated users can read from the "orders" collection.');
    }
    
    // If it's an index error, provide guidance
    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      console.warn('⚠️ Firestore index required for orderBy query.');
      console.warn('Go to: Firebase Console → Firestore Database → Indexes');
      console.warn('Create a composite index on "orders" collection: createdAt (Descending)');
    }
    
    return [];
  }
}

/**
 * Delete an order from Firestore
 * @param {string} orderId - Order document ID
 * @returns {Promise<void>}
 */
export async function deleteOrder(orderId) {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    if (!orderId) {
      throw new Error('Order ID is required');
    }
    
    const orderRef = doc(db, 'orders', orderId);
    await deleteDoc(orderRef);
    console.log(`✅ Order ${orderId} deleted from Firestore`);
  } catch (error) {
    console.error('Error deleting order from Firestore:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time order updates for a distributor
 * @param {string} distributorCode - Distributor code
 * @param {Function} callback - Callback function that receives orders array
 * @returns {Function} Unsubscribe function
 */
export function subscribeToOrders(distributorCode, callback) {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('distributorCode', '==', distributorCode),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(orders);
    });
  } catch (error) {
    console.error('Error subscribing to orders:', error);
    return () => {}; // Return no-op unsubscribe function
  }
}

// ==================== ADMIN MANAGEMENT ====================

/**
 * Get admin by UID
 * @param {string} uid - Firebase Auth UID
 * @returns {Promise<Object|null>} Admin object or null
 */
export async function getAdminByUid(uid) {
  try {
    const adminRef = doc(db, 'admins', uid);
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      return {
        id: adminSnap.id,
        ...adminSnap.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting admin:', error);
    return null;
  }
}

/**
 * Create an admin account
 * @param {Object} adminData - Admin information
 * @returns {Promise<Object>} Created admin data
 */
export async function createAdminAccount(adminData) {
  try {
    const { email, password, name, role = 'admin' } = adminData;
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Define role permissions
    const rolePermissions = {
      admin: { read: true, write: true, delete: true, manageUsers: true },
      viewer: { read: true, write: false, delete: false, manageUsers: false }
    };
    
    // Create admin document in Firestore
    const adminDoc = {
      email,
      name: name || 'Admin',
      role: role || 'admin',
      uid: user.uid,
      permissions: rolePermissions[role] || rolePermissions.admin,
      createdAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'admins', user.uid), adminDoc);
    
    return {
      uid: user.uid,
      ...adminDoc
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to create admin account');
  }
}

/**
 * Get user permissions from Firestore
 * @param {string} uid - User UID
 * @returns {Promise<Object>} User permissions object
 */
export async function getUserPermissions(uid) {
  try {
    const adminDoc = await getAdminByUid(uid);
    if (adminDoc && adminDoc.permissions) {
      return adminDoc.permissions;
    }
    // Default permissions for backward compatibility (admin)
    return { read: true, write: true, delete: true, manageUsers: true };
  } catch (error) {
    console.error('Error getting user permissions:', error);
    // Default to admin permissions on error
    return { read: true, write: true, delete: true, manageUsers: true };
  }
}

/**
 * Check if current user has specific permission
 * @param {string} permission - Permission to check ('read', 'write', 'delete', 'manageUsers')
 * @returns {Promise<boolean>} True if user has permission
 */
export async function hasPermission(permission) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;
    
    const permissions = await getUserPermissions(currentUser.uid);
    return permissions[permission] === true;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Delete a user from Firebase Authentication
 * This requires a Cloud Function with Admin SDK
 * @param {string} uid - User UID to delete
 * @returns {Promise<Object>} Result object with success status
 */
export async function deleteUserFromAuth(uid) {
  try {
    // Check if functions is available
    if (!functions) {
      console.warn('Firebase Functions not initialized');
      return { 
        success: true, 
        deletedFromAuth: false, 
        message: 'User deleted from Firestore. Note: Firebase Auth account still exists. Set up Cloud Function to delete from Auth.',
        warning: 'Firebase Functions not available. User was only deleted from Firestore.'
      };
    }

    // Use Firebase callable function (automatically handles authentication)
    const deleteUserFunction = httpsCallable(functions, 'deleteUser');
    
    try {
      const result = await deleteUserFunction({ uid });
      const data = result.data;
      
      if (data.success) {
        return { 
          success: true, 
          deletedFromAuth: true, 
          message: data.message || 'User deleted from Firebase Auth successfully' 
        };
      } else {
        throw new Error(data.error || 'Failed to delete user from Auth');
      }
    } catch (cloudFunctionError) {
      // Cloud Function might not be set up, that's okay - we'll still delete from Firestore
      console.warn('Cloud Function not available or error calling it:', cloudFunctionError);
      
      // Check if it's a function not found error
      if (cloudFunctionError.code === 'functions/not-found' || 
          cloudFunctionError.message?.includes('not found') ||
          cloudFunctionError.message?.includes('404')) {
        return { 
          success: true, 
          deletedFromAuth: false, 
          message: 'User deleted from Firestore. Note: Firebase Auth account still exists. Set up Cloud Function to delete from Auth.',
          warning: 'Cloud Function "deleteUser" not found. Please deploy it first. See SETUP_DELETE_USER_CLOUD_FUNCTION.md'
        };
      }
      
      // Other errors (permission denied, etc.)
      throw cloudFunctionError;
    }
  } catch (error) {
    console.error('Error deleting user from Auth:', error);
    // Return a result that allows Firestore deletion to continue
    return { 
      success: false, 
      deletedFromAuth: false, 
      error: error.message || 'Failed to delete user from Firebase Auth',
      warning: 'Could not delete from Firebase Auth. User will only be deleted from Firestore.'
    };
  }
}

/**
 * Update user's lastActive timestamp in Firestore
 * @param {string} uid - User UID
 * @returns {Promise<void>}
 */
export async function updateUserLastActive(uid) {
  try {
    if (!db) {
      console.warn("Firestore not initialized");
      return;
    }
    
    const adminRef = doc(db, 'admins', uid);
    await updateDoc(adminRef, {
      lastActive: serverTimestamp()
    });
  } catch (error) {
    // If document doesn't exist, create it
    if (error.code === 'not-found' || error.message?.includes('not found')) {
      try {
        const adminRef = doc(db, 'admins', uid);
        await setDoc(adminRef, {
          lastActive: serverTimestamp()
        }, { merge: true });
      } catch (createError) {
        console.warn("Could not create/update lastActive:", createError);
      }
    } else {
      console.warn("Could not update lastActive:", error);
    }
  }
}

/**
 * List all users from Firebase Authentication
 * This requires a Cloud Function because the Admin SDK is needed
 * @returns {Promise<Array>} Array of user objects from Firebase Auth
 */
export async function listUsersFromAuth() {
  try {
    if (!functions) {
      console.warn("Firebase Functions not initialized, cannot list Auth users");
      return [];
    }

    const listUsersFunction = httpsCallable(functions, "listUsers");
    const result = await listUsersFunction();

    if (result.data?.success && result.data?.users) {
      return result.data.users;
    }
    
    return [];
  } catch (error) {
    console.error("Error listing users from Firebase Auth:", error);
    
    // Check if it's a permission error or function not found
    if (error.message?.includes("permission-denied") || 
        error.message?.includes("not found") ||
        error.code === "functions/not-found") {
      console.warn("Cloud Function not deployed. Only showing users from Firestore.");
      return [];
    }
    
    // Return empty array on error so we can still show Firestore users
    return [];
  }
}

/**
 * Delete user document from Firestore
 * @param {string} uid - User UID
 * @returns {Promise<void>}
 */
export async function deleteUserDocument(uid) {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    const userRef = doc(db, 'admins', uid);
    await deleteDoc(userRef);
    console.log(`✅ User document deleted from Firestore: ${uid}`);
  } catch (error) {
    console.error('Error deleting user document:', error);
    throw new Error(error.message || 'Failed to delete user document');
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Check if username is already taken
 * @param {string} username - Username to check
 * @param {string} excludeId - Distributor code to exclude from check
 * @returns {Promise<boolean>} True if username is taken
 */
export async function isUsernameTaken(username, excludeId = null) {
  try {
    const distributorsRef = collection(db, 'distributors');
    const q = query(distributorsRef, where('username', '==', username));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return false;
    
    // If excludeId is provided, check if the found distributor is the one being excluded
    if (excludeId) {
      const found = snapshot.docs.find(doc => doc.id !== excludeId);
      return !!found;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking username:', error);
    return false;
  }
}

/**
 * Check if email is already taken
 * @param {string} email - Email to check
 * @param {string} excludeId - Distributor code to exclude from check
 * @returns {Promise<boolean>} True if email is taken
 */
export async function isEmailTaken(email, excludeId = null) {
  try {
    const distributorsRef = collection(db, 'distributors');
    const q = query(distributorsRef, where('email', '==', email));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return false;
    
    // If excludeId is provided, check if the found distributor is the one being excluded
    if (excludeId) {
      const found = snapshot.docs.find(doc => doc.id !== excludeId);
      return !!found;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking email:', error);
    return false;
  }
}

/**
 * Convert Firestore Timestamp to JavaScript Date
 * @param {Timestamp} timestamp - Firestore Timestamp
 * @returns {Date} JavaScript Date object
 */
export function timestampToDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) {
    return timestamp.toDate();
  }
  return new Date(timestamp);
}

// ==================== SALES DATA / INVOICE MANAGEMENT ====================

/**
 * Save sales data (invoice) to Firestore
 * @param {Object} salesData - Sales data object with invoice date, distributor, products, etc.
 * @returns {Promise<Object>} Saved sales data with ID
 */
export async function saveSalesData(salesData) {
  try {
    const salesRef = collection(db, 'sales_data');
    const salesDoc = {
      ...salesData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = doc(salesRef);
    await setDoc(docRef, salesDoc);
    
    return {
      id: docRef.id,
      ...salesDoc
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to save sales data');
  }
}

/**
 * Save multiple sales data records in batch
 * @param {Array} salesDataArray - Array of sales data objects
 * @returns {Promise<Array>} Array of saved sales data with IDs
 */
export async function saveSalesDataBatch(salesDataArray) {
  try {
    const batch = writeBatch(db);
    const salesRef = collection(db, 'sales_data');
    const savedData = [];
    
    salesDataArray.forEach((salesData) => {
      const docRef = doc(salesRef);
      const salesDoc = {
        ...salesData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(docRef, salesDoc);
      savedData.push({ id: docRef.id, ...salesDoc });
    });
    
    await batch.commit();
    return savedData;
  } catch (error) {
    throw new Error(error.message || 'Failed to save sales data batch');
  }
}

/**
 * Get sales data by date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of sales data objects
 */
export async function getSalesDataByDateRange(startDate, endDate) {
  try {
    const salesRef = collection(db, 'sales_data');
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    const q = query(
      salesRef,
      where('invoiceDate', '>=', startTimestamp),
      where('invoiceDate', '<=', endTimestamp),
      orderBy('invoiceDate', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting sales data:', error);
    return [];
  }
}

/**
 * Get all sales data
 * @returns {Promise<Array>} Array of all sales data objects
 */
export async function getAllSalesData() {
  try {
    const salesRef = collection(db, 'sales_data');
    const q = query(salesRef, orderBy('invoiceDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting all sales data:', error);
    return [];
  }
}

// ==================== TARGETS MANAGEMENT ====================

/**
 * Save or update targets for a distributor in Firestore
 * @param {string} distributorCode - Distributor code
 * @param {Object} targetData - Target values { CSD_PC, CSD_UC, Water_PC, Water_UC }
 * @returns {Promise<Object>} Saved target data
 */
export async function saveTarget(distributorCode, targetData) {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    if (!distributorCode) {
      throw new Error('Distributor code is required');
    }
    
    const currentUser = getCurrentUser();
    const targetDoc = {
      distributorCode: distributorCode,
      CSD_PC: Number(targetData.CSD_PC || 0),
      CSD_UC: Number(targetData.CSD_UC || 0),
      Water_PC: Number(targetData.Water_PC || 0),
      Water_UC: Number(targetData.Water_UC || 0),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.email || currentUser?.uid || 'unknown'
    };
    
    const targetRef = doc(db, 'targets', distributorCode);
    // Use setDoc without merge to completely replace old target data
    await setDoc(targetRef, targetDoc);
    
    console.log(`✅ Target saved (replaced) for distributor ${distributorCode}`);
    return targetDoc;
  } catch (error) {
    console.error('Error saving target:', error);
    throw error;
  }
}

/**
 * Save multiple targets in batch
 * @param {Object} targetsMap - Map of { distributorCode: { CSD_PC, CSD_UC, Water_PC, Water_UC }, ... }
 * @returns {Promise<Array>} Array of saved target data
 */
export async function saveTargetsBatch(targetsMap) {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    const batch = writeBatch(db);
    const currentUser = getCurrentUser();
    const savedTargets = [];
    
    Object.entries(targetsMap).forEach(([distributorCode, targetData]) => {
      const targetRef = doc(db, 'targets', distributorCode);
      const targetDoc = {
        distributorCode: distributorCode,
        CSD_PC: Number(targetData.CSD_PC || 0),
        CSD_UC: Number(targetData.CSD_UC || 0),
        Water_PC: Number(targetData.Water_PC || 0),
        Water_UC: Number(targetData.Water_UC || 0),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || currentUser?.uid || 'unknown'
      };
      
      // Use set instead of merge to completely replace old target data
      batch.set(targetRef, targetDoc);
      savedTargets.push(targetDoc);
    });
    
    await batch.commit();
    console.log(`✅ Saved ${savedTargets.length} targets to Firebase`);
    return savedTargets;
  } catch (error) {
    console.error('Error saving targets batch:', error);
    throw error;
  }
}

/**
 * Get target for a specific distributor
 * @param {string} distributorCode - Distributor code
 * @returns {Promise<Object|null>} Target object or null
 */
export async function getTarget(distributorCode) {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    const targetRef = doc(db, 'targets', distributorCode);
    const targetSnap = await getDoc(targetRef);
    
    if (targetSnap.exists()) {
      const data = targetSnap.data();
      const targetData = {
        CSD_PC: data.CSD_PC || 0,
        CSD_UC: data.CSD_UC || 0,
        Water_PC: data.Water_PC || 0,
        Water_UC: data.Water_UC || 0,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy
      };
      
      // Cache in localStorage as fallback
      try {
        const stored = localStorage.getItem('targets') || '{}';
        const targetsMap = JSON.parse(stored);
        targetsMap[distributorCode] = targetData;
        localStorage.setItem('targets', JSON.stringify(targetsMap));
      } catch (e) {
        // Ignore localStorage errors
      }
      
      return targetData;
    }
    
    return null;
  } catch (error) {
    // Handle quota exceeded - fallback to localStorage
    if (error.code === 'resource-exhausted' || error.code === 'quota-exceeded') {
      console.warn('⚠️ Firestore quota exceeded. Using cached target from localStorage.');
      try {
        const stored = localStorage.getItem('targets');
        if (stored) {
          const targetsMap = JSON.parse(stored);
          const targetData = targetsMap[distributorCode];
          if (targetData) {
            return targetData;
          }
        }
      } catch (e) {
        console.error('Error reading targets from localStorage:', e);
      }
    }
    console.error('Error getting target:', error);
    return null;
  }
}

/**
 * Subscribe to real-time target updates for a distributor
 * @param {string} distributorCode - Distributor code
 * @param {Function} callback - Callback function that receives target data (or null if not found)
 * @returns {Function} Unsubscribe function
 */
export function subscribeToTarget(distributorCode, callback) {
  if (!db) {
    console.warn('Firestore not initialized, cannot subscribe to target');
    return () => {}; // Return no-op unsubscribe function
  }
  
  if (!distributorCode) {
    console.warn('Distributor code is required for target subscription');
    return () => {}; // Return no-op unsubscribe function
  }
  
  const targetRef = doc(db, 'targets', distributorCode);
  
  const unsubscribe = onSnapshot(
    targetRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const targetData = {
          CSD_PC: data.CSD_PC || 0,
          CSD_UC: data.CSD_UC || 0,
          Water_PC: data.Water_PC || 0,
          Water_UC: data.Water_UC || 0,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy
        };
        console.log(`🔄 Target updated for distributor ${distributorCode}:`, targetData);
        callback(targetData);
      } else {
        console.log(`⚠️ No target found in targets collection for ${distributorCode}`);
        callback(null);
      }
    },
    (error) => {
      // Handle quota exceeded and other errors gracefully
      if (error.code === 'resource-exhausted' || error.code === 'quota-exceeded') {
        console.warn('⚠️ Firestore quota exceeded. Falling back to localStorage for targets.');
        // Try to get from localStorage as fallback
        try {
          const stored = localStorage.getItem('targets');
          if (stored) {
            const targetsMap = JSON.parse(stored);
            const targetData = targetsMap[distributorCode];
            if (targetData) {
              callback(targetData);
              return;
            }
          }
        } catch (e) {
          console.error('Error reading targets from localStorage:', e);
        }
      }
      console.error('Error subscribing to target:', error);
      callback(null);
    }
  );
  
  return unsubscribe;
}

// ==================== SCHEMES & DISCOUNTS MANAGEMENT ====================

/**
 * Save or update a scheme/discount in Firestore
 * @param {Object} schemeData - Scheme data
 * @returns {Promise<Object>} Saved scheme data
 */
export async function saveScheme(schemeData) {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    if (!schemeData.id) {
      throw new Error('Scheme ID is required');
    }
    
    // Recursively remove undefined, null (if needed), and empty values from schemeData before saving to Firebase
    const cleanValue = (value) => {
      if (value === undefined || value === null) {
        return null; // Return null to skip in filter
      }
      if (Array.isArray(value)) {
        // Always preserve arrays, even if empty (for distributors, appliesToSKUs, etc.)
        return value.filter(item => item !== undefined && item !== null);
      }
      if (typeof value === 'object' && value !== null) {
        const cleaned = {};
        Object.entries(value).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            cleaned[k] = cleanValue(v);
          }
        });
        return cleaned;
      }
      return value;
    };
    
    // Remove undefined and null values from schemeData
    // But preserve arrays (distributors, appliesToSKUs) even if they might be empty
    const cleanSchemeData = {};
    Object.entries(schemeData).forEach(([key, value]) => {
      // Always include arrays (distributors, appliesToSKUs) even if empty
      if (Array.isArray(value)) {
        // Preserve the array, filtering out only undefined/null items
        const cleanedArray = value.filter(item => item !== undefined && item !== null);
        cleanSchemeData[key] = cleanedArray; // Always include, even if empty
      } else if (value !== undefined && value !== null) {
        const cleaned = cleanValue(value);
        if (cleaned !== null && cleaned !== undefined) {
          cleanSchemeData[key] = cleaned;
        }
      }
    });
    
    // Explicitly ensure distributors and appliesToSKUs are always present
    if (!('distributors' in cleanSchemeData)) {
      cleanSchemeData.distributors = Array.isArray(schemeData.distributors) ? schemeData.distributors : [];
    }
    if (!('appliesToSKUs' in cleanSchemeData)) {
      cleanSchemeData.appliesToSKUs = Array.isArray(schemeData.appliesToSKUs) ? schemeData.appliesToSKUs : [];
    }
    
    const schemeDoc = {
      ...cleanSchemeData,
      updatedAt: serverTimestamp(),
    };
    
    // Final check: remove any remaining undefined values, but preserve arrays
    const finalDoc = {};
    Object.entries(schemeDoc).forEach(([key, value]) => {
      if (value !== undefined) {
        // Always include arrays, even if empty
        if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
          finalDoc[key] = value;
        } else if (value !== null) {
          finalDoc[key] = value;
        }
      }
    });
    
    // Final safety check: ensure distributors and appliesToSKUs are arrays
    if (!Array.isArray(finalDoc.distributors)) {
      finalDoc.distributors = Array.isArray(schemeData.distributors) ? schemeData.distributors : [];
    }
    if (!Array.isArray(finalDoc.appliesToSKUs)) {
      finalDoc.appliesToSKUs = Array.isArray(schemeData.appliesToSKUs) ? schemeData.appliesToSKUs : [];
    }
    
    const schemeRef = doc(db, 'schemes', schemeData.id);
    await setDoc(schemeRef, finalDoc);
    
    // Debug: Log distributors in saved document
    console.log(`✅ Scheme saved: ${schemeData.name}`);
    console.log('📊 Saved distributors:', {
      count: finalDoc.distributors?.length || 0,
      distributors: finalDoc.distributors,
      hasDistributors: 'distributors' in finalDoc
    });
    return finalDoc;
  } catch (error) {
    console.error('Error saving scheme:', error);
    console.error('Scheme data that failed:', schemeData);
    throw error;
  }
}

/**
 * Get all schemes from Firestore
 * @returns {Promise<Array>} Array of scheme objects
 */
export async function getAllSchemes() {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    const schemesRef = collection(db, 'schemes');
    const snapshot = await getDocs(schemesRef);
    
    const schemes = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const scheme = {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to dates
        startDate: data.startDate,
        endDate: data.endDate,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        // Ensure distributors is always an array
        distributors: Array.isArray(data.distributors) ? data.distributors : [],
        // Ensure appliesToSKUs is always an array
        appliesToSKUs: Array.isArray(data.appliesToSKUs) ? data.appliesToSKUs : [],
      };
      schemes.push(scheme);
      
      // Debug: Log distributors for each scheme
      if (scheme.distributors.length === 0 && scheme.name) {
        console.warn(`⚠️ Scheme "${scheme.name}" has 0 distributors`, {
          id: scheme.id,
          hasDistributorsField: 'distributors' in data,
          distributorsValue: data.distributors,
          fullData: data
        });
      }
    });
    
    console.log(`✅ Loaded ${schemes.length} schemes from Firebase`);
    return schemes;
  } catch (error) {
    console.error('Error getting all schemes:', error);
    return [];
  }
}

/**
 * Get active schemes for a distributor
 * @param {string} distributorCode - Distributor code
 * @returns {Promise<Array>} Array of active scheme objects
 */
export async function getActiveSchemesForDistributor(distributorCode) {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    const schemesRef = collection(db, 'schemes');
    const snapshot = await getDocs(schemesRef);
    
    const now = new Date();
    const activeSchemes = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      
      // Check if scheme is active and applies to this distributor
      if (
        startDate <= now &&
        endDate >= now &&
        data.distributors?.includes(distributorCode)
      ) {
        activeSchemes.push({
          id: doc.id,
          ...data,
          startDate: data.startDate,
          endDate: data.endDate,
        });
      }
    });
    
    console.log(`✅ Found ${activeSchemes.length} active schemes for distributor ${distributorCode}`);
    return activeSchemes;
  } catch (error) {
    console.error('Error getting active schemes:', error);
    return [];
  }
}

/**
 * Delete a scheme from Firestore
 * @param {string} schemeId - Scheme document ID
 * @returns {Promise<void>}
 */
export async function deleteScheme(schemeId) {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    if (!schemeId) {
      throw new Error('Scheme ID is required');
    }
    
    const schemeRef = doc(db, 'schemes', schemeId);
    await deleteDoc(schemeRef);
    
    console.log(`✅ Scheme deleted: ${schemeId}`);
  } catch (error) {
    console.error('Error deleting scheme:', error);
    throw error;
  }
}

/**
 * Get all targets from Firestore
 * @returns {Promise<Object>} Map of { distributorCode: { CSD_PC, CSD_UC, Water_PC, Water_UC }, ... }
 */
export async function getAllTargets() {
  try {
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    const targetsRef = collection(db, 'targets');
    const snapshot = await getDocs(targetsRef);
    
    const targetsMap = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      targetsMap[data.distributorCode || doc.id] = {
        CSD_PC: data.CSD_PC || 0,
        CSD_UC: data.CSD_UC || 0,
        Water_PC: data.Water_PC || 0,
        Water_UC: data.Water_UC || 0,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy
      };
    });
    
    console.log(`✅ Loaded ${Object.keys(targetsMap).length} targets from Firebase`);
    return targetsMap;
  } catch (error) {
    console.error('Error getting all targets:', error);
    return {};
  }
}

/**
 * Delete all sales data from Firebase
 * This deletes all records with source "excel_upload" from the admin dashboard
 * @returns {Promise<number>} Number of deleted records
 */
export async function deleteAllSalesDataFromAdmin() {
  try {
    const salesRef = collection(db, 'sales_data');
    // Query all sales data with source "excel_upload"
    const q = query(salesRef, where('source', '==', 'excel_upload'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('No sales data to delete');
      return 0;
    }
    
    // Delete in batches (Firestore batch limit is 500)
    let deletedCount = 0;
    const docs = snapshot.docs;
    
    // Process in chunks of 500 (Firestore batch limit)
    for (let i = 0; i < docs.length; i += 500) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + 500);
      chunk.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
      deletedCount += chunk.length;
    }
    
    console.log(`✅ Deleted ${deletedCount} sales data records from Firebase`);
    return deletedCount;
  } catch (error) {
    console.error('Error deleting sales data from Firebase:', error);
    throw new Error(error.message || 'Failed to delete sales data');
  }
}

/**
 * Subscribe to real-time sales data updates
 * @param {Function} callback - Callback function that receives sales data array
 * @returns {Function} Unsubscribe function
 */
export function subscribeToSalesData(callback) {
  try {
    const salesRef = collection(db, 'sales_data');
    const q = query(salesRef, orderBy('invoiceDate', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(salesData);
    });
  } catch (error) {
    console.error('Error subscribing to sales data:', error);
    return () => {}; // Return no-op unsubscribe function
  }
}
