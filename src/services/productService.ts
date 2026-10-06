import { doc, setDoc, getDocs, collection, serverTimestamp, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Product } from '../types';

// Hardcoded sample/dummy products that must NEVER be loaded or auto-added
export const HARDCODED_PRODUCT_NAMES = new Set<string>([
  'farmhouse veggie supreme pizza',
  'paneer tikka & herb cheese pizza',
  'classic margherita basil pizza',
  'crispy peri-peri paneer burger',
  'gourmet veggie smash cheese burger',
  'artisanal butter croissant',
  'truffle sourdough garlic bread',
  'paneer tikka charcoal wrap',
  'crispy farmhouse fries with dip',
  'artisan celebration gourmet cake',
  'belgian dark chocolate ganache pastry',
  'new york classic baked cheesecake',
  'wild berry & mascarpone tart',
  'cold brew vietnamese iced coffee',
  'fresh alphonso mango lassi'
]);

const STORAGE_KEY_DELETED_IDS = 'swadeep_deleted_product_ids';
const STORAGE_KEY_DELETED_NAMES = 'swadeep_deleted_product_names';
const STORAGE_KEY_CACHED_PRODUCTS = 'swadeep_cached_products';

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

  // 3. Immediately purge from cached products in localStorage
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

/**
 * Checks whether a given product is blacklisted (hardcoded sample or deleted by user)
 */
export function isProductBlacklisted(product: { id: string; name?: string }): boolean {
  if (!product) return true;

  // Rule 1: Any item with id starting with 'init-' is a hardcoded sample
  if (product.id && product.id.startsWith('init-')) {
    return true;
  }

  const normName = (product.name || '').trim().toLowerCase();

  // Rule 2: Hardcoded dummy products from the original seed catalogue
  if (normName && HARDCODED_PRODUCT_NAMES.has(normName)) {
    return true;
  }

  // Rule 3: Has been marked as deleted by user (ID match)
  if (product.id && getDeletedProductIds().has(product.id)) {
    return true;
  }

  // Rule 4: Has been marked as deleted by user (Name match)
  if (normName && getDeletedProductNames().has(normName)) {
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
    // Write back sanitized list
    localStorage.setItem(STORAGE_KEY_CACHED_PRODUCTS, JSON.stringify(cleanList));
    return cleanList;
  } catch {
    return [];
  }
}

/**
 * Syncs the list of user-deleted products from Firestore so all devices stay in sync
 */
export async function syncDeletedProductsFromFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'deleted_products'));
    if (!snap.empty) {
      const localIds = getDeletedProductIds();
      const localNames = getDeletedProductNames();
      let changed = false;

      snap.forEach((d) => {
        const data = d.data();
        if (data.id && !localIds.has(data.id)) {
          localIds.add(data.id);
          changed = true;
        }
        if (data.name && typeof data.name === 'string') {
          const norm = data.name.trim().toLowerCase();
          if (norm && !localNames.has(norm)) {
            localNames.add(norm);
            changed = true;
          }
        }
      });

      if (changed) {
        localStorage.setItem(STORAGE_KEY_DELETED_IDS, JSON.stringify(Array.from(localIds)));
        localStorage.setItem(STORAGE_KEY_DELETED_NAMES, JSON.stringify(Array.from(localNames)));
      }
    }
  } catch (err) {
    // Offline or permissions note
  }
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
      window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: newCached }));
    }
  } catch (err) {
    console.warn('Local cache update skipped:', err);
  }
}

