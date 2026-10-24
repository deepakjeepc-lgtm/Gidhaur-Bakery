import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { Product, Order, StaffSession } from './types';
import {
  getSanitizedCachedProducts,
  getProductsFromIndexedDB,
  syncCatalogFromNetwork,
  sanitizeProducts,
  purgeLocalHardcodedProducts,
} from './services/productService';

import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider, useLocation } from './context/LocationContext';
import { CartProvider, useCart } from './context/CartContext';

import { Navbar } from './components/Navbar';
import { CategoryFilter } from './components/CategoryFilter';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { ProductSkeletonGrid } from './components/ProductSkeletonGrid';
import { CartDrawer } from './components/CartDrawer';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TrackOrderPage } from './components/TrackOrderPage';
import { BakeryClosedQuotaScreen } from './components/BakeryClosedQuotaScreen';
import { Footer } from './components/Footer';
import { AnimatedAmbientBackground } from './components/AnimatedAmbientBackground';
import { ReadLimitProtectionBanner } from './components/ReadLimitProtectionBanner';
import { PortalErrorBoundary } from './components/PortalErrorBoundary';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import KitchenDisplayPage from './components/kitchen/KitchenDisplayPage';
import PreparingDisplayPage from './components/preparing/PreparingDisplayPage';
import DeliveryAgentPortal from './components/delivery/DeliveryAgentPortal';

import { getSavedStaffSession, clearStaffSession } from './services/staffService';
import {
  subscribeToCategories,
  getCachedCategories,
  getCachedCategoryIcons,
  CategoryDetail,
  getCachedDefaultLandingCategory
} from './services/categoryService';
import {
  saveActiveView,
  getSavedActiveView,
  saveActiveCategory,
  getSavedActiveCategory,
  saveScrollPosition,
  restoreScrollPosition,
} from './utils/scrollStateStorage';
import { triggerHaptic } from './utils/haptics';
import { subscribeToLiveSync } from './services/syncService';
import {
  getCustomerTrackedOrderIds,
  checkAndNotifyCustomerOrderStatus,
  registerCustomerOrderForNotifications,
} from './services/customerNotificationService';
import { registerPushSubscription } from './utils/sound';
import { getCustomerOwnOrders } from './services/orderArchiveService';

import { UtensilsCrossed, RefreshCw, Heart, Search, X } from 'lucide-react';

const PortalLoadingFallback: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200/80 flex items-center justify-center mb-3">
      <RefreshCw className="w-6 h-6 text-slate-700 animate-spin" />
    </div>
    <p className="text-xs font-semibold text-slate-500 tracking-wide">Loading portal...</p>
  </div>
);

