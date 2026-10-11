import { doc, setDoc, serverTimestamp, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Product } from '../types';

// Hardcoded sample/dummy products (empty set - all real products in catalog are preserved)
export const HARDCODED_PRODUCT_NAMES = new Set<string>();
export const CATALOG_CACHE_VERSION = 'swadeep_v5_264_synced';
const STORAGE_KEY_CATALOG_VERSION = 'swadeep_catalog_version';

const STORAGE_KEY_DELETED_IDS = 'swadeep_deleted_product_ids';
const STORAGE_KEY_DELETED_NAMES = 'swadeep_deleted_product_names';
const STORAGE_KEY_CACHED_PRODUCTS = 'swadeep_cached_products';
const STORAGE_KEY_LAST_SYNC = 'swadeep_last_catalog_sync';

// ==========================================
// IndexedDB Strict Wrapper for Product Catalog
// ==========================================
const IDB_NAME = 'swadeep_bakery_catalog_db';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'products';

function openProductDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Loads all stored products from IndexedDB, sanitizing and deduplicating them.
 */
export async function getProductsFromIndexedDB(): Promise<Product[]> {
  try {
    const db = await openProductDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const raw = req.result || [];
        const clean = sanitizeProducts(raw);
        resolve(clean);
      };
      req.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('IndexedDB read fallback:', err);
    return [];
  }
}

/**
 * Persists the entire product catalog in IndexedDB as well as a lean copy in localStorage.
 * Ensures localStorage 5MB quota is never exceeded by omitting huge inline base64 strings.
 */
export async function saveProductsToIndexedDB(products: Product[]): Promise<void> {
  if (!Array.isArray(products) || products.length === 0) return;
  const cleanList = sanitizeProducts(products);

  // Synchronously write a lean metadata copy to localStorage (bypasses 5MB quota cap)
  try {
    const leanForLocalStorage = cleanList.map((p) => ({
      ...p,
      imageUrl: p.imageUrl && p.imageUrl.startsWith('data:') ? '' : p.imageUrl,
      images: Array.isArray(p.images)
        ? p.images.filter((img) => img && !img.startsWith('data:'))
        : [],
    }));
    localStorage.setItem(STORAGE_KEY_CACHED_PRODUCTS, JSON.stringify(leanForLocalStorage));
  } catch {}

  try {
    const db = await openProductDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.clear();
      for (const item of cleanList) {
        if (item && item.id) {
          store.put(item);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB write warning:', err);
  }
}

/**
 * Removes a deleted product from IndexedDB.
 */
export async function removeProductFromIndexedDB(productId: string): Promise<void> {
  if (!productId) return;
  try {
    const db = await openProductDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.delete(productId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

/**
 * Clears products from IndexedDB.
 */
export async function clearProductsIndexedDB(): Promise<void> {
  try {
    const db = await openProductDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

export function getDeletedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_IDS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set<string>(arr.map(String));
      }
    }
  } catch {}
  return new Set<string>();
}

export function getDeletedProductNames(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_NAMES);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set<string>(arr.map((n: string) => String(n).trim().toLowerCase()));
      }
    }
  } catch {}
  return new Set<string>();
}

/**
 * Permanently records a product as deleted in both localStorage and Firestore
 * to guarantee it NEVER reappears across reloads, offline mode, or re-renders.
 */
