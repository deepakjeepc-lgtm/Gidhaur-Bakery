import React, { useRef, useEffect } from 'react';
import { Heart, Layers, UtensilsCrossed } from 'lucide-react';
import { CategoryDetail } from '../services/categoryService';
import { renderCategoryIcon } from '../utils/categoryIcons';
import { triggerHaptic } from '../utils/haptics';

interface HeroCategorySectionProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  categoryCounts: Record<string, number>;
  favoriteCount?: number;
  iconsMap?: Record<string, CategoryDetail>;
  isDiwaliActive?: boolean;
}

export const HeroCategorySection: React.FC<HeroCategorySectionProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
  categoryCounts = {},
  favoriteCount = 0,
  iconsMap = {},
  isDiwaliActive = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const nonAllCategories = categories.filter((c) => c !== 'All');

  const handleTabClick = (category: string, e: React.MouseEvent<HTMLButtonElement>) => {
    triggerHaptic('selection');
    onSelectCategory(category);
    try {
      e.currentTarget.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    } catch {
      // fallback
    }
  };

  // Center active category on change
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const activeBtn = scrollContainerRef.current.querySelector<HTMLElement>(
      `[data-hero-category="${activeCategory}"]`
    );
    if (activeBtn) {
      try {
        activeBtn.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      } catch {
        // fallback
      }
    }
  }, [activeCategory]);

  const renderIcon = (cat: string, isActive: boolean) => {
    const visual = iconsMap[cat];
    // Custom Emoji rendering
    if (
      visual?.iconType === 'emoji' ||
      (!visual?.iconType && visual?.iconValue && visual.iconValue.length <= 4)
    ) {
      return (
        <span
          className={`text-3xl leading-none select-none transition-transform duration-200 ${
            isActive ? 'scale-110' : 'group-hover:scale-105'
          }`}
        >
          {visual.iconValue}
        </span>
      );
    }

    const iconClass = `w-7 h-7 sm:w-8 sm:h-8 shrink-0 transition-transform duration-200 ${
      isActive ? 'scale-105 text-white stroke-[2.2]' : 'text-slate-800 stroke-[1.9] group-hover:scale-105'
    }`;

    const rendered = renderCategoryIcon(visual, cat, iconClass);
    if (rendered) return rendered;

    return <UtensilsCrossed className={iconClass} />;
  };

  return (
    <section aria-label="Explore Categories" className="w-full pt-1 pb-3 mb-2 select-none">
      {/* Category Cards Carousel - Exact match to user reference image */}
      <div
        ref={scrollContainerRef}
        className="flex items-start gap-3.5 overflow-x-auto no-scrollbar py-2 px-1 scroll-smooth"
      >
        {/* 1. 'All' Category */}
        <button
          key="All"
          type="button"
          data-hero-category="All"
          onClick={(e) => handleTabClick('All', e)}
          className="flex flex-col items-center shrink-0 select-none group cursor-pointer active:scale-95 transition-transform"
          id="hero-cat-all"
        >
          <div
            className={`w-[68px] h-[68px] rounded-[22px] flex items-center justify-center relative transition-all duration-300 ${
              activeCategory === 'All'
                ? isDiwaliActive
                  ? 'bg-[#38104d] text-white shadow-[0_8px_20px_rgba(56,16,77,0.28)] ring-2 ring-[#38104d]/20 scale-100'
                  : 'bg-[#121927] text-white shadow-[0_8px_24px_rgba(18,25,39,0.3)] scale-100'
                : 'bg-white border border-slate-100/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Layers
              className={`w-7 h-7 shrink-0 transition-transform duration-200 ${
                activeCategory === 'All'
                  ? 'text-white stroke-[2.2]'
                  : 'text-slate-800 stroke-[1.9] group-hover:scale-105'
              }`}
            />
            {/* Top-right pill count badge */}
            <span
              className={`absolute -top-1.5 -right-1.5 text-[11px] font-mono px-2 py-0.5 rounded-full font-black ${
                activeCategory === 'All'
                  ? 'bg-[#f59e0b] text-slate-950 shadow-xs'
                  : 'bg-white text-slate-500 border border-slate-200/80 shadow-2xs'
              }`}
            >
              {categoryCounts['All'] || 0}
            </span>
          </div>

          {/* Label below: active is bold text, inactive provides balanced height */}
          <div className="flex flex-col items-center h-5 mt-1.5">
            {activeCategory === 'All' ? (
              <span className="font-heading font-extrabold text-xs text-slate-900 tracking-tight text-center">
                All
              </span>
            ) : (
              <span className="font-heading font-semibold text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                All
              </span>
            )}
          </div>
        </button>

        {/* 2. 'Liked' Category if any items liked */}
        {favoriteCount > 0 && (
          <button
            key="Liked"
            type="button"
            data-hero-category="Liked"
            onClick={(e) => handleTabClick('Liked', e)}
            className="flex flex-col items-center shrink-0 select-none group cursor-pointer active:scale-95 transition-transform"
            id="hero-cat-liked"
          >
            <div
              className={`w-[68px] h-[68px] rounded-[22px] flex items-center justify-center relative transition-all duration-300 ${
                activeCategory === 'Liked'
                  ? 'bg-rose-600 text-white shadow-[0_8px_24px_rgba(225,29,72,0.35)] scale-100'
                  : 'bg-white border border-slate-100/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-rose-600 hover:bg-rose-50/50'
              }`}
            >
              <Heart
                className={`w-7 h-7 shrink-0 transition-transform duration-200 ${
                  activeCategory === 'Liked'
                    ? 'fill-white text-white'
                    : 'fill-rose-500 text-rose-500 group-hover:scale-105'
                }`}
              />
              <span
                className={`absolute -top-1.5 -right-1.5 text-[11px] font-mono px-2 py-0.5 rounded-full font-black ${
                  activeCategory === 'Liked'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'bg-white text-slate-500 border border-slate-200/80 shadow-2xs'
                }`}
              >
                {favoriteCount}
              </span>
            </div>

            <div className="flex flex-col items-center h-5 mt-1.5">
              {activeCategory === 'Liked' ? (
                <span className="font-heading font-extrabold text-xs text-rose-600 tracking-tight text-center">
                  Liked
                </span>
              ) : (
                <span className="font-heading font-semibold text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Liked
                </span>
              )}
            </div>
          </button>
        )}

        {/* 3. All Menu Categories with Big Icons matching reference */}
        {nonAllCategories.map((cat) => {
          const isActive = activeCategory === cat;
          const count = categoryCounts[cat] || 0;

          return (
            <button
              key={cat}
              type="button"
              data-hero-category={cat}
              onClick={(e) => handleTabClick(cat, e)}
              className="flex flex-col items-center shrink-0 select-none group cursor-pointer active:scale-95 transition-transform"
              id={`hero-cat-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            >
              <div
                className={`w-[68px] h-[68px] rounded-[22px] flex items-center justify-center relative transition-all duration-300 ${
                  isActive
                    ? isDiwaliActive
                      ? 'bg-[#38104d] text-white shadow-[0_8px_20px_rgba(56,16,77,0.28)] ring-2 ring-[#38104d]/20 scale-100'
                      : 'bg-[#121927] text-white shadow-[0_8px_24px_rgba(18,25,39,0.3)] scale-100'
                    : 'bg-white border border-slate-100/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-slate-800 hover:bg-slate-50'
                }`}
              >
                {renderIcon(cat, isActive)}
                <span
                  className={`absolute -top-1.5 -right-1.5 text-[11px] font-mono px-2 py-0.5 rounded-full font-black ${
                    isActive
                      ? 'bg-[#f59e0b] text-slate-950 shadow-xs'
                      : 'bg-white text-slate-500 border border-slate-200/80 shadow-2xs'
                  }`}
                >
                  {count}
                </span>
              </div>

              <div className="flex flex-col items-center h-5 mt-1.5 max-w-[76px]">
                {isActive ? (
                  <span className="font-heading font-extrabold text-xs text-slate-900 tracking-tight truncate text-center">
                    {cat}
                  </span>
                ) : (
                  <span className="font-heading font-semibold text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                    {cat}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
