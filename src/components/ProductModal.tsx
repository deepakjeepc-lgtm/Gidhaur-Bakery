import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  X,
  Plus,
  Minus,
  Check,
  Sparkles,
  Layers,
  Heart,
  Clock,
  ChevronLeft,
  ChevronRight,
  Ruler,
  UtensilsCrossed,
  Scale,
  Coffee,
  Boxes,
  Palette,
  Hash
} from 'lucide-react';
import { Product, ProductVariant, ProductExtra } from '../types';
import { useCart } from '../context/CartContext';
import { triggerHaptic } from '../utils/haptics';

interface ProductModalProps {
  product: Product | null;
  allProducts?: Product[];
  onSelectProduct?: (product: Product) => void;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
}

export interface ColorOption {
  id: string;
  name: string;
  colorCode?: string;
  imageUrl: string;
  price: number;
  imageFit?: 'cover' | 'contain';
  productRef?: Product;
}

const formatVariantName = (name: string): string => {
  return name.replace(/\s*\(\s*\d+[\s"'-]*(inch|in)?\s*\)/gi, '').trim();
};

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  allProducts = [],
  onSelectProduct,
  onClose,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const { addToCart, getItemQuantity, totalItems, subtotal, setIsCartOpen } = useCart();
  const [addedAnimation, setAddedAnimation] = useState(false);
  const hasVariants = Boolean(product?.variants && product.variants.length > 0);
  const hasMultipleVariants = Boolean(product?.variants && product.variants.length > 1);

  // If a product has multiple variants and user didn't open a pre-split variant, start unselected (-1)!
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(() => {
    if (product?.defaultVariantIndex !== undefined) return product.defaultVariantIndex;
    if (product?.variants && product.variants.length > 1) return -1;
    return product?.variants && product.variants.length === 1 ? 0 : -1;
  });
  const [selectedQty, setSelectedQty] = useState(1);
  const [selectedExtras, setSelectedExtras] = useState<ProductExtra[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const manualPauseTimerRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // 1. Level 1: Flipkart-Style Linked Sibling Products (Numbers 0..9, Flavours, Models)
  const siblingProducts = useMemo(() => {
    if (!product?.groupId || allProducts.length === 0) return [];
    return allProducts.filter((p) => p.groupId === product.groupId);
  }, [allProducts, product?.groupId]);

  // 2. Level 2: Colors / Styles for THIS currently viewed product (Flipkart iPhone Colors)
  const colorOptions: ColorOption[] = useMemo(() => {
    if (product?.colorVariants && product.colorVariants.length > 0) {
      return product.colorVariants.map((cv, i) => ({
        id: cv.id || `${cv.name}-${i}`,
        name: cv.name,
        colorCode: cv.colorCode || '#94A3B8',
        imageUrl: cv.imageUrl || product.imageUrl,
        price: cv.price || product.price,
        imageFit: cv.imageFit || product.imageFit,
      }));
    }
    return [];
  }, [product?.id, product?.colorVariants, product?.imageUrl, product?.price, product?.imageFit]);

  const [selectedColorOption, setSelectedColorOption] = useState<ColorOption | null>(null);

  // Ultra-fast zero-layout-shift scroll lock for fluid 120fps scrolling
  useEffect(() => {
    const origHtmlOverflow = document.documentElement.style.overflow;
    const origBodyOverflow = document.body.style.overflow;
    const origOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.documentElement.style.overflow = origHtmlOverflow;
      document.body.style.overflow = origBodyOverflow;
      document.body.style.overscrollBehavior = origOverscroll;
    };
  }, []);

  // Native hardware / gesture back button support
  useEffect(() => {
    window.history.pushState({ productView: true }, '');

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose]);

  const handleBackNavigation = useCallback(() => {
    triggerHaptic('light');
    onClose();
    if (window.history.state?.productView) {
      try {
        window.history.back();
      } catch {}
    }
  }, [onClose]);

  // If colorOptions.length > 1, do NOT auto-select color unless product explicitly has selectedColorName!
  useEffect(() => {
    if (colorOptions.length > 0) {
      if (product?.selectedColorName) {
        const matched = colorOptions.find((c) => c.name === product.selectedColorName);
        if (matched) {
          setSelectedColorOption(matched);
          return;
        }
      }
      if (colorOptions.length > 1) {
        setSelectedColorOption(null);
      } else {
        setSelectedColorOption(colorOptions[0]);
      }
    } else {
      setSelectedColorOption(null);
    }
  }, [product?.id, product?.selectedColorName, colorOptions]);

  // Reset variant selection if switching product
  useEffect(() => {
    if (product?.defaultVariantIndex !== undefined) {
      setSelectedVariantIndex(product.defaultVariantIndex);
    } else if (product?.variants && product.variants.length > 1) {
      setSelectedVariantIndex(-1);
    } else if (product?.variants && product.variants.length === 1) {
      setSelectedVariantIndex(0);
    } else {
      setSelectedVariantIndex(-1);
    }
  }, [product?.id, product?.defaultVariantIndex, product?.variants?.length]);

  const rawActiveVariant = hasVariants && product?.variants && selectedVariantIndex >= 0
    ? product.variants[selectedVariantIndex]
    : undefined;

  const activeVariant: ProductVariant | undefined = rawActiveVariant
    ? { ...rawActiveVariant, name: formatVariantName(rawActiveVariant.name) }
    : undefined;

  // Active target color name (e.g. "Blue", "Golden", "Red") to sync across sibling products
  const activeColorTarget = useMemo(() => {
    return activeVariant?.name?.trim() || selectedColorOption?.name?.trim() || product?.selectedColorName?.trim() || '';
  }, [activeVariant?.name, selectedColorOption?.name, product?.selectedColorName]);

  // Multi-image list for modal:
  // Shows ONLY the photo of the selected variant/option so it doesn't auto-shift between other variants!
  const isVegSalad = (url?: string) => !url || url.includes('photo-1546069901-ba9599a7e63c');

  const rawImages: string[] = useMemo(() => {
    const list: string[] = [];

    // 1. If an active variant with a specific image is selected, show THAT variant's photo only!
    if (activeVariant?.imageUrl && !isVegSalad(activeVariant.imageUrl)) {
      list.push(activeVariant.imageUrl);
      return list;
    }

    // 2. If a specific color option has its own image, show THAT color's photo only!
    if (selectedColorOption?.imageUrl && !isVegSalad(selectedColorOption.imageUrl)) {
      list.push(selectedColorOption.imageUrl);
      return list;
    }

    // 3. Otherwise fallback to product's own images / imageUrl
    if (product?.images && product.images.length > 0) {
      for (const img of product.images) {
        if (!isVegSalad(img) && !list.includes(img)) list.push(img);
      }
    }
    if (product?.imageUrl && !isVegSalad(product.imageUrl) && !list.includes(product.imageUrl)) {
      list.push(product.imageUrl);
    }

    return list;
  }, [
    product?.id,
    product?.images,
    product?.imageUrl,
    activeVariant?.imageUrl,
    selectedColorOption?.imageUrl,
  ]);

  const [activeImgIdx, setActiveImgIdx] = useState(0);

  useEffect(() => {
    setActiveImgIdx(0);
    let initialVarIdx = typeof product?.defaultVariantIndex === 'number' ? product.defaultVariantIndex : -1;

    // If multiple variants exist and no explicit defaultVariantIndex was given, keep unselected (-1)
    if (initialVarIdx === -1) {
      if (product?.variants && product.variants.length > 1) {
        initialVarIdx = -1; // Must be explicitly selected by customer!
      } else if (product?.variants && product.variants.length === 1) {
        initialVarIdx = 0;
      }
    }

    setSelectedVariantIndex(initialVarIdx);
    setSelectedQty(1);
    setAddedAnimation(false);
    setIsManualPaused(false);
    setShakeError(false);
    setHighlightMissing(false);
    setSelectedExtras([]);
  }, [product?.id, product?.defaultVariantIndex]);

  const handleSelectVariant = (idx: number) => {
    setSelectedVariantIndex(idx);
    setActiveImgIdx(0);
    setShakeError(false);
    setHighlightMissing(false);
    pauseAutoAdvanceTemporarily();
  };

  const handleSelectColor = (opt: ColorOption) => {
    setSelectedColorOption(opt);
    setActiveImgIdx(0);
    setShakeError(false);
    setHighlightMissing(false);
    pauseAutoAdvanceTemporarily();
    if (opt.productRef && onSelectProduct) {
      onSelectProduct(opt.productRef);
    }
  };

  const pauseAutoAdvanceTemporarily = useCallback(() => {
    setIsManualPaused(true);
    if (manualPauseTimerRef.current) {
      window.clearTimeout(manualPauseTimerRef.current);
    }
    manualPauseTimerRef.current = window.setTimeout(() => {
      setIsManualPaused(false);
    }, 8000);
  }, []);

  useEffect(() => {
    if (rawImages.length <= 1) return;
    if (isManualPaused || isHovered) return;

    const timer = setInterval(() => {
      setActiveImgIdx((prev) => (prev + 1) % rawImages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [rawImages.length, isManualPaused, isHovered]);

  // Touch Swipe Handlers for Modal
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
        setActiveImgIdx((prev) => (prev + 1) % rawImages.length);
      } else {
        // Swiped Right -> Prev Image
        setActiveImgIdx((prev) => (prev - 1 + rawImages.length) % rawImages.length);
      }
    }
    touchStartXRef.current = null;
  };

  // Dynamic SVG Icon and Title according to variant preset type or custom label
  const getVariantHeaderMeta = () => {
    if (product?.variantCustomLabel?.trim()) {
      const lower = product.variantCustomLabel.toLowerCase();
      if (lower.includes('color') || lower.includes('shade')) return { title: product.variantCustomLabel, icon: Palette };
      if (lower.includes('flavour') || lower.includes('flavor') || lower.includes('taste')) return { title: product.variantCustomLabel, icon: Sparkles };
      if (lower.includes('number') || lower.includes('digit')) return { title: product.variantCustomLabel, icon: Hash };
      if (lower.includes('volume') || lower.includes('drink') || lower.includes('ml')) return { title: product.variantCustomLabel, icon: Coffee };
      if (lower.includes('weight') || lower.includes('gm') || lower.includes('kg')) return { title: product.variantCustomLabel, icon: Scale };
      if (lower.includes('piece') || lower.includes('pack') || lower.includes('qty')) return { title: product.variantCustomLabel, icon: Boxes };
      if (lower.includes('plate') || lower.includes('half') || lower.includes('full')) return { title: product.variantCustomLabel, icon: UtensilsCrossed };
      if (lower.includes('size') || lower.includes('portion')) return { title: product.variantCustomLabel, icon: Ruler };
      return { title: product.variantCustomLabel, icon: Layers };
    }

    switch (product?.variantPresetType) {
      case 'colors':
        return { title: 'Select Color / Shade:', icon: Palette };
      case 'flavours':
        return { title: 'Select Flavour / Taste:', icon: Sparkles };
      case 'numbers':
        return { title: 'Select Number / Digit:', icon: Hash };
      case 'drinks':
        return { title: 'Select Volume / Drink:', icon: Coffee };
      case 'weights':
        return { title: 'Select Weight / Portion:', icon: Scale };
      case 'pieces':
        return { title: 'Select Quantity / Pcs:', icon: Boxes };
      case 'plates':
        return { title: 'Select Portion / Plate:', icon: UtensilsCrossed };
      case 'sizes':
        return { title: 'Select Size / Portion:', icon: Ruler };
      default:
        if (product?.variants?.some((v) => /number|\b\d+\b/i.test(v.name))) {
          return { title: 'Select Number / Digit:', icon: Hash };
        }
        if (product?.variants?.some((v) => /red|blue|gold|silver|black|white|pink|green|yellow/i.test(v.name))) {
          return { title: 'Select Color / Shade:', icon: Palette };
        }
        if (product?.variants?.some((v) => /berry|watermelon|tropical|sugarfree|cola|lime|mint|flavour/i.test(v.name))) {
          return { title: 'Select Flavour / Taste:', icon: Sparkles };
        }
        if (product?.variants?.some((v) => /ml|liter|litre|can|bottle/i.test(v.name))) {
          return { title: 'Select Volume / Drink:', icon: Coffee };
        }
        if (product?.variants?.some((v) => /kg|gm|gram/i.test(v.name))) {
          return { title: 'Select Weight / Portion:', icon: Scale };
        }
        if (product?.variants?.some((v) => /pc|piece|pack/i.test(v.name))) {
          return { title: 'Select Quantity / Pcs:', icon: Boxes };
        }
        if (product?.variants?.some((v) => /half|full|plate/i.test(v.name))) {
          return { title: 'Select Portion / Plate:', icon: UtensilsCrossed };
        }
        return { title: 'Select Size / Option:', icon: Ruler };
    }
  };

  if (!product) return null;

  const isVariantInStock = rawActiveVariant ? rawActiveVariant.available !== false : true;
  const isProductInStock = product.available !== false && isVariantInStock;

  const getModalImageFitClass = (imgSrc: string, idx: number) => {
    // 1. If active variant has its own image and explicit fit
    if (activeVariant?.imageUrl === imgSrc && activeVariant.imageFit) {
      return activeVariant.imageFit === 'contain' ? 'object-contain p-2 bg-white' : 'object-cover sm:object-contain';
    }

    // 2. If selected color option has its own image and explicit fit
    if (selectedColorOption?.imageUrl === imgSrc && selectedColorOption.imageFit) {
      return selectedColorOption.imageFit === 'contain' ? 'object-contain p-2 bg-white' : 'object-cover sm:object-contain';
    }

    // 3. Check per-photo fit configured in product.imageFits
    const specificFit =
      product.imageFits?.[String(idx)] ||
      (product.images && product.images.indexOf(imgSrc) !== -1 && product.imageFits?.[String(product.images.indexOf(imgSrc))]) ||
      (product.imageFits as any)?.[imgSrc];

    if (specificFit) {
      return specificFit === 'contain' ? 'object-contain p-2 bg-white' : 'object-cover sm:object-contain';
    }

    // 4. Fallback to product-level imageFit: preserve on mobile, ensure no clipping on desktop
    return product.imageFit === 'contain' ? 'object-contain p-2 bg-white' : 'object-cover sm:object-contain';
  };

  const needsVariantSelection = hasVariants && (product?.variants?.length || 0) > 1;
  const isVariantSelected = !needsVariantSelection || selectedVariantIndex >= 0;

  const needsColorSelection = colorOptions.length > 1;
  const isColorSelected = !needsColorSelection || selectedColorOption !== null;

  const isSelectionComplete = isVariantSelected && isColorSelected;

  const [shakeError, setShakeError] = useState(false);
  const [highlightMissing, setHighlightMissing] = useState(false);
  const shakeTimerRef = useRef<number | null>(null);

  const selectedExtrasTotal = useMemo(() => {
    return selectedExtras.reduce((sum, e) => sum + (Number(e.price) || 0), 0);
  }, [selectedExtras]);

  const basePrice = activeVariant
    ? activeVariant.price
    : selectedColorOption
    ? selectedColorOption.price
    : product.price;

  const currentPrice = basePrice + selectedExtrasTotal;

  const handleToggleExtra = (extra: ProductExtra) => {
    triggerHaptic('selection');
    setSelectedExtras((prev) => {
      const exists = prev.some((e) => e.id === extra.id);
      if (exists) {
        return prev.filter((e) => e.id !== extra.id);
      } else {
        return [...prev, extra];
      }
    });
  };

  const handleAddOrUpdate = () => {
    if (!product.available || !isVariantInStock) return;

    // If options / varieties / colors are not selected, vibrate + red shake alert!
    if (!isSelectionComplete) {
      triggerHaptic('error');
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([60, 40, 60]);
        }
      } catch {
        // ignore
      }

      setShakeError(true);
      setHighlightMissing(true);

      // Smoothly scroll the missing selection container into the center of the screen
      const targetId = !isVariantSelected ? 'variant-options-section' : 'color-options-section';
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = window.setTimeout(() => {
        setShakeError(false);
        setHighlightMissing(false);
      }, 1100);
      return;
    }

    let variantToSave = activeVariant;
    if (!variantToSave && selectedColorOption) {
      variantToSave = {
        name: selectedColorOption.name,
        price: selectedColorOption.price,
        colorName: selectedColorOption.name,
        colorCode: selectedColorOption.colorCode,
        imageUrl: selectedColorOption.imageUrl,
        imageFit: selectedColorOption.imageFit,
      };
    } else if (variantToSave && selectedColorOption) {
      variantToSave = {
        ...variantToSave,
        name: `${variantToSave.name} (${selectedColorOption.name})`,
        price: selectedColorOption.price || variantToSave.price,
        colorName: selectedColorOption.name,
        colorCode: selectedColorOption.colorCode,
        imageUrl: selectedColorOption.imageUrl || variantToSave.imageUrl,
        imageFit: selectedColorOption.imageFit || variantToSave.imageFit,
      };
    }

    addToCart(product, selectedQty, variantToSave, selectedExtras);
    setAddedAnimation(true);
    setTimeout(() => {
      setAddedAnimation(false);
      // Keep popup open so the customer can select and add multiple items from this same screen!
    }, 700);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col w-full h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none select-none animate-in fade-in duration-150"
      id="product-detail-fullscreen-view"
    >
      {/* Dedicated Clean Page View on Desktop AND Mobile - No Popup Lag or Background Clutter */}
      <div
        className="relative bg-white w-full h-full max-h-[100dvh] max-w-4xl mx-auto flex flex-col select-none touch-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Top Navigation Header: Proper Back Button on Left, Veg Tag & Favorite on Right */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top,0.75rem),0.75rem)] pb-3 pointer-events-none">
          {/* Top Left Proper Circular Back Button */}
          <button
            type="button"
            onClick={handleBackNavigation}
            className="pointer-events-auto w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.14)] border border-slate-200/90 backdrop-blur-md flex items-center justify-center transition-all duration-200 active:scale-90 hover:scale-105 cursor-pointer"
            aria-label="Back to Menu"
            id="product-fullscreen-back-btn"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Top Right: Favorite Button & Desktop Close Button */}
          <div className="flex items-center gap-2 pointer-events-auto">

            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(product.id)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-90 border backdrop-blur-md ${
                  isFavorite
                    ? 'bg-rose-50/95 text-rose-600 border-rose-200 shadow-[0_2px_12px_rgba(244,63,94,0.2)]'
                    : 'bg-white/95 hover:bg-white text-slate-700 border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.12)]'
                }`}
                aria-label="Save as favorite"
                id="modal-fav-btn"
              >
                <Heart
                  className={`w-4.5 h-4.5 transition-colors ${
                    isFavorite ? 'fill-rose-500 text-rose-500' : 'stroke-[2.2]'
                  }`}
                />
              </button>
            )}

            {/* Desktop Optional Close Button */}
            <button
              type="button"
              onClick={handleBackNavigation}
              className="hidden sm:flex w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-700 items-center justify-center transition-all duration-200 hover:scale-105 active:scale-90 border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.12)] cursor-pointer"
              aria-label="Close"
              id="close-product-modal"
            >
              <X className="w-4.5 h-4.5 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* Scrollable Content: Edge-to-Edge Hero Image + Details */}
        <div
          className="flex-1 overflow-y-auto select-text pb-48 sm:pb-56 overscroll-y-contain no-scrollbar"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Edge-to-Edge Hero Picture Container */}
          <div className="relative w-full">
            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="group relative w-full aspect-[4/3] sm:aspect-[4/3] sm:max-h-[500px] overflow-hidden bg-white select-none flex items-center justify-center transform-gpu"
            >
              {rawImages.length > 0 ? (
                rawImages.map((imgSrc, idx) => (
                  <img
                    key={idx}
                    src={imgSrc}
                    alt={`${product.name} ${idx + 1}`}
                    loading="eager"
                    decoding="async"
                    className={`absolute inset-0 w-full h-full ${getModalImageFitClass(
                      imgSrc,
                      idx
                    )} transition-opacity duration-300 ease-out transform-gpu ${
                      idx === activeImgIdx
                        ? 'opacity-100 z-0 pointer-events-auto'
                        : 'opacity-0 pointer-events-none'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                ))
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200/80 p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-2xs border border-slate-200/80 flex items-center justify-center text-slate-500 mb-2">
                    <span className="font-heading font-black text-xl text-slate-800 uppercase">
                      {product.name.slice(0, 2)}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    {product.category || 'Special Item'}
                  </span>
                </div>
              )}

              {/* Prev / Next Manual Arrows */}
              {rawImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      pauseAutoAdvanceTemporarily();
                      setActiveImgIdx((prev) => (prev - 1 + rawImages.length) % rawImages.length);
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-700 hover:text-slate-950 border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-xs flex items-center justify-center transition-all duration-200 z-10 cursor-pointer active:scale-90"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      pauseAutoAdvanceTemporarily();
                      setActiveImgIdx((prev) => (prev + 1) % rawImages.length);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-700 hover:text-slate-950 border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-xs flex items-center justify-center transition-all duration-200 z-10 cursor-pointer active:scale-90"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  {/* Multiple Images Indicator Dots (clean, light translucent, capsule-free) */}
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                    {rawImages.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          pauseAutoAdvanceTemporarily();
                          setActiveImgIdx(idx);
                        }}
                        className={`transition-all duration-300 rounded-full cursor-pointer focus:outline-none ${
                          idx === activeImgIdx
                            ? 'w-5 h-1.5 bg-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.3)]'
                            : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70 shadow-[0_1px_2px_rgba(0,0,0,0.15)]'
                        }`}
                        aria-label={`View photo ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail selector in 4:3 aspect ratio without borders or shadow when 2+ images */}
            {rawImages.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto px-1.5 pt-2.5 pb-2 no-scrollbar">
                {rawImages.map((imgSrc, idx) => {
                  const isActive = idx === activeImgIdx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        pauseAutoAdvanceTemporarily();
                        setActiveImgIdx(idx);
                      }}
                      className={`relative w-[82px] sm:w-20 aspect-[4/3] rounded-xl overflow-hidden shrink-0 transition-all duration-200 focus:outline-none bg-white cursor-pointer ${
                        isActive
                          ? '-translate-y-1.5 scale-[1.08] opacity-100 z-10'
                          : 'translate-y-0 scale-100 opacity-[0.95] hover:opacity-100'
                      }`}
                      aria-label={`View photo ${idx + 1}`}
                    >
                      <img
                        src={imgSrc}
                        alt={`Thumbnail ${idx + 1}`}
                        className={`w-full h-full ${
                          (product.imageFits?.[imgSrc] || product.imageFits?.[String(idx)] || product.imageFit) === 'contain'
                            ? 'object-contain p-1.5 bg-white'
                            : 'object-cover'
                        }`}
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Details Section */}
          <div className="p-4 sm:p-6 space-y-4">
            {/* Title & Pricing Block */}
            <div className="space-y-2 pt-0.5">
            {/* Meta Tags: Standard Indian Food Classification Symbol + Category & Prep Time */}
            <div className="flex items-center gap-2">
              {!product.isNonFood && (
                product.isVegetarian !== false ? (
                  <div
                    className="w-4 h-4 border-[1.5px] border-emerald-600 rounded-[3px] p-[2px] flex items-center justify-center shrink-0 bg-white shadow-2xs"
                    title="Pure Veg"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </div>
                ) : (
                  <div
                    className="w-4 h-4 border-[1.5px] border-rose-600 rounded-[3px] p-[2px] flex items-center justify-center shrink-0 bg-white shadow-2xs"
                    title="Non-Veg"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                  </div>
                )
              )}

              <span className="font-heading text-[11px] font-bold tracking-tight text-slate-500 uppercase">
                {product.category}
              </span>
              {typeof product.prepTimeMinutes === 'number' && product.prepTimeMinutes > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {product.prepTimeMinutes} mins prep
                  </span>
                </>
              )}
            </div>

            {/* Product Heading & Distinct Price */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-heading font-extrabold text-lg sm:text-xl text-slate-950 tracking-tight leading-snug capitalize">
                {product.name}
              </h2>
              <div className="shrink-0 bg-slate-100/90 border border-slate-200/80 px-2.5 py-1 rounded-xl shadow-2xs flex items-baseline gap-0.5">
                <span className="text-xs font-semibold text-slate-400 select-none">₹</span>
                <span className="font-heading font-extrabold text-xl sm:text-2xl text-slate-950 tracking-tight leading-none">
                  {currentPrice}
                </span>
              </div>
            </div>

            {/* Realistic & High-Contrast Description */}
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
              {product.description || 'Crafted with premium fresh ingredients and cooked to perfection.'}
            </p>
          </div>

          {/* 1. Flipkart-Style Linked Products (Numbers / Digits / Flavours / Models) */}
          {siblingProducts.length > 1 && (
            <div className="space-y-2.5 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-800 shrink-0" />
                  <span className="font-heading text-xs font-bold text-slate-900 uppercase tracking-tight block">
                    {product.groupName ? `${product.groupName}:` : 'Select Option / Number / Flavour:'}
                  </span>
                </div>
              </div>

              {/* Grid of Linked Sibling Products */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {siblingProducts.map((sibling) => {
                  const isCurrent = sibling.id === product.id;
                  const chipLabel = sibling.groupVariantLabel || sibling.name;

                  // Find if this sibling has a variant matching the currently active color/option
                  const targetLower = activeColorTarget.trim().toLowerCase();
                  const matchingVariant = targetLower && sibling.variants
                    ? sibling.variants.find((v) => {
                        const vName = v.name?.trim().toLowerCase();
                        const cName = v.colorName?.trim().toLowerCase();
                        return vName === targetLower || cName === targetLower;
                      })
                    : undefined;

                  const matchingColor = !matchingVariant && targetLower && sibling.colorVariants
                    ? sibling.colorVariants.find((cv) => cv.name?.trim().toLowerCase() === targetLower)
                    : undefined;

                  const displayImg = matchingVariant?.imageUrl || matchingColor?.imageUrl || sibling.imageUrl;
                  const displayFit = (matchingVariant?.imageUrl && matchingVariant.imageFit) ||
                                     (matchingColor?.imageUrl && matchingColor.imageFit) ||
                                     sibling.imageFit || 'contain';
                  const displayPrice = matchingVariant ? matchingVariant.price : matchingColor ? matchingColor.price : sibling.price;
                  const isSiblingAvailable = matchingVariant ? matchingVariant.available !== false : sibling.available !== false;
                  const inCartSiblingQty = getItemQuantity(sibling.id);

                  return (
                    <button
                      key={sibling.id}
                      type="button"
                      onClick={() => {
                        if (!isCurrent && onSelectProduct) {
                          // Find index of matching color variant in the clicked sibling so it opens with that color!
                          const targetIdx = targetLower && sibling.variants
                            ? sibling.variants.findIndex((v) => {
                                const vName = v.name?.trim().toLowerCase();
                                const cName = v.colorName?.trim().toLowerCase();
                                return vName === targetLower || cName === targetLower;
                              })
                            : -1;

                          onSelectProduct({
                            ...sibling,
                            defaultVariantIndex: targetIdx > -1 ? targetIdx : sibling.defaultVariantIndex,
                            selectedColorName: activeColorTarget || sibling.selectedColorName,
                          });
                        }
                      }}
                      className={`group relative flex flex-col items-center justify-between rounded-2xl p-1 transition-all duration-200 cursor-pointer text-center bg-white ${
                        isCurrent
                          ? 'shadow-[0_8px_22px_rgba(0,0,0,0.14)] scale-[1.05] z-10 opacity-100'
                          : isSiblingAvailable
                          ? 'shadow-none scale-100 opacity-[0.95] hover:opacity-100'
                          : 'bg-rose-50/20 opacity-60 scale-100'
                      }`}
                    >
                      {inCartSiblingQty > 0 && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-2xs border bg-white text-slate-900 border-slate-200/90 z-20">
                          {inCartSiblingQty} in cart
                        </span>
                      )}

                      {/* Product Photo with 4:3 Aspect Ratio, 4px margin (p-1) to card and no inner border */}
                      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-transparent relative shrink-0 flex items-center justify-center">
                        {displayImg ? (
                          <img
                            src={displayImg}
                            alt={chipLabel}
                            className={`w-full h-full ${
                              displayFit === 'contain' ? 'object-contain' : 'object-cover'
                            } group-hover:scale-105 transition-transform duration-200`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-xs bg-slate-50">
                            {sibling.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="w-full px-1 pt-1 pb-1.5 flex flex-col items-center justify-center">
                        <span
                          className="text-xs font-heading font-extrabold tracking-tight truncate w-full text-slate-900"
                        >
                          {chipLabel}
                        </span>

                        <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
                          <span className="text-[10px] font-semibold text-slate-400 select-none">
                            ₹
                          </span>
                          <span className={`text-xs font-heading font-extrabold ${!isSiblingAvailable ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {displayPrice}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Numbers / Sizes Section */}
          {hasVariants && (() => {
            const headerMeta = getVariantHeaderMeta();
            const HeaderIcon = headerMeta.icon;

            return (
              <div id="variant-options-section" className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <HeaderIcon className={`w-4 h-4 shrink-0 transition-colors ${
                      highlightMissing && !isVariantSelected ? 'text-red-500' : 'text-slate-800'
                    }`} />
                    <span className={`font-heading text-xs font-bold uppercase tracking-tight block transition-colors ${
                      highlightMissing && !isVariantSelected ? 'text-red-600' : 'text-slate-900'
                    }`}>
                      {headerMeta.title}
                    </span>
                  </div>
                </div>

                {/* Variant Choice Cards with Photo Thumbnails OR Text Pills */}
                {(() => {
                  const anyVariantHasImage = Boolean(
                    product.variants!.some((v) => v.imageUrl && v.imageUrl.trim().length > 0)
                  );

                  return (
                    <div
                      className={`grid gap-2 sm:gap-2.5 ${
                        product.variants!.length === 2
                          ? 'grid-cols-2'
                          : product.variants!.length === 3
                          ? 'grid-cols-3'
                          : product.variants!.length === 4
                          ? 'grid-cols-2 sm:grid-cols-4'
                          : 'grid-cols-3 sm:grid-cols-4'
                      }`}
                    >
                      {product.variants!.map((variant, idx) => {
                        const isSelected = idx === selectedVariantIndex;
                        const displayName = formatVariantName(variant.name);
                        const inCartQty = getItemQuantity(product.id, displayName);
                        const isVariantAvailable = variant.available !== false;

                        if (!anyVariantHasImage) {
                          return (
                            <button
                              key={variant.name + idx}
                              type="button"
                              onClick={() => handleSelectVariant(idx)}
                              className={`relative px-3.5 py-3 rounded-3xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center text-center focus:outline-none bg-white ${
                                isSelected
                                  ? 'border border-transparent shadow-[0_8px_22px_rgba(0,0,0,0.14)] scale-[1.04] z-10 opacity-100'
                                  : highlightMissing && !isVariantSelected
                                  ? 'border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.25)] scale-100 opacity-100'
                                  : isVariantAvailable
                                  ? 'border border-slate-200/80 shadow-[0_0_8px_rgba(0,0,0,0.04)] scale-100 opacity-[0.95] hover:opacity-100'
                                  : 'border border-slate-200/50 bg-rose-50/30 opacity-60 scale-100 shadow-none'
                              }`}
                            >
                              {!isVariantAvailable && (
                                <span className="absolute -top-1.5 left-2 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full shadow-2xs border bg-rose-100 text-rose-700 border-rose-200 z-10">
                                  Out of Stock
                                </span>
                              )}
                              {inCartQty > 0 && (
                                <span className="absolute -top-1.5 right-2 text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-2xs border bg-white text-slate-900 border-slate-200/90 z-10">
                                  {inCartQty} in cart
                                </span>
                              )}
                              <span
                                className={`text-xs sm:text-sm font-bold tracking-tight leading-tight block truncate w-full ${
                                  !isVariantAvailable ? 'text-slate-500' : 'text-slate-900'
                                }`}
                              >
                                {displayName}
                              </span>
                              <div className="flex items-baseline justify-center gap-0.5 mt-1">
                                <span className="text-[10px] font-semibold text-slate-400 select-none">
                                  ₹
                                </span>
                                <span
                                  className={`text-xs sm:text-sm font-heading font-extrabold ${
                                    !isVariantAvailable ? 'text-slate-500 line-through' : 'text-slate-900'
                                  }`}
                                >
                                  {variant.price}
                                </span>
                              </div>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={variant.name + idx}
                            type="button"
                            onClick={() => handleSelectVariant(idx)}
                            className={`group relative rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-between text-center p-1 focus:outline-none bg-white ${
                              isSelected
                                ? 'border border-transparent shadow-[0_8px_22px_rgba(0,0,0,0.14)] scale-[1.05] z-10 opacity-100'
                                : highlightMissing && !isVariantSelected
                                ? 'border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.25)] scale-100 opacity-100'
                                : isVariantAvailable
                                ? 'border border-transparent shadow-none scale-100 opacity-[0.95] hover:opacity-100'
                                : 'border border-transparent bg-rose-50/30 opacity-60 scale-100 shadow-none'
                            }`}
                          >
                            {!isVariantAvailable && (
                              <span className="absolute top-1.5 left-1.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full shadow-2xs border bg-rose-100 text-rose-700 border-rose-200 z-10">
                                Out of Stock
                              </span>
                            )}
                            {inCartQty > 0 && (
                              <span className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-2xs border bg-white text-slate-900 border-slate-200/90 z-10">
                                {inCartQty} in cart
                              </span>
                            )}

                            {/* 4:3 Aspect Ratio Photo Thumbnail with 4px margin (p-1) to card and no inner border */}
                            <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-transparent relative shrink-0 flex items-center justify-center">
                              {variant.imageUrl ? (
                                <img
                                  src={variant.imageUrl}
                                  alt={displayName}
                                  className={`w-full h-full ${
                                    variant.imageFit === 'contain'
                                      ? 'object-contain'
                                      : 'object-cover'
                                  } group-hover:scale-105 transition-transform duration-200`}
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-50 font-bold text-slate-400 text-xs">
                                  {displayName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="w-full px-1 pt-1 pb-1.5 flex flex-col items-center justify-center">
                              <span
                                className={`text-xs sm:text-sm font-bold tracking-tight leading-tight block truncate w-full ${
                                  !isVariantAvailable ? 'text-slate-500' : 'text-slate-900'
                                }`}
                              >
                                {displayName}
                              </span>

                              <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
                                <span className="text-[10px] font-semibold text-slate-400 select-none">
                                  ₹
                                </span>
                                <span
                                  className={`text-xs sm:text-sm font-heading font-extrabold ${
                                    !isVariantAvailable ? 'text-slate-500 line-through' : 'text-slate-900'
                                  }`}
                                >
                                  {variant.price}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* 3. Flipkart & Amazon Style Color / Style Variations Selector for Active Product */}
          {colorOptions.length > 0 && (
            <div id="color-options-section" className="space-y-2.5 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className={`font-heading text-xs font-bold tracking-tight transition-colors ${
                  highlightMissing && !isColorSelected ? 'text-red-600' : 'text-slate-900'
                }`}>
                  {siblingProducts.length > 1
                    ? `Color for ${product.groupVariantLabel || product.name}:`
                    : hasVariants && activeVariant
                    ? `Color for ${activeVariant.name}:`
                    : 'Color / Style:'}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {colorOptions.length} colors
                </span>
              </div>

              {/* Horizontal Scrollable Swatch Cards with Photos in 4:3 Aspect Ratio */}
              <div className="flex items-center gap-2.5 overflow-x-auto py-1.5 no-scrollbar">
                {colorOptions.map((opt) => {
                  const isSelected = selectedColorOption?.id === opt.id;
                  const inCartColorQty = getItemQuantity(product.id, opt.name);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectColor(opt)}
                      className={`group relative flex flex-col items-center justify-between rounded-2xl p-1 transition-all duration-200 cursor-pointer shrink-0 min-w-[84px] sm:min-w-[96px] bg-white ${
                        isSelected
                          ? 'border border-transparent shadow-[0_8px_22px_rgba(0,0,0,0.14)] scale-[1.05] z-10 opacity-100'
                          : highlightMissing && !isColorSelected
                          ? 'border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.25)] scale-100 opacity-100'
                          : 'border border-transparent shadow-none scale-100 opacity-[0.95] hover:opacity-100'
                      }`}
                    >
                      {inCartColorQty > 0 && (
                        <span className="absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-2xs border bg-white text-slate-900 border-slate-200/90 z-20">
                          {inCartColorQty} in cart
                        </span>
                      )}

                      {/* Thumbnail Picture with 4px margin (p-1) from card border and no inner border */}
                      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-transparent relative shrink-0 flex items-center justify-center">
                        {opt.imageUrl ? (
                          <img
                            src={opt.imageUrl}
                            alt={opt.name}
                            className={`w-full h-full ${opt.imageFit === 'contain' ? 'object-contain' : 'object-cover'} group-hover:scale-105 transition-transform`}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ backgroundColor: opt.colorCode || '#E2E8F0' }}
                          />
                        )}
                        {/* Tiny color badge */}
                        {opt.colorCode && (
                          <span
                            className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full border border-white shadow-2xs z-10"
                            style={{ backgroundColor: opt.colorCode }}
                            title={opt.name}
                          />
                        )}
                      </div>

                      <div className="w-full px-1 pt-1 pb-1.5 flex flex-col items-center justify-center">
                        {/* Color Name */}
                        <span className={`text-[11px] font-bold truncate max-w-[80px] text-center ${
                          isSelected ? 'text-slate-950 font-extrabold' : 'text-slate-700'
                        }`}>
                          {opt.name}
                        </span>

                        {/* Price */}
                        <span className="text-[10px] font-extrabold text-slate-500 mt-0.5">
                          ₹{opt.price}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Add-ons & Extras (Direct Visible Boxes - No Dropdown) */}
          {product.availableExtras && product.availableExtras.length > 0 && (
            <div id="product-extras-section" className="space-y-2.5 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                  <span className="font-heading text-xs font-bold text-slate-900 tracking-tight">
                    Add-ons & Extras:
                  </span>
                </div>
                {selectedExtras.length > 0 && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                    {selectedExtras.length} selected (+₹{selectedExtrasTotal})
                  </span>
                )}
              </div>

              {/* Direct Open Grid of Boxes - ZERO Dropdowns */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {product.availableExtras.map((extra) => {
                  const isChecked = selectedExtras.some((e) => e.id === extra.id);
                  const isExtraAvailable = extra.available !== false;

                  return (
                    <button
                      key={extra.id}
                      type="button"
                      disabled={!isExtraAvailable}
                      onClick={() => handleToggleExtra(extra)}
                      className={`relative p-2.5 rounded-2xl text-left flex flex-col justify-between transition-all duration-150 cursor-pointer ${
                        isChecked
                          ? 'border border-amber-400 bg-amber-50/80 shadow-[0_4px_14px_rgba(245,158,11,0.18)] ring-1 ring-amber-400/80 scale-[1.02]'
                          : isExtraAvailable
                          ? 'border border-slate-200/90 bg-white hover:bg-slate-50/90 hover:border-slate-300 shadow-2xs'
                          : 'border border-slate-100 bg-slate-50/50 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5 w-full">
                        <span className={`text-xs font-heading font-extrabold leading-snug line-clamp-2 ${
                          isChecked ? 'text-amber-950' : 'text-slate-900'
                        }`}>
                          {extra.name}
                        </span>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                            isChecked
                              ? 'bg-amber-500 text-slate-950 shadow-2xs'
                              : 'border-2 border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-2 pt-1 border-t border-slate-100/80 w-full">
                        <span className="text-[10px] font-semibold text-slate-400 truncate">
                          {extra.category || 'Add-on'}
                        </span>
                        <span className={`text-[11px] font-heading font-black shrink-0 ${
                          isChecked ? 'text-amber-900' : 'text-slate-800'
                        }`}>
                          +₹{extra.price}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Action Area with GPU-Accelerated Capsules - Fluid 120fps Scrolling Performance */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none px-3.5 sm:px-4 pb-[max(env(safe-area-inset-bottom,1.5rem),2.25rem)] pt-1 flex flex-col items-center transform-gpu">
        {/* Capsule 1: Floating In-Modal Cart Notification & Fast Checkout Shortcut */}
        {totalItems > 0 && (
          <div className="pointer-events-auto max-w-lg w-full mx-auto mb-2.5 p-1.5 sm:p-2 bg-white/95 rounded-full border border-slate-200/90 text-slate-950 flex items-center justify-between shadow-[0_10px_30px_rgba(15,23,42,0.1)] shrink-0 animate-in fade-in slide-in-from-bottom-2 select-none transform-gpu">
            <div className="flex items-center gap-2.5 pl-1">
              <span className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full bg-amber-400 text-slate-950 font-heading font-black text-sm sm:text-base flex items-center justify-center shrink-0 shadow-2xs">
                {totalItems}
              </span>
              <span className="text-xs font-semibold text-slate-600">
                In Cart: <strong className="text-slate-950 font-heading font-black text-sm sm:text-base ml-1">₹{subtotal}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                setIsCartOpen(true);
              }}
              className="h-10 sm:h-11 px-6 sm:px-7 bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 font-heading font-black text-xs sm:text-[13px] rounded-full flex items-center justify-center border border-amber-300 shadow-none transition-all cursor-pointer shrink-0"
            >
              <span>View Cart</span>
            </button>
          </div>
        )}

        {/* Capsule 2: Action Footer - GPU-Accelerated Crisp Design */}
        <div className={`pointer-events-auto max-w-lg w-full mx-auto p-1.5 sm:p-2 bg-white/95 rounded-full flex items-center gap-2.5 transition-all duration-200 transform-gpu ${
          isSelectionComplete
            ? 'border border-slate-300 shadow-[0_14px_38px_rgba(15,23,42,0.12)]'
            : 'border border-slate-200/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)]'
        }`}>
          {/* Stepper */}
          <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200/80 rounded-full px-3 h-12.5 shadow-2xs shrink-0">
            <button
              onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
              className="w-7 h-7 rounded-full bg-white hover:bg-slate-50 text-slate-800 active:scale-90 flex items-center justify-center font-bold transition-all cursor-pointer shadow-2xs border border-slate-200/80"
              aria-label="Decrease"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-heading font-black text-sm sm:text-base min-w-[20px] text-center text-slate-950 select-none">
              {selectedQty}
            </span>
            <button
              onClick={() => setSelectedQty((q) => q + 1)}
              className="w-7 h-7 rounded-full bg-white hover:bg-slate-50 text-slate-800 active:scale-90 flex items-center justify-center font-bold transition-all cursor-pointer shadow-2xs border border-slate-200/80"
              aria-label="Increase"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add Button */}
          <button
            type="button"
            onClick={handleAddOrUpdate}
            disabled={!product.available || !isVariantInStock}
            className={`flex-1 h-12.5 px-6 rounded-full font-heading font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] whitespace-nowrap ${
              !product.available || !isVariantInStock
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-xs'
                : addedAnimation
                ? 'bg-emerald-600 text-white shadow-emerald-600/20 cursor-pointer'
                : !isSelectionComplete
                ? shakeError
                  ? 'bg-red-50 text-red-600 border-2 border-red-500 animate-shake-alert cursor-pointer'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-[0_4px_16px_rgba(15,23,42,0.18)] cursor-pointer'
                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-[0_4px_18px_rgba(15,23,42,0.22)] cursor-pointer'
            }`}
            id="modal-add-to-cart-btn"
          >
            {addedAnimation ? (
              <div className="flex items-center gap-2 font-bold text-white">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Added to Cart!</span>
              </div>
            ) : !product.available ? (
              <span className="text-rose-500 font-heading font-black">Sold Out</span>
            ) : !isVariantInStock ? (
              <span className="text-rose-500 font-heading font-black">Out of Stock</span>
            ) : !isSelectionComplete ? (
              <div className="flex items-center gap-1.5 font-heading font-black tracking-tight">
                <span>Add to Cart</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 font-heading font-black tracking-tight text-white">
                <span>Add{selectedQty > 1 ? ` (${selectedQty})` : ''}</span>
                <span className="text-slate-400 font-normal select-none">•</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-xs text-slate-300 select-none">₹</span>
                  <span className="font-heading font-black text-base">{currentPrice * selectedQty}</span>
                </div>
              </div>
            )}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};
