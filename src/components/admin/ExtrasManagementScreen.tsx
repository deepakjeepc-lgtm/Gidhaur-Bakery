import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  X,
  RotateCcw
} from 'lucide-react';
import { ProductExtra } from '../../types';
import {
  getCachedExtras,
  subscribeToExtras,
  addExtra,
  updateExtra,
  deleteExtra,
  saveExtras,
  DEFAULT_PRODUCT_EXTRAS
} from '../../services/extrasService';
import { triggerHaptic } from '../../utils/haptics';

interface ExtrasManagementScreenProps {
  onBack: () => void;
}

export const ExtrasManagementScreen: React.FC<ExtrasManagementScreenProps> = React.memo(({ onBack }) => {
  const [extras, setExtras] = useState<ProductExtra[]>(() => getCachedExtras());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<ProductExtra | null>(null);
  const [deletingExtra, setDeletingExtra] = useState<ProductExtra | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | string>(20);
  const [category, setCategory] = useState('Toppings');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToExtras((items) => {
      setExtras(items);
    });
    return () => unsub();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    extras.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [extras]);

  const filteredExtras = useMemo(() => {
    return extras.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [extras, searchQuery, selectedCategory]);

  const handleOpenAdd = () => {
    setName('');
    setPrice(20);
    setCategory('Toppings');
    setEditingExtra(null);
    setFormError(null);
    setIsFormModalOpen(true);
    triggerHaptic('light');
  };

  const handleOpenEdit = (extra: ProductExtra) => {
    setName(extra.name);
    setPrice(extra.price);
    setCategory(extra.category || 'Toppings');
    setEditingExtra(extra);
    setFormError(null);
    setIsFormModalOpen(true);
    triggerHaptic('light');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const numPrice = Number(price);

    if (!cleanName) {
      setFormError('Please enter an extra name.');
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      setFormError('Please enter a valid price.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingExtra) {
        await updateExtra(editingExtra.id, {
          name: cleanName,
          price: numPrice,
          category: category.trim() || 'General',
        });
        setFeedback(`✓ "${cleanName}" updated`);
      } else {
        await addExtra({
          name: cleanName,
          price: numPrice,
          category: category.trim() || 'General',
          available: true,
        });
        setFeedback(`✓ "${cleanName}" added`);
      }
      setIsFormModalOpen(false);
      setTimeout(() => setFeedback(null), 3000);
      triggerHaptic('medium');
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save extra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAvailability = async (extra: ProductExtra) => {
    triggerHaptic('selection');
    const nextStatus = extra.available === false ? true : false;
    await updateExtra(extra.id, { available: nextStatus });
  };

  const handleConfirmDelete = async () => {
    if (!deletingExtra) return;
    setIsSubmitting(true);
    try {
      await deleteExtra(deletingExtra.id);
      setFeedback(`✓ "${deletingExtra.name}" removed`);
      setDeletingExtra(null);
      setTimeout(() => setFeedback(null), 3000);
      triggerHaptic('medium');
    } catch (err: any) {
      setFeedback(`Error deleting: ${err?.message || 'Failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestoreDefaults = async () => {
    setShowRestoreModal(false);
    setIsSubmitting(true);
    try {
      await saveExtras(DEFAULT_PRODUCT_EXTRAS);
      setFeedback('✓ Restored default extras');
      setTimeout(() => setFeedback(null), 3000);
      triggerHaptic('medium');
    } catch (err: any) {
      setFeedback(`Error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3 bg-[#18181B] border border-[#27272A] rounded-md p-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#121212] hover:bg-[#242427] border border-[#27272A] hover:border-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF] cursor-pointer shrink-0"
            id="back-to-catalog-btn"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#A1A1AA]" />
            <span>BACK</span>
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="font-bold text-sm sm:text-base uppercase tracking-[-0.02em] text-[#FFFFFF] truncate">
              Extras &amp; Add-ons
            </h1>
            <span className="text-[11px] font-mono font-bold text-[#A1A1AA] bg-[#0A0A0A] border border-[#27272A] px-2 py-0.5 rounded-sm tabular-nums shrink-0 uppercase tracking-[0.06em]">
              {extras.length} ITEMS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <button
            type="button"
            onClick={() => setShowRestoreModal(true)}
            className="px-3 py-1.5 rounded-sm bg-[#121212] hover:bg-[#242427] border border-[#27272A] text-[#A1A1AA] hover:text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.06em] flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 rounded-sm bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.06em] flex items-center gap-1.5 cursor-pointer"
            id="add-extra-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Extra</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-sm bg-[#18181B] border border-[#10B981]/50 text-[#FFFFFF] text-xs font-mono font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="bg-[#18181B] rounded-md border border-[#27272A] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-sm text-[11px] uppercase tracking-[0.06em] shrink-0 cursor-pointer border ${
              selectedCategory === 'all'
                ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF] font-bold'
                : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:border-[#3F3F46]'
            }`}
          >
            ALL ({extras.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-sm text-[11px] uppercase tracking-[0.06em] shrink-0 cursor-pointer border ${
                selectedCategory === cat
                  ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF] font-bold'
                  : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:border-[#3F3F46]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0 font-mono">
          <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="FILTER EXTRAS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 rounded-sm bg-[#0A0A0A] border border-[#27272A] focus:border-[#FFFFFF] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#FFFFFF] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Extras Grid */}
      {filteredExtras.length === 0 ? (
        <div className="bg-[#18181B] p-12 text-center rounded-md border border-[#27272A] space-y-3 font-mono">
          <h3 className="font-bold text-sm uppercase tracking-[0.06em] text-[#FFFFFF]">
            No Extras Found
          </h3>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-sm bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-bold text-[11px] uppercase tracking-[0.06em] cursor-pointer"
          >
            + Create Extra
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredExtras.map((extra) => (
            <div
              key={extra.id}
              className={`bg-[#18181B] p-4 rounded-md border flex flex-col justify-between ${
                extra.available !== false
                  ? 'border-[#27272A] hover:border-[#3F3F46] hover:bg-[#242427]'
                  : 'border-[#27272A] bg-[#121212] opacity-60'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="inline-block text-[10px] font-mono font-bold text-[#A1A1AA] bg-[#0A0A0A] border border-[#27272A] px-1.5 py-0.5 rounded-sm uppercase tracking-[0.06em] mb-1">
                      {extra.category || 'TOPPING'}
                    </span>
                    <h3 className="font-bold text-sm text-[#FFFFFF] tracking-[-0.02em] truncate">
                      {extra.name}
                    </h3>
                  </div>

                  {/* Matte Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={extra.available !== false}
                    onClick={() => handleToggleAvailability(extra)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border p-0.5 focus:outline-hidden ${
                      extra.available !== false ? 'bg-[#10B981]/20 border-[#10B981]' : 'bg-[#0A0A0A] border-[#27272A]'
                    }`}
                    title={extra.available !== false ? 'Active' : 'Disabled'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full ${
                        extra.available !== false ? 'translate-x-4 bg-[#10B981]' : 'translate-x-0 bg-[#71717A]'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-baseline justify-between bg-[#0A0A0A] px-3 py-2 rounded-sm border border-[#27272A] font-mono">
                  <span className="font-bold text-base text-[#FFFFFF] tabular-nums">
                    +₹{extra.price}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#71717A]">
                    PER ITEM
                  </span>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-[#27272A] flex items-center justify-end gap-1.5 font-mono">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(extra)}
                  className="px-2 py-1 rounded-sm text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#0A0A0A] cursor-pointer"
                  title="Edit Extra"
                >
                  EDIT
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingExtra(extra)}
                  className="p-1 rounded-sm text-[#71717A] hover:text-[#EF4444] cursor-pointer"
                  title="Delete Extra"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Extra Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] max-w-sm w-full p-5 rounded-md border border-[#27272A] space-y-4">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <span className="text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
                {editingExtra ? 'EDIT EXTRA' : 'ADD EXTRA'}
              </span>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="text-[#71717A] hover:text-[#FFFFFF] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#EF4444] text-xs text-[#EF4444] font-mono font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.06em] mb-1">
                  EXTRA NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Extra Cheese, Extra Corn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] focus:border-[#FFFFFF] text-xs font-mono font-semibold text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.06em] mb-1">
                    PRICE (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="30"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] focus:border-[#FFFFFF] text-xs font-mono font-bold text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.06em] mb-1">
                    CATEGORY TAG
                  </label>
                  <input
                    type="text"
                    placeholder="Toppings"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] focus:border-[#FFFFFF] text-xs font-mono font-semibold text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap pt-1 font-mono">
                {['Toppings', 'Cheese & Dips', 'Seasoning', 'Dessert & Sweets', 'Party Accessories'].map(
                  (c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-1 rounded-sm border cursor-pointer ${
                        category === c
                          ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                          : 'bg-[#0A0A0A] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF]'
                      }`}
                    >
                      {c}
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#27272A] font-mono">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-sm bg-[#121212] border border-[#27272A] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] text-[11px] uppercase tracking-[0.06em] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-sm bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-bold text-[11px] uppercase tracking-[0.06em] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingExtra ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingExtra && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] rounded-md border border-[#27272A] max-w-sm w-full p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#EF4444] block">
                DELETE EXTRA
              </span>
              <h4 className="font-bold text-base text-[#FFFFFF] tracking-[-0.02em]">
                Delete "{deletingExtra.name}"?
              </h4>
            </div>
            <div className="flex items-center gap-2 pt-2 font-mono">
              <button
                type="button"
                onClick={() => setDeletingExtra(null)}
                className="flex-1 py-2 rounded-sm text-[11px] font-bold uppercase tracking-[0.06em] text-[#A1A1AA] hover:text-[#FFFFFF] bg-[#121212] border border-[#27272A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-sm text-[11px] font-bold uppercase tracking-[0.06em] text-[#FFFFFF] bg-[#EF4444] hover:bg-[#dc2626] cursor-pointer disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Default Extras Confirmation Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] rounded-md border border-[#27272A] max-w-sm w-full p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#A1A1AA] block">
                RESTORE DEFAULTS
              </span>
              <h4 className="font-bold text-base text-[#FFFFFF] tracking-[-0.02em]">
                Reset Default Extras?
              </h4>
            </div>
            <div className="flex items-center gap-2 pt-2 font-mono">
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                className="flex-1 py-2 rounded-sm text-[11px] font-bold uppercase tracking-[0.06em] text-[#A1A1AA] hover:text-[#FFFFFF] bg-[#121212] border border-[#27272A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleRestoreDefaults}
                className="flex-1 py-2 rounded-sm text-[11px] font-bold uppercase tracking-[0.06em] text-[#FFFFFF] bg-[#FF5500] hover:bg-[#e04b00] cursor-pointer disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ExtrasManagementScreen.displayName = 'ExtrasManagementScreen';
