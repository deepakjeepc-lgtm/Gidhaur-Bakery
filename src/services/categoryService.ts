import { doc, getDoc, setDoc, updateDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { readThrottler } from './readThrottler';

export const DEFAULT_CATEGORIES = [
  'Pizzas',
  'Burgers',
  'Snacks & Samosas',
  'Fast Food',
  'Noodles & Pasta',
  'Cakes',
  'Pastries',
  'Artisan Bakery & Breads',
  'Cookies & Biscuits',
  'Hot & Cold Coffee',
  'Tea & Chai',
  'Milkshakes',
  'Soft Drinks',
  'Cold Drinks & Juices',
  'Energy Drinks',
  'Ice Creams & Sundaes',
  'Chocolates',
  'Traditional Sweets & Mithai',
  'Desserts',
  'Party & Decoration',
  'Birthday & Anniversary',
  'Gift Hampers & Combos',
  'Dairy & Paneer',
  'Momos & Dumplings',
  'Rolls & Wraps',
  'Donuts & Muffins',
  'Waffles & Pancakes',
  'Healthy Salads & Bowls',
  'Mocktails & Coolers',
  'Breakfast & Brunch',
  'Chef Specials & Gourmet',
  'Namkeen & Munchies',
  'Combos & Meal Boxes',
  'Festive & Seasonal Treats',
  'Kids Zone Treats',
  'Custom Theme Cakes'
];

export const DEFAULT_CATEGORY_ICONS: Record<string, CategoryDetail> = {
  'Pizzas': { name: 'Pizzas', iconType: 'lucide', iconValue: 'Pizza' },
  'Burgers': { name: 'Burgers', iconType: 'lucide', iconValue: 'Sandwich' },
  'Snacks & Samosas': { name: 'Snacks & Samosas', iconType: 'lucide', iconValue: 'Popcorn' },
  'Fast Food': { name: 'Fast Food', iconType: 'lucide', iconValue: 'Soup' },
  'Noodles & Pasta': { name: 'Noodles & Pasta', iconType: 'lucide', iconValue: 'Soup' },
  'Cakes': { name: 'Cakes', iconType: 'lucide', iconValue: 'Cake' },
  'Pastries': { name: 'Pastries', iconType: 'lucide', iconValue: 'Cake' },
  'Artisan Bakery & Breads': { name: 'Artisan Bakery & Breads', iconType: 'lucide', iconValue: 'Croissant' },
  'Cookies & Biscuits': { name: 'Cookies & Biscuits', iconType: 'lucide', iconValue: 'Cookie' },
  'Hot & Cold Coffee': { name: 'Hot & Cold Coffee', iconType: 'lucide', iconValue: 'Coffee' },
  'Tea & Chai': { name: 'Tea & Chai', iconType: 'lucide', iconValue: 'Coffee' },
  'Milkshakes': { name: 'Milkshakes', iconType: 'lucide', iconValue: 'Milk' },
  'Soft Drinks': { name: 'Soft Drinks', iconType: 'lucide', iconValue: 'CupSoda' },
  'Cold Drinks & Juices': { name: 'Cold Drinks & Juices', iconType: 'lucide', iconValue: 'GlassWater' },
  'Energy Drinks': { name: 'Energy Drinks', iconType: 'lucide', iconValue: 'Zap' },
  'Ice Creams & Sundaes': { name: 'Ice Creams & Sundaes', iconType: 'lucide', iconValue: 'IceCream' },
  'Chocolates': { name: 'Chocolates', iconType: 'lucide', iconValue: 'Candy' },
  'Traditional Sweets & Mithai': { name: 'Traditional Sweets & Mithai', iconType: 'lucide', iconValue: 'Lollipop' },
  'Desserts': { name: 'Desserts', iconType: 'lucide', iconValue: 'IceCream2' },
  'Party & Decoration': { name: 'Party & Decoration', iconType: 'lucide', iconValue: 'PartyPopper' },
  'Birthday & Anniversary': { name: 'Birthday & Anniversary', iconType: 'lucide', iconValue: 'Gift' },
  'Gift Hampers & Combos': { name: 'Gift Hampers & Combos', iconType: 'lucide', iconValue: 'Package' },
  'Dairy & Paneer': { name: 'Dairy & Paneer', iconType: 'lucide', iconValue: 'Milk' },
  'Momos & Dumplings': { name: 'Momos & Dumplings', iconType: 'lucide', iconValue: 'Utensils' },
  'Rolls & Wraps': { name: 'Rolls & Wraps', iconType: 'lucide', iconValue: 'UtensilsCrossed' },
  'Donuts & Muffins': { name: 'Donuts & Muffins', iconType: 'lucide', iconValue: 'Cookie' },
  'Waffles & Pancakes': { name: 'Waffles & Pancakes', iconType: 'lucide', iconValue: 'Layers' },
  'Healthy Salads & Bowls': { name: 'Healthy Salads & Bowls', iconType: 'lucide', iconValue: 'Salad' },
  'Mocktails & Coolers': { name: 'Mocktails & Coolers', iconType: 'lucide', iconValue: 'Citrus' },
  'Breakfast & Brunch': { name: 'Breakfast & Brunch', iconType: 'lucide', iconValue: 'Egg' },
  'Chef Specials & Gourmet': { name: 'Chef Specials & Gourmet', iconType: 'lucide', iconValue: 'ChefHat' },
  'Namkeen & Munchies': { name: 'Namkeen & Munchies', iconType: 'lucide', iconValue: 'Popcorn' },
  'Combos & Meal Boxes': { name: 'Combos & Meal Boxes', iconType: 'lucide', iconValue: 'Sparkles' },
  'Festive & Seasonal Treats': { name: 'Festive & Seasonal Treats', iconType: 'lucide', iconValue: 'Sparkles' },
  'Kids Zone Treats': { name: 'Kids Zone Treats', iconType: 'lucide', iconValue: 'Candy' },
  'Custom Theme Cakes': { name: 'Custom Theme Cakes', iconType: 'lucide', iconValue: 'Cake' }
};

export interface CategoryDetail {
  name: string;
  iconType?: 'emoji' | 'lucide' | 'svg' | 'custom_svg';
  iconValue?: string;
}

const LOCAL_STORAGE_KEY = 'swadeep_custom_categories';
const LOCAL_STORAGE_ICONS_KEY = 'swadeep_category_icons';
const LOCAL_STORAGE_DEFAULT_CAT_KEY = 'swadeep_default_landing_category';
const CATEGORIES_DOC_REF = doc(db, 'settings', 'categories');

export interface CategoryItem {
  id: string;
  name: string;
  order?: number;
}

// Read cached default landing category
export const getCachedDefaultLandingCategory = (): string => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_DEFAULT_CAT_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch (e) {
    console.warn('Could not read cached default landing category:', e);
  }
  return 'All';
};

