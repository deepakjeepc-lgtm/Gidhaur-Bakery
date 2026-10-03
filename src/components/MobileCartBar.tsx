import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { triggerHaptic } from '../utils/haptics';

export const MobileCartBar: React.FC = () => {
  const { totalItems, totalAmount, setIsCartOpen, isCartOpen } = useCart();
  const [isVisible, setIsVisible] = useState(true);

  const isVisibleRef = useRef(true);
  const lastScrollYRef = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);
  const rAFRef = useRef<number | null>(null);

  // Buttery-smooth scroll hide/show with requestAnimationFrame and overscroll protection
  useEffect(() => {
    lastScrollYRef.current = typeof window !== 'undefined' ? (window.scrollY || window.pageYOffset || 0) : 0;

    const onScroll = () => {
      if (rAFRef.current !== null) return;

      rAFRef.current = window.requestAnimationFrame(() => {
        rAFRef.current = null;
        const currentScrollY = window.scrollY || window.pageYOffset || 0;
        const delta = Math.abs(currentScrollY - lastScrollYRef.current);
        lastScrollYRef.current = currentScrollY;

        // Check if near bottom of document (protects against bottom overscroll flicker)
        const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
        const isNearBottom = window.innerHeight + currentScrollY >= scrollHeight - 70;

        if (isNearBottom) {
          if (!isVisibleRef.current) {
            isVisibleRef.current = true;
            setIsVisible(true);
          }
          return;
        }

        // Only hide during deliberate fast vertical scroll movements (delta > 8px)
        if (delta > 8 && isVisibleRef.current) {
          isVisibleRef.current = false;
          setIsVisible(false);
        }

        // Reappear smoothly as soon as scrolling pauses/stops (180ms debounce)
        if (scrollTimeoutRef.current) {
          window.clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = window.setTimeout(() => {
          if (!isVisibleRef.current) {
            isVisibleRef.current = true;
            setIsVisible(true);
          }
        }, 180);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
      if (rAFRef.current) window.cancelAnimationFrame(rAFRef.current);
    };
  }, []);

  if (totalItems === 0) return null;

  const handleOpenCart = () => {
    triggerHaptic('medium');
    setIsCartOpen(true);
  };

  return (
    <div
      className={`fixed bottom-[max(env(safe-area-inset-bottom,1rem),1.25rem)] left-0 right-0 z-40 sm:hidden flex justify-center px-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible && !isCartOpen
          ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
          : 'translate-y-16 opacity-0 scale-90 pointer-events-none'
      }`}
    >
      {/* Plush, Thicker Light Capsule Bar */}
      <div
        onClick={handleOpenCart}
        className="w-full max-w-[310px] bg-white text-slate-900 rounded-full px-4 py-3 sm:py-3.5 shadow-[0_14px_34px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/90 flex items-center justify-between active:scale-[0.97] transition-all cursor-pointer select-none group"
        id="mobile-capsule-cart-bar"
      >
        {/* Left Side: Larger Shopping Bag Icon + "My Cart" & Items Count */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0 shadow-2xs group-hover:bg-slate-200/70 transition-colors">
            <ShoppingBag className="w-5 h-5 stroke-[1.8]" />
          </div>

          <div className="text-left min-w-0">
            <h3 className="font-heading font-extrabold text-sm text-slate-900 tracking-tight leading-tight">
              My Cart
            </h3>
            <p className="text-xs font-semibold text-slate-500 leading-none mt-0.5">
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>

        {/* Right Side: Product Card-Style Rupee Price + Chevron Button */}
        <div className="flex items-center gap-2.5 pl-2 shrink-0">
          <div className="flex items-baseline gap-0.5 select-none">
            <span className="text-xs sm:text-sm font-semibold text-slate-400 select-none">
              ₹
            </span>
            <span className="font-heading font-extrabold text-base sm:text-lg text-slate-950 tracking-tight leading-none">
              {totalAmount}
            </span>
          </div>

          <div className="w-8.5 h-8.5 rounded-full bg-slate-950 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:bg-slate-800 transition-colors">
            <ChevronRight className="w-4.5 h-4.5 stroke-[2.5]" />
          </div>
        </div>
      </div>
    </div>
  );
};
