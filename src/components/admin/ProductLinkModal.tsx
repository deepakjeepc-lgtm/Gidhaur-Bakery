import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Link2,
  Unlink,
  Search,
  Check,
  Sparkles,
  AlertCircle,
  Loader2,
  Layers,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Product } from '../../types';

interface ProductLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetProduct: Product | null;
  allProducts: Product[];
  onProductsUpdated: (updatedProducts: Product[]) => void;
}

export const ProductLinkModal: React.FC<ProductLinkModalProps> = ({
  isOpen,
  onClose,
  targetProduct,
  allProducts,
  onProductsUpdated
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [groupLabel, setGroupLabel] = useState('Flavors & Varieties');
  const [labelsMap, setLabelsMap] = useState<Record<string, string>>({});
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Initialize selected products when targetProduct changes
  useEffect(() => {
    if (!targetProduct) return;

    setStatusMessage(null);
    setSearchQuery('');

    // Pre-fill group label
    setGroupLabel(targetProduct.groupName || 'Flavors & Varieties');

    // If target product already belongs to a groupId, find all sibling products in that group
    if (targetProduct.groupId) {
      const siblings = allProducts.filter((p) => p.groupId === targetProduct.groupId);
      const siblingIds = new Set(siblings.map((p) => p.id));
      setSelectedProductIds(siblingIds);

      const initialLabels: Record<string, string> = {};
      siblings.forEach((p) => {
        initialLabels[p.id] = p.selectedColorName || extractShortLabel(p.name, targetProduct.name);
      });
      setLabelsMap(initialLabels);
    } else {
      // New group with just targetProduct
      setSelectedProductIds(new Set([targetProduct.id]));
      setLabelsMap({
        [targetProduct.id]: targetProduct.selectedColorName || extractShortLabel(targetProduct.name, '')
      });
    }

    // Default category filter to target product's category
    setSelectedCategory(targetProduct.category || 'all');
  }, [targetProduct, allProducts, isOpen]);

  // Helper to extract a short distinguishing label (e.g. "Grape" from "Fanta Grape")
  function extractShortLabel(fullName: string, baseName: string): string {
    const cleanFull = fullName.trim();
    if (!cleanFull) return '';

    // Check if ends with parenthesis: "Fanta (Grape)"
    const parenMatch = cleanFull.match(/\((.*?)\)/);
    if (parenMatch && parenMatch[1]) return parenMatch[1].trim();

    // Check if starts with common words
    const words = cleanFull.split(/\s+/);
    if (words.length > 1) {
      // If starts with "Fanta", return the second word
      return words.slice(1).join(' ');
    }
    return cleanFull;
  }

  // Categories list for filter pills
  const categoriesList = useMemo(() => {
    const cats = Array.from(new Set(allProducts.map((p) => p.category).filter(Boolean)));
    return ['all', ...cats];
  }, [allProducts]);

  // Filtered candidate products
  const candidateProducts = useMemo(() => {
    return allProducts.filter((p) => {
      // Exclude current target from candidate search list (it's always part of the group)
      if (p.id === targetProduct?.id) return false;

      // Category filter
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          String(p.price).includes(q)
        );
      }

      return true;
    });
  }, [allProducts, targetProduct?.id, selectedCategory, searchQuery]);

  if (!isOpen || !targetProduct) return null;

  const toggleProductSelect = (id: string, name: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Autofill smart label if empty
        if (!labelsMap[id]) {
          setLabelsMap((l) => ({
            ...l,
            [id]: extractShortLabel(name, targetProduct.name)
          }));
        }
      }
      return next;
    });
  };

  const handleLabelChange = (id: string, val: string) => {
    setLabelsMap((prev) => ({
      ...prev,
      [id]: val
    }));
  };

  // Quick preset labels
  const handleApplyPresetGroupLabel = (preset: string) => {
    setGroupLabel(preset);
  };

  // Save linking to Firestore & Local Cache
  const handleSaveLinking = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const targetGroupId = targetProduct.groupId || `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const cleanLabel = groupLabel.trim() || 'Flavors & Varieties';
      const batch = writeBatch(db);

      // 1. Gather all products that SHOULD be in this group
      const currentGroupMemberIds = Array.from(selectedProductIds);

      // 2. Also check if any products were PREVIOUSLY in this group and were now UNCHECKED
      const previouslyInGroup = allProducts.filter(
        (p) => p.groupId === targetProduct.groupId && !selectedProductIds.has(p.id)
      );

      // Update Firestore: Add groupId to all selected products
      for (const id of currentGroupMemberIds) {
        const prodRef = doc(db, 'products', id);
        const shortName = (labelsMap[id] || '').trim();
        batch.set(
          prodRef,
          {
            groupId: targetGroupId,
            groupName: cleanLabel,
            selectedColorName: shortName || undefined,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      // Update Firestore: Clear groupId from unselected products
      for (const p of previouslyInGroup) {
        const prodRef = doc(db, 'products', p.id);
        batch.set(
          prodRef,
          {
            groupId: null as any,
            groupName: null as any,
            selectedColorName: null as any,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();

      // 3. Update local products cache optimistically
      const updatedAll = allProducts.map((p) => {
        if (currentGroupMemberIds.includes(p.id)) {
          return {
            ...p,
            groupId: targetGroupId,
            groupName: cleanLabel,
            selectedColorName: (labelsMap[p.id] || '').trim() || p.selectedColorName
          };
        }
        if (previouslyInGroup.some((prev) => prev.id === p.id)) {
          const clone = { ...p };
          delete clone.groupId;
          delete clone.groupName;
          delete clone.selectedColorName;
          return clone;
        }
        return p;
      });

      localStorage.setItem('swadeep_cached_products', JSON.stringify(updatedAll));
      window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: updatedAll }));
      onProductsUpdated(updatedAll);

      setStatusMessage({
        type: 'success',
        text: `✓ Successfully linked ${currentGroupMemberIds.length} items as "${cleanLabel}"!`
      });

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Error saving linked variations:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to link: ${err?.message || 'Database error'}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Completely unlink target product from any group
  const handleUnlinkTarget = async () => {
    if (!targetProduct.groupId) return;

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const prodRef = doc(db, 'products', targetProduct.id);
      const batch = writeBatch(db);
      batch.set(
        prodRef,
        {
          groupId: null as any,
          groupName: null as any,
          selectedColorName: null as any,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      await batch.commit();

      const updatedAll = allProducts.map((p) => {
        if (p.id === targetProduct.id) {
          const clone = { ...p };
          delete clone.groupId;
          delete clone.groupName;
          delete clone.selectedColorName;
          return clone;
        }
        return p;
      });

      localStorage.setItem('swadeep_cached_products', JSON.stringify(updatedAll));
      window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: updatedAll }));
      onProductsUpdated(updatedAll);

      setStatusMessage({
        type: 'success',
        text: `✓ Unlinked "${targetProduct.name}" from variation group.`
      });

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Error unlinking: ${err?.message || 'Failed'}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currentlyLinkedCount = selectedProductIds.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 animate-fadeIn">
      <div
        className="relative bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200/90 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Link2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 tracking-tight leading-tight truncate">
                Link Variations & Flavors
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate">
                Connect related products (Flavors, Numbers, Colors) to show together on one screen.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 overscroll-contain">
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 font-semibold ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Current Target Product Summary Card */}
          <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-slate-200/80 shrink-0 shadow-2xs">
                {targetProduct.imageUrl ? (
                  <img
                    src={targetProduct.imageUrl}
                    alt={targetProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-400">
                    No img
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                    Base Product
                  </span>
                  <span className="text-xs font-extrabold text-slate-900">
                    ₹{targetProduct.price}
                  </span>
                </div>
                <h4 className="font-heading font-extrabold text-sm text-slate-900 truncate mt-0.5">
                  {targetProduct.name}
                </h4>
              </div>
            </div>

            {targetProduct.groupId && (
              <button
                type="button"
                onClick={handleUnlinkTarget}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                title="Unlink this product from its current group"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Unlink</span>
              </button>
            )}
          </div>

          {/* Configuration: Group Label & Preset Buttons */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>Selector Title on Customer Screen:</span>
              </label>

              {/* Quick Presets */}
              <div className="flex items-center gap-1 flex-wrap">
                {['Flavors & Varieties', 'Colors / Styles', 'Number Digits', 'Sizes & Options'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleApplyPresetGroupLabel(preset)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                      groupLabel === preset
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              placeholder="e.g. Choose Flavor, Available Colors, Select Number..."
              className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          {/* Candidate Products Selection Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-extrabold text-slate-900">
                Select Products to Link ({currentlyLinkedCount} linked):
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Tap checkbox to add or remove
              </span>
            </div>

            {/* Filter Bar: Search + Category Pills */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full sm:flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products to link (e.g. Fanta, Balloon, Red Bull)..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto no-scrollbar py-0.5">
                {categoriesList.slice(0, 5).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold shrink-0 transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'all' ? 'All Cats' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Candidate Product List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {/* Always show current target product item pinned at top */}
              <div className="p-3 bg-indigo-50/70 border-2 border-indigo-500 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0">
                    {targetProduct.imageUrl && (
                      <img
                        src={targetProduct.imageUrl}
                        alt={targetProduct.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="font-heading font-bold text-xs text-slate-900 truncate block">
                      {targetProduct.name}
                    </span>
                    <span className="text-[10px] text-indigo-700 font-extrabold">
                      ₹{targetProduct.price} • Current Item
                    </span>
                  </div>
                </div>

                <div className="w-32 sm:w-40">
                  <input
                    type="text"
                    value={labelsMap[targetProduct.id] || ''}
                    onChange={(e) => handleLabelChange(targetProduct.id, e.target.value)}
                    placeholder="Label (e.g. Strawberry)"
                    className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-indigo-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    title="Short label for customer thumbnails"
                  />
                </div>
              </div>

              {/* Sibling candidates */}
              {candidateProducts.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-400">
                  No other products found matching your search. Try changing the category filter or search query.
                </div>
              ) : (
                candidateProducts.map((p) => {
                  const isChecked = selectedProductIds.has(p.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleProductSelect(p.id, p.name)}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-50/40 border-indigo-400 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200/90'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by row onClick
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                        />

                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover bg-white"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                              No pic
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="font-heading font-bold text-xs text-slate-900 truncate block">
                            {p.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            ₹{p.price} • {p.category}
                          </span>
                        </div>
                      </div>

                      {/* Short Label input */}
                      {isChecked && (
                        <div
                          className="w-32 sm:w-40 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={labelsMap[p.id] || ''}
                            onChange={(e) => handleLabelChange(p.id, e.target.value)}
                            placeholder="Label (e.g. Grape)"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            title="Short label shown under thumbnail in customer modal"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveLinking}
            disabled={isSaving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer active:scale-95"
            id="save-product-link-btn"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Links...</span>
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 stroke-[2.5]" />
                <span>Save & Link ({currentlyLinkedCount} Items)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
