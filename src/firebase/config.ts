import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore, memoryLocalCache, doc, getDocFromServer } from 'firebase/firestore';
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
  appId: "1:107876066770:web:e428e27556e542f4f9540b"
};

// Initialize Firebase App safely (singleton)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with robust connection handling and memory cache for iframe / background web environments
export const db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true,
      localCache: memoryLocalCache(),
    });
  } catch {
    return getFirestore(app);
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

// Defensive connection health test for Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase configuration note: client is offline.');
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection().catch(() => {});
}


