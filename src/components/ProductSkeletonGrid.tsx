import React from 'react';

interface ProductSkeletonGridProps {
  count?: number;
}

export const ProductSkeletonGrid: React.FC<ProductSkeletonGridProps> = ({ count = 8 }) => {
  const items = Array.from({ length: count });

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 w-full"
      aria-label="Loading products"
      role="status"
    >
      {items.map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 border border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden animate-shimmer"
        >
          <div>
            {/* Image Placeholder with Aspect Ratio Match */}
            <div className="relative w-full aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 mb-2.5 flex items-center justify-center">
              {/* Veg Indicator Stub */}
              <div className="absolute top-2 left-2 w-3.5 h-3.5 bg-slate-200/80 rounded-xs" />
              {/* Favorite Button Stub */}
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-200/80" />
            </div>

            {/* Title & Metadata Skeletons */}
            <div className="space-y-2 py-0.5">
              {/* Title line */}
              <div
                className="h-3.5 sm:h-4 bg-slate-200/90 rounded-md"
                style={{ width: `${65 + (index % 4) * 8}%` }}
              />

              {/* Category / description tag line */}
              <div
                className="h-2.5 sm:h-3 bg-slate-200/60 rounded-md"
                style={{ width: `${40 + (index % 3) * 10}%` }}
              />

              {/* Variants chip stub (for some cards) */}
              {index % 2 === 0 && (
                <div className="flex gap-1 pt-0.5">
                  <div className="h-3.5 w-10 bg-slate-100 rounded border border-slate-200/60" />
                  <div className="h-3.5 w-10 bg-slate-100 rounded border border-slate-200/60" />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Pricing & Action Button Stubs */}
          <div className="pt-2.5 mt-2 flex items-center justify-between border-t border-slate-100/80">
            {/* Price Stub */}
            <div className="h-4 sm:h-5 w-12 bg-slate-200/90 rounded-md" />

            {/* ADD Button Stub */}
            <div className="h-[30px] sm:h-[34px] w-14 sm:w-16 bg-slate-200/90 rounded-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading menu items...</span>
    </div>
  );
};
