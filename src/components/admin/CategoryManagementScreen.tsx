import React, { useState, useMemo, useRef, useEffect, memo, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  Smile,
  Loader2,
  Layers,
  LayoutTemplate,
  Pin,
  ChevronsUp,
  ArrowUp,
  ArrowDown,
  X
} from 'lucide-react';
import { Product } from '../../types';
import {
  DEFAULT_CATEGORIES,
  getCachedCategoryIcons,
  saveCategories,
  CategoryDetail,
  renameCategoryInProducts,
  getCachedDefaultLandingCategory,
  saveDefaultLandingCategory
} from '../../services/categoryService';
import { CategoryIconPicker } from './CategoryIconPicker';
import { renderCategoryIcon, CategoryVisual } from '../../utils/categoryIcons';

interface CategoryManagementScreenProps {
  categories: string[];
  products: Product[];
  iconsMap?: Record<string, CategoryDetail>;
  defaultLandingCategory?: string;
  onBack: () => void;
  onCategoriesChange?: (
    newCategories: string[],
    newIcons?: Record<string, CategoryDetail>,
    newDefaultLandingCat?: string
  ) => void;
}

// Memoized individual Category Row for butter-smooth 60fps reordering
interface CategoryRowProps {
  cat: string;
  index: number;
  totalCount: number;
  itemCount: number;
  isFirst: boolean;
  isEditing: boolean;
  visual?: CategoryVisual;
  editNameInput: string;
  onEditInputChange: (val: string) => void;
  onSaveRename: (index: number, cat: string) => void;
  onCancelRename: () => void;
  onStartEditing: (index: number, cat: string) => void;
  onMoveToFront: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onOpenIconPicker: (cat: string, index: number) => void;
  onInitDelete: (cat: string) => void;
}

