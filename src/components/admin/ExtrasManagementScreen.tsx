import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  Power,
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

export const ExtrasManagementScreen: React.FC<ExtrasManagementScreenProps> = ({ onBack }) => {
  const [extras, setExtras] = useState<ProductExtra[]>(() => getCachedExtras());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<ProductExtra | null>(null);
  const [deletingExtra, setDeletingExtra] = useState<ProductExtra | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  // Form fields
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
      setFormError('Please enter an extra name (e.g. Extra Cheese).');
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      setFormError('Please enter a valid price (₹0 or higher).');
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
        setFeedback(`✓ "${cleanName}" updated successfully!`);
      } else {
        await addExtra({
          name: cleanName,
          price: numPrice,
          category: category.trim() || 'General',
          available: true,
        });
        setFeedback(`✓ "${cleanName}" added to extras catalog!`);
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
      setFeedback(`🗑️ "${deletingExtra.name}" removed from library`);
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
      setFeedback('✓ Restored default extras & add-ons!');
      setTimeout(() => setFeedback(null), 3000);
      triggerHaptic('medium');
    } catch (err: any) {
      setFeedback(`Error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Top Header Bar */}
      <div className="bg-white/95 backdrop-blur-md sticky top-0 z-20 py-3 border-b border-slate-200/80 -mx-3 sm:mx-0 px-3 sm:px-0 mb-4">
        <div className="flex items-center justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-700 transition-all shadow-2xs active:scale-95 cursor-pointer"
              id="back-to-catalog-btn"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Back to Menu</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h1 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight leading-tight">
                  Extras & Add-ons Library ({extras.length})
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              id="add-extra-btn"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Extra</span>
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="max-w-6xl mx-auto p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Search & Category Filter Bar */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search extras (e.g. Cheese, Corn, Spicy)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({extras.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Direct Boxes / Cards Grid (No dropdowns!) */}
        {filteredExtras.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-base text-slate-800">
              No extras found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add toppings, sauces, cheese, dips, and spice extras so you can attach them to your menu items.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-slate-950 text-white font-bold text-xs rounded-full shadow-xs cursor-pointer"
            >
              + Create First Extra
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {filteredExtras.map((extra) => (
              <div
                key={extra.id}
                className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between shadow-2xs hover:shadow-xs hover:border-slate-300 ${
                  extra.available !== false
                    ? 'border-slate-200/90'
                    : 'border-slate-200 bg-slate-50/60 opacity-60'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80 uppercase tracking-wider inline-block mb-1">
                        {extra.category || 'Topping'}
                      </span>
                      <h3 className="font-heading font-extrabold text-sm text-slate-950 truncate leading-snug">
                        {extra.name}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(extra)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                        extra.available !== false
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Toggle active status"
                    >
                      <Power className="w-2.5 h-2.5" />
                      <span>{extra.available !== false ? 'Active' : 'Off'}</span>
                    </button>
                  </div>

                  {/* Price Box */}
                  <div className="flex items-baseline gap-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-400">+₹</span>
                    <span className="font-heading font-black text-lg text-slate-950">
                      {extra.price}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 ml-auto">
                      per item
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(extra)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Edit Extra"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingExtra(extra)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Extra"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Restore Defaults Footer Shortcut */}
        <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Need default bakery toppings and sauces?
          </span>
          <button
            type="button"
            onClick={() => setShowRestoreModal(true)}
            className="px-3.5 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default Extras</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Extra Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-slate-900">
                  {editingExtra ? 'Edit Extra' : 'Add New Extra'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Extra Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Extra Cheese, Extra Corn, Extra Spicy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Additional Price (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="30"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category Tag
                  </label>
                  <input
                    type="text"
                    placeholder="Toppings / Dips"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Quick Preset Categories */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {['Toppings', 'Cheese & Dips', 'Seasoning', 'Dessert & Sweets', 'Party Accessories'].map(
                  (c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                        category === c
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {c}
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingExtra ? 'Save Changes' : 'Create Extra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Zero window.confirm) */}
      {deletingExtra && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-heading font-extrabold text-base text-slate-900">
                Delete "{deletingExtra.name}"?
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to remove this extra option (+₹{deletingExtra.price}) from the library?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingExtra(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                Delete Extra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Default Extras Confirmation Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-heading font-extrabold text-base text-slate-900">
                Reset Default Extras?
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will restore the standard set of toppings, cheese, seasonings, and accessories (Extra Cheese, Corn, Spicy, Paneer, Dips, etc.).
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleRestoreDefaults}
                className="flex-1 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                Reset Extras
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