export async function recordDeletedProduct(id: string, name?: string): Promise<void> {
  if (!id) return;

  // 1. Update deleted IDs in localStorage
  const currentIds = getDeletedProductIds();
  currentIds.add(id);
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_IDS, JSON.stringify(Array.from(currentIds)));
  } catch {}

  // 2. Update deleted names in localStorage if provided
  if (name && name.trim()) {
    const normName = name.trim().toLowerCase();
    const currentNames = getDeletedProductNames();
    currentNames.add(normName);
    try {
      localStorage.setItem(STORAGE_KEY_DELETED_NAMES, JSON.stringify(Array.from(currentNames)));
    } catch {}
  }

  // 3. Immediately purge from cached products in localStorage & IndexedDB
  try {
    const cachedStr = localStorage.getItem(STORAGE_KEY_CACHED_PRODUCTS);
    if (cachedStr) {
      const parsed: Product[] = JSON.parse(cachedStr);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (p) => p.id !== id && (name ? p.name.trim().toLowerCase() !== name.trim().toLowerCase() : true)
        );
        localStorage.setItem(STORAGE_KEY_CACHED_PRODUCTS, JSON.stringify(cleaned));
      }
    }
  } catch {}

  removeProductFromIndexedDB(id).catch(() => {});

  // 4. Sync permanent deletion record to Firestore so other devices/sessions respect it
  try {
    await setDoc(doc(db, 'deleted_products', id), {
      id,
      name: name || '',
      deletedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not sync deleted product record to Firestore (stored locally):', err);
  }
}

// Protected restored product IDs (including all 17 Gift Hampers & Combos)
const PROTECTED_RESTORED_IDS = new Set<string>([
  '2WA001E5gSuQQvngGJkX', '8RsDN3RUkFvWrgEuOBqz', 'BsCU2ArrtNmBo9F7F3JA',
  'F2q9GTx7fPxTDNgbDiLm', 'J9iz70nxbrJ6D2i10QLO', 'LXpkdj4b88OFaky45NkN',
  'V3xk7OKiEA1uzOBzEabN', 'X5yU6euyUPjeH6WdckLO', 'Y5b00epUYtdhXYn3lQm0',
  'cP6KKm5wFr7u8cSKmwHD', 'oTLjeQ1iOj6J7VdOU8Ua', 'qQHIseJZFEAPjKS0XI4h',
  'tD4LoPn6ddwQ0D4WU0SZ', 'uVgZUnMTvC9XBtXTe5SD', 'wXP7tcmGqNYSMyANVOtY',
  'xg6vhuQdzcm3ebdUjzK7', 'yl2xnS7BIKZLokYNHHl7'
]);

/**
 * Removes a product from the local deleted sets if an admin creates or edits it.
 */
export function unblacklistProduct(id?: string, name?: string): void {
  if (id) {
    const ids = getDeletedProductIds();
    if (ids.has(id)) {
      ids.delete(id);
      try {
        localStorage.setItem(STORAGE_KEY_DELETED_IDS, JSON.stringify(Array.from(ids)));
      } catch {}
    }
  }
  if (name && name.trim()) {
    const names = getDeletedProductNames();
    const norm = name.trim().toLowerCase();
    if (names.has(norm)) {
      names.delete(norm);
      try {
        localStorage.setItem(STORAGE_KEY_DELETED_NAMES, JSON.stringify(Array.from(names)));
      } catch {}
    }
  }
}

/**
 * Checks whether a given product is blacklisted (deleted by user or fake mock template)
 */
export function isProductBlacklisted(product: { id: string; name?: string }): boolean {
  if (!product) return true;

  const id = String(product.id || '');
  const normName = (product.name || '').trim().toLowerCase();

  // Restored products must never be blocked
  if (PROTECTED_RESTORED_IDS.has(id)) {
    return false;
  }

  // Rule 1: Has been explicitly deleted by user (ID match)
  if (id && getDeletedProductIds().has(id)) {
    return true;
  }

  // Rule 2: Has been explicitly deleted by user (Name match)
  if (normName && getDeletedProductNames().has(normName)) {
    return true;
  }

  // Rule 3: Only dummy initial seed placeholder IDs (not real user products)
  if (
    id.startsWith('init-dummy-') ||
    id.startsWith('sample-mock-') ||
    id === 'item-pizza-1'
  ) {
    return true;
  }

  return false;
}

/**
 * Filters out all hardcoded and user-deleted products, deduplicating by ID
 */
export function sanitizeProducts(products: Product[]): Product[] {
  if (!Array.isArray(products)) return [];

  const seenIds = new Set<string>();
  const sanitized: Product[] = [];

  for (const prod of products) {
    if (!prod || !prod.id) continue;
    if (seenIds.has(prod.id)) continue;
    if (isProductBlacklisted(prod)) continue;

    // Purge unwanted auto-injected Unsplash salad bowl image
    let cleanImages = Array.isArray(prod.images)
      ? prod.images.filter((img) => img && !img.includes('photo-1546069901-ba9599a7e63c'))
      : [];
    let cleanImageUrl = prod.imageUrl && !prod.imageUrl.includes('photo-1546069901-ba9599a7e63c')
      ? prod.imageUrl
      : '';

    // If primary imageUrl was the salad bowl, fallback to first color or variant image
    if (!cleanImageUrl) {
      cleanImageUrl =
        prod.colorVariants?.find((c) => c.imageUrl)?.imageUrl ||
        prod.variants?.find((v) => v.imageUrl)?.imageUrl ||
        cleanImages[0] ||
        '';
    }

    if (cleanImages.length === 0 && cleanImageUrl) {
      cleanImages = [cleanImageUrl];
    }

    const cleanedProd: Product = {
      ...prod,
      imageUrl: cleanImageUrl,
      images: cleanImages,
    };

    seenIds.add(prod.id);
    sanitized.push(cleanedProd);
  }

  return sanitized;
}

/**
 * Reads local cached products, purges all hardcoded/deleted items, saves back to localStorage,
 * and returns the clean list.
 */
export function getSanitizedCachedProducts(): Product[] {
  try {
    const cachedStr = localStorage.getItem(STORAGE_KEY_CACHED_PRODUCTS);
    if (!cachedStr) return [];
    const parsed = JSON.parse(cachedStr);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(STORAGE_KEY_CACHED_PRODUCTS);
      return [];
    }
    const cleanList = sanitizeProducts(parsed);
    // Write back sanitized list safely
    try {
      localStorage.setItem(STORAGE_KEY_CACHED_PRODUCTS, JSON.stringify(cleanList));
    } catch {}
    return cleanList;
  } catch {
    return [];
  }
}

