import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import {
  collection,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { db } from './firebase/config';
import { Product, Order, StaffSession } from './types';
import {
  getSanitizedCachedProducts,
  sanitizeProducts,
  syncDeletedProductsFromFirestore,
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
import { LocationPermissionModal } from './components/LocationPermissionModal';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TrackOrderPage } from './components/TrackOrderPage';
import { Footer } from './components/Footer';
import { AnimatedAmbientBackground } from './components/AnimatedAmbientBackground';
import { lazyWithRetry } from './utils/lazyRetry';
import { PortalErrorBoundary } from './components/PortalErrorBoundary';
import { AVAILABLE_FONTS } from './utils/fontList';

// Lazy-load Admin, Kitchen, and Delivery views with auto-retry and cache-busting resilience
const AdminLogin = lazyWithRetry(() => import('./components/admin/AdminLogin'));
const AdminDashboard = lazyWithRetry(() => import('./components/admin/AdminDashboard'));
const KitchenDisplayPage = lazyWithRetry(() => import('./components/kitchen/KitchenDisplayPage'));
const DeliveryAgentPortal = lazyWithRetry(() => import('./components/delivery/DeliveryAgentPortal'));

import { getSavedStaffSession, clearStaffSession, seedStaffIfEmpty } from './services/staffService';
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
  getScrollPosition
} from './utils/scrollStateStorage';
import { triggerHaptic } from './utils/haptics';

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
  const { setIsCartOpen, clearCart, addToCart } = useCart();
  const { settings, showPermissionGuide, setShowPermissionGuide } = useLocation();

  // Navigation views: 'home' | 'track' | 'admin' - Persisted cross-session
  const [currentView, setCurrentViewState] = useState<'home' | 'track' | 'admin'>(() => getSavedActiveView());

  // Staff Session (Role-based: admin, kitchen, delivery)
  const [staffSession, setStaffSession] = useState<StaffSession | null>(() => getSavedStaffSession());

  // Tracking query passed from checkout or recent order
  const [trackingOrderId, setTrackingOrderId] = useState('');
  const [trackingPhone, setTrackingPhone] = useState('');

  // Products state & real-time synchronization with offline caching (strictly excluding any hardcoded dummy items)
  const [products, setProducts] = useState<Product[]>(() => {
    return getSanitizedCachedProducts();
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('swadeep_cached_products');
      return !cached;
    } catch {
      return true;
    }
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

    // Update URL hash for clean address bar state without full reload
    if (typeof window !== 'undefined') {
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
    seedStaffIfEmpty();
    syncDeletedProductsFromFirestore().catch(() => {});
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

  const handleSelectCard = useCallback((id: string) => {
    setSelectedCardId(id);
  }, []);

  const handleHoverChange = useCallback((id: string | null) => {
    setHoveredCardId(id);
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

  // Modals & Card Selection
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
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
    // Transition cleanly from Cart to Checkout in history stack
    window.history.pushState({ modal: 'checkout', from: 'cart' }, '');
    setIsCheckoutOpen(true);
    setIsCartOpen(false);
  }, [setIsCartOpen]);

  const menuSectionRef = useRef<HTMLDivElement>(null);

  const [isNavVisible, setIsNavVisible] = useState(true);
  const downAccumRef = useRef(0);
  const upAccumRef = useRef(0);
  const rAFRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const scrollSaveDebounceRef = useRef<number | null>(null);

  // Reset header visibility when switching views
  useEffect(() => {
    setIsNavVisible(true);
  }, [currentView]);

  // Synchronized scroll direction listener for both Header and MobileBottomNav:
  // - Downscroll >= 16px: smoothly slides Header up and BottomNav down
  // - Upscroll >= 10px or Page Top (<= 20px): smoothly slides them back into view
  useEffect(() => {
    lastScrollYRef.current = typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0;

    const onScroll = () => {
      if (document.body.style.position === 'fixed') return;
      if (rAFRef.current !== null) return;

      rAFRef.current = window.requestAnimationFrame(() => {
        rAFRef.current = null;

        const currentY = window.scrollY || window.pageYOffset || 0;
        const deltaY = currentY - lastScrollYRef.current;

        // When at or near the top of the page, always stay visible
        if (currentY <= 20) {
          downAccumRef.current = 0;
          upAccumRef.current = 0;
          setIsNavVisible(true);
        } else {
          if (deltaY > 0) {
            downAccumRef.current += deltaY;
            upAccumRef.current = 0;
          } else if (deltaY < 0) {
            upAccumRef.current += Math.abs(deltaY);
            downAccumRef.current = 0;
          }

          if (downAccumRef.current >= 16) {
            setIsNavVisible(false);
          } else if (upAccumRef.current >= 10) {
            setIsNavVisible(true);
          }
        }

        lastScrollYRef.current = currentY;

        // Debounce saving scroll position
        if (scrollSaveDebounceRef.current) {
          window.clearTimeout(scrollSaveDebounceRef.current);
        }
        scrollSaveDebounceRef.current = window.setTimeout(() => {
          saveScrollPosition(currentScrollKeyRef.current, currentY);
        }, 500);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rAFRef.current) window.cancelAnimationFrame(rAFRef.current);
      if (scrollSaveDebounceRef.current) window.clearTimeout(scrollSaveDebounceRef.current);
    };
  }, []);

  // Listen to products in Firestore in real-time with resilient offline/permission fallback
  useEffect(() => {
    const productsCol = collection(db, 'products');
    const q = query(productsCol);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setIsLoadingProducts(false);
        if (snapshot.empty) {
          // Empty menu - strictly do NOT auto-seed or inject dummy products
          setProducts([]);
          try {
            localStorage.setItem('swadeep_cached_products', JSON.stringify([]));
          } catch {}
        } else {
          const prods: Product[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Product;
            prods.push({
              ...data,
              id: docSnap.id,
            });
          });
          const cleanProds = sanitizeProducts(prods);
          setProducts(cleanProds);
          try {
            localStorage.setItem('swadeep_cached_products', JSON.stringify(cleanProds));
          } catch {}
        }
      },
      (err) => {
        // Fall back gracefully when Firestore permissions restrict direct queries or network is offline
        console.warn('Products sync note: using cached/local menu catalogue (Firestore offline or restricted).', err?.message || err);
        setIsLoadingProducts(false);
        const cleanCached = getSanitizedCachedProducts();
        setProducts(cleanCached);
      }
    );

    // Support instant local menu updates when admin modifies products
    const handleLocalProductsUpdate = (e: Event) => {
      try {
        const customEvt = e as CustomEvent;
        if (customEvt.detail && Array.isArray(customEvt.detail)) {
          const clean = sanitizeProducts(customEvt.detail);
          setProducts(clean);
          return;
        }
        const cleanCached = getSanitizedCachedProducts();
        setProducts(cleanCached);
      } catch {}
    };

    window.addEventListener('swadeep_products_updated', handleLocalProductsUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('swadeep_products_updated', handleLocalProductsUpdate);
    };
  }, []);

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
      acc[p.category] = (acc[p.category] || 0) + 1;
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
        matchesCategory = p.category === activeCategory;
      }

      if (!matchesCategory) return false;
      if (!query) return true;

      return (
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        p.category.toLowerCase().includes(query)
      );
    });

    // Products strictly follow manual order sequence (sortOrder) set in Admin
    const sorted = matched.sort((a, b) => {
      const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : 1000;
      const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : 1000;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aPin = Boolean(a.isFeatured || a.isPinnedToFront);
      const bPin = Boolean(b.isFeatured || b.isPinnedToFront);
      if (aPin && !bPin) return -1;
      if (!aPin && bPin) return 1;
      return 0;
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
    setSelectedCardId(prod.id);
    if (prod.realProductId) {
      const realParent = products.find((p) => p.id === prod.realProductId) || prod;
      setSelectedProductForModal({
        ...realParent,
        defaultVariantIndex: prod.defaultVariantIndex,
        selectedColorName: prod.selectedColorName,
      });
    } else {
      setSelectedProductForModal(prod);
    }
  }, [products]);

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStaffLoginSuccess = (session: StaffSession) => {
    setStaffSession(session);
  };

  const handleStaffLogout = () => {
    clearStaffSession();
    setStaffSession(null);
    signOut();
  };

  // If viewing admin or staff portal
  if (currentView === 'admin') {
    if (authLoading) {
      return <PortalLoadingFallback />;
    }

    return (
      <PortalErrorBoundary onBackToStore={() => setCurrentView('home')}>
        <Suspense fallback={<PortalLoadingFallback />}>
          {staffSession ? (
            staffSession.role === 'kitchen' ? (
              <KitchenDisplayPage
                currentChef={staffSession.data}
                onLogout={handleStaffLogout}
                onBackToStore={() => setCurrentView('home')}
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
                onBackToStore={() => setCurrentView('home')}
                onLogout={handleStaffLogout}
              />
            )
          ) : user ? (
            <AdminDashboard
              products={products}
              onBackToStore={() => setCurrentView('home')}
              onLogout={handleStaffLogout}
            />
          ) : (
            <AdminLogin
              onBackToStore={() => setCurrentView('home')}
              onStaffLoginSuccess={handleStaffLoginSuccess}
            />
          )}
        </Suspense>
      </PortalErrorBoundary>
    );
  }

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden flex flex-col justify-between selection:bg-slate-200 selection:text-slate-900 pb-8">
      {/* Dynamic ambient background with still pattern & slow morphing gradient (Pink, Blue, Purple, White @ 5% opacity) */}
      <AnimatedAmbientBackground />

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
        className="flex-1 w-full max-w-full overflow-x-hidden pt-[calc(max(env(safe-area-inset-top,0.5rem),0.5rem)+5.35rem)] sm:pt-48 pb-32 sm:pb-12 animate-in fade-in duration-150"
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
          {isLoadingProducts && products.length === 0 ? (
            <ProductSkeletonGrid count={8} />
          ) : (
            <div
              key={`${activeCategory}-${searchQuery || 'all'}`}
              className="animate-category-switch w-full"
            >
              {filteredProducts.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs my-4">
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
              ) : (
                /* Product Grid - 2 columns on mobile, 3 on tablet, 4 on desktop directly without background patti */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                  {filteredProducts.map((product, idx) => {
                    const isCardSelected = (hoveredCardId || selectedCardId) === product.id;
                    const isFav = favoritesSet.has(product.realProductId || product.id);
                    return (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onOpenDetail={handleOpenProductModal}
                        isFavorite={isFav}
                        onToggleFavorite={toggleFavorite}
                        isSelected={isCardSelected}
                        onSelect={handleSelectCard}
                        onHoverChange={handleHoverChange}
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
      <Footer onGoToAdmin={() => { setCurrentView('admin'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />

      {/* Subdued Non-Intrusive Offline Status Indicator */}
      <OfflineIndicator />

      {/* Floating Mobile Bottom Navigation Dock & Dedicated Circular Cart Button */}
      <MobileBottomNav
        currentView={currentView}
        setCurrentView={setCurrentView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isVisible={isNavVisible}
        onOpenSearch={() => {
          setIsMobileSearchOpen(true);
          setIsNavVisible(true);
        }}
      />

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

      {/* GPS Location Permission Flow */}
      <LocationPermissionModal
        isOpen={showPermissionGuide}
        onClose={() => setShowPermissionGuide(false)}
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
