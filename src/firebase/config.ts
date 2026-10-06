import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyBNb0ksbQZP9TNKj3dYL-k1u_aHZTuu-cM",
  authDomain: "swadeep-2e33a.firebaseapp.com",
  projectId: "swadeep-2e33a",
  storageBucket: "swadeep-2e33a.firebasestorage.app",
  messagingSenderId: "107876066770",
  appId: "1:107876066770:web:7970267951e6dc28f9540b",
  firestoreDatabaseId: "ai-studio-swadeep-c9f5f4f9-12f6-4ef3-a3b0-884128973d8b"
};

// Initialize Firebase App safely (singleton)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

// Initialize Firestore targeting the dedicated cloud database
export const db = (() => {
  try {
    return initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true,
        localCache: memoryLocalCache(),
      },
      FIRESTORE_DATABASE_ID
    );
  } catch {
    return getFirestore(app, FIRESTORE_DATABASE_ID);
  }
})();

// Initialize Auth with localStorage & session persistence to avoid IndexedDB "Database is closing/hidden" issues
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
    });
  } catch {
    return getAuth(app);
  }
})();

export const storage = getStorage(app);


