import React, { useRef } from 'react';
import { Heart, Layers } from 'lucide-react';
import { CategoryDetail } from '../services/categoryService';
import { renderCategoryIcon } from '../utils/categoryIcons';
import { triggerHaptic } from '../utils/haptics';

interface CategoryFilterProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  categoryCounts: Record<string, number>;
  favoriteCount?: number;
  iconsMap?: Record<string, CategoryDetail>;
  isDiwaliActive?: boolean;
  activeColor?: string;
  inactiveColor?: string;
}

const CategoryFilterComponent: React.FC<CategoryFilterProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
  categoryCounts: _categoryCounts,
  favoriteCount = 0,
  iconsMap = {},
  isDiwaliActive: _isDiwaliActive = false,
  activeColor,
  inactiveColor,
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

  const defaultActiveColor = activeColor || 'var(--category-active-color, #0f172a)';
  const defaultInactiveColor = inactiveColor || 'var(--category-inactive-color, #64748b)';

  return (
    <nav
      aria-label="Categories"
      className="w-full box-border select-none"
    >
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar py-1 px-2.5 sm:px-3 w-full max-w-full scroll-smooth"
      >
        {/* 1. 'All' Category (Large SVG Icon on Top, Bold Name Below, No bottom indicator to prevent dead space) */}
        <button
          key="All"
          type="button"
          onClick={(e) => handleTabClick('All', e)}
          className="flex flex-col items-center justify-center gap-1 min-w-[56px] sm:min-w-[64px] cursor-pointer group shrink-0 active:scale-95 transition-all focus:outline-none"
          id="cat-btn-all"
        >
          <div style={{ color: activeCategory === 'All' ? defaultActiveColor : defaultInactiveColor }}>
            <Layers
              className={`w-7 h-7 sm:w-8 sm:h-8 transition-all duration-200 ${
                activeCategory === 'All'
                  ? 'stroke-[2] scale-105 opacity-100'
                  : 'stroke-[1.6] opacity-75 group-hover:opacity-100'
              }`}
            />
          </div>
          <span
            style={{ color: activeCategory === 'All' ? defaultActiveColor : defaultInactiveColor }}
            className={`font-heading tracking-tight text-xs transition-all duration-200 ${
              activeCategory === 'All'
                ? 'font-extrabold opacity-100'
                : 'font-bold opacity-75 group-hover:opacity-100'
            }`}
          >
            All
          </span>
        </button>

        {/* 2. 'Liked' Category (Only if items are favorited) */}
        {favoriteCount > 0 && (
          <button
            key="Liked"
            type="button"
            onClick={(e) => handleTabClick('Liked', e)}
            className="flex flex-col items-center justify-center gap-1 min-w-[56px] sm:min-w-[64px] cursor-pointer group shrink-0 active:scale-95 transition-all focus:outline-none"
            id="cat-btn-liked"
          >
            <Heart
              className={`w-7 h-7 sm:w-8 sm:h-8 transition-all duration-200 ${
                activeCategory === 'Liked'
                  ? 'text-rose-600 fill-rose-600 stroke-[2] scale-105 opacity-100'
                  : 'text-slate-500 group-hover:text-rose-500 stroke-[1.6] opacity-75 group-hover:opacity-100'
              }`}
            />
            <span
              className={`font-heading tracking-tight text-xs transition-all duration-200 ${
                activeCategory === 'Liked'
                  ? 'font-extrabold text-rose-600 opacity-100'
                  : 'font-bold text-slate-700 opacity-75 group-hover:opacity-100'
              }`}
            >
              Liked
            </span>
          </button>
        )}

        {/* 3. Product Categories (Donuts, Burger, PanCake, Pizza, Cakes, etc.) */}
        {nonAllCategories.map((cat) => {
          const isActive = activeCategory === cat;
          const iconVisual = iconsMap[cat];

          return (
            <button
              key={cat}
              type="button"
              onClick={(e) => handleTabClick(cat, e)}
              className="flex flex-col items-center justify-center gap-1 min-w-[56px] sm:min-w-[64px] cursor-pointer group shrink-0 active:scale-95 transition-all focus:outline-none"
              id={`cat-btn-${cat.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div style={{ color: isActive ? defaultActiveColor : defaultInactiveColor }}>
                {renderCategoryIcon(
                  iconVisual,
                  cat,
                  `w-7 h-7 sm:w-8 sm:h-8 transition-all duration-200 ${
                    isActive
                      ? 'stroke-[2] scale-105 opacity-100'
                      : 'stroke-[1.6] opacity-75 group-hover:opacity-100'
                  }`
                )}
              </div>
              <span
                style={{ color: isActive ? defaultActiveColor : defaultInactiveColor }}
                className={`font-heading tracking-tight text-xs transition-all duration-200 ${
                  isActive
                    ? 'font-extrabold opacity-100'
                    : 'font-bold opacity-75 group-hover:opacity-100'
                }`}
              >
                {cat}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export const CategoryFilter = React.memo(CategoryFilterComponent);
