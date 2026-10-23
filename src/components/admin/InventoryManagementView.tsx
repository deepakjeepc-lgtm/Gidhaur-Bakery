import React, { useState, useMemo, useCallback } from 'react';
import {
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Search,
  Plus,
  Minus,
  RefreshCw,
  Download,
  Printer,
  TrendingUp,
  ChevronDown,
  Boxes,
  ArrowUpDown,
  X
} from 'lucide-react';
import { Product } from '../../types';
import {
  getProductStock,
  getProductLowStockThreshold,
  isItemLowStock,
  isItemOutOfStock,
  bulkUpdateInventory,
  updateProductStockQuantity,
  exportInventoryToCSV,
  printInventoryAuditSheet
} from '../../services/inventoryService';
import { triggerHaptic } from '../../utils/haptics';

interface InventoryManagementViewProps {
  products: Product[];
  categories?: string[];
  onRefreshCatalog?: () => void;
}

type StockFilterType = 'all' | 'low_stock' | 'out_of_stock' | 'in_stock';
type StockSortType = 'name_asc' | 'lowest_stock' | 'highest_stock' | 'price_desc' | 'price_asc';

export const InventoryManagementView = React.memo<InventoryManagementViewProps>(({
  products,
  categories = [],
  onRefreshCatalog
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<StockFilterType>('all');
  const [sortBy, setSortBy] = useState<StockSortType>('lowest_stock');

  // Local state for inline editing of custom quantities before Enter/Blur
  const [editingQuantities, setEditingQuantities] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // Compute KPI metrics
  const kpis = useMemo(() => {
    const totalItems = products.length;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalUnitsInStore = 0;
    let totalRetailValue = 0;

    for (const p of products) {
      const stock = getProductStock(p);
      const isOut = isItemOutOfStock(p);
      const isLow = isItemLowStock(p);

      if (isOut) {
        outOfStockCount++;
      } else {
        inStockCount++;
        if (isLow) {
          lowStockCount++;
        }
      }

      if (!isOut) {
        totalUnitsInStore += stock;
        totalRetailValue += stock * (Number(p.price) || 0);
      }
    }

    const inStockPercent = totalItems > 0 ? Math.round((inStockCount / totalItems) * 100) : 100;

    return {
      totalItems,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      totalUnitsInStore,
      totalRetailValue,
      inStockPercent
    };
  }, [products]);

  // Unique categories list
  const availableCategories = useMemo(() => {
    const catSet = new Set<string>(categories);
    products.forEach((p) => {
      if (p.category) catSet.add(p.category);
    });
    return ['all', ...Array.from(catSet)];
  }, [categories, products]);

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = products.filter((p) => {
      if (q) {
        const matchName = p.name.toLowerCase().includes(q);
        const matchCat = (p.category || '').toLowerCase().includes(q);
        const matchId = p.id.toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchId) return false;
      }

      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      if (filterType === 'out_of_stock' && !isItemOutOfStock(p)) return false;
      if (filterType === 'low_stock' && !isItemLowStock(p)) return false;
      if (filterType === 'in_stock' && isItemOutOfStock(p)) return false;

      return true;
    });

    return filtered.sort((a, b) => {
      const stockA = getProductStock(a);
      const stockB = getProductStock(b);

      switch (sortBy) {
        case 'lowest_stock':
          return stockA - stockB;
        case 'highest_stock':
          return stockB - stockA;
        case 'price_desc':
          return (b.price || 0) - (a.price || 0);
        case 'price_asc':
          return (a.price || 0) - (b.price || 0);
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [products, searchQuery, selectedCategory, filterType, sortBy]);

  // Handle +1, -1, +5, +10, +25 quick adjust
  const handleAdjustQuantity = useCallback(
    (product: Product, delta: number) => {
      triggerHaptic('light');
      const currentStock = getProductStock(product);
      const nextStock = Math.max(0, currentStock + delta);
      updateProductStockQuantity(
        product.id,
        nextStock,
        nextStock > 0,
        getProductLowStockThreshold(product),
        products
      );
      setEditingQuantities((prev) => {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      });
      showToast(
        `${product.name}: ${delta > 0 ? `+${delta}` : delta} → ${nextStock} IN STOCK`
      );
    },
    [products, showToast]
  );

  // Handle direct typing of stock quantity
  const handleQuantityInputChange = (productId: string, val: string) => {
    setEditingQuantities((prev) => ({ ...prev, [productId]: val }));
  };

  const handleQuantityInputBlur = (product: Product) => {
    const rawVal = editingQuantities[product.id];
    if (rawVal === undefined) return;

    const parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      triggerHaptic('medium');
      updateProductStockQuantity(
        product.id,
        parsed,
        parsed > 0,
        getProductLowStockThreshold(product),
        products
      );
      showToast(`✓ UPDATED "${product.name}" STOCK TO ${parsed}`);
    }

    setEditingQuantities((prev) => {
      const copy = { ...prev };
      delete copy[product.id];
      return copy;
    });
  };

  // Toggle Availability (Mark Out of Stock / In Stock)
  const handleToggleAvailability = (product: Product) => {
    triggerHaptic('medium');
    const currentlyOut = isItemOutOfStock(product);
    if (currentlyOut) {
      const currentStock = getProductStock(product);
      const restoredQty = currentStock > 0 ? currentStock : 25;
      updateProductStockQuantity(
        product.id,
        restoredQty,
        true,
        getProductLowStockThreshold(product),
        products
      );
      showToast(`✓ "${product.name}" MARKED IN STOCK (${restoredQty} UNITS)`);
    } else {
      updateProductStockQuantity(
        product.id,
        0,
        false,
        getProductLowStockThreshold(product),
        products
      );
      showToast(`"${product.name}" MARKED OUT OF STOCK`);
    }
  };

  // Bulk Selection Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleBulkAction = (action: 'restock25' | 'add10' | 'markOut') => {
    if (selectedIds.size === 0) return;
    triggerHaptic('heavy');
    const ids = Array.from(selectedIds);

    if (action === 'restock25') {
      bulkUpdateInventory(ids, 'setQuantity', 25, products);
    } else if (action === 'add10') {
      bulkUpdateInventory(ids, 'addQuantity', 10, products);
    } else if (action === 'markOut') {
      bulkUpdateInventory(ids, 'markOutOfStock', 0, products);
    }

    showToast(`✓ APPLIED BULK UPDATE TO ${ids.length} ITEMS`);
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-sm bg-[#18181B] text-[#FFFFFF] px-4 py-3 flex items-center gap-2.5 border border-[#3F3F46]">
          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.06em]">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar (LEKHIX Style with breathable spacing) */}
      <div className="pb-4 border-b border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[#FFFFFF]">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[18px] font-bold uppercase tracking-[0.04em] text-[#FFFFFF] font-['Plus_Jakarta_Sans',sans-serif]">
            STOCK
          </h2>
          <span className="px-2 py-0.5 border border-[#FFFFFF] bg-[#0A0A0A] text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.12em]">
            INVENTORY
          </span>
          <span className="text-[11px] font-mono font-medium text-[#A1A1AA] uppercase tracking-[0.14em]">
            {kpis.totalItems} ITEMS · {kpis.totalUnitsInStore} UNITS IN STORE
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportInventoryToCSV(products)}
            title="Download full inventory CSV spreadsheet"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] font-mono font-semibold uppercase tracking-[0.1em] text-[#E4E4E7] hover:text-[#FFFFFF] bg-[#18181B] hover:bg-[#242427] border border-[#27272A] cursor-pointer rounded-none"
          >
            <Download className="w-3.5 h-3.5 text-[#A1A1AA]" />
            <span>EXPORT CSV</span>
          </button>

          <button
            onClick={() => printInventoryAuditSheet(products)}
            title="Print daily morning kitchen baking audit sheet"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] font-mono font-semibold uppercase tracking-[0.1em] text-[#E4E4E7] hover:text-[#FFFFFF] bg-[#18181B] hover:bg-[#242427] border border-[#27272A] cursor-pointer rounded-none"
          >
            <Printer className="w-3.5 h-3.5 text-[#A1A1AA]" />
            <span>PRINT AUDIT</span>
          </button>

          {onRefreshCatalog && (
            <button
              onClick={onRefreshCatalog}
              title="Refresh inventory from local catalog"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-[0.08em] text-[#0A0A0A] bg-[#FFFFFF] hover:bg-zinc-200 border border-[#FFFFFF] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>SYNC</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. 5 KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Tracked Items */}
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 space-y-1">
          <div className="flex items-center justify-between text-[#71717A]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em]">TRACKED ITEMS</span>
            <Package className="w-3.5 h-3.5 text-[#71717A]" />
          </div>
          <div className="font-mono font-bold text-2xl text-[#FFFFFF] tabular-nums">
            {kpis.totalItems}
          </div>
        </div>

        {/* In Stock Items */}
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 space-y-1">
          <div className="flex items-center justify-between text-[#71717A]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em]">IN STOCK</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
          </div>
          <div className="font-mono font-bold text-2xl text-[#10B981] tabular-nums">
            {kpis.inStockCount}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 space-y-1">
          <div className="flex items-center justify-between text-[#71717A]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em]">LOW STOCK (≤ 5)</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
          </div>
          <div className="font-mono font-bold text-2xl text-[#F59E0B] tabular-nums">
            {kpis.lowStockCount}
          </div>
        </div>

        {/* Out of Stock / Sold Out */}
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 space-y-1">
          <div className="flex items-center justify-between text-[#71717A]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em]">SOLD OUT (0)</span>
            <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
          </div>
          <div className="font-mono font-bold text-2xl text-[#EF4444] tabular-nums">
            {kpis.outOfStockCount}
          </div>
        </div>

        {/* Retail Inventory Value */}
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 space-y-1 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-[#71717A]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em]">RETAIL VALUE</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#FF5500]" />
          </div>
          <div className="font-mono font-bold text-2xl text-[#FFFFFF] tabular-nums">
            ₹{kpis.totalRetailValue.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* 2. SMART SEARCH & FILTER TOOLBAR */}
      <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Live Search */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter items by name, category, or SKU..."
              className="w-full pl-8 pr-8 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#FFFFFF]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category & Sort Dropdowns */}
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF] cursor-pointer focus:outline-none focus:border-[#FFFFFF]"
              >
                <option value="all">All Categories</option>
                {availableCategories
                  .filter((c) => c !== 'all')
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#71717A] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as StockSortType)}
                className="appearance-none pl-3 pr-8 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF] cursor-pointer focus:outline-none focus:border-[#FFFFFF]"
              >
                <option value="lowest_stock">Lowest Stock First</option>
                <option value="highest_stock">Highest Stock First</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="price_asc">Price: Low to High</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-[#71717A] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#27272A]">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-sm text-[11px] font-mono uppercase tracking-[0.06em] border cursor-pointer tabular-nums ${
              filterType === 'all'
                ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF] font-bold'
                : 'bg-[#0A0A0A] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
            }`}
          >
            All Items ({products.length})
          </button>

          <button
            onClick={() => setFilterType('in_stock')}
            className={`px-3 py-1.5 rounded-sm text-[11px] font-mono uppercase tracking-[0.06em] border cursor-pointer flex items-center gap-1.5 tabular-nums ${
              filterType === 'in_stock'
                ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF] font-bold'
                : 'bg-[#0A0A0A] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
            }`}
          >
            <span>In Stock ({kpis.inStockCount})</span>
          </button>

          <button
            onClick={() => setFilterType('low_stock')}
            className={`px-3 py-1.5 rounded-sm text-[11px] font-mono uppercase tracking-[0.06em] border cursor-pointer flex items-center gap-1.5 tabular-nums ${
              filterType === 'low_stock'
                ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF] font-bold'
                : 'bg-[#0A0A0A] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
            }`}
          >
            <span>Low Stock ({kpis.lowStockCount})</span>
          </button>

          <button
            onClick={() => setFilterType('out_of_stock')}
            className={`px-3 py-1.5 rounded-sm text-[11px] font-mono uppercase tracking-[0.06em] border cursor-pointer flex items-center gap-1.5 tabular-nums ${
              filterType === 'out_of_stock'
                ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF] font-bold'
                : 'bg-[#0A0A0A] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
            }`}
          >
            <span>Sold Out ({kpis.outOfStockCount})</span>
          </button>

          <div className="ml-auto text-[11px] text-[#71717A] font-mono uppercase tracking-[0.06em] tabular-nums">
            Showing <strong className="text-[#FFFFFF]">{filteredProducts.length}</strong> items
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar when items selected */}
      {selectedIds.size > 0 && (
        <div className="bg-[#18181B] text-[#FFFFFF] p-3.5 rounded-sm border border-[#FF5500] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-sm bg-[#FF5500] text-[#FFFFFF] font-mono text-xs font-bold tabular-nums">
              {selectedIds.size}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] font-mono">Items Selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('add10')}
              className="px-3 py-1.5 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] border border-[#27272A] text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer font-mono text-[#FFFFFF]"
            >
              +10 Units
            </button>
            <button
              onClick={() => handleBulkAction('restock25')}
              className="px-3 py-1.5 rounded-sm bg-[#FF5500] text-[#FFFFFF] hover:bg-[#E04B00] border border-[#FF5500] text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer font-mono"
            >
              Set 25 In Stock
            </button>
            <button
              onClick={() => handleBulkAction('markOut')}
              className="px-3 py-1.5 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] border border-[#EF4444]/40 text-[#EF4444] text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer font-mono"
            >
              Mark Sold Out
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 text-[#71717A] hover:text-[#FFFFFF] cursor-pointer"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. STOCK CONTROL TABLE / LIST */}
      <div className="bg-[#18181B] rounded-sm border border-[#27272A] overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-12 h-12 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex items-center justify-center mx-auto text-[#71717A]">
              <Boxes className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm uppercase tracking-[0.06em] text-[#FFFFFF] font-mono">
              No inventory items found
            </h3>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setSelectedCategory('all');
                }}
                className="px-4 py-2 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] border border-[#27272A] text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF] cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#0A0A0A] border-b border-[#27272A] text-[10px] font-mono font-bold text-[#71717A] uppercase tracking-[0.12em]">
                  <th className="py-3 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredProducts.length}
                      onChange={handleSelectAll}
                      className="rounded-sm border-[#27272A] bg-[#0A0A0A] accent-[#FF5500] cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="py-3 px-3">Item Details</th>
                  <th className="py-3 px-3">Price</th>
                  <th className="py-3 px-3 text-center">Live Status</th>
                  <th className="py-3 px-3 text-center">Quick Stock Adjuster</th>
                  <th className="py-3 pr-4 pl-3 text-right">Instant Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {filteredProducts.map((product) => {
                  const stock = getProductStock(product);
                  const isOut = isItemOutOfStock(product);
                  const isLow = isItemLowStock(product);
                  const isSelected = selectedIds.has(product.id);
                  const currentInputValue = editingQuantities[product.id] ?? String(stock);

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-[#242427] ${
                        isSelected ? 'bg-[#242427]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(product.id)}
                          className="rounded-sm border-[#27272A] bg-[#0A0A0A] accent-[#FF5500] cursor-pointer w-4 h-4"
                        />
                      </td>

                      {/* Item Details (Thumbnail, Name, Category) */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-sm overflow-hidden bg-[#0A0A0A] shrink-0 border border-[#27272A] aspect-square">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#71717A]">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs sm:text-sm text-[#FFFFFF] truncate max-w-[200px] sm:max-w-xs">
                              {product.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.06em] text-[#A1A1AA] font-mono">
                              <span className="font-bold text-[#A1A1AA]">{product.category || 'Bakery'}</span>
                              <span>·</span>
                              <span className="text-[#71717A]">
                                SKU: {product.id.slice(-6)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Retail Price */}
                      <td className="py-3 px-3 font-mono font-bold text-[#FFFFFF] text-xs sm:text-sm tabular-nums">
                        ₹{product.price}
                      </td>

                      {/* Live Stock Badge & Threshold Customizer */}
                      <td className="py-3 px-3 text-center">
                        <div>
                          {isOut ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-[0.06em] bg-[#0A0A0A] text-[#EF4444] border border-[#EF4444]/40 line-through tabular-nums">
                              Sold Out (0)
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-[0.06em] bg-[#0A0A0A] text-[#F59E0B] border border-[#F59E0B]/40 tabular-nums">
                              Low Stock ({stock})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-[0.06em] bg-[#0A0A0A] text-[#10B981] border border-[#10B981]/40 tabular-nums">
                              In Stock ({stock})
                            </span>
                          )}

                          <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-[#71717A] font-mono">
                            <span>Alert if ≤</span>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              defaultValue={getProductLowStockThreshold(product)}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val >= 0) {
                                  updateProductStockQuantity(product.id, stock, undefined, val, products);
                                  showToast(`✓ ALERT THRESHOLD SET TO ≤ ${val} FOR "${product.name}"`);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              title="Set low stock alert threshold for this item (default 5)"
                              className="w-9 text-center font-mono font-bold text-[10px] rounded-sm bg-[#0A0A0A] border border-[#27272A] px-1 py-0.5 text-[#FFFFFF] focus:outline-none focus:border-[#FFFFFF] tabular-nums"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Quick Adjust Stepper: [-5] [-1] [Direct Input] [+1] [+5] */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-[#0A0A0A] p-1 rounded-sm border border-[#27272A]">
                          <button
                            onClick={() => handleAdjustQuantity(product, -5)}
                            disabled={stock <= 0}
                            title="Deduct 5 items"
                            className="px-2 py-1 rounded-sm text-[11px] font-mono font-bold text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#18181B] disabled:opacity-30 cursor-pointer"
                          >
                            -5
                          </button>

                          <button
                            onClick={() => handleAdjustQuantity(product, -1)}
                            disabled={stock <= 0}
                            title="Deduct 1 item"
                            className="p-1 rounded-sm text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#18181B] disabled:opacity-30 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <input
                            type="number"
                            min="0"
                            value={currentInputValue}
                            onChange={(e) => handleQuantityInputChange(product.id, e.target.value)}
                            onBlur={() => handleQuantityInputBlur(product)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleQuantityInputBlur(product);
                            }}
                            className="w-14 text-center font-mono font-bold text-xs rounded-sm bg-[#18181B] border border-[#27272A] py-1 px-1 focus:outline-none focus:border-[#FFFFFF] text-[#FFFFFF] tabular-nums"
                            title="Type exact stock number and press Enter or click outside"
                          />

                          <button
                            onClick={() => handleAdjustQuantity(product, 1)}
                            title="Add 1 item"
                            className="p-1 rounded-sm text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#18181B] cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleAdjustQuantity(product, 5)}
                            title="Add 5 items"
                            className="px-2 py-1 rounded-sm text-[11px] font-mono font-bold text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#18181B] cursor-pointer"
                          >
                            +5
                          </button>
                        </div>
                      </td>

                      {/* Quick Toggle: Mark In Stock / Out of Stock */}
                      <td className="py-3 pr-4 pl-3 text-right">
                        <button
                          onClick={() => handleToggleAvailability(product)}
                          className={`px-3 py-1.5 rounded-sm text-[11px] font-mono font-bold uppercase tracking-[0.06em] border cursor-pointer ${
                            isOut
                              ? 'bg-[#FF5500] text-[#FFFFFF] border-[#FF5500] hover:bg-[#E04B00]'
                              : 'bg-[#0A0A0A] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427] border-[#27272A]'
                          }`}
                        >
                          {isOut ? 'Restock (+25)' : 'Mark Sold Out'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

InventoryManagementView.displayName = 'InventoryManagementView';
