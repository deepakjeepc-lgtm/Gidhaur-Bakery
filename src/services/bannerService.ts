import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { BannerSettings, PromotionalBanner } from '../types';

export const DEFAULT_BANNER_SETTINGS: BannerSettings = {
  isEnabled: true,
  autoSlideIntervalSeconds: 5,
  banners: [
    {
      id: 'banner-welcome-1',
      badge: 'SPECIAL OFFER',
      title: 'Artisan Pizzas & Burger Combos',
      description: 'Get flat 20% off on all freshly crafted stone-baked pizzas and gourmet meal combos.',
      couponCode: 'GIDHAUR20',
      discountText: '20% OFF',
      targetCategory: 'Combos',
      buttonText: 'Explore Combos',
      imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
      isActive: true,
      order: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'banner-welcome-2',
      badge: "CHEF'S SPECIAL",
      title: 'Signature Desserts & Shakes',
      description: 'Indulge in melt-in-mouth Belgian chocolate brownies, pastries, and thick creamy shakes.',
      couponCode: 'SWEET50',
      discountText: 'FLAT ₹50 OFF',
      targetCategory: 'Desserts',
      buttonText: 'View Desserts',
      imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
      isActive: true,
      order: 2,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'banner-welcome-3',
      badge: 'EXPRESS DELIVERY',
      title: 'Free Delivery on Orders Above ₹199',
      description: 'Order your favorite snacks & meals and get piping-hot delivery right to your doorstep.',
      couponCode: 'FREEDEL',
      discountText: 'FREE DELIVERY',
      targetCategory: 'All',
      buttonText: 'Order Now',
      imageUrl: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=600&q=80',
      isActive: true,
      order: 3,
      createdAt: new Date().toISOString(),
    },
  ],
};

const LOCAL_STORAGE_KEY = 'swadeep_promotional_banners_cache';
const BANNER_DOC_REF = doc(db, 'settings', 'promotional_banners');

// In-memory subscribers for synchronous zero-latency UI updates
const localSubscribers: Set<(settings: BannerSettings) => void> = new Set();

// Cross-tab broadcast channel
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('swadeep_banner_sync_channel');
    broadcastChannel.onmessage = (event) => {
      if (event.data && typeof event.data === 'object') {
        const settings = event.data as BannerSettings;
        cacheBannerSettings(settings);
        localSubscribers.forEach((fn) => {
          try {
            fn(settings);
          } catch (e) {
            console.error('Error notifying banner subscriber:', e);
          }
        });
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel not initialized:', e);
  }
}

// Storage event listener for multi-tab fallback
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && Array.isArray(parsed.banners)) {
          localSubscribers.forEach((fn) => fn(parsed));
        }
      } catch {}
    }
  });

  // Custom DOM event listener for intra-app synchronous broadcasting
  window.addEventListener('swadeep_banner_settings_updated', (e: any) => {
    if (e.detail) {
      localSubscribers.forEach((fn) => fn(e.detail));
    }
  });
}

/**
 * Synchronously retrieves cached banner settings from localStorage
 */
export const getCachedBannerSettings = (): BannerSettings => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.banners)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed reading cached banner settings:', e);
  }
  return DEFAULT_BANNER_SETTINGS;
};

/**
 * Saves banner settings to localStorage
 */
export const cacheBannerSettings = (settings: BannerSettings) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed saving banner settings to cache:', e);
  }
};

/**
 * Called by SSE live sync service when a remote change arrives from server (e.g. from iPhone or simulator)
 */
export const applyServerBannerSettings = (settings: BannerSettings) => {
  cacheBannerSettings(settings);
  localSubscribers.forEach((fn) => {
    try {
      fn(settings);
    } catch (e) {
      console.error('Error executing banner subscriber:', e);
    }
  });
};

/**
 * Real-time subscription to banner settings from:
 * 1. In-memory local subscribers (instant)
 * 2. SSE Server Stream
 * 3. Firestore onSnapshot (if available)
 */
