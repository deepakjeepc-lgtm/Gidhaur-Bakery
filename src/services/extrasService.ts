import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ProductExtra } from '../types';
import { readThrottler } from './readThrottler';

export const STORAGE_KEY_EXTRAS = 'swadeep_product_extras';

export const DEFAULT_PRODUCT_EXTRAS: ProductExtra[] = [
  {
    id: 'extra-cheese',
    name: 'Extra Cheese',
    price: 30,
    available: true,
    category: 'Cheese & Dips'
  },
  {
    id: 'extra-corn',
    name: 'Extra Golden Corn',
    price: 20,
    available: true,
    category: 'Toppings'
  },
  {
    id: 'extra-spicy',
    name: 'Extra Spicy Peri-Peri',
    price: 15,
    available: true,
    category: 'Seasoning'
  },
  {
    id: 'extra-paneer',
    name: 'Extra Fresh Paneer',
    price: 35,
    available: true,
    category: 'Toppings'
  },
  {
    id: 'extra-mushroom',
    name: 'Extra Mushroom',
    price: 25,
    available: true,
    category: 'Toppings'
  },
  {
    id: 'extra-veggies',
    name: 'Extra Crisp Veggies',
    price: 20,
    available: true,
    category: 'Toppings'
  },
  {
    id: 'extra-garlic-dip',
    name: 'Extra Garlic Dip / Mayo',
    price: 20,
    available: true,
    category: 'Cheese & Dips'
  },
  {
    id: 'extra-tandoori-sauce',
    name: 'Extra Tandoori Sauce',
    price: 15,
    available: true,
    category: 'Cheese & Dips'
  },
  {
    id: 'extra-jalapeno',
    name: 'Jalapeno Slices',
    price: 20,
    available: true,
    category: 'Toppings'
  },
  {
    id: 'extra-olives',
    name: 'Black Olives',
    price: 25,
    available: true,
    category: 'Toppings'
  },
  {
    id: 'extra-choco-drizzle',
    name: 'Chocolate Fudge Drizzle',
    price: 25,
    available: true,
    category: 'Dessert & Sweets'
  },
  {
    id: 'extra-candle-knife',
    name: 'Extra Candle & Knife Set',
    price: 20,
    available: true,
    category: 'Party Accessories'
  }
];

export function getCachedExtras(): ProductExtra[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXTRAS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.debug('Error reading cached extras:', err);
  }
  return DEFAULT_PRODUCT_EXTRAS;
}

export function saveCachedExtras(extras: ProductExtra[]) {
  try {
    localStorage.setItem(STORAGE_KEY_EXTRAS, JSON.stringify(extras));
    window.dispatchEvent(new CustomEvent('swadeep_extras_updated', { detail: extras }));
  } catch (err) {
    console.warn('Failed saving cached extras:', err);
  }
}

/**
 * Saves full list of extras to Firestore and local cache
 */
export async function saveExtras(extras: ProductExtra[]): Promise<void> {
  saveCachedExtras(extras);
  readThrottler.invalidate('product_extras');
  try {
    window.dispatchEvent(new CustomEvent('swadeep_extras_updated'));
  } catch {}
  try {
    const ref = doc(db, 'settings', 'product_extras');
    await setDoc(
      ref,
      {
        items: extras,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore extras sync note:', err);
  }
}

/**
 * Fetches extras with memory/localStorage caching and rate-limiting (no onSnapshot leak)
 */
export function subscribeToExtras(callback: (extras: ProductExtra[]) => void): () => void {
  // 1. Immediately provide cached data for 0ms render
  callback(getCachedExtras());

  // 2. Listen to local update events
  const handleUpdate = () => {
    callback(getCachedExtras());
  };
  window.addEventListener('swadeep_extras_updated', handleUpdate);

  // 3. Single throttled check (120s cooldown)
  if (readThrottler.canFetch('product_extras', 120000)) {
    readThrottler.markFetched('product_extras');
    const ref = doc(db, 'settings', 'product_extras');
    getDoc(ref)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data?.items)) {
            saveCachedExtras(data.items);
            callback(data.items);
          }
        }
      })
      .catch((err) => {
        console.warn('Extras fetch note (using local cache):', err?.message || err);
      });
  }

  return () => {
    window.removeEventListener('swadeep_extras_updated', handleUpdate);
  };
}

/**
 * Adds a new extra
 */
export async function addExtra(extra: Omit<ProductExtra, 'id'>): Promise<ProductExtra> {
  const current = getCachedExtras();
  const newExtra: ProductExtra = {
    ...extra,
    id: `extra-${Date.now()}`,
    available: extra.available !== false,
  };
  const updated = [...current, newExtra];
  await saveExtras(updated);
  return newExtra;
}

/**
 * Updates an existing extra
 */
export async function updateExtra(id: string, updates: Partial<ProductExtra>): Promise<void> {
  const current = getCachedExtras();
  const updated = current.map((e) => (e.id === id ? { ...e, ...updates } : e));
  await saveExtras(updated);
}

/**
 * Deletes an extra
 */
export async function deleteExtra(id: string): Promise<void> {
  const current = getCachedExtras();
  const updated = current.filter((e) => e.id !== id);
  await saveExtras(updated);
}
