import React, { useState, useRef, useEffect } from 'react';
import { Home, Search, ReceiptText, Phone, ShoppingCart, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import { triggerHaptic } from '../utils/haptics';

interface MobileBottomNavProps {
  currentView: 'home' | 'track' | 'admin';
  setCurrentView: (view: 'home' | 'track' | 'admin') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isVisible?: boolean;
  onOpenSearch?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  setCurrentView,
  searchQuery,
  setSearchQuery: _setSearchQuery,
  isVisible: propIsVisible,
  onOpenSearch,
}) => {
  const { totalItems, setIsCartOpen } = useCart();
  const { settings } = useLocation();
  const [localVisible, setLocalVisible] = useState(true);
  const setIsVisible = setLocalVisible;
  const isVisible = propIsVisible !== undefined ? propIsVisible : localVisible;

  // Optimistic synchronized tab state for 0ms instantaneous icon rearrangement
  const [activeTab, setActiveTab] = useState<'home' | 'track'>(
    currentView === 'track' ? 'track' : 'home'
  );

  useEffect(() => {
    if (currentView === 'home' || currentView === 'track') {
      setActiveTab(currentView);
    }
  }, [currentView]);

  const lastScrollYRef = useRef(0);
  const rAFRef = useRef<number | null>(null);
  const isProgrammaticSwitchRef = useRef(false);
  const downAccumRef = useRef(0);
  const upAccumRef = useRef(0);

  // Pure transform-based scroll direction listener:
  // - Downscroll: smoothly slides completely out of viewport (200px down so nothing peeks out)
  // - Upscroll or Page Top: smoothly slides back into viewport
  // - Fixed opacity: 1 avoids mobile backdrop-filter rasterization flash.
  useEffect(() => {
    lastScrollYRef.current =
      typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0;

    const onScroll = () => {
      if (rAFRef.current !== null) return;

      rAFRef.current = window.requestAnimationFrame(() => {
        rAFRef.current = null;

        // If user just switched tabs programmatically, ignore scroll jumps during layout settling
        if (isProgrammaticSwitchRef.current) {
          lastScrollYRef.current = window.scrollY || window.pageYOffset || 0;
          return;
        }

        const currentY = window.scrollY || window.pageYOffset || 0;
        const deltaY = currentY - lastScrollYRef.current;

        // When at or near the top of the page, always stay visible
        if (currentY <= 20) {
          downAccumRef.current = 0;
          upAccumRef.current = 0;
          setIsVisible(true);
        } else {
          if (deltaY > 0) {
            downAccumRef.current += deltaY;
            upAccumRef.current = 0;
          } else if (deltaY < 0) {
            upAccumRef.current += Math.abs(deltaY);
            downAccumRef.current = 0;
          }

          if (downAccumRef.current >= 16) {
            setIsVisible(false);
          } else if (upAccumRef.current >= 10) {
            setIsVisible(true);
          }
        }

        lastScrollYRef.current = currentY;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rAFRef.current) window.cancelAnimationFrame(rAFRef.current);
    };
  }, []);

  // Programmatic tab switch handler that updates optimistic state immediately for 0ms lag
  const handleSwitchTab = (targetView: 'home' | 'track') => {
    if (targetView === activeTab) return;
    triggerHaptic('selection');
    // 1. Optimistic immediate state update: icons & text rearrange on the exact frame of the tap!
    setActiveTab(targetView);
    isProgrammaticSwitchRef.current = true;
    setIsVisible(true);
    setCurrentView(targetView);

    // Keep scroll suppression active while browser handles scroll restoration smoothly
    setTimeout(() => {
      isProgrammaticSwitchRef.current = false;
      lastScrollYRef.current =
        typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0;
    }, 450);
  };

  // Handle direct phone call to Customer Support Number configured in Admin Panel
  const handleCallSupport = () => {
    triggerHaptic('medium');
    const rawNumber = settings?.contactPhone || '';
    const cleanNumber = rawNumber.replace(/[^\d+]/g, '');
    if (cleanNumber) {
      window.location.href = `tel:${cleanNumber}`;
    } else {
      window.location.href = 'tel:+919876543210';
    }
  };

  return (
    <nav
      aria-label="Mobile Navigation Dock"
      className={`fixed bottom-[max(env(safe-area-inset-bottom,0.75rem),1.15rem)] left-0 right-0 z-40 sm:hidden flex items-center justify-between w-full max-w-lg mx-auto px-3.5 select-none transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu ${
        isVisible ? 'translate-y-0 pointer-events-none' : 'translate-y-[200px] pointer-events-none'
      }`}
    >
      {/* Main Expanded Capsule Dock - Always Clean Icons, Search Box Appears at TOP of screen */}
      <div className="pointer-events-auto flex-1 bg-white/55 backdrop-blur-xl rounded-full border border-white/50 shadow-[0_12px_36px_rgba(15,23,42,0.1),0_2px_8px_rgba(15,23,42,0.03)] px-3.5 py-2 h-[68px] flex items-center justify-between transition-all mr-3">
        <div className="flex items-center justify-around w-full h-full">
          {/* 1. Home Button */}
          <button
            type="button"
            onClick={() => handleSwitchTab('home')}
            className={`flex items-center justify-center cursor-pointer active:scale-95 py-2.5 px-3 rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              activeTab === 'home'
                ? 'text-slate-950 font-extrabold bg-slate-900/5'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            id="mobile-dock-home-btn"
            aria-label="Home Menu"
          >
            <Home
              className={`w-5 h-5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 ${
                activeTab === 'home' ? 'fill-slate-950 text-slate-950 scale-105' : 'text-slate-600'
              }`}
            />
            <div
              className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center ${
                activeTab === 'home' ? 'max-w-[70px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
              }`}
            >
              <span className="font-heading tracking-tight text-sm font-extrabold whitespace-nowrap text-slate-950">
                Home
              </span>
            </div>
          </button>

          {/* 2. Search Toggle Button - Triggers Top Header Search Bar */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              handleSwitchTab('home');
              onOpenSearch?.();
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 relative ${
              searchQuery.trim()
                ? 'bg-slate-900/5 text-slate-900'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
            id="mobile-dock-search-btn"
            aria-label="Search Menu"
          >
            <Search className="w-5.5 h-5.5 text-slate-600" />
            {searchQuery.trim() && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
            )}
          </button>

          {/* 3. Order Button (Custom Receipt/Bill Icon + Label 'Order' with Symmetrical Smooth Animation) */}
          <button
            type="button"
            onClick={() => handleSwitchTab('track')}
            className={`flex items-center justify-center cursor-pointer active:scale-95 py-2.5 px-3 rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              activeTab === 'track'
                ? 'text-slate-950 font-extrabold bg-slate-900/5'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            id="mobile-dock-track-btn"
            aria-label="Orders"
          >
            <ReceiptText
              className={`w-5 h-5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 ${
                activeTab === 'track' ? 'text-slate-950 stroke-[2.4] scale-105' : 'text-slate-600'
              }`}
            />
            <div
              className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center ${
                activeTab === 'track' ? 'max-w-[70px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
              }`}
            >
              <span className="font-heading tracking-tight text-sm font-extrabold whitespace-nowrap text-slate-950">
                Order
              </span>
            </div>
          </button>

          {/* 4. Call Customer Support Button */}
          <button
            type="button"
            onClick={handleCallSupport}
            className="w-11 h-11 rounded-full flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/70 transition-all cursor-pointer active:scale-95"
            id="mobile-dock-call-btn"
            title={`Call Customer Support (${settings?.contactPhone || 'Available'})`}
            aria-label="Call Customer Support"
          >
            <Phone className="w-5.5 h-5.5" />
          </button>
        </div>
      </div>

      {/* Dedicated Floating Circular Cart Button - Matching 68px Dimension & Higher Transparency (bg-white/55) */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic('medium');
          setIsCartOpen(true);
        }}
        className="pointer-events-auto w-[68px] h-[68px] rounded-full bg-white/55 backdrop-blur-xl border border-white/50 shadow-[0_12px_36px_rgba(15,23,42,0.1),0_2px_8px_rgba(15,23,42,0.03)] flex items-center justify-center relative cursor-pointer active:scale-95 transition-all text-slate-800 hover:bg-white/80 shrink-0"
        id="mobile-dock-cart-btn"
        aria-label={`View Cart (${totalItems} items)`}
      >
        <ShoppingCart className="w-6 h-6 text-slate-800 stroke-[2.2]" />
        {totalItems > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-black min-w-6 h-6 px-1.5 rounded-full flex items-center justify-center shadow-md leading-none font-mono animate-in zoom-in-75 duration-200">
            {totalItems}
          </span>
        )}
      </button>
    </nav>
  );
};