function MainApp() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isCartOpen, setIsCartOpen, clearCart, addToCart } = useCart();
  const { settings } = useLocation();

  // Navigation views: 'home' | 'track' | 'admin' - Persisted cross-session
  const [currentView, setCurrentViewState] = useState<'home' | 'track' | 'admin'>(() => getSavedActiveView());

  // Keep admin portal mounted in memory once visited or pre-warmed after startup
  const [hasVisitedAdmin, setHasVisitedAdmin] = useState<boolean>(() => currentView === 'admin');

  useEffect(() => {
    if (currentView === 'admin') {
      setHasVisitedAdmin(true);
      return;
    }
    // Background pre-warm after 150ms so even the very first admin click is 0ms instant
    const timer = setTimeout(() => {
      setHasVisitedAdmin(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [currentView]);

  // Staff Session (Role-based: admin, kitchen, delivery)
  const [staffSession, setStaffSession] = useState<StaffSession | null>(() => getSavedStaffSession());

  // Synchronize Android top status bar & bottom gesture home-indicator bar colors (eliminates bottom "black patti")
  useEffect(() => {
    const isAdminView = currentView === 'admin';
    const topThemeColor = isAdminView ? '#0A0A0C' : '#ffffff';
    const bottomNavColor = isAdminView ? '#0A0A0C' : '#f6f8fb';

    try {
      document.documentElement.classList.toggle('admin-mode-active', isAdminView);
      document.body.classList.toggle('admin-mode-active', isAdminView);
      document.documentElement.style.backgroundColor = bottomNavColor;
      document.body.style.backgroundColor = bottomNavColor;

      const themeMetaList = document.querySelectorAll('meta[name="theme-color"]');
      themeMetaList.forEach((meta) => {
        meta.setAttribute('content', topThemeColor);
      });
      const navMeta = document.querySelector('meta[name="navigation-bar-color"]');
      if (navMeta) {
        navMeta.setAttribute('content', bottomNavColor);
      }
    } catch {}
  }, [currentView]);

  // Global Background & Closed-App Notification Subscription + Live SSE Order Status Monitor (0 Firestore reads)
  useEffect(() => {
    // 1. Register existing customer orders on this device for Web Push & Service Worker sync
    try {
      const ownOrders = getCustomerOwnOrders();
      ownOrders.forEach((o: any) => {
        const oid = o?.orderId || o?.id;
        if (oid) {
          registerCustomerOrderForNotifications(String(oid), o?.phone);
        }
      });
      const trackedIds = getCustomerTrackedOrderIds();
      if (trackedIds.length > 0) {
        registerPushSubscription('customer', { orderIds: trackedIds }).catch(() => {});
      }
    } catch {}

    // 2. If Admin or Staff is logged in (or previously logged in on this device), register Admin Web Push
    const isAdminOrStaff =
      Boolean(user) ||
      Boolean(staffSession) ||
      localStorage.getItem('swadeep_is_admin_device') === 'true';
    if (isAdminOrStaff) {
      registerPushSubscription('admin', { isAdminDevice: true }).catch(() => {});
    }

    // 3. Global SSE listener for Customer Order Status changes (works even on Home screen, 0 Firestore reads!)
    const unsubSSE = subscribeToLiveSync({
      onOrders: (liveOrders) => {
        if (!Array.isArray(liveOrders) || liveOrders.length === 0) return;
        const trackedIds = getCustomerTrackedOrderIds();
        if (trackedIds.length === 0) return;
        const trackedSet = new Set(trackedIds.map((id) => String(id).toLowerCase()));
        liveOrders.forEach((ord: any) => {
          const oid = String(ord?.orderId || ord?.id || '').toLowerCase();
          if (oid && trackedSet.has(oid)) {
            checkAndNotifyCustomerOrderStatus(ord as Order);
          }
        });
      },
    });

    // 4. Handle deep-link navigation when user taps a notification from Android status bar / lock screen
    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'NAVIGATE_FROM_NOTIFICATION') {
        if (data.role === 'admin' || String(data.url || '').includes('admin')) {
          setCurrentViewState('admin');
          saveActiveView('admin');
        } else if (data.role === 'customer' || String(data.url || '').includes('track')) {
          if (data.orderId) {
            setTrackingOrderId(String(data.orderId));
          }
          setCurrentViewState('track');
          saveActiveView('track');
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    // Also check initial URL hash (#admin or #track) when launched from closed state via notification tap
    try {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#admin') {
        setCurrentViewState('admin');
        saveActiveView('admin');
      } else if (hash === '#track') {
        setCurrentViewState('track');
        saveActiveView('track');
      }
    } catch {}

    return () => {
      unsubSSE();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [user, staffSession]);

  // Tracking query passed from checkout or recent order
  const [trackingOrderId, setTrackingOrderId] = useState('');
  const [trackingPhone, setTrackingPhone] = useState('');

  // Products state & real-time synchronization with offline caching (strictly excluding any hardcoded dummy items)
  const initialCachedProducts = useMemo(() => getSanitizedCachedProducts(), []);
  const [products, setProducts] = useState<Product[]>(initialCachedProducts);
  const [firestoreQuotaExceeded, setFirestoreQuotaExceeded] = useState(false);

  // Sync quota updates from quotaTrackerService or Admin simulation
  useEffect(() => {
    const handleQuota = (e: any) => {
      if (e.detail && typeof e.detail.isExhausted === 'boolean') {
        setFirestoreQuotaExceeded(e.detail.isExhausted);
      }
    };
    window.addEventListener('gidhaur_quota_updated', handleQuota);
    return () => window.removeEventListener('gidhaur_quota_updated', handleQuota);
  }, []);

  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState<boolean>(() => {
    return initialCachedProducts.length > 0;
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(() => {
    return initialCachedProducts.length === 0;
  });

  // Search & Category Filter - Persisted cross-session with Landing Screen default support
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [activeCategory, setActiveCategoryState] = useState<string>(() => {
    const landingDefault = getCachedDefaultLandingCategory();
    if (landingDefault) return landingDefault;
    const saved = getSavedActiveCategory();
    return saved || 'All';
  });

  // Helper to compute current scroll cache key
  const getCurrentScrollKey = (view = currentView, category = activeCategory) => {
    if (view === 'home') return `home_${category}`;
    return view;
  };

  const currentScrollKeyRef = useRef(getCurrentScrollKey());
  currentScrollKeyRef.current = getCurrentScrollKey();

  // Custom view switch handler that preserves and restores scroll positions
  const setCurrentView = (nextView: 'home' | 'track' | 'admin') => {
    if (nextView === currentView) return;
    triggerHaptic('selection');
    // 1. Save scroll position of previous view
    const prevKey = getCurrentScrollKey(currentView, activeCategory);
    saveScrollPosition(prevKey, window.scrollY);

    // 2. Set new view & persist
    setCurrentViewState(nextView);
    saveActiveView(nextView);

    // In iOS standalone PWA, never touch window.history or hash as it triggers Safari URL bar reveal
    const isStandalone = typeof window !== 'undefined' && (
      Boolean((window.navigator as any).standalone) ||
      window.matchMedia('(display-mode: standalone)').matches
    );
    if (typeof window !== 'undefined' && !isStandalone) {
      try {
        const hash = nextView === 'home' ? '' : `#${nextView}`;
        window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
      } catch {}
    }

    // 3. Restore scroll position of next view
    const nextKey = getCurrentScrollKey(nextView, activeCategory);
    restoreScrollPosition(nextKey);
  };

  // Custom category switch handler that preserves and restores scroll positions per category
  const setActiveCategory = (nextCat: string) => {
    if (nextCat === activeCategory) return;
    triggerHaptic('selection');
    // 1. Save scroll position of current category
    const prevKey = getCurrentScrollKey(currentView, activeCategory);
    saveScrollPosition(prevKey, window.scrollY);

    // 2. Set new category & persist
    setActiveCategoryState(nextCat);
    saveActiveCategory(nextCat);

    // 3. Restore scroll position of next category (or top if not visited)
    const nextKey = getCurrentScrollKey(currentView, nextCat);
    restoreScrollPosition(nextKey);
  };

  // Favorites / Liked Products State (Stored locally)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('swadeep_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    purgeLocalHardcodedProducts();
  }, []);

  // Restore scroll position on initial app load / browser reload
  useEffect(() => {
    const initialKey = getCurrentScrollKey();
    restoreScrollPosition(initialKey, 6);
  }, []);

  // Save scroll on unload, pagehide, and visibilitychange (app close / tab switch)
  useEffect(() => {
    const handleSaveCurrentState = () => {
      const key = currentScrollKeyRef.current;
      saveScrollPosition(key, window.scrollY);
      saveActiveView(currentView);
      saveActiveCategory(activeCategory);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleSaveCurrentState();
      }
    };

    window.addEventListener('beforeunload', handleSaveCurrentState);
    window.addEventListener('pagehide', handleSaveCurrentState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleSaveCurrentState);
      window.removeEventListener('pagehide', handleSaveCurrentState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentView, activeCategory]);

  useEffect(() => {
    try {
      localStorage.setItem('swadeep_favorites', JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  const toggleFavorite = useCallback((productId: string) => {
    triggerHaptic('light');
    setFavorites((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }, []);

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const handleReorder = (orderItems: import('./types').OrderItem[]) => {
    clearCart();
    orderItems.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        const variant = product.variants?.find((v) => v.name === item.selectedSize);
        addToCart(product, item.quantity, variant);
      }
    });
    setIsCartOpen(true);
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Modals
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  // Master Modal History Navigator (Home <-> Cart <-> Order Confirmation)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const modal = event.state?.modal;
      if (modal === 'checkout') {
        setIsCheckoutOpen(true);
        setIsCartOpen(false);
      } else if (modal === 'cart') {
        setIsCheckoutOpen(false);
        setIsCartOpen(true);
      } else {
        // Returned to base view (home / track / admin)
        setIsCheckoutOpen(false);
        setIsCartOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setIsCartOpen]);

  const handleProceedToCheckout = useCallback(() => {
    setIsCheckoutOpen(true);
    setIsCartOpen(false);
  }, [setIsCartOpen]);

  const menuSectionRef = useRef<HTMLDivElement>(null);

  const [isNavVisible, setIsNavVisible] = useState(true);
  const isNavVisibleRef = useRef(true);
  const downAccumRef = useRef(0);
  const upAccumRef = useRef(0);
  const rAFRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const scrollSaveDebounceRef = useRef<number | null>(null);

  const updateNavVisibility = useCallback((visible: boolean) => {
    if (isNavVisibleRef.current !== visible) {
      isNavVisibleRef.current = visible;
      setIsNavVisible(visible);
    }
  }, []);

  // Reset header visibility when switching views
  useEffect(() => {
    updateNavVisibility(true);
  }, [currentView, updateNavVisibility]);

  // Synchronized scroll direction listener for both Header and MobileBottomNav:
  // - Downscroll >= 24px: smoothly slides Header up and BottomNav down
  // - Upscroll >= 16px or Page Top (<= 24px): smoothly slides them back into view
  useEffect(() => {
    lastScrollYRef.current = typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0;

    const onScroll = () => {
      if (
        document.body.style.position === 'fixed' ||
        document.body.style.overflow === 'hidden'
      ) {
        return;
      }
      if (rAFRef.current !== null) return;

      rAFRef.current = window.requestAnimationFrame(() => {
        rAFRef.current = null;

        const currentY = Math.max(0, window.scrollY || window.pageYOffset || 0);
        const deltaY = currentY - lastScrollYRef.current;

        // When at or near the top of the page, always stay visible
        if (currentY <= 24) {
          downAccumRef.current = 0;
          upAccumRef.current = 0;
          updateNavVisibility(true);
        } else {
          if (deltaY > 0) {
            downAccumRef.current += deltaY;
            upAccumRef.current = 0;
          } else if (deltaY < 0) {
            upAccumRef.current += Math.abs(deltaY);
            downAccumRef.current = 0;
          }

          if (downAccumRef.current >= 24) {
            updateNavVisibility(false);
          } else if (upAccumRef.current >= 16) {
            updateNavVisibility(true);
          }
        }

        lastScrollYRef.current = currentY;

        // Debounce saving scroll position in memory/storage after scroll settles
        if (scrollSaveDebounceRef.current) {
          window.clearTimeout(scrollSaveDebounceRef.current);
        }
        scrollSaveDebounceRef.current = window.setTimeout(() => {
          saveScrollPosition(currentScrollKeyRef.current, currentY);
        }, 600);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rAFRef.current) window.cancelAnimationFrame(rAFRef.current);
      if (scrollSaveDebounceRef.current) window.clearTimeout(scrollSaveDebounceRef.current);
    };
  }, [updateNavVisibility]);

  // Fast catalog signature helper to prevent redundant re-renders when IDB/network returns identical catalog
  const computeCatalogSignature = useCallback((list: Product[]): string => {
    if (!list || list.length === 0) return '0';
    let sig = `${list.length}:`;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      sig += `${p.id}|${p.price}|${p.available !== false ? 1 : 0}|${p.stockQuantity ?? ''}|${p.sortOrder ?? ''}|${p.imageUrl || ''}|${p.images?.length || 0};`;
    }
    return sig;
  }, []);

  const catalogSigRef = useRef<string>(computeCatalogSignature(initialCachedProducts));
  const productsRef = useRef<Product[]>(initialCachedProducts);
  productsRef.current = products;

  const updateProductsIfChanged = useCallback((nextList: Product[]) => {
    const nextSig = computeCatalogSignature(nextList);
    if (nextSig !== catalogSigRef.current) {
      catalogSigRef.current = nextSig;
      productsRef.current = nextList;
      setProducts(nextList);
    }
  }, [computeCatalogSignature]);

  // Load products: Instant IndexedDB + LocalStorage load, followed by single throttled syncCatalogFromNetwork.
  // Category filtering is strictly in-memory (products.filter(...)) with 0 network calls.
  useEffect(() => {
    let isMounted = true;

    // 1. Read full persistent catalog immediately from IndexedDB
    getProductsFromIndexedDB()
      .then((idbProds) => {
        if (!isMounted) return;
        if (idbProds && idbProds.length > 0) {
          updateProductsIfChanged(idbProds);
          setIsLoadingProducts(false);
          setHasInitialLoadCompleted(true);
          setFirestoreQuotaExceeded(false);
        }
      })
      .catch((err) => {
        console.warn('IndexedDB initial load note:', err);
      });

    // 2. Single throttled background catalog sync (fetches /api/products, caches in IDB, 0 Firestore reads)
    syncCatalogFromNetwork(false)
      .then((synced) => {
        if (!isMounted) return;
        if (synced && synced.length > 0) {
          updateProductsIfChanged(synced);
          setIsLoadingProducts(false);
          setHasInitialLoadCompleted(true);
          setFirestoreQuotaExceeded(false);
        } else {
          setIsLoadingProducts(false);
          setHasInitialLoadCompleted(true);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoadingProducts(false);
        setHasInitialLoadCompleted(true);
      });

    // 3. Support instant local menu updates when admin modifies products
    const handleLocalProductsUpdate = async (e: Event) => {
      try {
        const customEvt = e as CustomEvent;
        if (customEvt.detail && Array.isArray(customEvt.detail) && customEvt.detail.length > 0) {
          const clean = sanitizeProducts(customEvt.detail);
          if (clean.length > 0) {
            updateProductsIfChanged(clean);
            return;
          }
        }
        const idb = await getProductsFromIndexedDB();
        if (idb.length > 0) {
          updateProductsIfChanged(idb);
          return;
        }
        const cleanCached = getSanitizedCachedProducts();
        if (cleanCached.length > 0) {
          updateProductsIfChanged(cleanCached);
        }
      } catch {}
    };

    window.addEventListener('swadeep_products_updated', handleLocalProductsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('swadeep_products_updated', handleLocalProductsUpdate);
    };
  }, [updateProductsIfChanged]);

  // Real-time custom categories & icons managed from Admin Panel
  const [managedCategories, setManagedCategories] = useState<string[]>(() => getCachedCategories());
  const [categoryIcons, setCategoryIcons] = useState<Record<string, CategoryDetail>>(() => getCachedCategoryIcons());

  useEffect(() => {
    const unsub = subscribeToCategories([], (newCats, newIcons) => {
      setManagedCategories(newCats);
      setCategoryIcons(newIcons || {});
    });
    return () => unsub();
  }, []);

  // Extract categories dynamically: preserves admin ordering + any extra product categories
  const categories = useMemo(() => {
    const productCategories = Array.from(new Set(products.map((p) => p.category))).filter(Boolean) as string[];
    const ordered = [
      ...managedCategories,
      ...productCategories.filter((c) => !managedCategories.includes(c))
    ];
    return ['All', ...ordered];
  }, [products, managedCategories]);

  const categoryCounts = useMemo(() => {
    return products.reduce((acc, p) => {
      acc['All'] = (acc['All'] || 0) + 1;
      const cat = p.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [products]);

  // Count of valid favorited products currently available
  const favoriteCount = useMemo(() => {
    return products.filter((p) => favorites.includes(p.id)).length;
  }, [products, favorites]);

  // Filter products by category, liked state, and search query + Sort pinned items to the front
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const matched = products.filter((p) => {
      let matchesCategory = false;
      if (activeCategory === 'All') {
        matchesCategory = true;
      } else if (activeCategory === 'Liked') {
        matchesCategory = favorites.includes(p.id);
      } else {
        const pCat = (p.category || '').trim().toLowerCase();
        const aCat = activeCategory.trim().toLowerCase();
        const normPCat = pCat.replace(/&/g, 'and').replace(/\s+/g, ' ');
        const normACat = aCat.replace(/&/g, 'and').replace(/\s+/g, ' ');
        matchesCategory =
          pCat === aCat ||
          normPCat === normACat ||
          (normPCat.includes('gift hamper') && normACat.includes('gift hamper')) ||
          (normPCat.includes('combo') && normACat.includes('combo'));
      }

      if (!matchesCategory) return false;
      if (!query) return true;

      return (
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        p.category.toLowerCase().includes(query)
      );
    });

    // Products follow category arrangement order in All view, and manual sortOrder within each category
    const categoryOrderMap = new Map<string, number>();
    managedCategories.forEach((cat, idx) => {
      categoryOrderMap.set(cat.toLowerCase().trim(), idx);
    });

    const sorted = matched.sort((a, b) => {
      // 1. If viewing 'All', group products strictly by Category Arrangement sequence
      if (activeCategory === 'All') {
        const catA = (a.category || '').toLowerCase().trim();
        const catB = (b.category || '').toLowerCase().trim();

        const catIdxA = categoryOrderMap.has(catA) ? categoryOrderMap.get(catA)! : 9999;
        const catIdxB = categoryOrderMap.has(catB) ? categoryOrderMap.get(catB)! : 9999;

        if (catIdxA !== catIdxB) {
          return catIdxA - catIdxB;
        }
      }

      // 2. Within each category, sort by manual sortOrder
      const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : 1000;
      const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : 1000;
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      const aPin = Boolean(a.isFeatured || a.isPinnedToFront);
      const bPin = Boolean(b.isFeatured || b.isPinnedToFront);
      if (aPin && !bPin) return -1;
      if (!aPin && bPin) return 1;
      
      return (a.name || '').localeCompare(b.name || '');
    });

    // Expand items whose admin setting showVariantsSeparately is enabled
    // Fast O(N) single-pass without nested filter allocations or findIndex calls
    const result: Product[] = [];
    const len = sorted.length;
    for (let i = 0; i < len; i++) {
      const p = sorted[i];
      if (!p.showVariantsSeparately) {
        result.push(p);
        continue;
      }

      if (p.variants && p.variants.length > 0) {
        let hasDedicated = false;
        const vLen = p.variants.length;
        for (let j = 0; j < vLen; j++) {
          const v = p.variants[j];
          if (v.imageUrl && v.imageUrl.trim().length > 0) {
            hasDedicated = true;
            const dedicatedImage = v.imageUrl || p.imageUrl;
            result.push({
              ...p,
              id: `${p.id}__var_${j}`,
              realProductId: p.id,
              defaultVariantIndex: j,
              name: `${p.name} - ${v.name}`,
              price: v.price,
              available: p.available !== false && v.available !== false,
              imageUrl: dedicatedImage,
              images: dedicatedImage ? [dedicatedImage] : [],
              imageFit: v.imageFit || p.imageFit,
              showVariantsSeparately: true,
              variants: [v],
              colorVariants: [],
            });
          }
        }
        if (!hasDedicated) {
          result.push(p);
        }
      } else if (p.colorVariants && p.colorVariants.length > 0) {
        let hasDedicated = false;
        const cLen = p.colorVariants.length;
        for (let j = 0; j < cLen; j++) {
          const c = p.colorVariants[j];
          if (c.imageUrl && c.imageUrl.trim().length > 0) {
            hasDedicated = true;
            const dedicatedImage = c.imageUrl || p.imageUrl;
            result.push({
              ...p,
              id: `${p.id}__col_${j}`,
              realProductId: p.id,
              selectedColorName: c.name,
              name: `${p.name} - ${c.name}`,
              price: c.price,
              available: p.available !== false,
              imageUrl: dedicatedImage,
              images: dedicatedImage ? [dedicatedImage] : [],
              imageFit: c.imageFit || p.imageFit,
              showVariantsSeparately: true,
              variants: [],
              colorVariants: [c],
            });
          }
        }
        if (!hasDedicated) {
          result.push(p);
        }
      } else {
        result.push(p);
      }
    }

    return result;
  }, [products, activeCategory, favorites, searchQuery]);

  const handleOpenProductModal = useCallback((prod: Product) => {
    if (prod.realProductId) {
      const realParent = productsRef.current.find((p) => p.id === prod.realProductId) || prod;
      setSelectedProductForModal({
        ...realParent,
        defaultVariantIndex: prod.defaultVariantIndex,
        selectedColorName: prod.selectedColorName,
      });
    } else {
      setSelectedProductForModal(prod);
    }
  }, []);

  const handleOrderSuccess = (order: Order) => {
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    setConfirmedOrder(order);
  };

  const handleTrackFromSuccess = (orderId: string, phone: string) => {
    setConfirmedOrder(null);
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    setTrackingOrderId(orderId);
    setTrackingPhone(phone);
    setCurrentView('track');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleStaffLoginSuccess = (session: StaffSession) => {
    setStaffSession(session);
  };

  const handleStaffLogout = () => {
    clearStaffSession();
    setStaffSession(null);
    signOut();
  };

  const isOverlayOpen = Boolean(selectedProductForModal || isCartOpen || isCheckoutOpen || confirmedOrder);

  return (
    <>
      {/* Storefront View Root (0ms Instant Switch & Persistent State) */}
      <div
        id="storefront-view-root"
        className={currentView === 'admin' ? 'hidden' : 'relative min-h-screen w-full max-w-full overflow-x-clip flex flex-col justify-between selection:bg-slate-200 selection:text-slate-900 pb-8'}
      >
        <ReadLimitProtectionBanner />
        <AnimatedAmbientBackground />

        <div className={isOverlayOpen ? 'contents invisible pointer-events-none' : 'contents'}>
        {/* Header Container: Solid pure white matching phone status bar 100%, hides/shows in sync with bottom dock */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 w-full transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] bg-white border-b border-slate-100/60 shadow-[0_1px_3px_rgba(15,23,42,0.03)] pt-[max(env(safe-area-inset-top,0.5rem),0.5rem)] sm:pt-3 pb-1 sm:pb-2.5 ${
          currentView !== 'home' ? 'hidden sm:block' : ''
        } ${
          isNavVisible ? 'translate-y-0 pointer-events-auto' : '-translate-y-full pointer-events-none'
        }`}
      >
        <div className="w-full max-w-5xl mx-auto px-3 sm:px-6">
          {/* Desktop Floating Navigation Dock - Completely Removed on Phone View */}
          <div className="hidden sm:block">
            <Navbar
              currentView={currentView}
              setCurrentView={setCurrentView}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          </div>

          {/* Categories Section on Mobile/Desktop OR Top Search Input when Search clicked on mobile */}
          {currentView === 'home' && (
            <div className="w-full sm:pt-2">
              {isMobileSearchOpen ? (
                <div className="flex sm:hidden items-center gap-2.5 w-full py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center flex-1 bg-slate-100 rounded-full px-3.5 py-2 border border-slate-200/80 shadow-2xs">
                    <Search className="w-4.5 h-4.5 text-slate-400 shrink-0 mr-2" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search sweets, cakes, dishes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none font-medium"
                      id="mobile-top-search-input"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-slate-400 hover:text-slate-700 w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 text-xs shrink-0 cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="text-xs font-bold text-slate-700 hover:text-slate-950 px-2.5 py-1.5 rounded-full hover:bg-slate-100 shrink-0 cursor-pointer active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <CategoryFilter
                  categories={categories}
                  activeCategory={activeCategory}
                  onSelectCategory={setActiveCategory}
                  categoryCounts={categoryCounts}
                  favoriteCount={favoriteCount}
                  iconsMap={categoryIcons}
                  activeColor={settings?.categoryActiveColor}
                  inactiveColor={settings?.categoryInactiveColor}
                />
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main View Switcher - Preserves main in DOM for instant 0ms switching */}
      {currentView === 'track' && (
        <div className="pt-[max(env(safe-area-inset-top,0.5rem),0.5rem)] sm:pt-20 flex-1 w-full max-w-full animate-in fade-in duration-150">
          <TrackOrderPage
            initialOrderId={trackingOrderId}
            initialPhone={trackingPhone}
            onReorder={handleReorder}
            onBackToMenu={() => {
              setCurrentView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      <main
        style={{ display: currentView === 'home' ? 'block' : 'none' }}
        className="flex-1 w-full max-w-full overflow-x-clip pt-[calc(max(env(safe-area-inset-top,0.5rem),0.5rem)+5.35rem)] sm:pt-48 pb-32 sm:pb-12"
      >
        {/* Product Catalog Section */}
        <div
          ref={menuSectionRef}
          id="menu-catalog-section"
          className="w-full max-w-5xl mx-auto px-3 sm:px-6 pt-0 pb-8 box-border"
        >
          {/* Active Search / Filter Status Banner */}
          {searchQuery && (
            <div className="flex items-center justify-between gap-3 mb-4 bg-white/80 backdrop-blur-xs border border-slate-200/80 px-4 py-2 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span>Searching for: <strong>"{searchQuery}"</strong></span>
                <span className="text-[11px] font-bold text-slate-400 font-mono">
                  ({filteredProducts.length} items)
                </span>
              </div>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-all"
              >
                Clear ✕
              </button>
            </div>
          )}

          {/* Loading Skeleton State or Empty State or Product Grid */}
          {(!hasInitialLoadCompleted || isLoadingProducts) && products.length === 0 ? (
            <ProductSkeletonGrid count={8} />
          ) : (
            <div
              key={`${activeCategory}-${searchQuery || 'all'}`}
              className="animate-category-switch w-full"
            >
              {filteredProducts.length === 0 ? (
                (!hasInitialLoadCompleted || isLoadingProducts) ? (
                  <ProductSkeletonGrid count={8} />
                ) : (
                  /* Empty State */
                  (firestoreQuotaExceeded && products.length === 0) ? (
                    <BakeryClosedQuotaScreen
                      onRefresh={() => {
                        window.location.reload();
                      }}
                    />
                  ) : (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs my-4 flex items-center justify-center">
                      <div>
                        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                          {activeCategory === 'Liked' ? (
                            <Heart className="w-8 h-8 stroke-[1.5]" />
                          ) : (
                            <UtensilsCrossed className="w-8 h-8 stroke-[1.5]" />
                          )}
                        </div>
                        <h3 className="font-heading font-extrabold text-lg text-slate-900 mb-1">
                          {activeCategory === 'Liked' ? 'No Liked Items Yet' : 'No items found'}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                          {activeCategory === 'Liked'
                            ? 'Tap the heart icon on any dish to save your favorites here for quick ordering.'
                            : searchQuery
                            ? `We couldn't find any dishes matching "${searchQuery}". Try another keyword.`
                            : `No items available in the "${activeCategory}" category.`}
                        </p>
                        {(searchQuery || activeCategory !== 'All') && (
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setActiveCategory('All');
                            }}
                            className="px-5 py-2.5 bg-slate-950 text-white rounded-full text-xs font-bold shadow-xs hover:bg-slate-800 transition-all cursor-pointer"
                          >
                            View All Items
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )
              ) : (
                /* Product Grid - 2 columns on mobile, 3 on tablet, 4 on desktop directly without background patti */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                  {filteredProducts.map((product, idx) => {
                    const isFav = favoritesSet.has(product.realProductId || product.id);
                    return (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onOpenDetail={handleOpenProductModal}
                        isFavorite={isFav}
                        onToggleFavorite={toggleFavorite}
                        priority={idx < 6}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Unified Minimal Footer */}
      <Footer onGoToAdmin={() => { setCurrentView('admin'); window.scrollTo({ top: 0, behavior: 'instant' }); }} />

      {/* Subdued Non-Intrusive Offline Status Indicator */}
      <OfflineIndicator />

      {/* Floating Mobile Bottom Navigation Dock & Dedicated Circular Cart Button */}
      <MobileBottomNav
        currentView={currentView}
        setCurrentView={setCurrentView}
        searchQuery={searchQuery}
        isVisible={isNavVisible}
        onOpenSearch={() => {
          setIsMobileSearchOpen(true);
          setIsNavVisible(true);
        }}
      />
      </div>

      {/* Slide-over Cart Drawer */}
      <CartDrawer
        onProceedToCheckout={handleProceedToCheckout}
        onCheckout={handleProceedToCheckout}
      />

      {/* Product Detail Modal */}
      {selectedProductForModal && (
        <ProductModal
          product={selectedProductForModal}
          allProducts={products}
          onSelectProduct={(p) => setSelectedProductForModal(p)}
          onClose={() => setSelectedProductForModal(null)}
          isFavorite={favorites.includes(selectedProductForModal.realProductId || selectedProductForModal.id)}
          onToggleFavorite={(id) => toggleFavorite(selectedProductForModal.realProductId || id)}
        />
      )}

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
        }}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Order Confirmed Receipt Modal */}
      {confirmedOrder && (
        <OrderSuccessModal
          order={confirmedOrder}
          onClose={() => setConfirmedOrder(null)}
          onTrackOrder={handleTrackFromSuccess}
        />
      )}
      </div>

      {/* Admin & Staff Portal View Root (Pre-warmed in memory for 0ms instantaneous switching) */}
      {(hasVisitedAdmin || currentView === 'admin') && (
        <div
          id="admin-portal-view-root"
          className={currentView === 'admin' ? 'min-h-screen w-full' : 'hidden'}
        >
          <PortalErrorBoundary onBackToStore={() => setCurrentView('home')}>
            <ReadLimitProtectionBanner />
            {authLoading ? (
              <PortalLoadingFallback />
            ) : staffSession ? (
              staffSession.role === 'kitchen' ? (
                <KitchenDisplayPage
                  currentChef={staffSession.data}
                  onLogout={handleStaffLogout}
                  onBackToStore={() => setCurrentView('home')}
                />
              ) : staffSession.role === 'preparing' ? (
                <PreparingDisplayPage
                  onBackToAdmin={handleStaffLogout}
                  onOpenStore={() => setCurrentView('home')}
                />
              ) : staffSession.role === 'delivery' ? (
                <DeliveryAgentPortal
                  currentAgent={staffSession.data}
                  onLogout={handleStaffLogout}
                  onBackToStore={() => setCurrentView('home')}
                />
              ) : (
                <AdminDashboard
                  products={products}
                  onUpdateProducts={setProducts}
                  onBackToStore={() => setCurrentView('home')}
                  onLogout={handleStaffLogout}
                />
              )
            ) : user ? (
              <AdminDashboard
                products={products}
                onUpdateProducts={setProducts}
                onBackToStore={() => setCurrentView('home')}
                onLogout={handleStaffLogout}
              />
            ) : (
              <AdminLogin
                onBackToStore={() => setCurrentView('home')}
                onStaffLoginSuccess={handleStaffLoginSuccess}
              />
            )}
          </PortalErrorBoundary>
        </div>
      )}

      {/* Bottom Edge-to-Edge Home Indicator Surface Fill (Eliminates Android bottom "black patti" gap) */}
      <div
        aria-hidden="true"
        className={`fixed bottom-0 left-0 right-0 pointer-events-none z-0 ${
          currentView === 'admin' ? 'bg-[#0A0A0C]' : 'bg-[#f6f8fb]'
        }`}
        style={{ height: 'max(env(safe-area-inset-bottom, 0px), 2px)' }}
      />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <CartProvider>
          <MainApp />
        </CartProvider>
      </LocationProvider>
    </AuthProvider>
  );
}
export default App;
