import { doc, getDoc, setDoc, onSnapshot, updateDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

export const DEFAULT_CATEGORIES = [
  'Desserts',
  'Beverages',
  'Bakery',
  'Snacks',
  'Meals',
  'Choclate',
  'Pizzas',
  'Burgers',
  'Combos'
];

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
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Could not read cached category icons:', e);
  }
  return {};
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
  }
};

// Subscribe to categories, icons, and default landing category in real-time
export const subscribeToCategories = (
  fallbackProductCategories: string[],
  callback: (
    categories: string[],
    iconsMap: Record<string, CategoryDetail>,
    defaultLandingCat?: string
  ) => void
) => {
  let isInitial = true;

  return onSnapshot(
    CATEGORIES_DOC_REF,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const defaultCat = (data?.defaultLandingCategory as string) || getCachedDefaultLandingCategory();
        if (defaultCat) {
          localStorage.setItem(LOCAL_STORAGE_DEFAULT_CAT_KEY, defaultCat);
        }

        if (Array.isArray(data?.list) && data.list.length > 0) {
          const icons = (data.icons as Record<string, CategoryDetail>) || {};
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.list));
          localStorage.setItem(LOCAL_STORAGE_ICONS_KEY, JSON.stringify(icons));
          callback(data.list, icons, defaultCat);
          return;
        }
      }

      // If document doesn't exist yet, seed with combined unique list
      if (isInitial) {
        isInitial = false;
        const cached = getCachedCategories();
        const cachedIcons = getCachedCategoryIcons();
        const cachedDefault = getCachedDefaultLandingCategory();
        const combined = Array.from(
          new Set([...cached, ...fallbackProductCategories.filter(Boolean)])
        );
        const finalCategories = combined.length > 0 ? combined : DEFAULT_CATEGORIES;
        saveCategories(finalCategories, cachedIcons, cachedDefault).catch(() => {});
        callback(finalCategories, cachedIcons, cachedDefault);
      }
    },
    (error) => {
      console.warn('Firestore categories subscription error (using fallback):', error);
      callback(getCachedCategories(), getCachedCategoryIcons(), getCachedDefaultLandingCategory());
    }
  );
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
        batch.update(doc(db, 'products', docSnap.id), {
          category: newCategory
        });
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