const CategoryItemRow: React.FC<CategoryRowProps> = memo(({
  cat,
  index,
  totalCount,
  itemCount,
  isFirst,
  isEditing,
  visual,
  editNameInput,
  onEditInputChange,
  onSaveRename,
  onCancelRename,
  onStartEditing,
  onMoveToFront,
  onMoveUp,
  onMoveDown,
  onOpenIconPicker,
  onInitDelete
}) => {
  return (
    <div className="overflow-x-auto no-scrollbar rounded-2xl">
      <div
        className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex items-center justify-between gap-3 min-w-[390px] sm:min-w-0"
        style={{ contain: 'content' }}
      >
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={editNameInput}
              onChange={(e) => onEditInputChange(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveRename(index, cat);
                if (e.key === 'Escape') onCancelRename();
              }}
            />
            <button
              type="button"
              onClick={() => onSaveRename(index, cat)}
              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors cursor-pointer"
              title="Save Rename"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onCancelRename}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              {/* Position Badge */}
              <span
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xl text-[10px] sm:text-[11px] font-heading font-extrabold flex items-center justify-center shrink-0 ${
                  isFirst ? 'bg-amber-500 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 font-bold'
                }`}
                title={`Position #${index + 1} in Customer Category Dock`}
              >
                #{index + 1}
              </span>

              {/* Reorder Buttons: Move to Front (1st), Up, Down */}
              <div className="flex items-center gap-0.5 shrink-0 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => onMoveToFront(index)}
                  disabled={isFirst}
                  className="p-1 text-amber-600 hover:text-amber-800 disabled:opacity-20 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer flex items-center"
                  title="Move to Front (1st Position)"
                >
                  <ChevronsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveUp(index)}
                  disabled={isFirst}
                  className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-20 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                  title="Move 1 step earlier"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveDown(index)}
                  disabled={index === totalCount - 1}
                  className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-20 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                  title="Move 1 step later"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              {/* Category SVG / Emoji Icon */}
              <button
                type="button"
                onClick={() => onOpenIconPicker(cat, index)}
                className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 flex items-center justify-center text-slate-700 transition-all shrink-0 cursor-pointer shadow-2xs hover:scale-105"
                title={`Change SVG Icon or Emoji for "${cat}"`}
              >
                {renderCategoryIcon(visual, cat, 'w-4 h-4 text-slate-800')}
              </button>

              {/* Category Name: NEVER hidden or reduced to single letter! Full text visible with whitespace-nowrap */}
              <div className="flex items-center gap-1.5 shrink-0 min-w-[90px]">
                <span className="font-heading font-extrabold text-xs sm:text-sm text-slate-900 whitespace-nowrap">
                  {cat}
                </span>
                {isFirst && (
                  <span className="text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md shrink-0">
                    1st
                  </span>
                )}
              </div>
            </div>

            {/* Right Actions: Product count badge, Rename & Delete */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <span
                className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                  itemCount > 0
                    ? 'bg-slate-100 border-slate-200 text-slate-700'
                    : 'bg-slate-50 border-slate-200/70 text-slate-400'
                }`}
              >
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>

              <button
                type="button"
                onClick={() => onStartEditing(index, cat)}
                className="w-7 h-7 sm:w-8 sm:h-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="Rename category"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onInitDelete(cat)}
                className="w-7 h-7 sm:w-8 sm:h-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="Delete category"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export const CategoryManagementScreen: React.FC<CategoryManagementScreenProps> = memo(({
  categories: initialCategories,
  products,
  iconsMap: initialIconsMap,
  defaultLandingCategory: initialDefaultLandingCat,
  onBack,
  onCategoriesChange
}) => {
  // Memoized product count map
  const categoryCounts = useMemo(() => {
    return products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [products]);

  // Local state for categories with instant optimistic updates
  const [localCategories, setLocalCategories] = useState<string[]>(initialCategories);
  const [newCatInput, setNewCatInput] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Icon picker state
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [activeCategoryForIcon, setActiveCategoryForIcon] = useState<string | null>(null);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, CategoryDetail>>(() => {
    return initialIconsMap || getCachedCategoryIcons();
  });

  // Default Landing Screen Category state
  const [defaultLandingCat, setDefaultLandingCat] = useState<string>(() => {
    return initialDefaultLandingCat || getCachedDefaultLandingCategory();
  });
  const [isSavingLandingCat, setIsSavingLandingCat] = useState(false);

  // Delete modal state
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  // Keep localCategories in sync if external initialCategories changes
  useEffect(() => {
    setLocalCategories(initialCategories);
  }, [initialCategories]);

  // Debounced persistence helper for category reordering
  const saveDebounceRef = useRef<number | null>(null);

  const persistCategoryOrder = useCallback((catsToSave: string[], iconsToSave?: Record<string, CategoryDetail>) => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }
    saveDebounceRef.current = window.setTimeout(async () => {
      try {
        await saveCategories(catsToSave, iconsToSave || categoryIcons);
      } catch (err) {
        console.warn('Background category save note:', err);
      }
    }, 450);
  }, [categoryIcons]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, []);

  // Instant reorder: Move to front (1st position)
  const handleMoveToFront = useCallback((idx: number) => {
    if (idx === 0) return;
    setLocalCategories((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.unshift(item);
      onCategoriesChange?.(copy, categoryIcons, defaultLandingCat);
      persistCategoryOrder(copy);
      return copy;
    });
  }, [categoryIcons, defaultLandingCat, onCategoriesChange, persistCategoryOrder]);

  // Instant reorder: Move up 1 position
  const handleMoveUp = useCallback((idx: number) => {
    if (idx === 0) return;
    setLocalCategories((prev) => {
      const copy = [...prev];
      const temp = copy[idx - 1];
      copy[idx - 1] = copy[idx];
      copy[idx] = temp;
      onCategoriesChange?.(copy, categoryIcons, defaultLandingCat);
      persistCategoryOrder(copy);
      return copy;
    });
  }, [categoryIcons, defaultLandingCat, onCategoriesChange, persistCategoryOrder]);

  // Instant reorder: Move down 1 position
  const handleMoveDown = useCallback((idx: number) => {
    setLocalCategories((prev) => {
      if (idx >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[idx + 1];
      copy[idx + 1] = copy[idx];
      copy[idx] = temp;
      onCategoriesChange?.(copy, categoryIcons, defaultLandingCat);
      persistCategoryOrder(copy);
      return copy;
    });
  }, [categoryIcons, defaultLandingCat, onCategoriesChange, persistCategoryOrder]);

  // Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatInput.trim();
    if (!trimmed) return;

    if (localCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setFeedback(`"${trimmed}" already exists.`);
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    const updated = [...localCategories, trimmed];
    setLocalCategories(updated);
    setNewCatInput('');
    setIsSaving(true);
    setFeedback(`✓ "${trimmed}" added!`);

    try {
      await saveCategories(updated, categoryIcons);
      onCategoriesChange?.(updated, categoryIcons, defaultLandingCat);
    } catch (err: any) {
      setFeedback(`Error adding category: ${err?.message || 'failed'}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Start Editing
  const handleStartEditing = useCallback((idx: number, cat: string) => {
    setEditingIdx(idx);
    setEditingName(cat);
  }, []);

  const handleCancelRename = useCallback(() => {
    setEditingIdx(null);
    setEditingName('');
  }, []);

  // Save Rename
  const handleSaveRename = useCallback(async (idx: number, oldName: string) => {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingIdx(null);
      return;
    }

    if (
      localCategories.some(
        (c, i) => i !== idx && c.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setFeedback(`"${trimmed}" already exists.`);
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setIsSaving(true);
    const updated = [...localCategories];
    updated[idx] = trimmed;

    const updatedIcons = { ...categoryIcons };
    if (updatedIcons[oldName]) {
      updatedIcons[trimmed] = updatedIcons[oldName];
      delete updatedIcons[oldName];
      setCategoryIcons(updatedIcons);
    }

    let nextLanding = defaultLandingCat;
    if (defaultLandingCat === oldName) {
      nextLanding = trimmed;
      setDefaultLandingCat(trimmed);
      saveDefaultLandingCategory(trimmed).catch(() => {});
    }

    setLocalCategories(updated);
    setEditingIdx(null);

    try {
      await saveCategories(updated, updatedIcons);
      await renameCategoryInProducts(oldName, trimmed);
      onCategoriesChange?.(updated, updatedIcons, nextLanding);
      setFeedback(`✓ Renamed "${oldName}" to "${trimmed}" across menu!`);
    } catch (err: any) {
      setFeedback(`Error: ${err?.message || 'failed'}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  }, [categoryIcons, defaultLandingCat, editingName, localCategories, onCategoriesChange]);

  // Delete Category
  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;

    const updated = localCategories.filter((c) => c !== categoryToDelete);
    const updatedIcons = { ...categoryIcons };
    delete updatedIcons[categoryToDelete];

    let nextLanding = defaultLandingCat;
    if (defaultLandingCat === categoryToDelete) {
      nextLanding = updated[0] || 'Bakery';
      setDefaultLandingCat(nextLanding);
      saveDefaultLandingCategory(nextLanding).catch(() => {});
    }

    setLocalCategories(updated);
    setCategoryIcons(updatedIcons);
    setIsSaving(true);

    try {
      await saveCategories(updated, updatedIcons);
      onCategoriesChange?.(updated, updatedIcons, nextLanding);
      setFeedback(`✓ Deleted category "${categoryToDelete}"`);
    } catch (err: any) {
      setFeedback(`Error: ${err?.message || 'failed'}`);
    } finally {
      setIsSaving(false);
      setCategoryToDelete(null);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Reset to Defaults
  const handleResetToDefaults = async () => {
    if (
      !window.confirm(
        'Reset categories to the original restaurant defaults? Existing product assignments will remain intact.'
      )
    ) {
      return;
    }

    setIsSaving(true);
    setLocalCategories(DEFAULT_CATEGORIES);

    try {
      await saveCategories(DEFAULT_CATEGORIES, categoryIcons);
      onCategoriesChange?.(DEFAULT_CATEGORIES, categoryIcons, defaultLandingCat);
      setFeedback('✓ Restored default category catalog!');
    } catch (err: any) {
      setFeedback(`Error resetting: ${err?.message || 'failed'}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Open Icon Picker
  const handleOpenIconPicker = useCallback((cat: string) => {
    setActiveCategoryForIcon(cat);
    setIsIconPickerOpen(true);
  }, []);

  // Save selected icon
  const handleSaveIcon = (visual: CategoryVisual) => {
    if (!activeCategoryForIcon) return;

    const updatedIcons: Record<string, CategoryDetail> = {
      ...categoryIcons,
      [activeCategoryForIcon]: {
        name: activeCategoryForIcon,
        iconType: visual.iconType,
        iconValue: visual.iconValue,
      },
    };
    setCategoryIcons(updatedIcons);
    setIsIconPickerOpen(false);

    saveCategories(localCategories, updatedIcons).catch(() => {});
    onCategoriesChange?.(localCategories, updatedIcons, defaultLandingCat);

    setFeedback(`✓ Updated icon for "${activeCategoryForIcon}"!`);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Save Default Landing Category
  const handleSelectDefaultLanding = async (newLandingCat: string) => {
    setDefaultLandingCat(newLandingCat);
    setIsSavingLandingCat(true);

    try {
      await saveDefaultLandingCategory(newLandingCat);
      onCategoriesChange?.(localCategories, categoryIcons, newLandingCat);
      setFeedback(`✓ Default customer landing set to "${newLandingCat}"!`);
    } catch (err: any) {
      setFeedback(`Error saving default category: ${err?.message || 'failed'}`);
    } finally {
      setIsSavingLandingCat(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="space-y-5 pb-12 animate-fadeIn">
      {/* Top Header Bar with Menu-Style Back Button */}
      <div className="bg-white/90 backdrop-blur-md sticky top-0 z-30 -mx-3 sm:mx-0 px-3 sm:px-0 py-2.5 sm:py-3 border-b border-slate-200/80 mb-2">
        <div className="flex items-center justify-between gap-2.5 sm:gap-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-full text-xs sm:text-[13px] font-bold text-slate-700 transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
              id="category-screen-back-btn"
              title="Back to Catalog"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span>Back</span>
            </button>

            <div className="min-w-0">
              <h2 className="font-heading font-extrabold text-sm sm:text-lg text-slate-900 tracking-tight leading-tight truncate">
                <span className="sm:hidden">Categories ({localCategories.length})</span>
                <span className="hidden sm:inline">Manage Categories & Order ({localCategories.length})</span>
              </h2>
            </div>
          </div>

          {isSaving && (
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-100 text-slate-700 text-[11px] sm:text-xs font-bold shrink-0">
              <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
              <span className="hidden xs:inline">Syncing...</span>
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3 sm:p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2 max-w-4xl mx-auto shadow-2xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{feedback}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-3.5 sm:space-y-4">
        {/* CARD 1: Create New Category Box (Sleek unified input with inside button & no extra subtitles) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 border border-slate-200/90 shadow-2xs">
          <form onSubmit={handleAddCategory} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80 focus-within:border-slate-900 focus-within:bg-white transition-all">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Plus className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Create new category (e.g. Burgers, Beverages, Rolls...)"
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              className="flex-1 bg-transparent px-2 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none truncate min-w-0"
            />
            <button
              type="submit"
              disabled={!newCatInput.trim() || isSaving}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
            >
              <span>Add</span>
            </button>
          </form>
        </div>

        {/* CARD 2: Default Landing Category Selector (Clean, compact, no overflowing subtitles) */}
        <div className="bg-gradient-to-r from-amber-50/70 via-orange-50/50 to-amber-50/70 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-amber-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <LayoutTemplate className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="font-heading font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                Default Customer Landing Tab
              </h4>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-200/80 text-amber-950 uppercase tracking-wide shrink-0">
                Home
              </span>
            </div>
          </div>

          <select
            value={defaultLandingCat}
            onChange={(e) => handleSelectDefaultLanding(e.target.value)}
            disabled={isSavingLandingCat}
            className="w-full sm:w-56 px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-2xs cursor-pointer shrink-0"
          >
            <option value="All">
              All ({categoryCounts['All'] || products.length} items)
            </option>
            {localCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({categoryCounts[cat] || 0} items)
              </option>
            ))}
          </select>
        </div>

        {/* CARD 3: Menu Category List (Clean title without subtitles) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-heading font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                Menu Category
              </h3>
            </div>
            <span className="text-xs font-extrabold text-slate-700 px-2.5 py-0.5 bg-slate-100 rounded-full shrink-0">
              {localCategories.length} Categories
            </span>
          </div>

          <div className="space-y-2.5">
            {localCategories.map((cat, idx) => (
              <CategoryItemRow
                key={cat}
                cat={cat}
                index={idx}
                totalCount={localCategories.length}
                itemCount={categoryCounts[cat] || 0}
                isFirst={idx === 0}
                isEditing={editingIdx === idx}
                visual={categoryIcons[cat]}
                editNameInput={editingName}
                onEditInputChange={setEditingName}
                onSaveRename={handleSaveRename}
                onCancelRename={handleCancelRename}
                onStartEditing={handleStartEditing}
                onMoveToFront={handleMoveToFront}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onOpenIconPicker={handleOpenIconPicker}
                onInitDelete={setCategoryToDelete}
              />
            ))}
          </div>

          {/* Reset to Default Categories Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Need to restore initial categories?
            </span>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="px-3.5 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-slate-900 text-lg">
                Delete "{categoryToDelete}"?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {categoryCounts[categoryToDelete]
                  ? `Warning: ${categoryCounts[categoryToDelete]} products currently belong to this category.`
                  : 'This category will be permanently removed from your customer category bar.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Icon Picker Modal */}
      {isIconPickerOpen && activeCategoryForIcon && (
        <CategoryIconPicker
          categoryName={activeCategoryForIcon}
          currentVisual={categoryIcons[activeCategoryForIcon]}
          onClose={() => setIsIconPickerOpen(false)}
          onSelect={handleSaveIcon}
        />
      )}
    </div>
  );
});
