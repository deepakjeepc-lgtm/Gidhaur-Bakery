import React, { useState, useMemo, useCallback } from 'react';
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Printer,
  Plus,
  Minus,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  X,
  Package,
  Layers,
  Check,
  Eye,
  Store
} from 'lucide-react';
import { Product } from '../../types';
import {
  getProductStock,
  getProductLowStockThreshold,
  isItemLowStock,
  isItemOutOfStock,
  updateProductStockQuantity,
  bulkUpdateInventory,
  exportInventoryToCSV,
  printInventoryAuditSheet
} from '../../services/inventoryService';

interface InventoryManagementViewProps {
  products: Product[];
  onRefreshCatalog?: () => void;
}

type StockFilterType = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type StockSortType = 'lowest_stock' | 'highest_stock' | 'name_asc' | 'price_desc' | 'price_asc';

export const InventoryManagementView = React.memo<InventoryManagementViewProps>(({
  products,
  onRefreshCatalog
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<StockFilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<StockSortType>('lowest_stock');
  
  // Multi-select for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Custom toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Local editing inputs state for quantity inputs
  const [editingQuantities, setEditingQuantities] = useState<Record<string, string>>({});

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  // Compute Categories from products
  const availableCategories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);
    return ['all', ...cats];
  }, [products]);

  // 1. KPI Calculations
  const kpis = useMemo(() => {
    const totalItems = products.length;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalRetailValue = 0;

    products.forEach((p) => {
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

      totalRetailValue += (Number(p.price) || 0) * stock;
    });

    return {
      totalItems,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      totalRetailValue,
      inStockPercent: totalItems > 0 ? Math.round((inStockCount / totalItems) * 100) : 0,
    };
  }, [products]);

  // 2. Filter & Search Logic
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products.filter((p) => {
      // Search match
      if (query) {
        const matchesName = (p.name || '').toLowerCase().includes(query);
        const matchesCategory = (p.category || '').toLowerCase().includes(query);
        const matchesId = (p.id || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCategory && !matchesId) return false;
      }

      // Category match
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      // Filter chip match
      if (filterType === 'in_stock') {
        return !isItemOutOfStock(p);
      }
      if (filterType === 'low_stock') {
        return isItemLowStock(p);
      }
      if (filterType === 'out_of_stock') {
        return isItemOutOfStock(p);
      }

      return true;
    }).sort((a, b) => {
      const stockA = getProductStock(a);
      const stockB = getProductStock(b);

      switch (sortBy) {
        case 'lowest_stock':
          return stockA - stockB;
        case 'highest_stock':
          return stockB - stockA;
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'price_desc':
          return (b.price || 0) - (a.price || 0);
        case 'price_asc':
          return (a.price || 0) - (b.price || 0);
        default:
          return 0;
      }
    });
  }, [products, searchQuery, selectedCategory, filterType, sortBy]);

  // Quick quantity increment/decrement handler
  const handleAdjustQuantity = (product: Product, delta: number) => {
    const currentStock = getProductStock(product);
    const newStock = Math.max(0, currentStock + delta);
    updateProductStockQuantity(product.id, newStock, undefined, undefined, products);
    showToast(`✓ "${product.name}" stock updated to ${newStock} units`);
  };

  // Direct quantity input change
  const handleQuantityInputChange = (productId: string, valStr: string) => {
    setEditingQuantities((prev) => ({ ...prev, [productId]: valStr }));
  };

  const handleQuantityInputBlur = (product: Product) => {
    const rawVal = editingQuantities[product.id];
    if (rawVal !== undefined && rawVal.trim() !== '') {
      const parsed = parseInt(rawVal, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        updateProductStockQuantity(product.id, parsed, undefined, undefined, products);
        showToast(`✓ "${product.name}" stock updated to ${parsed} units`);
      }
      setEditingQuantities((prev) => {
        const clone = { ...prev };
        delete clone[product.id];
        return clone;
      });
    }
  };

  // Toggle in-stock / out-of-stock
  const handleToggleAvailability = (product: Product) => {
    const currentOut = isItemOutOfStock(product);
    if (currentOut) {
      // Mark In Stock (set to 25 if was 0)
      const currentStock = getProductStock(product);
      const newStock = currentStock > 0 ? currentStock : 25;
      updateProductStockQuantity(product.id, newStock, true, undefined, products);
      showToast(`✓ "${product.name}" marked In Stock (${newStock} units)`);
    } else {
      // Mark Out of Stock (0 units)
      updateProductStockQuantity(product.id, 0, false, undefined, products);
      showToast(`⚠️ "${product.name}" marked Out of Stock`);
    }
  };

  // Selection handlers
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

  // Bulk actions
  const handleBulkAction = (action: 'markInStock' | 'markOutOfStock' | 'add25') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (action === 'markInStock') {
      bulkUpdateInventory(ids, 'markInStock', undefined, products);
      showToast(`✓ ${ids.length} items marked In Stock`);
    } else if (action === 'markOutOfStock') {
      bulkUpdateInventory(ids, 'markOutOfStock', undefined, products);
      showToast(`⚠️ ${ids.length} items marked Out of Stock`);
    } else if (action === 'add25') {
      bulkUpdateInventory(ids, 'addQuantity', 25, products);
      showToast(`✓ Restocked +25 units to ${ids.length} items`);
    }
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-extrabold uppercase tracking-wider">
            <Boxes className="w-3.5 h-3.5 text-rose-600" />
            <span>Smart Inventory Control</span>
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-slate-900">
            Stock & Baking Batch Manager
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Instant 1-click stock updates, automated kitchen deduction on order acceptance, and zero-leak sync.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => exportInventoryToCSV(products)}
            title="Download full inventory CSV spreadsheet"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => printInventoryAuditSheet(products)}
            title="Print daily morning kitchen baking audit sheet"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Audit Sheet</span>
          </button>

          {onRefreshCatalog && (
            <button
              onClick={onRefreshCatalog}
              title="Refresh inventory from local catalog"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
              <span>Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. 5 KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Tracked Items */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">TRACKED ITEMS</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900">
            {kpis.totalItems}
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            Catalog items
          </span>
        </div>

        {/* In Stock Items */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">IN STOCK</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-600">
            {kpis.inStockCount}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium block">
            {kpis.inStockPercent}% of menu live
          </span>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">LOW STOCK (≤ 5)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-amber-600">
            {kpis.lowStockCount}
          </div>
          <span className="text-[11px] text-amber-700 font-medium block">
            Needs fresh batch bake
          </span>
        </div>

        {/* Out of Stock / Sold Out */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">SOLD OUT (0)</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="font-heading font-extrabold text-2xl sm:text-3xl text-rose-600">
            {kpis.outOfStockCount}
          </div>
          <span className="text-[11px] text-rose-700 font-medium block">
            Unavailable on menu
          </span>
        </div>

        {/* Retail Inventory Value */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-1 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">RETAIL VALUE</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-amount font-extrabold text-2xl sm:text-3xl text-slate-900 font-mono">
            ₹{kpis.totalRetailValue.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 font-medium block">
            Current on-shelf stock
          </span>
        </div>
      </div>

      {/* 2. SMART SEARCH & FILTER TOOLBAR */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Live Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items by name, category, or SKU..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
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
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as StockSortType)}
                className="appearance-none pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="lowest_stock">Lowest Stock First</option>
                <option value="highest_stock">Highest Stock First</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="price_asc">Price: Low to High</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Items ({products.length})
          </button>

          <button
            onClick={() => setFilterType('in_stock')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'in_stock'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>In Stock ({kpis.inStockCount})</span>
          </button>

          <button
            onClick={() => setFilterType('low_stock')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'low_stock'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Low Stock ({kpis.lowStockCount})</span>
          </button>

          <button
            onClick={() => setFilterType('out_of_stock')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'out_of_stock'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <XCircle className="w-3 h-3" />
            <span>Sold Out ({kpis.outOfStockCount})</span>
          </button>

          <div className="ml-auto text-xs text-slate-400 font-medium">
            Showing <strong className="text-slate-700">{filteredProducts.length}</strong> items
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar when items selected */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-3 sm:p-4 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center text-xs font-bold">
              {selectedIds.size}
            </span>
            <span className="text-xs sm:text-sm font-semibold">Items Selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('add25')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              +25 Units Restock
            </button>
            <button
              onClick={() => handleBulkAction('markInStock')}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Mark In Stock
            </button>
            <button
              onClick={() => handleBulkAction('markOutOfStock')}
              className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Mark Sold Out
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. STOCK CONTROL TABLE / LIST */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Boxes className="w-7 h-7" />
            </div>
            <h3 className="font-heading font-extrabold text-base text-slate-800">
              No inventory items found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? `No products matched "${searchQuery}". Try searching with another keyword or clear filters.`
                : 'There are no products in this stock category right now.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setSelectedCategory('all');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredProducts.length}
                      onChange={handleSelectAll}
                      className="rounded-sm border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="py-3.5 px-3">Item Details</th>
                  <th className="py-3.5 px-3">Price</th>
                  <th className="py-3.5 px-3 text-center">Live Status</th>
                  <th className="py-3.5 px-3 text-center">Quick Stock Adjuster</th>
                  <th className="py-3.5 pr-4 pl-3 text-right">Instant Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => {
                  const stock = getProductStock(product);
                  const isOut = isItemOutOfStock(product);
                  const isLow = isItemLowStock(product);
                  const isSelected = selectedIds.has(product.id);
                  const currentInputValue = editingQuantities[product.id] ?? String(stock);

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isSelected ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(product.id)}
                          className="rounded-sm border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer w-4 h-4"
                        />
                      </td>

                      {/* Item Details (Thumbnail, Name, Category) */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-heading font-extrabold text-xs sm:text-sm text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                              {product.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="font-medium">{product.category || 'Bakery'}</span>
                              <span>•</span>
                              <span className="font-mono text-slate-400 text-[10px]">
                                SKU: {product.id.slice(-6)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Retail Price */}
                      <td className="py-3.5 px-3 font-amount font-extrabold text-slate-800 font-mono text-xs sm:text-sm">
                        ₹{product.price}
                      </td>

                      {/* Live Stock Badge & Threshold Customizer */}
                      <td className="py-3.5 px-3 text-center">
                        <div>
                          {isOut ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                              Sold Out (0)
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Low Stock ({stock})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              In Stock ({stock})
                            </span>
                          )}

                          <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-slate-400">
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
                                  showToast(`✓ Alert threshold set to ≤ ${val} for "${product.name}"`);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              title="Set low stock alert threshold for this item (default 5)"
                              className="w-8 text-center font-mono font-bold text-[10px] bg-slate-100 hover:bg-slate-200 focus:bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-rose-500/40"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Quick Adjust Stepper: [-5] [-1] [Direct Input] [+1] [+5] */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-200">
                          {/* -5 Button */}
                          <button
                            onClick={() => handleAdjustQuantity(product, -5)}
                            disabled={stock <= 0}
                            title="Deduct 5 items"
                            className="px-2 py-1 text-[11px] font-extrabold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all disabled:opacity-30 cursor-pointer"
                          >
                            -5
                          </button>

                          {/* -1 Button */}
                          <button
                            onClick={() => handleAdjustQuantity(product, -1)}
                            disabled={stock <= 0}
                            title="Deduct 1 item"
                            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all disabled:opacity-30 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          {/* Direct Input Number Field */}
                          <input
                            type="number"
                            min="0"
                            value={currentInputValue}
                            onChange={(e) => handleQuantityInputChange(product.id, e.target.value)}
                            onBlur={() => handleQuantityInputBlur(product)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleQuantityInputBlur(product);
                            }}
                            className="w-14 text-center font-mono font-bold text-xs sm:text-sm bg-white border border-slate-200 rounded-lg py-1 px-1 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 text-slate-900"
                            title="Type exact stock number and press Enter or click outside"
                          />

                          {/* +1 Button */}
                          <button
                            onClick={() => handleAdjustQuantity(product, 1)}
                            title="Add 1 item"
                            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          {/* +5 Button */}
                          <button
                            onClick={() => handleAdjustQuantity(product, 5)}
                            title="Add 5 items"
                            className="px-2 py-1 text-[11px] font-extrabold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
                          >
                            +5
                          </button>
                        </div>
                      </td>

                      {/* Quick Toggle: Mark In Stock / Out of Stock */}
                      <td className="py-3.5 pr-4 pl-3 text-right">
                        <button
                          onClick={() => handleToggleAvailability(product)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isOut
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
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