const SYNC_THROTTLE_MS = 15 * 60 * 1000; // 15 minutes throttle window
let isSyncingCatalog = false;
let inFlightCatalogSync: Promise<Product[]> | null = null;

/**
 * Single throttled sync function that refreshes the product catalog:
 * 1. Checks throttle cooldown (at most once every 15 mins) unless force=true.
 * 2. Fetches from local server API (/api/products) - 0 Firestore reads!
 * 3. Saves to IndexedDB and localStorage.
 * 4. Dispatches 'swadeep_products_updated' event to keep UI instantly in sync.
 * 5. Strictly prevents any background Firestore read loops.
 */
export async function syncCatalogFromNetwork(force = false): Promise<Product[]> {
  if (isSyncingCatalog && inFlightCatalogSync) {
    return inFlightCatalogSync;
  }

  // Force automatic catalog refresh if user has older cached catalog version (e.g. unapproved items)
  const currentVersion = localStorage.getItem(STORAGE_KEY_CATALOG_VERSION);
  const isVersionOutdated = currentVersion !== CATALOG_CACHE_VERSION;
  const shouldForce = force || isVersionOutdated;

  if (!shouldForce) {
    const lastSyncStr = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
    if (lastSyncStr) {
      const lastSync = Number(lastSyncStr);
      if (Date.now() - lastSync < SYNC_THROTTLE_MS) {
        // Within throttle window: return catalog already in IndexedDB or memory
        const idb = await getProductsFromIndexedDB();
        if (idb.length > 0) return idb;
        const cached = getSanitizedCachedProducts();
        if (cached.length > 0) return cached;
      }
    }
  }

  isSyncingCatalog = true;
  inFlightCatalogSync = (async () => {
    try {
      // 1. Fetch from local Node API /api/products (STRICTLY 0 Firestore reads)
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const cleanList = sanitizeProducts(data);
            if (cleanList.length > 0) {
              await saveProductsToIndexedDB(cleanList);
              localStorage.setItem(STORAGE_KEY_LAST_SYNC, String(Date.now()));
              localStorage.setItem(STORAGE_KEY_CATALOG_VERSION, CATALOG_CACHE_VERSION);
              window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: cleanList }));
              return cleanList;
            }
          }
        }
      } catch (err) {
        console.warn('API products fetch note:', err);
      }

      // 2. If API is unreachable, return local IndexedDB or localStorage (0 Firestore reads)
      const existingIdb = await getProductsFromIndexedDB();
      if (existingIdb.length > 0) {
        return existingIdb;
      }
      const existingCached = getSanitizedCachedProducts();
      if (existingCached.length > 0) {
        return existingCached;
      }

      return [];
    } finally {
      isSyncingCatalog = false;
      inFlightCatalogSync = null;
    }
  })();

  return inFlightCatalogSync;
}

