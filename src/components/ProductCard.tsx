import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, Minus, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product, ProductVariant } from '../types';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';

interface ProductCardProps {
  product: Product;
  onOpenDetail: (product: Product) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
  priority?: boolean;
}

const ProductCardComponent: React.FC<ProductCardProps> = ({
  product,
  onOpenDetail,
  isFavorite = false,
  onToggleFavorite,
  priority = false,
}) => {
  const { addToCart, updateQuantity, getItemQuantity } = useCart();
  const { settings } = useLocation();
  const isSquare = settings?.homeCardShape === 'square';
  const [localFavorite, setLocalFavorite] = useState(false);

  // Multi-image list: Extract clean photos from product.images, imageUrl, variants, or colorVariants
  const isVegSalad = (url?: string) => !url || url.includes('photo-1546069901-ba9599a7e63c');

  // Normalize image URLs so primary cover (.webp) and its generated copies (-img0.webp / -var0.webp) never duplicate
  const getCanonicalImageKey = (url: string): string => {
    const trimmed = url.trim();
    if (trimmed.startsWith('/product-images/')) {
      return trimmed
        .replace(/-(?:img0|var0)(\.[a-zA-Z0-9]+)(\?.*)?$/i, '$1$2')
        .split('?')[0];
    }
    return trimmed.split('#')[0];
  };

  const isSeparatedVariant = Boolean(product.realProductId && (product.defaultVariantIndex !== undefined || product.selectedColorName !== undefined));
  const isSeparateViewOn = isSeparatedVariant || Boolean(product.showVariantsSeparately);

  const rawImages: string[] = useMemo(() => {
    // If separate toggle is on for this card on the home screen:
    // show ONLY the photo uploaded for this item and do NOT scroll on the home screen!
    if (isSeparateViewOn) {
      if (product.imageUrl && !isVegSalad(product.imageUrl)) {
        return [product.imageUrl];
      }
      if (product.images && product.images.length > 0 && !isVegSalad(product.images[0])) {
        return [product.images[0]];
      }
      return [];
    }

    const list: string[] = [];
    const seenKeys = new Set<string>();

    const pushUnique = (url?: string) => {
      if (!url || isVegSalad(url)) return;
      const trimmed = url.trim();
      if (!trimmed) return;
      const key = getCanonicalImageKey(trimmed);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        list.push(trimmed);
      }
    };

    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        pushUnique(img);
      }
    }
    // Only fallback to product.imageUrl if product.images had no valid photos
    if (list.length === 0 && product.imageUrl) {
      pushUnique(product.imageUrl);
    }
    if (product.variants && product.variants.length > 0) {
      for (const v of product.variants) {
        pushUnique(v.imageUrl);
      }
    }
    if (product.colorVariants && product.colorVariants.length > 0) {
      for (const c of product.colorVariants) {
        pushUnique(c.imageUrl);
      }
    }
    return list;
  }, [product.imageUrl, product.images, product.variants, product.colorVariants, isSeparateViewOn]);

  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const manualPauseTimerRef = useRef<number | null>(null);
  const [isManualPaused, setIsManualPaused] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [product.id, currentImgIdx]);

  // Handle manual pause after user click/swipe
  const pauseAutoAdvanceTemporarily = useCallback(() => {
    setIsManualPaused(true);
    if (manualPauseTimerRef.current) {
      window.clearTimeout(manualPauseTimerRef.current);
    }
    // Resume auto-rotation after 6 seconds of no manual interaction
    manualPauseTimerRef.current = window.setTimeout(() => {
      setIsManualPaused(false);
    }, 6000);
  }, []);

  // Auto-scroll images smoothly on desktop hover (only when product has multiple unique images)
  useEffect(() => {
    if (rawImages.length <= 1 || isManualPaused || !isHovered) return;

    const timer = setInterval(() => {
      setCurrentImgIdx((prev) => (prev + 1) % rawImages.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [rawImages.length, isHovered, isManualPaused]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (manualPauseTimerRef.current) {
        window.clearTimeout(manualPauseTimerRef.current);
      }
    };
  }, []);

  // Manual Navigation Helpers
  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    pauseAutoAdvanceTemporarily();
    setCurrentImgIdx((prev) => (prev - 1 + rawImages.length) % rawImages.length);
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    pauseAutoAdvanceTemporarily();
    setCurrentImgIdx((prev) => (prev + 1) % rawImages.length);
  };

  const handleDotClick = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    pauseAutoAdvanceTemporarily();
    setCurrentImgIdx(idx);
  };

  // Touch Swipe Handlers for Mobile (only active when rawImages.length > 1 and strictly horizontal)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (rawImages.length <= 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (rawImages.length <= 1 || touchStartXRef.current === null || touchStartYRef.current === null) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartXRef.current - touchEndX;
    const diffY = touchStartYRef.current - touchEndY;

    // Only trigger horizontal image swipe if horizontal movement clearly dominates vertical scroll
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      pauseAutoAdvanceTemporarily();
      if (diffX > 0) {
        setCurrentImgIdx((prev) => (prev + 1) % rawImages.length);
      } else {
        setCurrentImgIdx((prev) => (prev - 1 + rawImages.length) % rawImages.length);
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const effectiveFavorite = onToggleFavorite ? isFavorite : localFavorite;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(product.id);
    } else {
      setLocalFavorite(!localFavorite);
    }
  };

  const separatedVariant: ProductVariant | undefined = isSeparatedVariant && product.variants
    ? (product.variants[0] || (product.defaultVariantIndex !== undefined ? product.variants[product.defaultVariantIndex] : undefined))
    : undefined;

  const hasVariants = !isSeparatedVariant && Boolean(product.variants && product.variants.length > 0);
  const hasColorVariants = !isSeparatedVariant && Boolean(product.colorVariants && product.colorVariants.length > 0);
  const hasOptions = hasVariants || hasColorVariants;
  const totalCartQty = getItemQuantity(product.id);

  const activeVariant: ProductVariant | undefined = isSeparatedVariant
    ? separatedVariant
    : hasVariants
    ? product.variants![0]
    : undefined;

  const cartItemId = `${product.id}-${activeVariant?.name || 'default'}`;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('select') ||
      target.closest('[data-fav-btn]') ||
      target.closest('[data-img-nav]')
    ) {
      return;
    }
    onOpenDetail(product);
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasOptions) {
      onOpenDetail(product);
    } else {
      addToCart(product, 1, activeVariant);
    }
  };

  const displayPrice = isSeparatedVariant
    ? (separatedVariant?.price ?? product.price)
    : hasVariants
    ? Math.min(...product.variants!.map((v) => v.price))
    : hasColorVariants
    ? Math.min(...product.colorVariants!.map((c) => c.price))
    : product.price;

  const isStockZero = typeof product.stockQuantity === 'number' && product.stockQuantity <= 0;
  const isAvailable = !isStockZero && (isSeparatedVariant
    ? product.available !== false && (separatedVariant ? separatedVariant.available !== false : true)
    : hasVariants
    ? product.available !== false && !product.variants!.every((v) => v.available === false)
    : product.available !== false);

  const getImageFitClass = (imgSrc: string, idx: number) => {
    // 1. Check if separated variant has an explicit fit
    if (isSeparatedVariant && separatedVariant?.imageFit) {
      return separatedVariant.imageFit === 'contain' ? 'object-contain p-2 bg-white' : 'object-cover bg-white';
    }

    // 2. Check if this specific photo has an individual fit configured in imageFits
    const specificFit =
      product.imageFits?.[String(idx)] ||
      (product.images && product.images.indexOf(imgSrc) !== -1 && product.imageFits?.[String(product.images.indexOf(imgSrc))]) ||
      (product.imageFits as any)?.[imgSrc];

    if (specificFit) {
      return specificFit === 'contain' ? 'object-contain p-2 bg-white' : 'object-cover bg-white';
    }

    // 3. Check if active variant has an image and dedicated fit
    if (activeVariant?.imageUrl === imgSrc && activeVariant.imageFit) {
      return activeVariant.imageFit === 'contain' ? 'object-contain p-2 bg-white' : 'object-cover bg-white';
    }

    // 4. Fallback to product-level imageFit
    return product.imageFit === 'contain' ? 'object-contain p-2 bg-white' : 'object-cover bg-white';
  };

  const hasMultipleImages = rawImages.length > 1;

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={hasMultipleImages ? () => setIsHovered(true) : undefined}
      onMouseLeave={hasMultipleImages ? () => setIsHovered(false) : undefined}
      className={`product-card-container group bg-white p-2.5 sm:p-3.5 transition-shadow duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden select-none active:scale-[0.99] ${
        isSquare
          ? 'rounded-none border-0 outline-none shadow-[0_6px_18px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.05)] hover:shadow-[0_12px_28px_-3px_rgba(15,23,42,0.13),0_4px_10px_-2px_rgba(15,23,42,0.06)]'
          : 'rounded-2xl sm:rounded-3xl border border-slate-100/90 shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] hover:border-slate-200/90'
      }`}
      id={`product-card-${product.id}`}
    >
      <div>
        {/* Food Image Container with Native Lazy Loading & Smooth Manual Controls */}
        <div
          onTouchStart={hasMultipleImages ? handleTouchStart : undefined}
          onTouchEnd={hasMultipleImages ? handleTouchEnd : undefined}
          className="relative w-full aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden bg-white mb-2.5 select-none"
        >
          {rawImages.length > 0 && !imgError ? (
            <img
              src={rawImages[currentImgIdx] || rawImages[0]}
              alt={product.name}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding={priority ? 'sync' : 'async'}
              onError={() => {
                if (rawImages.length > 1 && currentImgIdx < rawImages.length - 1) {
                  setCurrentImgIdx((prev) => prev + 1);
                } else {
                  setImgError(true);
                }
              }}
              className={`absolute inset-0 w-full h-full ${getImageFitClass(
                rawImages[currentImgIdx] || rawImages[0],
                currentImgIdx
              )} z-0 select-none`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200/80 p-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-2xs border border-slate-200/80 flex items-center justify-center text-slate-400 mb-1.5">
                <span className="font-heading font-extrabold text-base text-slate-700 uppercase">
                  {product.name.slice(0, 2)}
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {product.category || 'Special'}
              </span>
            </div>
          )}

          {/* Manual Prev / Next Arrow Controls for Multiple Photos */}
          {rawImages.length > 1 && (
            <>
              {/* Previous Image Arrow */}
              <button
                type="button"
                data-img-nav="true"
                onClick={handlePrevImage}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6.5 h-6.5 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-950 border border-slate-200/80 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 z-10 cursor-pointer active:scale-90"
                aria-label="Previous photo"
                title="Previous photo"
              >
                <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>

              {/* Next Image Arrow */}
              <button
                type="button"
                data-img-nav="true"
                onClick={handleNextImage}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6.5 h-6.5 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-950 border border-slate-200/80 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 z-10 cursor-pointer active:scale-90"
                aria-label="Next photo"
                title="Next photo"
              >
                <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>

              {/* Interactive Multiple Images Indicator Dots (clean, light translucent, capsule-free) */}
              <div
                data-img-nav="true"
                className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10"
              >
                {rawImages.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => handleDotClick(e, idx)}
                    className={`transition-all duration-150 rounded-full cursor-pointer focus:outline-none ${
                      idx === currentImgIdx
                        ? 'w-3.5 h-1 bg-white/90 shadow-[0_1px_3px_rgba(0,0,0,0.35)]'
                        : 'w-1.5 h-1 bg-white/40 hover:bg-white/70 shadow-[0_1px_2px_rgba(0,0,0,0.2)]'
                    }`}
                    aria-label={`Show photo ${idx + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Pure Veg / Non-Veg Badge (strictly hidden for non-food items) */}
          {!product.isNonFood && (
            product.isVegetarian !== false ? (
              <div className="absolute top-2 left-2 w-3.5 h-3.5 bg-white rounded-xs border border-emerald-600 flex items-center justify-center p-0.5 shadow-2xs z-10" title="Pure Veg">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              </div>
            ) : (
              <div className="absolute top-2 left-2 w-3.5 h-3.5 bg-white rounded-xs border border-rose-600 flex items-center justify-center p-0.5 shadow-2xs z-10" title="Non-Veg">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              </div>
            )
          )}

          {/* Favorite Toggle Button (Zero GPU backdrop-blur overhead for 120fps scrolling) */}
          <button
            data-fav-btn="true"
            onClick={handleFavoriteClick}
            className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform z-10 cursor-pointer ${
              effectiveFavorite
                ? 'bg-rose-50/90 text-rose-500 border border-rose-200/80 shadow-2xs'
                : 'bg-white/85 hover:bg-white text-slate-700 hover:text-rose-500 border border-slate-200/70 shadow-2xs'
            }`}
            aria-label="Save as favorite"
            id={`fav-btn-${product.id}`}
          >
            <Heart
              className={`w-3.5 h-3.5 transition-colors ${
                effectiveFavorite ? 'fill-rose-500 text-rose-500' : 'stroke-[2.2]'
              }`}
            />
          </button>

          {/* Sold Out Overlay */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-slate-950/25 flex items-center justify-center z-20 pointer-events-none">
              <span className="bg-slate-900/80 border border-white/35 text-white font-heading font-black text-[10.5px] sm:text-[11px] px-3.5 py-1 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.18)] uppercase tracking-wider select-none">
                Sold Out
              </span>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="space-y-1">
          <h3 className="font-heading font-bold text-[13px] text-slate-900 tracking-tight line-clamp-1 group-hover:text-slate-700 transition-colors leading-tight capitalize">
            {product.name}
          </h3>

          <div className="flex flex-col gap-1.5 pt-0.5">
            <span className="font-heading text-[11px] text-slate-500 font-semibold tracking-tight truncate leading-none">
              {product.category}
            </span>

            {/* Color Swatch Dots on Card (Flipkart/Amazon style) */}
            {product.colorVariants && product.colorVariants.length > 0 ? (
              <div className="flex items-center gap-1.5 pt-0.5">
                <div className="flex items-center -space-x-1">
                  {product.colorVariants.slice(0, 5).map((cv, idx) => (
                    <span
                      key={idx}
                      className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs shrink-0"
                      style={{ backgroundColor: cv.colorCode || '#94A3B8' }}
                      title={cv.name}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  {product.colorVariants.length} Colors
                </span>
              </div>
            ) : (!isSeparatedVariant && product.selectedColorName) ? (
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 w-fit">
                {product.selectedColorCode && (
                  <span
                    className="w-2 h-2 rounded-full border border-white"
                    style={{ backgroundColor: product.selectedColorCode }}
                  />
                )}
                <span>{product.selectedColorName}</span>
              </div>
            ) : null}
            {hasVariants ? (
              <div className="w-full relative pt-0.5">
                <div className="flex flex-nowrap items-center gap-1.5 w-full overflow-hidden">
                  {product.variants!.map((v, idx) => (
                    <div
                      key={idx}
                      className={`inline-flex shrink-0 items-center justify-center px-1.5 py-[3px] rounded text-[9px] font-heading font-bold tracking-tight whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${
                        v.available === false
                          ? 'bg-rose-50/70 border border-rose-200/70 text-rose-500 line-through'
                          : 'bg-slate-50 border border-slate-200/80 text-slate-600'
                      }`}
                      title={v.available === false ? `${v.name} (Out of stock)` : v.name}
                    >
                      {v.name}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom Pricing & Sleek Action Button */}
      <div className="pt-2.5 mt-2 flex items-center justify-between border-t border-slate-100/80">
        <div className="flex items-baseline gap-0.5">
          <span className="text-xs font-semibold text-slate-400 select-none">₹</span>
          <span className="font-heading font-extrabold text-base sm:text-lg text-slate-900 tracking-tight leading-none">
            {displayPrice}
          </span>
        </div>

        {/* Action Button: ADD Capsule Button, Multi-size Customized Button, or Stepper */}
        <div>
          {!isAvailable ? (
            <span className="h-[30px] sm:h-[34px] px-3.5 rounded-full bg-stone-100/90 border border-stone-200/80 text-rose-500/80 font-heading font-black text-[11px] sm:text-xs flex items-center justify-center select-none shadow-2xs tracking-wide uppercase">
              Sold Out
            </span>
          ) : hasVariants ? (
            totalCartQty > 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail(product);
                }}
                className="h-[30px] sm:h-[34px] pl-1.5 pr-3 sm:pl-2 sm:pr-3.5 bg-white hover:bg-stone-50 active:bg-stone-100 active:scale-95 text-stone-900 border border-black/[0.04] rounded-full flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_3px_10px_rgba(0,0,0,0.12)] transition-all focus:outline-none cursor-pointer"
                id={`customized-btn-${product.id}`}
                aria-label="Edit sizes in cart"
              >
                <span className="w-[18px] h-[18px] rounded-full bg-stone-900 text-white text-[10px] font-black flex items-center justify-center leading-none shrink-0">
                  {totalCartQty}
                </span>
                <span className="font-heading font-black text-[11px] sm:text-xs text-stone-900 tracking-wide uppercase">
                  ADDED
                </span>
              </button>
            ) : (
              <button
                onClick={handleAddClick}
                className="px-4 py-1.5 sm:px-4.5 sm:py-2 rounded-full bg-white hover:bg-stone-50 active:bg-stone-100 active:scale-95 text-stone-900 border border-black/[0.04] font-heading font-black text-xs sm:text-xs tracking-wider uppercase shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_3px_10px_rgba(0,0,0,0.12)] transition-all focus:outline-none flex items-center justify-center min-w-[62px] cursor-pointer"
                id={`add-btn-${product.id}`}
                aria-label="Add to cart"
              >
                ADD
              </button>
            )
          ) : totalCartQty > 0 ? (
            <div className="h-[30px] sm:h-[34px] px-1 bg-white text-stone-900 rounded-full flex items-center justify-between gap-1 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-black/[0.04] min-w-[78px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateQuantity(cartItemId, totalCartQty - 1);
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-stone-600 hover:text-stone-950 hover:bg-stone-100 active:scale-85 transition-colors focus:outline-none cursor-pointer"
                id={`decrease-btn-${cartItemId}`}
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>

              <span className="font-heading font-black text-xs sm:text-sm min-w-[18px] text-center text-stone-950 select-none">
                {totalCartQty}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToCart(product, 1, activeVariant);
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-stone-600 hover:text-stone-950 hover:bg-stone-100 active:scale-85 transition-colors focus:outline-none cursor-pointer"
                id={`increase-btn-${cartItemId}`}
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddClick}
              className="px-4 py-1.5 sm:px-4.5 sm:py-2 rounded-full bg-white hover:bg-stone-50 active:bg-stone-100 active:scale-95 text-stone-900 border border-black/[0.04] font-heading font-black text-xs sm:text-xs tracking-wider uppercase shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_3px_10px_rgba(0,0,0,0.12)] transition-all focus:outline-none flex items-center justify-center min-w-[62px] cursor-pointer"
              id={`add-btn-${product.id}`}
              aria-label="Add to cart"
            >
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ProductCard = React.memo(ProductCardComponent);