// Save default landing category
export const saveDefaultLandingCategory = async (defaultCat: string): Promise<void> => {
  try {
    localStorage.setItem(LOCAL_STORAGE_DEFAULT_CAT_KEY, defaultCat);
    await setDoc(
      CATEGORIES_DOC_REF,
      {
        defaultLandingCategory: defaultCat,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Could not save default landing category to Firestore:', e);
    localStorage.setItem(LOCAL_STORAGE_DEFAULT_CAT_KEY, defaultCat);
  }
};

// Read cached categories from localStorage
export const getCachedCategories = (): string[] => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read cached categories:', e);
  }
  return DEFAULT_CATEGORIES;
};

// Read cached category icons
export const getCachedCategoryIcons = (): Record<string, CategoryDetail> => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_ICONS_KEY);
    if (saved) {
      return { ...DEFAULT_CATEGORY_ICONS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Could not read cached category icons:', e);
  }
  return DEFAULT_CATEGORY_ICONS;
};

// Save categories & icons to localStorage & Firestore
export const saveCategories = async (
  categories: string[],
  iconsMap?: Record<string, CategoryDetail>,
  defaultLandingCategory?: string
): Promise<void> => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(categories));
    if (iconsMap) {
      localStorage.setItem(LOCAL_STORAGE_ICONS_KEY, JSON.stringify(iconsMap));
    }
    if (defaultLandingCategory) {
      localStorage.setItem(LOCAL_STORAGE_DEFAULT_CAT_KEY, defaultLandingCategory);
    }
    const payload: any = {
      list: categories,
      icons: iconsMap || getCachedCategoryIcons(),
      updatedAt: new Date().toISOString()
    };
    if (defaultLandingCategory) {
      payload.defaultLandingCategory = defaultLandingCategory;
    }
    await setDoc(CATEGORIES_DOC_REF, payload, { merge: true });
    readThrottler.invalidate('categories');
  } catch (error: any) {
    console.warn('Category sync note: saving locally (Firestore fallback):', error?.message || error);
    // Still save locally
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(categories));
    if (iconsMap) {
      localStorage.setItem(LOCAL_STORAGE_ICONS_KEY, JSON.stringify(iconsMap));
    }
    if (defaultLandingCategory) {
      localStorage.setItem(LOCAL_STORAGE_DEFAULT_CAT_KEY, defaultLandingCategory);
    }
  } finally {
    try {
      window.dispatchEvent(new CustomEvent('swadeep_categories_updated', {
        detail: { categories, icons: iconsMap || getCachedCategoryIcons(), defaultCat: defaultLandingCategory }
      }));
    } catch {}
  }
};

