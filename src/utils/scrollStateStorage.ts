// Utility for cross-session screen & scroll position persistence

const SCROLL_POSITIONS_KEY = 'swadeep_scroll_positions';
const ACTIVE_VIEW_KEY = 'swadeep_active_view';
const ACTIVE_CATEGORY_KEY = 'swadeep_active_category';
const ACTIVE_ADMIN_TAB_KEY = 'swadeep_active_admin_tab';
const ACTIVE_KITCHEN_TAB_KEY = 'swadeep_active_kitchen_tab';
const ACTIVE_DELIVERY_TAB_KEY = 'swadeep_active_delivery_tab';

// In-memory cache for ultra-fast instant lookups during navigation
const memoryScrollMap: Record<string, number> = {};

// Initialize memory cache from storage
if (typeof window !== 'undefined') {
  try {
    const saved =
      sessionStorage.getItem(SCROLL_POSITIONS_KEY) ||
      localStorage.getItem(SCROLL_POSITIONS_KEY);
    if (saved) {
      Object.assign(memoryScrollMap, JSON.parse(saved));
    }
  } catch (e) {
    console.warn('Could not initialize scroll positions cache:', e);
  }
}

export function saveScrollPosition(key: string, scrollY?: number) {
  if (typeof window === 'undefined' || !key) return;
  const currentY = scrollY !== undefined ? scrollY : window.scrollY || window.pageYOffset || 0;
  memoryScrollMap[key] = Math.max(0, Math.round(currentY));

  try {
    const json = JSON.stringify(memoryScrollMap);
    sessionStorage.setItem(SCROLL_POSITIONS_KEY, json);
    localStorage.setItem(SCROLL_POSITIONS_KEY, json);
  } catch (e) {
    // ignore quota errors
  }
}

export function getScrollPosition(key: string): number {
  if (memoryScrollMap[key] !== undefined) {
    return memoryScrollMap[key];
  }
  if (typeof window === 'undefined') return 0;
  try {
    const saved =
      sessionStorage.getItem(SCROLL_POSITIONS_KEY) ||
      localStorage.getItem(SCROLL_POSITIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed[key] || 0;
    }
  } catch {}
  return 0;
}

export function restoreScrollPosition(key: string, _attempts = 1) {
  if (typeof window === 'undefined' || !key) return;
  const targetY = getScrollPosition(key);

  requestAnimationFrame(() => {
    window.scrollTo({ top: targetY, behavior: 'instant' as ScrollBehavior });
  });
}

// Active Screen / View Persistence
export function saveActiveView(view: 'home' | 'track' | 'admin') {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_VIEW_KEY, view);
    sessionStorage.setItem(ACTIVE_VIEW_KEY, view);
  } catch {}
}

export function getSavedActiveView(): 'home' | 'track' | 'admin' {
  if (typeof window === 'undefined') return 'home';
  // Also check URL hash / path first
  if (window.location.pathname === '/admin' || window.location.hash === '#admin') {
    return 'admin';
  }
  if (window.location.pathname === '/track' || window.location.hash === '#track') {
    return 'track';
  }
  try {
    const saved =
      localStorage.getItem(ACTIVE_VIEW_KEY) ||
      sessionStorage.getItem(ACTIVE_VIEW_KEY);
    if (saved === 'admin' || saved === 'track' || saved === 'home') {
      return saved;
    }
  } catch {}
  return 'home';
}

// Active Category Persistence
export function saveActiveCategory(category: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_CATEGORY_KEY, category);
    sessionStorage.setItem(ACTIVE_CATEGORY_KEY, category);
  } catch {}
}

export function getSavedActiveCategory(): string {
  if (typeof window === 'undefined') return 'All';
  try {
    return (
      localStorage.getItem(ACTIVE_CATEGORY_KEY) ||
      sessionStorage.getItem(ACTIVE_CATEGORY_KEY) ||
      'All'
    );
  } catch {
    return 'All';
  }
}

// Admin Tab Persistence
export function saveActiveAdminTab(tab: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_ADMIN_TAB_KEY, tab);
    sessionStorage.setItem(ACTIVE_ADMIN_TAB_KEY, tab);
  } catch {}
}

export function getSavedActiveAdminTab<T extends string>(defaultTab: T): T {
  if (typeof window === 'undefined') return defaultTab;
  try {
    const saved =
      localStorage.getItem(ACTIVE_ADMIN_TAB_KEY) ||
      sessionStorage.getItem(ACTIVE_ADMIN_TAB_KEY);
    if (saved) return saved as T;
  } catch {}
  return defaultTab;
}

// Kitchen Tab Persistence
export function saveActiveKitchenTab(tab: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_KITCHEN_TAB_KEY, tab);
    sessionStorage.setItem(ACTIVE_KITCHEN_TAB_KEY, tab);
  } catch {}
}

export function getSavedActiveKitchenTab<T extends string>(defaultTab: T): T {
  if (typeof window === 'undefined') return defaultTab;
  try {
    const saved =
      localStorage.getItem(ACTIVE_KITCHEN_TAB_KEY) ||
      sessionStorage.getItem(ACTIVE_KITCHEN_TAB_KEY);
    if (saved) return saved as T;
  } catch {}
  return defaultTab;
}

// Delivery Tab Persistence
export function saveActiveDeliveryTab(tab: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_DELIVERY_TAB_KEY, tab);
    sessionStorage.setItem(ACTIVE_DELIVERY_TAB_KEY, tab);
  } catch {}
}

export function getSavedActiveDeliveryTab<T extends string>(defaultTab: T): T {
  if (typeof window === 'undefined') return defaultTab;
  try {
    const saved =
      localStorage.getItem(ACTIVE_DELIVERY_TAB_KEY) ||
      sessionStorage.getItem(ACTIVE_DELIVERY_TAB_KEY);
    if (saved) return saved as T;
  } catch {}
  return defaultTab;
}
