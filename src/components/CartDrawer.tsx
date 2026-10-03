import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  X,
  Plus,
  Minus,
  ShoppingBag,
  Trash2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Receipt,
  UtensilsCrossed,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { CartItem } from '../types';
import { triggerHaptic } from '../utils/haptics';
import { lockBodyScroll, unlockBodyScroll } from '../utils/scrollLock';

interface CartDrawerProps {
  onProceedToCheckout?: () => void;
  onCheckout?: () => void;
}

interface CartItemRowProps {
  item: CartItem;
  onIncrease: (item: CartItem) => void;
  onDecrease: (item: CartItem) => void;
  onRequestRemove: (item: CartItem) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  onIncrease,
  onDecrease,
  onRequestRemove,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const leftRevealRef = useRef<HTMLDivElement>(null);
  const rightRevealRef = useRef<HTMLDivElement>(null);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);

  const unitPrice = item.selectedVariant ? item.selectedVariant.price : item.product.price;
  const itemTotal = unitPrice * item.quantity;
  const isContain = item.selectedVariant?.imageFit === 'contain' || item.product.imageFit === 'contain';

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    currentXRef.current = 0;
    isHorizontalRef.current = null;

    if (cardRef.current) {
      cardRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - startXRef.current;
    const deltaY = e.touches[0].clientY - startYRef.current;

    if (isHorizontalRef.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        isHorizontalRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (isHorizontalRef.current && cardRef.current) {
      // Smooth resistance clamping up to -125px (left) and +115px (right) for full visibility
      const clamped = Math.max(-125, Math.min(115, deltaX * 0.95));
      currentXRef.current = clamped;
      cardRef.current.style.transform = `translate3d(${clamped}px, 0, 0)`;

      // Direct opacity toggle on reveal badges with zero React re-render lag
      if (leftRevealRef.current) {
        leftRevealRef.current.style.opacity = clamped > 15 ? '1' : '0';
        leftRevealRef.current.style.transform = `scale(${clamped > 15 ? 1 : 0.85})`;
      }
      if (rightRevealRef.current) {
        rightRevealRef.current.style.opacity = clamped < -15 ? '1' : '0';
        rightRevealRef.current.style.transform = `scale(${clamped < -15 ? 1 : 0.85})`;
      }
    }
  };

  const handleTouchEnd = () => {
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)';
      cardRef.current.style.transform = 'translate3d(0, 0, 0)';
    }

    if (leftRevealRef.current) {
      leftRevealRef.current.style.opacity = '0';
    }
    if (rightRevealRef.current) {
      rightRevealRef.current.style.opacity = '0';
    }

    if (isHorizontalRef.current) {
      const finalX = currentXRef.current;
      if (finalX < -38) {
        // Swiped Left: Decrease by 1 or request removal
        if (item.quantity > 1) {
          triggerHaptic('medium');
          onDecrease(item);
        } else {
          triggerHaptic('warning');
          onRequestRemove(item);
        }
      } else if (finalX > 38) {
        // Swiped Right: Increase by 1
        triggerHaptic('medium');
        onIncrease(item);
      }
    }

    currentXRef.current = 0;
    isHorizontalRef.current = null;
  };

  return (
    <div className="relative overflow-hidden bg-slate-50 select-none">
      {/* Background slide indicators - Inset by px-4/px-5 to prevent clipping at rounded corners */}
      <div className="absolute inset-0 flex items-center justify-between px-4 sm:px-5 pointer-events-none z-0">
        {/* Right slide reveal (Increase) */}
        <div
          ref={leftRevealRef}
          style={{ opacity: 0, transition: 'opacity 150ms ease, transform 150ms ease' }}
          className="flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1 rounded-full text-[11px] font-heading font-black shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Add 1</span>
        </div>

        {/* Left slide reveal (Decrease / Remove) */}
        <div
          ref={rightRevealRef}
          style={{ opacity: 0, transition: 'opacity 150ms ease, transform 150ms ease' }}
          className={`flex items-center gap-1 ${
            item.quantity === 1 ? 'bg-rose-600' : 'bg-amber-600'
          } text-white px-2.5 py-1 rounded-full text-[11px] font-heading font-black shadow-sm`}
        >
          {item.quantity === 1 ? (
            <>
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </>
          ) : (
            <>
              <Minus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Minus 1</span>
            </>
          )}
        </div>
      </div>

      {/* Foreground Swipeable Card - Direct GPU Hardware Accelerated Transform */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          willChange: 'transform',
        }}
        className="relative z-10 bg-white p-3 sm:p-3.5 flex items-center gap-3 sm:gap-3.5 hover:bg-slate-50/40 transition-colors"
      >
        {/* Dish Thumbnail: Blends 100% with white background (NO border, NO shadow) */}
        <div className="w-20 sm:w-22 aspect-[4/3] rounded-xl bg-transparent overflow-hidden shrink-0 relative">
          <img
            src={item.selectedVariant?.imageUrl || item.product.imageUrl}
            alt={item.product.name}
            className={`w-full h-full ${isContain ? 'object-contain p-0.5' : 'object-cover'}`}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Content Area: Strictly Single Line Title + Variant Tag on Top-Right */}
        <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
          {/* Top Row: Title (Strictly Single Line Truncate) + Variant Badge (Top-Right) */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading font-extrabold text-sm sm:text-base text-slate-950 tracking-tight leading-snug truncate min-w-0 flex-1 pr-1">
              {item.product.name}
            </h3>

            {/* Variant Label: Fixed at Top-Right */}
            {item.selectedVariant ? (
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 shrink-0 leading-none">
                {item.selectedVariant.name}
              </span>
            ) : null}
          </div>

          {/* Bottom Row: Total Item Price on Left, Stepper Quantity on Right */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-semibold text-slate-400 select-none">₹</span>
              <span className="font-heading font-black text-base sm:text-lg text-slate-950">
                {itemTotal}
              </span>
              {item.quantity > 1 && (
                <span className="text-[10px] text-slate-400 font-medium ml-1">
                  (₹{unitPrice} ea)
                </span>
              )}
            </div>

            {/* Stepper Quantity Capsule: Equal margin all around (p-1) */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-full border border-slate-200/70 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  if (item.quantity > 1) {
                    triggerHaptic('light');
                    onDecrease(item);
                  } else {
                    triggerHaptic('warning');
                    onRequestRemove(item);
                  }
                }}
                className="w-5.5 h-5.5 rounded-full bg-white text-slate-800 hover:bg-slate-200 active:scale-90 flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-2.5 h-2.5 stroke-[2.5]" />
              </button>
              <span className="font-heading font-black text-xs min-w-[14px] text-center text-slate-950 select-none px-0.5">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onIncrease(item);
                }}
                className="w-5.5 h-5.5 rounded-full bg-slate-950 text-white hover:bg-slate-800 active:scale-90 flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CartDrawer: React.FC<CartDrawerProps> = ({ onProceedToCheckout, onCheckout }) => {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    totalAmount,
    totalItems,
    clearCart,
  } = useCart();

  const [itemPendingRemoval, setItemPendingRemoval] = useState<CartItem | null>(null);

  // Prevent background home screen from scrolling while cart is open
  useEffect(() => {
    if (!isCartOpen) return;
    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isCartOpen]);

  // Support phone hardware / browser gesture back button
  useEffect(() => {
    if (!isCartOpen) return;
    if (window.history.state?.modal !== 'cart' && window.history.state?.modal !== 'checkout') {
      window.history.pushState({ modal: 'cart' }, '');
    }
  }, [isCartOpen]);

  // Handle escape key on desktop
  useEffect(() => {
    if (!isCartOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (itemPendingRemoval) {
          setItemPendingRemoval(null);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCartOpen, itemPendingRemoval]);

  const handleClose = useCallback(() => {
    triggerHaptic('light');
    if (window.history.state?.modal === 'cart') {
      window.history.back();
    } else {
      setIsCartOpen(false);
    }
  }, [setIsCartOpen]);

  const handleCheckoutClick = useCallback(() => {
    triggerHaptic('medium');
    if (onProceedToCheckout) {
      onProceedToCheckout();
    } else if (onCheckout) {
      onCheckout();
    }
  }, [onProceedToCheckout, onCheckout]);

  const handleIncrease = useCallback(
    (item: CartItem) => {
      updateQuantity(item.id, item.quantity + 1);
    },
    [updateQuantity]
  );

  const handleDecrease = useCallback(
    (item: CartItem) => {
      updateQuantity(item.id, item.quantity - 1);
    },
    [updateQuantity]
  );

  const handleRequestRemove = useCallback((item: CartItem) => {
    setItemPendingRemoval(item);
  }, []);

  if (!isCartOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col overflow-hidden select-none animate-in fade-in duration-200"
      id="cart-fullscreen-view"
    >
      {/* Full Screen Dedicated View on Mobile & Desktop - Zero popup lag, Zero backdrop stutter */}
      <div
        className="relative bg-[#f8fafc] w-full h-full max-w-2xl mx-auto flex flex-col overflow-hidden sm:border-x sm:border-slate-200/80 sm:shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: Proper Back Button on Left, Title in Center, Trash on Right */}
        <header className="px-4 py-3 sm:px-6 sm:py-4 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3">
            {/* Top Left Proper Circular Back Button */}
            <button
              type="button"
              onClick={handleClose}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-2xs"
              aria-label="Back to Menu"
              id="cart-back-btn"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div>
              <h2 className="font-heading font-black text-lg sm:text-xl text-slate-950 tracking-tight leading-none flex items-center gap-2">
                <span>My Order</span>
                {totalItems > 0 && (
                  <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                    {totalItems} {totalItems === 1 ? 'item' : 'items'}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Review items & delivery details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Clear Cart Button */}
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  clearCart();
                }}
                className="w-10 h-10 rounded-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200/80 flex items-center justify-center transition-colors cursor-pointer shadow-2xs active:scale-90"
                title="Clear all items"
                aria-label="Clear cart"
                id="cart-clear-btn"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            )}

            {/* Desktop Optional Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="hidden sm:flex w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 items-center justify-center transition-all hover:scale-105 active:scale-90 border border-slate-200/80 cursor-pointer shadow-2xs"
              aria-label="Close"
            >
              <X className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>
          </div>
        </header>

        {/* Free Delivery Promise Banner */}
        {items.length > 0 && (
          <div className="px-4 py-2.5 sm:px-6 bg-gradient-to-r from-emerald-50 to-teal-50/50 border-b border-emerald-100/80 flex items-center justify-between text-xs shrink-0">
            <span className="flex items-center gap-2 text-emerald-800 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>0–5 km Free Delivery Unlocked!</span>
            </span>
            <span className="text-[10px] font-black text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs uppercase tracking-wider">
              FREE
            </span>
          </div>
        )}

        {/* Scrollable Items List & Bill Breakdown */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 select-text pb-32 sm:pb-36">
          {items.length === 0 ? (
            /* Empty State */
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 text-slate-400">
              <div className="w-20 h-20 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center text-slate-400">
                <ShoppingBag className="w-10 h-10 stroke-[1.8]" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-xl text-slate-900 tracking-tight">
                  Your order is empty
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                  Explore fresh dishes and add your favorites to get started!
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="mt-2 px-6 py-3 bg-slate-950 hover:bg-slate-800 text-white text-xs font-heading font-extrabold rounded-full shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>Browse Menu</span>
              </button>
            </div>
          ) : (
            <>
              {/* Items Card Container */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden divide-y divide-slate-100">
                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onIncrease={handleIncrease}
                    onDecrease={handleDecrease}
                    onRequestRemove={handleRequestRemove}
                  />
                ))}
              </div>

              {/* Add More Items Button */}
              <button
                type="button"
                onClick={handleClose}
                className="w-full p-3.5 bg-white hover:bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex items-center justify-between text-xs font-heading font-bold text-slate-800 transition-colors shadow-2xs active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Add more delicious items from menu</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Bill Summary Card */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-heading font-bold text-slate-900 border-b border-slate-100 pb-2.5">
                  <Receipt className="w-4 h-4 text-slate-500" />
                  <span>Bill Summary</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Item Total ({totalItems} items)</span>
                    <span className="font-heading font-bold text-slate-900">₹{totalAmount}</span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span>Delivery Fee</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 font-bold px-1.5 py-0.2 rounded">
                        0-5 km
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 line-through text-[11px]">₹40</span>
                      <span className="font-heading font-black text-emerald-600">FREE</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span>Taxes & Restaurant Packaging</span>
                    <span className="font-heading font-medium text-slate-500">Included</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
                  <div>
                    <span className="font-heading font-extrabold text-sm text-slate-950 block">
                      To Pay
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Inclusive of all taxes
                    </span>
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-sm font-semibold text-slate-400 select-none">₹</span>
                    <span className="font-heading font-black text-2xl text-slate-950 tracking-tight">
                      {totalAmount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Safety & Guarantee Badge */}
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium pb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>100% Safe & Contactless Delivery Guaranteed</span>
              </div>
            </>
          )}
        </div>

        {/* Floating Action Footer: Unified Floating Glass Capsule Checkout Button */}
        {items.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none p-2.5 sm:p-3.5 pb-[max(env(safe-area-inset-bottom,0.75rem),1.15rem)] flex items-center justify-center">
            <button
              type="button"
              onClick={handleCheckoutClick}
              className="pointer-events-auto max-w-xl w-full h-16 px-6 sm:px-8 bg-white/35 hover:bg-white/55 active:scale-[0.98] backdrop-blur-xl rounded-full border border-white/50 shadow-[0_12px_36px_rgba(15,23,42,0.1),0_2px_8px_rgba(15,23,42,0.03)] flex items-center justify-between transition-all cursor-pointer group select-none"
              id="checkout-proceed-btn"
            >
              {/* Left: Just the amount */}
              <div className="flex items-baseline gap-1 font-heading font-black text-xl text-slate-950 tracking-tight">
                <span className="text-sm font-bold text-slate-600 select-none">₹</span>
                <span>{totalAmount}</span>
              </div>

              {/* Right: SVG + Checkout Now + Arrow */}
              <div className="flex items-center gap-2.5 font-heading font-black text-sm sm:text-base text-slate-950">
                <ShoppingBag className="w-5 h-5 stroke-[2.4] text-slate-950 group-hover:scale-105 transition-transform" />
                <span>Checkout Now</span>
                <ArrowRight className="w-4.5 h-4.5 stroke-[2.5] text-slate-950 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Remove Item Confirmation Modal */}
      {itemPendingRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-slate-200/90 text-center space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-2xs">
              <Trash2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="font-heading font-black text-base text-slate-950">
                Remove dish?
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Remove <span className="font-bold text-slate-800">"{itemPendingRemoval.product.name}"</span> from your order?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setItemPendingRemoval(null);
                }}
                className="w-full py-2.5 px-4 rounded-full border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  removeFromCart(itemPendingRemoval.id);
                  setItemPendingRemoval(null);
                }}
                className="w-full py-2.5 px-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
