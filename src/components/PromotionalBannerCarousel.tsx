import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  Tag,
  Utensils
} from 'lucide-react';
import { BannerSettings, PromotionalBanner } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface PromotionalBannerCarouselProps {
  bannerSettings: BannerSettings;
  onSelectCategory?: (category: string) => void;
  onOpenItem?: (productId: string) => void;
}

export const PromotionalBannerCarousel: React.FC<PromotionalBannerCarouselProps> = ({
  bannerSettings,
  onSelectCategory,
  onOpenItem,
}) => {
  const activeBanners = (bannerSettings.banners || [])
    .filter((b) => b.isActive)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Touch swipe handling
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);

  const bannerCount = activeBanners.length;

  // Safe slide increment
  const handleNext = useCallback(() => {
    if (bannerCount <= 1) return;
    triggerHaptic('selection');
    setCurrentIndex((prev) => (prev + 1) % bannerCount);
  }, [bannerCount]);

  const handlePrev = useCallback(() => {
    if (bannerCount <= 1) return;
    triggerHaptic('selection');
    setCurrentIndex((prev) => (prev - 1 + bannerCount) % bannerCount);
  }, [bannerCount]);

  // Auto-slide timer
  useEffect(() => {
    if (!bannerSettings.isEnabled || bannerCount <= 1 || isPaused) {
      return;
    }

    const intervalSec = Math.max(3, bannerSettings.autoSlideIntervalSeconds || 5);
    const timer = setInterval(() => {
      handleNext();
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [bannerSettings.isEnabled, bannerSettings.autoSlideIntervalSeconds, bannerCount, isPaused, handleNext]);

  // If index falls out of bounds after updates
  useEffect(() => {
    if (currentIndex >= bannerCount && bannerCount > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, bannerCount]);

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!code) return;

    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      triggerHaptic('success');
      setTimeout(() => {
        setCopiedCode(null);
      }, 2500);
    } catch {
      // Fallback
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleActionClick = (banner: PromotionalBanner) => {
    triggerHaptic('light');
    if (banner.targetProductId && onOpenItem) {
      onOpenItem(banner.targetProductId);
      return;
    }
    if (onSelectCategory) {
      onSelectCategory(banner.targetCategory || 'All');
    }
  };

  // Touch gesture listeners
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (touchStartXRef.current === null) return;
    const swipeThreshold = 45;
    if (touchDeltaXRef.current < -swipeThreshold) {
      handleNext();
    } else if (touchDeltaXRef.current > swipeThreshold) {
      handlePrev();
    }
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
  };

  // If carousel is disabled in admin settings or no active banners
  if (!bannerSettings.isEnabled || bannerCount === 0) {
    return null;
  }

  const currentBanner = activeBanners[currentIndex];
  if (!currentBanner) return null;

  return (
    <section
      aria-label="Promotional Offers"
      className="relative w-full overflow-hidden select-none group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      id="promotional-banner-carousel"
    >
      {/* Clean, Minimalist White Card */}
      <div className="relative bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_4px_24px_rgba(15,23,42,0.03)] p-4 sm:p-6 transition-all duration-300">
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 sm:gap-6">
          {/* Left Text and Actions Column */}
          <div className="flex-1 text-left space-y-2 sm:space-y-3 w-full">
            {/* Offer Tag Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] sm:text-[11px] font-bold text-slate-800 tracking-wide uppercase">
                <Sparkles className="w-3 h-3 text-amber-500" />
                {currentBanner.badge || 'SPECIAL OFFER'}
              </span>

              {currentBanner.discountText && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                  <Tag className="w-2.5 h-2.5" />
                  {currentBanner.discountText}
                </span>
              )}
            </div>

            {/* Banner Title & Description */}
            <div className="space-y-1">
              <h2 className="font-heading font-extrabold text-slate-900 text-lg sm:text-2xl lg:text-[1.65rem] tracking-tight leading-snug">
                {currentBanner.title}
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm font-normal line-clamp-2 leading-relaxed max-w-xl">
                {currentBanner.description}
              </p>
            </div>

            {/* Action Row: Promo Coupon Pill + CTA Button */}
            <div className="pt-1 flex flex-wrap items-center gap-2.5">
              {/* Promo Code Copy Pill */}
              {currentBanner.couponCode && (
                <button
                  type="button"
                  onClick={(e) => handleCopyCode(currentBanner.couponCode!, e)}
                  title="Click to copy coupon code"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                    copiedCode === currentBanner.couponCode
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-50 hover:bg-slate-100 border-dashed border-slate-300 text-slate-700'
                  }`}
                  id={`copy-coupon-${currentBanner.id}`}
                >
                  {copiedCode === currentBanner.couponCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-bold text-emerald-700">Code Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-500 font-normal">Code:</span>
                      <strong className="font-mono text-slate-900 font-bold tracking-wider">
                        {currentBanner.couponCode}
                      </strong>
                    </>
                  )}
                </button>
              )}

              {/* Main CTA Button */}
              <button
                type="button"
                onClick={() => handleActionClick(currentBanner)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
                id={`banner-cta-${currentBanner.id}`}
              >
                <span>{currentBanner.buttonText || 'Order Now'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Product Food Photo or Minimal Icon Frame */}
          <div className="shrink-0 w-full sm:w-auto flex justify-center sm:justify-end">
            {currentBanner.imageUrl ? (
              <div className="relative w-full sm:w-44 md:w-56 h-36 sm:h-36 md:h-40 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 shadow-2xs">
                <img
                  src={currentBanner.imageUrl}
                  alt={currentBanner.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400">
                <Utensils className="w-10 h-10 stroke-[1.5]" />
              </div>
            )}
          </div>
        </div>

        {/* Floating Minimal Navigation Arrows (Visible on Hover / Active when > 1 banner) */}
        {bannerCount > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous Offer"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 border border-slate-200/90 text-slate-700 hover:text-slate-900 hover:bg-white shadow-sm flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 cursor-pointer z-10"
              id="banner-prev-btn"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next Offer"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 border border-slate-200/90 text-slate-700 hover:text-slate-900 hover:bg-white shadow-sm flex items-center justify-center transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-95 cursor-pointer z-10"
              id="banner-next-btn"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Minimalist Bottom Indicator Dots */}
        {bannerCount > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-3 mt-1">
            {activeBanners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setCurrentIndex(index);
                }}
                aria-label={`Go to slide ${index + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  currentIndex === index
                    ? 'w-6 bg-slate-900'
                    : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
export default PromotionalBannerCarousel;
