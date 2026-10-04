import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, Minus, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product, ProductVariant } from '../types';
import { useCart } from '../context/CartContext';

interface ProductCardProps {
  product: Product;
  onOpenDetail: (product: Product) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
  isSelected?: boolean;
  onSelect?: (productId: string) => void;
  onHoverChange?: (productId: string | null) => void;
  priority?: boolean;
}

const ProductCardComponent: React.FC<ProductCardProps> = ({
  product,
  onOpenDetail,
  isFavorite = false,
  onToggleFavorite,
  isSelected = false,
  onSelect,
  onHoverChange,
  priority = false,
}) => {
  const { addToCart, updateQuantity, getItemQuantity } = useCart();
  const [localFavorite, setLocalFavorite] = useState(false);

  // Multi-image list: Extract clean photos from product.images, imageUrl, variants, or colorVariants
  const isVegSalad = (url?: string) => !url || url.includes('photo-1546069901-ba9599a7e63c');

  const isSeparatedVariant = Boolean(product.realProductId && (product.defaultVariantIndex !== undefined || product.selectedColorName !== undefined));
  const isSeparateViewOn = isSeparatedVariant || Boolean(product.showVariantsSeparately);

  const rawImages: string[] = useMemo(() => {
    // If separate toggle is on for this card on the home screen:
    // show ONLY the photo uploaded for this item and do NOT scroll on the home screen!
    if (isSeparateViewOn) {
      if (product.imageUrl && !isVegSalad(product.imageUrl)) {
        return [product.imageUrl];
      }
      if (product.images && product.images.length > 0) {
        return [product.images[0]];
      }
      return [];
    }

    const list: string[] = [];
    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        if (!isVegSalad(img) && !list.includes(img)) list.push(img);
      }
    }
    if (product.imageUrl && !isVegSalad(product.imageUrl) && !list.includes(product.imageUrl)) {
      list.push(product.imageUrl);
    }
    if (product.variants && product.variants.length > 0) {
      for (const v of product.variants) {
        if (v.imageUrl && !isVegSalad(v.imageUrl) && !list.includes(v.imageUrl)) {
          list.push(v.imageUrl);
        }
      }
    }
    if (product.colorVariants && product.colorVariants.length > 0) {
      for (const c of product.colorVariants) {
        if (c.imageUrl && !isVegSalad(c.imageUrl) && !list.includes(c.imageUrl)) {
          list.push(c.imageUrl);
        }
      }
    }
    return list;
  }, [product.imageUrl, product.images, product.variants, product.colorVariants, isSeparateViewOn]);

  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const manualPauseTimerRef = useRef<number | null>(null);
  const [isManualPaused, setIsManualPaused] = useState(false);

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

  // Auto-scroll images smoothly on desktop hover
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

  // Touch Swipe Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartXRef.current - touchEndX;

    if (Math.abs(diffX) > 35) {
      pauseAutoAdvanceTemporarily();
      if (diffX > 0) {
        // Swiped Left -> Next Image
        setCurrentImgIdx((prev) => (prev + 1) % rawImages.length);
      } else {
        // Swiped Right -> Prev Image
        setCurrentImgIdx((prev) => (prev - 1 + rawImages.length) % rawImages.length);
      }
    }
    touchStartXRef.current = null;
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

  const [selectedVariantIndex] = useState(0);
  const activeVariant: ProductVariant | undefined = isSeparatedVariant
    ? separatedVariant
    : hasVariants
    ? product.variants![selectedVariantIndex]
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
    onSelect?.(product.id);
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

  const isAvailable = isSeparatedVariant
    ? product.available !== false && (separatedVariant ? separatedVariant.available !== false : true)
    : hasVariants
    ? product.available !== false && !product.variants!.every((v) => v.available === false)
    : product.available !== false;

  const effectiveSelected = Boolean(isSelected || isHovered);

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

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => {
        setIsHovered(true);
        onHoverChange?.(product.id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHoverChange?.(null);
      }}
      className="product-card-container group bg-white border border-slate-100/90 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between relative overflow-hidden select-none shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] hover:border-slate-200/90 active:scale-[0.99]"
      id={`product-card-${product.id}`}
    >
      <div>
        {/* Food Image Container with Native Lazy Loading & Smooth Manual Controls */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative w-full aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden bg-white mb-2.5 select-none"
        >
          {rawImages.length > 0 ? (
            <img
              src={rawImages[currentImgIdx] || rawImages[0]}
              alt={product.name}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding={priority ? 'sync' : 'async'}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
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

          {/* Favorite Toggle Button with Translucent Glassy Blur Effect (no solid circle) */}
          <button
            data-fav-btn="true"
            onClick={handleFavoriteClick}
            className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md active:scale-90 transition-all z-10 cursor-pointer ${
              effectiveFavorite
                ? 'bg-rose-500/20 text-rose-500 border border-rose-300/40 shadow-none'
                : 'bg-white/25 hover:bg-white/45 text-slate-700 hover:text-rose-500 border border-white/40 shadow-none'
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
          {!product.available && (
            <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center z-20">
              <span className="bg-white text-slate-900 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-md uppercase tracking-wider">
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
                <div 
                  className="flex flex-nowrap items-center gap-1.5 w-full overflow-hidden"
                  style={{ maskImage: 'linear-gradient(to right, black 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 80%, transparent 100%)' }}
                >
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
            <span className="text-[11px] font-bold text-slate-400 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
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
