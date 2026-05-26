// Firebase Configuration and Initialization
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Your Firebase configuration
// TODO: Replace these values with your actual Firebase project configuration
// You can find these in Firebase Console → Project Settings → General → Your apps
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || ''
};

// Initialize Firebase
let app;
let auth;
let db;
let storage;
let functions;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Export null values if initialization fails
  auth = null;
  db = null;
  storage = null;
  functions = null;
}

export { auth, db, storage, functions };
export default app;