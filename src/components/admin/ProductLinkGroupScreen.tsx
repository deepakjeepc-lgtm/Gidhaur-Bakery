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
  AlertCircle
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

  const initialGroupId = useMemo(() => {
    if (product?.groupId) {
      return product.groupId;
    }
    return 'new';
  }, [product]);

  const [activeGroupId, setActiveGroupId] = useState<string>(initialGroupId);

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

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    if (product?.groupId) {
      return allProducts.filter((p) => p.groupId === product.groupId).map((p) => p.id);
    }
    if (product) {
      return [product.id];
    }
    return [];
  });

  const [originalProductIds, setOriginalProductIds] = useState<string[]>(() => {
    if (product?.groupId) {
      return allProducts.filter((p) => p.groupId === product.groupId).map((p) => p.id);
    }
    return [];
  });

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

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProducts) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set);
  }, [allProducts]);

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

  const includedProducts = useMemo(() => {
    const idSet = new Set(selectedProductIds);
    return allProducts.filter((p) => idSet.has(p.id));
  }, [allProducts, selectedProductIds]);

  const handleToggleProduct = (targetProd: Product) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(targetProd.id)) {
        return prev.filter((id) => id !== targetProd.id);
      } else {
        return [...prev, targetProd.id];
      }
    });
  };

  const handleLabelChange = (productId: string, val: string) => {
    setCustomLabels((prev) => ({
      ...prev,
      [productId]: val
    }));
  };

  const handleSaveGroup = async () => {
    const cleanName = groupNameInput.trim();
    if (!cleanName) {
      setStatusMessage('Please enter a group name.');
      return;
    }

    if (selectedProductIds.length === 0) {
      setStatusMessage('Please select at least 1 product.');
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

      onSuccess(`✓ Group "${cleanName}" saved (${selectedProductIds.length} products)`);
    } catch (err: any) {
      console.error('Error saving product group:', err);
      setStatusMessage(`Error saving group: ${err?.message || 'Please try again'}`);
      setIsSaving(false);
    }
  };

  const handleDissolveGroup = async () => {
    if (activeGroupId === 'new') return;

    setIsSaving(true);
    setStatusMessage(null);

    try {
      await unlinkEntireGroup(activeGroupId, allProducts);
      onSuccess(`✓ Group "${groupNameInput}" dissolved.`);
    } catch (err: any) {
      console.error('Error dissolving group:', err);
      setStatusMessage(`Failed to delete group: ${err?.message || 'Please try again'}`);
      setIsSaving(false);
      setIsConfirmingDelete(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#18181B] border border-[#27272A] rounded-md p-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#121212] hover:bg-[#242427] border border-[#27272A] hover:border-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF] cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#A1A1AA]" />
            <span>BACK</span>
          </button>

          <h2 className="font-bold text-sm sm:text-base uppercase tracking-[-0.02em] text-[#FFFFFF] truncate">
            Link &amp; Group Products
          </h2>
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0 font-mono">
          <button
            type="button"
            onClick={onBack}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-sm border border-[#27272A] bg-[#121212] text-[11px] font-bold uppercase tracking-[0.06em] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427] cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveGroup}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-sm bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] text-[11px] font-bold uppercase tracking-[0.06em] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {isSaving ? 'Saving...' : `Save Group (${selectedProductIds.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Group Switcher Tabs */}
      <div className="bg-[#18181B] p-3 rounded-md border border-[#27272A] flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono">
        <button
          type="button"
          onClick={() => handleSelectGroup('new')}
          className={`px-3 py-1.5 rounded-sm text-[11px] font-bold uppercase tracking-[0.06em] shrink-0 flex items-center gap-1.5 cursor-pointer border ${
            activeGroupId === 'new'
              ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
              : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:border-[#3F3F46]'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Group</span>
        </button>

        <div className="h-4 w-px bg-[#27272A] shrink-0 mx-1" />

        {existingGroups.map((g) => {
          const isCurrent = activeGroupId === g.groupId;
          return (
            <button
              key={g.groupId}
              type="button"
              onClick={() => handleSelectGroup(g.groupId)}
              className={`px-3 py-1.5 rounded-sm text-[11px] font-bold uppercase tracking-[0.06em] shrink-0 flex items-center gap-2 cursor-pointer border ${
                isCurrent
                  ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                  : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:border-[#3F3F46]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{g.groupName}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-xs font-mono ${
                  isCurrent ? 'bg-[#0A0A0A] text-[#FFFFFF]' : 'bg-[#0A0A0A] text-[#A1A1AA] border border-[#27272A]'
                }`}
              >
                {g.count}
              </span>
            </button>
          );
        })}
      </div>

      {statusMessage && (
        <div className="p-3 rounded-sm bg-[#18181B] border border-[#FF5500] text-[#FFFFFF] text-xs font-mono font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#FF5500] shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 1. Group Name Input Box */}
      <div className="bg-[#18181B] p-4 sm:p-5 rounded-md border border-[#27272A] space-y-2">
        <label className="block text-[11px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.06em]">
          GROUP NAME / COLLECTION TITLE *
        </label>

        <div className="relative">
          <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
          <input
            type="text"
            value={groupNameInput}
            onChange={(e) => setGroupNameInput(e.target.value)}
            placeholder="e.g. Red Bull Flavours, Foil Balloon Numbers (0-9)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-sm bg-[#0A0A0A] border border-[#27272A] focus:border-[#FFFFFF] text-xs sm:text-sm font-mono font-semibold text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-hidden"
          />
        </div>
      </div>

      {/* 2. Selected Products in this Group */}
      <div className="bg-[#18181B] p-4 sm:p-5 rounded-md border border-[#27272A] space-y-3.5">
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#27272A]">
          <h3 className="font-mono font-bold text-xs uppercase tracking-[0.06em] text-[#FFFFFF]">
            LINKED PRODUCTS ({includedProducts.length})
          </h3>
          <span className="text-[10px] font-mono font-bold text-[#A1A1AA] bg-[#0A0A0A] px-2 py-0.5 rounded-sm border border-[#27272A] uppercase tracking-[0.06em]">
            {includedProducts.length} LINKED
          </span>
        </div>

        {includedProducts.length === 0 ? (
          <div className="p-8 rounded-sm border border-dashed border-[#27272A] bg-[#0A0A0A] text-center font-mono">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#71717A]">
              No products linked yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {includedProducts.map((prod) => (
              <div
                key={prod.id}
                className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex items-center gap-3 relative"
              >
                <div className="w-14 aspect-[4/3] rounded-sm overflow-hidden bg-[#121212] border border-[#27272A] shrink-0 relative">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className={`w-full h-full ${
                        prod.imageFit === 'contain' ? 'object-contain p-0.5 bg-[#121212]' : 'object-cover bg-[#121212]'
                      }`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-mono font-bold text-[#71717A] text-xs">
                      {prod.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-xs text-[#FFFFFF] truncate">
                      {prod.name}
                    </h4>
                    <span className="font-mono font-bold text-xs text-[#FFFFFF] shrink-0">
                      ₹{prod.price}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono">
                    <Tag className="w-3 h-3 text-[#71717A] shrink-0" />
                    <input
                      type="text"
                      value={customLabels[prod.id] ?? prod.groupVariantLabel ?? ''}
                      onChange={(e) => handleLabelChange(prod.id, e.target.value)}
                      placeholder={`Label (e.g. ${prod.name.split(' ')[0]})`}
                      className="w-full px-2 py-1 rounded-sm bg-[#18181B] border border-[#27272A] focus:border-[#FFFFFF] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-hidden"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleProduct(prod)}
                  className="w-7 h-7 rounded-sm bg-[#18181B] hover:bg-[#242427] text-[#71717A] hover:text-[#EF4444] flex items-center justify-center cursor-pointer shrink-0 border border-[#27272A]"
                  title="Remove from group"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Catalog Products Selector */}
      <div className="bg-[#18181B] p-4 sm:p-5 rounded-md border border-[#27272A] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272A]">
          <h3 className="font-mono font-bold text-xs uppercase tracking-[0.06em] text-[#FFFFFF]">
            SELECT CATALOG ITEMS
          </h3>

          <div className="relative w-full sm:w-64 shrink-0 font-mono">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
            <input
              type="text"
              placeholder="FILTER CATALOG ITEMS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-sm bg-[#0A0A0A] border border-[#27272A] focus:border-[#FFFFFF] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-hidden"
            />
          </div>
        </div>

        {/* Category Filter Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 font-mono">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-sm text-[11px] uppercase tracking-[0.06em] whitespace-nowrap shrink-0 cursor-pointer border ${
              selectedCategory === 'all'
                ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF] font-bold'
                : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:border-[#3F3F46]'
            }`}
          >
            ALL ({allProducts.length})
          </button>
          {categories.map((c) => {
            const count = allProducts.filter((p) => p.category === c).length;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                className={`px-3 py-1.5 rounded-sm text-[11px] uppercase tracking-[0.06em] whitespace-nowrap shrink-0 cursor-pointer border ${
                  selectedCategory === c
                    ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF] font-bold'
                    : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:border-[#3F3F46]'
                }`}
              >
                {c} ({count})
              </button>
            );
          })}
        </div>

        {/* Catalog Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {filteredCatalog.map((prod) => {
            const isSelected = selectedProductIds.includes(prod.id);
            const isInOtherGroup = prod.groupId && prod.groupId !== activeGroupId;

            return (
              <div
                key={prod.id}
                onClick={() => handleToggleProduct(prod)}
                className={`p-2.5 rounded-sm border cursor-pointer flex items-center gap-2.5 ${
                  isSelected
                    ? 'bg-[#242427] border-[#FFFFFF]'
                    : 'bg-[#0A0A0A] hover:border-[#3F3F46] border-[#27272A]'
                }`}
              >
                <div className="w-12 aspect-[4/3] rounded-xs overflow-hidden bg-[#121212] border border-[#27272A] shrink-0 relative">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className={`w-full h-full ${
                        prod.imageFit === 'contain' ? 'object-contain p-0.5 bg-[#121212]' : 'object-cover bg-[#121212]'
                      }`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-mono font-bold text-[#71717A] text-[10px]">
                      {prod.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#FFFFFF] truncate">
                      {prod.name}
                    </span>
                    <span className="font-mono font-bold text-xs text-[#FFFFFF] ml-1 shrink-0">
                      ₹{prod.price}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-[#71717A] font-mono truncate">
                      {prod.category}
                    </span>
                    {isInOtherGroup && (
                      <span className="text-[9px] font-mono text-[#FF5500] bg-[#18181B] px-1 rounded-xs border border-[#27272A] truncate max-w-[90px]">
                        {prod.groupName || 'Linked'}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-xs flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-[#FFFFFF] text-[#0A0A0A]'
                      : 'border border-[#3F3F46] bg-[#18181B] text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Sticky Actions Bar */}
      <div className="sticky bottom-3 z-20 bg-[#0A0A0A] p-3.5 rounded-md border border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
        <div>
          {activeGroupId !== 'new' && (
            <div>
              {isConfirmingDelete ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#18181B] border border-[#27272A] rounded-sm p-2">
                  <span className="text-xs font-bold text-[#FFFFFF]">
                    Dissolve "{groupNameInput}"?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDissolveGroup}
                      disabled={isSaving}
                      className="px-3 py-1 rounded-sm bg-[#EF4444] hover:bg-[#dc2626] text-[#FFFFFF] text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isSaving}
                      className="px-2.5 py-1 rounded-sm bg-[#121212] border border-[#27272A] text-[#A1A1AA] hover:text-[#FFFFFF] text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer"
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
                  className="px-3 py-1.5 rounded-sm text-[11px] font-bold uppercase tracking-[0.06em] text-[#EF4444] border border-[#EF4444]/40 hover:bg-[#EF4444]/10 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Dissolve Group</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onBack}
            disabled={isSaving}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-sm border border-[#27272A] bg-[#18181B] text-[11px] font-bold uppercase tracking-[0.06em] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427] cursor-pointer disabled:opacity-50 text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveGroup}
            disabled={isSaving}
            className="flex-1 sm:flex-initial px-5 py-2 rounded-sm bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] text-[11px] font-bold uppercase tracking-[0.06em] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-center"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {isSaving ? 'Saving...' : `Save Group (${selectedProductIds.length})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
});

ProductLinkGroupScreen.displayName = 'ProductLinkGroupScreen';
