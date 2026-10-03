import React, { useState, useMemo, memo } from 'react';
import {
  ArrowLeft,
  Search,
  Check,
  Plus,
  Trash2,
  Layers,
  Save,
  Tag,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Product } from '../../types';
import {
  saveProductGroup,
  unlinkEntireGroup
} from '../../services/productService';

interface ProductLinkGroupScreenProps {
  product?: Product | null;
  allProducts: Product[];
  onBack: () => void;
  onSuccess: (message: string) => void;
}

export const ProductLinkGroupScreen: React.FC<ProductLinkGroupScreenProps> = memo(({
  product,
  allProducts,
  onBack,
  onSuccess
}) => {
  // 1. Discover all existing groups across catalog
  const existingGroups = useMemo(() => {
    const map = new Map<string, { groupId: string; groupName: string; count: number; items: Product[] }>();
    for (const p of allProducts) {
      if (p.groupId) {
        const item = map.get(p.groupId) || {
          groupId: p.groupId,
          groupName: p.groupName || 'Variant Group',
          count: 0,
          items: []
        };
        item.count += 1;
        item.items.push(p);
        map.set(p.groupId, item);
      }
    }
    return Array.from(map.values());
  }, [allProducts]);

  // Determine initial group:
  const initialGroupId = useMemo(() => {
    if (product?.groupId) {
      return product.groupId;
    }
    return 'new';
  }, [product]);

  const [activeGroupId, setActiveGroupId] = useState<string>(initialGroupId);

  // Group name state
  const [groupNameInput, setGroupNameInput] = useState<string>(() => {
    if (product?.groupId && product?.groupName) {
      return product.groupName;
    }
    if (product && !product.groupId) {
      const baseName = product.name.replace(/\s*\d+.*$/, '').trim();
      return baseName ? `${baseName} Collection` : `${product.name} Options`;
    }
    return '';
  });

  // Selected product IDs in this group
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    if (product?.groupId) {
      return allProducts.filter((p) => p.groupId === product.groupId).map((p) => p.id);
    }
    if (product) {
      return [product.id];
    }
    return [];
  });

  // Track original products in this group so we know what to unlink if removed
  const [originalProductIds, setOriginalProductIds] = useState<string[]>(() => {
    if (product?.groupId) {
      return allProducts.filter((p) => p.groupId === product.groupId).map((p) => p.id);
    }
    return [];
  });

  // Custom labels for each product in the group
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (product?.groupId) {
      allProducts
        .filter((p) => p.groupId === product.groupId)
        .forEach((p) => {
          if (p.groupVariantLabel) {
            map[p.id] = p.groupVariantLabel;
          }
        });
    } else if (product?.groupVariantLabel) {
      map[product.id] = product.groupVariantLabel;
    }
    return map;
  });

  // Inline delete confirm state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Switch between existing groups or create new
  const handleSelectGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    setIsConfirmingDelete(false);
    setStatusMessage(null);

    if (groupId === 'new') {
      setGroupNameInput('');
      setSelectedProductIds(product && !product.groupId ? [product.id] : []);
      setOriginalProductIds([]);
      setCustomLabels({});
    } else {
      const matched = existingGroups.find((g) => g.groupId === groupId);
      if (matched) {
        setGroupNameInput(matched.groupName);
        const ids = matched.items.map((p) => p.id);
        setSelectedProductIds(ids);
        setOriginalProductIds(ids);
        const labels: Record<string, string> = {};
        matched.items.forEach((p) => {
          if (p.groupVariantLabel) {
            labels[p.id] = p.groupVariantLabel;
          }
        });
        setCustomLabels(labels);
      }
    }
  };

  // Search & category filter for catalog items
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProducts) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set);
  }, [allProducts]);

  // Catalog products for adding/removing
  const filteredCatalog = useMemo(() => {
    return allProducts.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.groupName && p.groupName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [allProducts, selectedCategory, searchQuery]);

  // Products currently in the group
  const includedProducts = useMemo(() => {
    const idSet = new Set(selectedProductIds);
    return allProducts.filter((p) => idSet.has(p.id));
  }, [allProducts, selectedProductIds]);

  // Toggle a product in/out of the group
  const handleToggleProduct = (targetProd: Product) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(targetProd.id)) {
        return prev.filter((id) => id !== targetProd.id);
      } else {
        return [...prev, targetProd.id];
      }
    });
  };

  // Label change for a product
  const handleLabelChange = (productId: string, val: string) => {
    setCustomLabels((prev) => ({
      ...prev,
      [productId]: val
    }));
  };

  // Save the entire group to Firestore
  const handleSaveGroup = async () => {
    const cleanName = groupNameInput.trim();
    if (!cleanName) {
      setStatusMessage('⚠️ Please enter a group name (e.g. "Red Bull Flavours" or "Foil Balloons 0-9")');
      return;
    }

    if (selectedProductIds.length === 0) {
      setStatusMessage('⚠️ Please select at least 1 product to include in this group.');
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const finalGroupId = activeGroupId === 'new' ? `group_${Date.now()}` : activeGroupId;

      await saveProductGroup({
        groupId: finalGroupId,
        groupName: cleanName,
        productIds: selectedProductIds,
        itemLabels: customLabels,
        previousProductIds: originalProductIds
      });

      onSuccess(`✅ Group "${cleanName}" saved with ${selectedProductIds.length} linked products!`);
    } catch (err: any) {
      console.error('Error saving product group:', err);
      setStatusMessage(`❌ Error saving group: ${err?.message || 'Please try again'}`);
      setIsSaving(false);
    }
  };

  // Dissolve/delete entire group - pure inline without window.confirm
  const handleDissolveGroup = async () => {
    if (activeGroupId === 'new') return;

    setIsSaving(true);
    setStatusMessage(null);

    try {
      await unlinkEntireGroup(activeGroupId, allProducts);
      onSuccess(`✅ Group "${groupNameInput}" has been unlinked and dissolved successfully.`);
    } catch (err: any) {
      console.error('Error dissolving group:', err);
      setStatusMessage(`❌ Failed to delete group: ${err?.message || 'Please try again'}`);
      setIsSaving(false);
      setIsConfirmingDelete(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Return to Menu Catalog"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading font-extrabold text-lg sm:text-2xl text-slate-950 truncate">
              Link & Group Products
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              Group related products together to let customers switch options seamlessly.
            </p>
          </div>
        </div>

        {/* Action Buttons on Tablet & Desktop (Hidden on mobile to eliminate double buttons) */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onBack}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveGroup}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSaving
                ? 'Saving...'
                : `Save Group (${selectedProductIds.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Group Switcher Tabs */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-xs flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => handleSelectGroup('new')}
          className={`px-3.5 py-2 rounded-xl text-xs font-heading font-bold shrink-0 transition-all flex items-center gap-2 cursor-pointer ${
            activeGroupId === 'new'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>+ Create New Group</span>
        </button>

        <div className="h-6 w-px bg-slate-200 shrink-0 mx-1" />

        {existingGroups.length === 0 ? (
          <span className="text-xs text-slate-400 italic px-2">No groups created yet. Create your first group!</span>
        ) : (
          existingGroups.map((g) => {
            const isCurrent = activeGroupId === g.groupId;
            return (
              <button
                key={g.groupId}
                type="button"
                onClick={() => handleSelectGroup(g.groupId)}
                className={`px-3.5 py-2 rounded-xl text-xs font-heading font-bold shrink-0 transition-all flex items-center gap-2 cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{g.groupName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isCurrent ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {g.count}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Status / Alert Message */}
      {statusMessage && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 1. Group Name Input Box */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-xs space-y-2.5">
        <label className="block text-xs font-heading font-bold text-slate-900 uppercase tracking-wider">
          Group Name / Collection Title <span className="text-rose-500">*</span>
        </label>

        <div className="relative">
          <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={groupNameInput}
            onChange={(e) => setGroupNameInput(e.target.value)}
            placeholder="e.g. Red Bull Flavours, Foil Balloon Numbers (0-9), Cold Drink Cans..."
            className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* 2. Selected Products in this Group */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading font-extrabold text-sm sm:text-base text-slate-900">
            Products in this Group ({includedProducts.length})
          </h3>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
            {includedProducts.length} linked
          </span>
        </div>

        {includedProducts.length === 0 ? (
          <div className="p-6 sm:p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-center space-y-1 sm:space-y-2">
            <p className="text-xs sm:text-sm font-bold text-slate-600">
              No products added to this group yet
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Scroll down to the catalog below and tap any product card to link it to this group.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {includedProducts.map((prod) => (
              <div
                key={prod.id}
                className="p-3 sm:p-3.5 bg-stone-50/80 rounded-2xl border border-indigo-200/80 shadow-2xs flex items-center gap-3 relative group"
              >
                {/* 4:3 Aspect Ratio Product Photo */}
                <div className="w-16 sm:w-20 aspect-[4/3] rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 relative">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className={`w-full h-full ${
                        prod.imageFit === 'contain' ? 'object-contain p-1 bg-white' : 'object-cover bg-white'
                      }`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-xs">
                      {prod.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Details & Custom Label */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-heading font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {prod.name}
                    </h4>
                    <span className="font-heading font-extrabold text-xs text-slate-900 shrink-0">
                      ₹{prod.price}
                    </span>
                  </div>

                  {/* Button Label Input */}
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={customLabels[prod.id] ?? prod.groupVariantLabel ?? ''}
                      onChange={(e) => handleLabelChange(prod.id, e.target.value)}
                      placeholder={`Label (e.g. ${prod.name.split(' ')[0]})`}
                      className="w-full px-2 py-1 bg-white border border-slate-200 focus:border-indigo-500 rounded-lg text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none transition-colors"
                      title="Button text on the product modal"
                    />
                  </div>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleToggleProduct(prod)}
                  className="w-8 h-8 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-slate-200 hover:border-rose-200"
                  title="Remove from this group"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Catalog Products Selector (Separated Clean Rows to Prevent Text Squeeze) */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-xs space-y-4">
        {/* Row 1: Section Title and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="font-heading font-extrabold text-sm sm:text-base text-slate-900">
              Select Items from Menu Catalog
            </h3>
            <p className="text-xs text-slate-500">
              Click any product to toggle it in or out of this variant group.
            </p>
          </div>

          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search catalog items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Row 2: Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">Category:</span>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All ({allProducts.length})
          </button>
          {categories.map((c) => {
            const count = allProducts.filter((p) => p.category === c).length;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                  selectedCategory === c
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {c} ({count})
              </button>
            );
          })}
        </div>

        {/* Catalog Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredCatalog.map((prod) => {
            const isSelected = selectedProductIds.includes(prod.id);
            const isInOtherGroup = prod.groupId && prod.groupId !== activeGroupId;

            return (
              <div
                key={prod.id}
                onClick={() => handleToggleProduct(prod)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                  isSelected
                    ? 'bg-indigo-50/90 border-indigo-500 shadow-2xs ring-1 ring-indigo-500/20'
                    : 'bg-white hover:bg-stone-50 border-stone-200/80 hover:border-stone-300'
                }`}
              >
                {/* 4:3 Aspect Ratio Product Photo */}
                <div className="w-14 sm:w-16 aspect-[4/3] rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 relative">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className={`w-full h-full ${
                        prod.imageFit === 'contain' ? 'object-contain p-0.5 bg-white' : 'object-cover bg-white'
                      }`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-[10px]">
                      {prod.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-xs text-slate-900 truncate">
                      {prod.name}
                    </span>
                    <span className="font-heading font-extrabold text-xs text-slate-900 ml-1 shrink-0">
                      ₹{prod.price}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-slate-500 font-medium truncate">
                      {prod.category}
                    </span>
                    {isInOtherGroup && (
                      <span className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 truncate max-w-[90px]">
                        {prod.groupName || 'In other group'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Checkmark indicator */}
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'border border-slate-300 bg-white text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Sticky Actions Bar */}
      <div className="sticky bottom-3 sm:bottom-4 z-20 bg-white/95 backdrop-blur-md p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-stone-200 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {activeGroupId !== 'new' && (
            <div>
              {isConfirmingDelete ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-rose-50 border border-rose-200 p-2 sm:p-2.5 rounded-2xl animate-fadeIn">
                  <span className="text-xs font-bold text-rose-800">
                    Dissolve & unlink all items from "{groupNameInput}"?
                  </span>
                  <div className="flex items-center gap-2 mt-1 sm:mt-0">
                    <button
                      type="button"
                      onClick={handleDissolveGroup}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {isSaving ? 'Deleting...' : 'Yes, Dissolve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isSaving}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                  title="Unlink all products and delete this variant group"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete / Dissolve Group</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onBack}
            disabled={isSaving}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50 text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveGroup}
            disabled={isSaving}
            className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-center"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSaving
                ? 'Saving...'
                : `Save Group (${selectedProductIds.length})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
});

ProductLinkGroupScreen.displayName = 'ProductLinkGroupScreen';
