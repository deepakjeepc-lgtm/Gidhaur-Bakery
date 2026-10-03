import React from 'react';
import { ShoppingBag, Search, Package, X, Shield } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import { triggerHaptic } from '../utils/haptics';

interface NavbarProps {
  currentView: 'home' | 'track' | 'admin';
  setCurrentView: (view: 'home' | 'track' | 'admin') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const NavbarComponent: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  searchQuery,
  setSearchQuery,
}) => {
  const { totalItems, setIsCartOpen } = useCart();
  const { settings } = useLocation();

  return (
    <div className="w-full box-border">
      {/* Mobile Top Header: Clean, Unboxed & Direct matching screenshot */}
      <div className="flex sm:hidden items-center justify-between w-full px-3 pt-1.5 pb-1 select-none">
        {/* Brand Logo on Mobile */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex focus:outline-none shrink-0 group text-left items-center gap-2 active:scale-95 transition-transform cursor-pointer"
          id="gidhaur-mobile-logo-btn"
        >
          {settings?.headerLogoUrl ? (
            <div
              className="flex items-center justify-start overflow-hidden rounded-lg"
              style={{ height: `${settings.headerLogoHeight || 40}px` }}
            >
              <img
                src={settings.headerLogoUrl}
                alt={settings.restaurantName || 'Gidhaur Bakery'}
                className={`h-full w-auto max-w-[200px] transition-all ${
                  settings.headerLogoFit === 'cover' ? 'object-cover' : 'object-contain'
                }`}
                style={{ height: `${settings.headerLogoHeight || 40}px` }}
              />
            </div>
          ) : (
            <span className="font-heading font-extrabold text-2xl text-slate-900 tracking-tight block leading-none select-none">
              {settings?.restaurantName ? (
                settings.restaurantName
              ) : (
                <>Gidhaur <span className="text-amber-600">Bakery</span></>
              )}
            </span>
          )}
        </button>

        {/* Right: Live Open/Closed badge & Admin Shield button */}
        <div className="flex items-center gap-2.5">
          <span
            className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs ${
              settings?.isStoreOpen !== false
                ? 'bg-[#dcfce7] text-[#15803d] border border-[#86efac]/70'
                : 'bg-rose-100 text-rose-800 border border-rose-300/70'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                settings?.isStoreOpen !== false ? 'bg-[#16a34a]' : 'bg-rose-500'
              }`}
            />
            {settings?.isStoreOpen !== false ? 'Open' : 'Closed'}
          </span>

          <button
            onClick={() => {
              triggerHaptic('selection');
              setCurrentView('admin');
            }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer border border-slate-200/90 shadow-2xs active:scale-95 ${
              currentView === 'admin'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            id="mobile-header-admin-btn"
            title="Open Admin Portal"
            aria-label="Admin Portal"
          >
            <Shield className="w-4.5 h-4.5 stroke-[1.8]" />
          </button>
        </div>
      </div>

      {/* Desktop Clean Direct Navbar - Removed Redundant Middle Capsule Layer */}
      <div className="hidden sm:flex w-full items-center justify-between gap-4 min-w-0 py-1 transition-all">
        {/* Brand Logo - Desktop */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            setCurrentView('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex focus:outline-none shrink-0 group text-left items-center gap-2.5 active:scale-95 transition-transform cursor-pointer"
          id="gidhaur-desktop-logo-btn"
        >
          {settings?.headerLogoUrl ? (
            <div
              className="flex items-center justify-start overflow-hidden rounded-lg"
              style={{ height: `${settings.headerLogoHeight || 36}px` }}
            >
              <img
                src={settings.headerLogoUrl}
                alt={settings.restaurantName || 'Gidhaur Bakery'}
                className={`h-full w-auto max-w-[240px] transition-all ${
                  settings.headerLogoFit === 'cover' ? 'object-cover' : 'object-contain'
                }`}
                style={{ height: `${settings.headerLogoHeight || 36}px` }}
              />
            </div>
          ) : (
            <span className="font-heading font-extrabold text-2xl text-slate-900 tracking-tight block leading-none select-none">
              {settings?.restaurantName ? (
                settings.restaurantName
              ) : (
                <>Gidhaur <span className="text-amber-600">Bakery</span></>
              )}
            </span>
          )}
        </button>

        {/* Desktop Search Input with Real-time Filtering */}
        {currentView === 'home' && (
          <div className="flex items-center relative max-w-sm flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search sweets, savory & fresh dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50/80 hover:bg-slate-100/70 border border-slate-200/80 rounded-full text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 transition-all font-medium"
              id="desktop-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSearchQuery('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 w-4 h-4 flex items-center justify-center rounded-full bg-slate-200 cursor-pointer transition-colors"
                aria-label="Clear query"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Desktop Navigation Links */}
        <nav className="flex items-center gap-2">
          <button
            onClick={() => {
              triggerHaptic('selection');
              setCurrentView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentView === 'home'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            id="nav-home-btn"
          >
            Menu
          </button>

          <button
            onClick={() => {
              triggerHaptic('selection');
              setCurrentView('track');
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentView === 'track'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            id="nav-track-btn"
          >
            <Package className="w-3.5 h-3.5" />
            <span>My Orders</span>
          </button>

          {/* Discreet Admin Portal Button in Nav */}
          <button
            onClick={() => {
              triggerHaptic('selection');
              setCurrentView('admin');
            }}
            className={`px-3 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentView === 'admin'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            id="nav-admin-btn"
            title="Open Admin & Staff Panel"
          >
            Admin
          </button>

          {/* Cart Icon in Nav */}
          <button
            onClick={() => {
              triggerHaptic('selection');
              setIsCartOpen(true);
            }}
            className="flex items-center gap-2 ml-1 px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer"
            id="header-cart-btn"
          >
            <ShoppingBag className="w-4 h-4 text-slate-800" />
            <span>Cart</span>
            {totalItems > 0 && (
              <span className="bg-slate-900 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full font-mono">
                {totalItems}
              </span>
            )}
          </button>
        </nav>
      </div>
    </div>
  );
};

export const Navbar = React.memo(NavbarComponent);