export const subscribeToBannerSettings = (
  onUpdate: (settings: BannerSettings) => void
): (() => void) => {
  // Immediately provide cached data for zero layout shift
  const initial = getCachedBannerSettings();
  onUpdate(initial);

  // Register in local subscribers set for instant local and cross-tab triggers
  localSubscribers.add(onUpdate);

  // Fetch from server API in background on initialization
  if (typeof fetch !== 'undefined') {
    fetch('/api/settings/banners')
      .then((res) => (res.ok ? res.json() : null))
      .then((serverData) => {
        if (serverData && Array.isArray(serverData.banners)) {
          const loaded: BannerSettings = {
            isEnabled: serverData.isEnabled !== false,
            autoSlideIntervalSeconds: serverData.autoSlideIntervalSeconds || 5,
            banners: serverData.banners,
          };
          cacheBannerSettings(loaded);
          onUpdate(loaded);
        }
      })
      .catch(() => {
        // Fallback silently to cache
      });
  }

  // Also maintain Firestore subscription as secondary layer
  let unsubscribeFirestore = () => {};
  try {
    unsubscribeFirestore = onSnapshot(
      BANNER_DOC_REF,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const loadedSettings: BannerSettings = {
            isEnabled: data.isEnabled !== false,
            autoSlideIntervalSeconds: data.autoSlideIntervalSeconds || 5,
            banners: Array.isArray(data.banners) ? data.banners : DEFAULT_BANNER_SETTINGS.banners,
          };
          cacheBannerSettings(loadedSettings);
          onUpdate(loadedSettings);
        }
      },
      (error) => {
        console.warn('Banner Firestore subscription note (using cached/server state):', error);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to banner settings via Firestore:', err);
  }

  return () => {
    localSubscribers.delete(onUpdate);
    unsubscribeFirestore();
  };
};

/**
 * Persists updated banner settings:
 * 1. Writes to localStorage immediately
 * 2. Notifies all local subscribers synchronously
 * 3. Broadcasts to other open tabs/windows
 * 4. Dispatches CustomEvent
 * 5. Calls server API POST /api/settings/banners (which pushes SSE to iPhone & all devices)
 * 6. Dual-writes to Firestore in the background
 */
export const saveBannerSettings = async (settings: BannerSettings): Promise<void> => {
  // 1. Local Cache
  cacheBannerSettings(settings);

  // 2. Local Subscribers (instant UI update in current tab)
  localSubscribers.forEach((fn) => {
    try {
      fn(settings);
    } catch (e) {
      console.error('Error invoking subscriber in saveBannerSettings:', e);
    }
  });

  // 3. BroadcastChannel (cross-tab)
  try {
    broadcastChannel?.postMessage(settings);
  } catch {}

  // 4. Custom DOM Event
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('swadeep_banner_settings_updated', { detail: settings })
      );
    } catch {}
  }

  // 5. Server REST API -> Broadcasts SSE to all remote devices (e.g. iPhone, simulator)
  try {
    await fetch('/api/settings/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  } catch (err) {
    console.warn('Server sync note for banner settings:', err);
  }

  // 6. Firestore Dual-Write
  try {
    await setDoc(
      BANNER_DOC_REF,
      {
        isEnabled: settings.isEnabled,
        autoSlideIntervalSeconds: settings.autoSlideIntervalSeconds,
        banners: settings.banners,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    // Firestore may fail due to permissions, server SSE handles cross-device sync
    console.warn('Firestore write note for banner settings:', error);
  }
};

/**
 * Quickly toggle active state of a single banner
 */
export const toggleBannerStatus = async (
  bannerId: string,
  isActive: boolean
): Promise<BannerSettings> => {
  const current = getCachedBannerSettings();
  const updatedBanners = current.banners.map((b) =>
    b.id === bannerId ? { ...b, isActive } : b
  );
  const updatedSettings: BannerSettings = {
    ...current,
    banners: updatedBanners,
  };
  await saveBannerSettings(updatedSettings);
  return updatedSettings;
};

/**
 * Delete a banner
 */
export const deleteBanner = async (bannerId: string): Promise<BannerSettings> => {
  const current = getCachedBannerSettings();
  const updatedBanners = current.banners.filter((b) => b.id !== bannerId);
  const updatedSettings: BannerSettings = {
    ...current,
    banners: updatedBanners,
  };
  await saveBannerSettings(updatedSettings);
  return updatedSettings;
};

/**
 * Add or update a banner
 */
export const upsertBanner = async (banner: PromotionalBanner): Promise<BannerSettings> => {
  const current = getCachedBannerSettings();
  const existingIndex = current.banners.findIndex((b) => b.id === banner.id);
  let updatedBanners: PromotionalBanner[];

  if (existingIndex >= 0) {
    updatedBanners = [...current.banners];
    updatedBanners[existingIndex] = { ...banner };
  } else {
    updatedBanners = [
      ...current.banners,
      {
        ...banner,
        order: current.banners.length + 1,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  const updatedSettings: BannerSettings = {
    ...current,
    banners: updatedBanners,
  };
  await saveBannerSettings(updatedSettings);
  return updatedSettings;
};