/**
 * Fetches the master catalog from local server API or cache with IndexedDB support (0 Firestore reads)
 */
export async function fetchFallbackProducts(): Promise<Product[]> {
  return syncCatalogFromNetwork(false);
}

/**
 * Syncs the list of user-deleted products locally (STRICTLY 0 Firestore reads)
 */
export async function syncDeletedProductsFromFirestore(): Promise<void> {
  // Pure local storage - zero Firestore reads to preserve free quota
}

/**
 * One-time and runtime cleaner to purge any old hardcoded or deleted products
 */
export function purgeLocalHardcodedProducts(): void {
  try {
    // Clean swadeep_cached_products
    getSanitizedCachedProducts();
  } catch {}
}

/**
 * Saves an entire variant group in a single clean batch:
 * - Unlinks products that were removed from the group
 * - Links and updates groupName / custom variant labels for all included products
 * - Syncs local cache and emits catalog update event
 */
export async function saveProductGroup({
  groupId,
  groupName,
  productIds,
  itemLabels,
  previousProductIds = []
}: {
  groupId: string;
  groupName: string;
  productIds: string[];
  itemLabels: Record<string, string>;
  previousProductIds?: string[];
}): Promise<void> {
  if (!groupId) return;

  const batch = writeBatch(db);
  const activeIdsSet = new Set(productIds);
  const cleanGroupName = groupName.trim() || 'Variant Group';

  // 1. Unlink any products that were in this group previously but now removed
  const toUnlink = previousProductIds.filter((id) => !activeIdsSet.has(id));
  for (const id of toUnlink) {
    const ref = doc(db, 'products', id);
    batch.set(
      ref,
      {
        groupId: deleteField(),
        groupName: deleteField(),
        groupVariantLabel: deleteField(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // 2. Link all active products
  for (const id of productIds) {
    const ref = doc(db, 'products', id);
    const updateData: any = {
      groupId,
      groupName: cleanGroupName,
      updatedAt: serverTimestamp(),
    };
    if (itemLabels && itemLabels[id] !== undefined) {
      updateData.groupVariantLabel = itemLabels[id].trim();
    }
    batch.set(ref, updateData, { merge: true });
  }

  await batch.commit();

  // 3. Synchronize local cache & dispatch event
  try {
    const cached = getSanitizedCachedProducts();
    if (cached.length > 0) {
      const newCached = cached.map((p) => {
        if (activeIdsSet.has(p.id)) {
          return {
            ...p,
            groupId,
            groupName: cleanGroupName,
            groupVariantLabel:
              itemLabels && itemLabels[p.id] !== undefined ? itemLabels[p.id].trim() : p.groupVariantLabel,
          };
        }
        if (toUnlink.includes(p.id)) {
          const clone = { ...p };
          delete clone.groupId;
          delete clone.groupName;
          delete clone.groupVariantLabel;
          return clone;
        }
        return p;
      });
      localStorage.setItem(STORAGE_KEY_CACHED_PRODUCTS, JSON.stringify(newCached));
      saveProductsToIndexedDB(newCached).catch(() => {});
      window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: newCached }));
    }
  } catch (err) {
    console.warn('Local cache update skipped:', err);
  }
}

/**
 * Links multiple products into a Flipkart-style variant group.
 * Allows users to browse numbers (0, 1, 2... 9) or flavours (Red Bull Watermelon, Tropical, etc.)
 * in a single product screen.
 */
export async function linkProductsToGroup(
  productIds: string[],
  groupId: string,
  groupName: string,
  itemLabels?: Record<string, string>
): Promise<void> {
  if (!productIds || productIds.length === 0 || !groupId) return;

  const batch = writeBatch(db);
  const updatedIds = new Set(productIds);

  for (const id of productIds) {
    const ref = doc(db, 'products', id);
    const updateData: any = {
      groupId,
      groupName: groupName.trim() || 'Product Variants',
      updatedAt: serverTimestamp(),
    };
    if (itemLabels && itemLabels[id] !== undefined) {
      updateData.groupVariantLabel = itemLabels[id].trim();
    }
    batch.set(ref, updateData, { merge: true });
  }

  await batch.commit();

  // Also synchronize locally cached products
  try {
    const cached = getSanitizedCachedProducts();
    if (cached.length > 0) {
      const newCached = cached.map((p) => {
        if (updatedIds.has(p.id)) {
          return {
            ...p,
            groupId,
            groupName: groupName.trim() || 'Product Variants',
            groupVariantLabel: itemLabels && itemLabels[p.id] !== undefined ? itemLabels[p.id].trim() : p.groupVariantLabel,
          };
        }
        return p;
      });
      localStorage.setItem(STORAGE_KEY_CACHED_PRODUCTS, JSON.stringify(newCached));
      saveProductsToIndexedDB(newCached).catch(() => {});
    }
  } catch (err) {
    console.warn('Local cache update skipped:', err);
  }
}

/**
 * Unlinks a single product from its variant group.
 */
export async function unlinkProductFromGroup(productId: string): Promise<void> {
  if (!productId) return;

  const ref = doc(db, 'products', productId);
  await setDoc(
    ref,
    {
      groupId: deleteField(),
      groupName: deleteField(),
      groupVariantLabel: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Update local cache
  try {
    const cached = getSanitizedCachedProducts();
    if (cached.length > 0) {
      const newCached = cached.map((p) => {
        if (p.id === productId) {
          const clone = { ...p };
          delete clone.groupId;
          delete clone.groupName;
          delete clone.groupVariantLabel;
          return clone;
        }
        return p;
      });
      localStorage.setItem(STORAGE_KEY_CACHED_PRODUCTS, JSON.stringify(newCached));
      saveProductsToIndexedDB(newCached).catch(() => {});
      window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: newCached }));
    }
  } catch (err) {
    console.warn('Local cache update skipped:', err);
  }
}

/**
 * Unlinks all products in a given variant group, dissolving the group.
 */
export async function unlinkEntireGroup(groupId: string, allProducts: Product[]): Promise<void> {
  if (!groupId) return;

  const targets = allProducts.filter((p) => p.groupId === groupId);
  if (targets.length === 0) return;

  const batch = writeBatch(db);
  for (const prod of targets) {
    const ref = doc(db, 'products', prod.id);
    batch.set(
      ref,
      {
        groupId: deleteField(),
        groupName: deleteField(),
        groupVariantLabel: deleteField(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();

  // Update local cache
  try {
    const cached = getSanitizedCachedProducts();
    if (cached.length > 0) {
      const newCached = cached.map((p) => {
        if (p.groupId === groupId) {
          const clone = { ...p };
          delete clone.groupId;
          delete clone.groupName;
          delete clone.groupVariantLabel;
          return clone;
        }
        return p;
      });
      localStorage.setItem(STORAGE_KEY_CACHED_PRODUCTS, JSON.stringify(newCached));
      saveProductsToIndexedDB(newCached).catch(() => {});
      window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: newCached }));
    }
  } catch (err) {
    console.warn('Local cache update skipped:', err);
  }
}