// Fetch categories once with memory/localStorage caching and throttle protection (no real-time leak)
export const subscribeToCategories = (
  fallbackProductCategories: string[],
  callback: (
    categories: string[],
    iconsMap: Record<string, CategoryDetail>,
    defaultLandingCat?: string
  ) => void
) => {
  // 1. Immediately provide cached data for 0ms layout shift
  const cachedList = getCachedCategories();
  const cachedIcons = getCachedCategoryIcons();
  const cachedDefault = getCachedDefaultLandingCategory();
  callback(cachedList, cachedIcons, cachedDefault);

  // 2. Listen to local/admin update events
  const handleUpdate = (e: Event) => {
    try {
      const custom = e as CustomEvent;
      if (custom.detail?.categories) {
        callback(custom.detail.categories, custom.detail.icons, custom.detail.defaultCat);
        return;
      }
      callback(getCachedCategories(), getCachedCategoryIcons(), getCachedDefaultLandingCategory());
    } catch {}
  };
  window.addEventListener('swadeep_categories_updated', handleUpdate);

  // 3. Single fetch with rate-limiting throttler (120s cooldown)
  if (readThrottler.canFetch('categories', 120000)) {
    readThrottler.markFetched('categories');
    getDoc(CATEGORIES_DOC_REF)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const defaultCat = (data?.defaultLandingCategory as string) || getCachedDefaultLandingCategory();
          if (defaultCat) {
            localStorage.setItem(LOCAL_STORAGE_DEFAULT_CAT_KEY, defaultCat);
          }
          if (Array.isArray(data?.list) && data.list.length > 0) {
            const rawIcons = (data.icons as Record<string, CategoryDetail>) || {};
            const icons = { ...DEFAULT_CATEGORY_ICONS, ...rawIcons };
            const mergedList = Array.from(
              new Set([...data.list, ...fallbackProductCategories.filter(Boolean)])
            );
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mergedList));
            localStorage.setItem(LOCAL_STORAGE_ICONS_KEY, JSON.stringify(icons));
            callback(mergedList, icons, defaultCat);
          }
        }
      })
      .catch((err) => {
        console.warn('Category fetch note (serving local cache):', err?.message || err);
      });
  }

  return () => {
    window.removeEventListener('swadeep_categories_updated', handleUpdate);
  };
};

// Helper: Rename category in products
export const renameCategoryInProducts = async (
  oldCategory: string,
  newCategory: string
): Promise<number> => {
  try {
    const productsSnapshot = await getDocs(collection(db, 'products'));
    let updatedCount = 0;
    const batch = writeBatch(db);

    productsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.category === oldCategory) {
        batch.set(
          doc(db, 'products', docSnap.id),
          {
            category: newCategory
          },
          { merge: true }
        );
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
    }
    return updatedCount;
  } catch (error: any) {
    console.warn('Category update note: products update skipped in Firestore (using local):', error?.message || error);
    return 0;
  }
};

// Helper: Reassign category in products when deleting
export const reassignCategoryInProducts = async (
  deletedCategory: string,
  targetCategory: string
): Promise<number> => {
  return renameCategoryInProducts(deletedCategory, targetCategory);
};
