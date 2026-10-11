/**
 * IndexedDB 24-Hour TTL Session Cache
 * Used for Staff, Customer Emails, Banners, Extras, and Categories.
 * Guarantees data is read ONCE per 24 hours, completely eliminating polling.
 */

const DB_NAME = 'swadeep_session_cache_db';
const STORE_NAME = 'cache_entries';
const DB_VERSION = 1;

interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: number;
}

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getSessionCached<T>(
  key: string,
  ttlMs = 24 * 60 * 60 * 1000 // 24-hour TTL
): Promise<T | null> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry<T> | undefined;
        if (entry && Date.now() - entry.cachedAt < ttlMs) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    // Fallback to localStorage if IndexedDB is blocked
    try {
      const raw = localStorage.getItem(`swadeep_cache_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Date.now() - parsed.cachedAt < ttlMs) {
          return parsed.data;
        }
      }
    } catch {}
    return null;
  }
}

export async function setSessionCached<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key, data, cachedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    try {
      localStorage.setItem(
        `swadeep_cache_${key}`,
        JSON.stringify({ data, cachedAt: Date.now() })
      );
    } catch {}
  }
}

export async function invalidateSessionCache(key: string): Promise<void> {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
  } catch {}
  try {
    localStorage.removeItem(`swadeep_cache_${key}`);
  } catch {}
}
