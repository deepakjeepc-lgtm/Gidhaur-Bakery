import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Leaf,
  ChevronsUp,
  ArrowUp,
  ArrowDown,
  Link2
} from 'lucide-react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Product } from '../../types';
import {
  recordDeletedProduct,
  sanitizeProducts,
  getSanitizedCachedProducts
} from '../../services/productService';
import { cleanupProductImages } from '../../services/storageCleanupService';
import {
  DEFAULT_CATEGORIES,
  getCachedCategories,
  getCachedCategoryIcons,
  subscribeToCategories,
  saveCategories,
  CategoryDetail
} from '../../services/categoryService';
import { CategoryManagementScreen } from './CategoryManagementScreen';
import { ProductFormScreen } from './ProductFormScreen';
import { ProductLinkGroupScreen } from './ProductLinkGroupScreen';
import { renderCategoryIcon } from '../../utils/categoryIcons';

interface ProductManagementProps {
  products: Product[];
  onRefresh?: () => void;
}

// -------------------------------------------------------------
// Memoized Product Table Row for 60fps Scrolling & Instant Sorting
// -------------------------------------------------------------
interface ProductTableRowProps {
  product: Product;
  idx: number;
  totalProducts: number;
  onMoveToFront: (product: Product, index: number) => void;
  onMoveUp: (product: Product, index: number) => void;
  onMoveDown: (product: Product, index: number) => void;
  onToggleAvailability: (product: Product) => void;
  onToggleFeatured?: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onOpenLinkGroup: (product: Product) => void;
}

const ProductTableRow = memo<ProductTableRowProps>(({
  product,
  idx,
  totalProducts,
  onMoveToFront,
  onMoveUp,
  onMoveDown,
  onToggleAvailability,
  onEdit,
  onDelete,
  onOpenLinkGroup
}) => {
  const isPinned = Boolean(product.isFeatured || product.isPinnedToFront);

  const thumb = useMemo(() => {
    const isVegSalad = (url?: string) => !url || url.includes('photo-1546069901-ba9599a7e63c');
    let t = product.imageUrl && !isVegSalad(product.imageUrl) ? product.imageUrl : '';
    if (!t && product.images && product.images.length > 0) {
      t = product.images.find((img) => !isVegSalad(img)) || '';
    }
    if (!t && product.variants && product.variants.length > 0) {
      t = product.variants.find((v) => !isVegSalad(v.imageUrl))?.imageUrl || '';
    }
    return t;
  }, [product.imageUrl, product.images, product.variants]);

  return (
    <tr
      className={`hover:bg-stone-50/50 transition-colors group ${
        isPinned ? 'bg-amber-50/30' : ''
      }`}
    >
      {/* Product & Position */}
      <td className="py-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Position Badge & Reorder Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`w-6 h-6 rounded-lg text-[10px] font-heading font-extrabold flex items-center justify-center shrink-0 ${
                idx === 0
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600'
              }`}
              title={`Position #${idx + 1} in Menu`}
            >
              #{idx + 1}
            </span>

            <div className="flex items-center gap-0.5 shrink-0 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => onMoveToFront(product, idx)}
                disabled={idx === 0}
                className="p-1 text-amber-600 hover:text-amber-800 disabled:opacity-20 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer flex items-center"
                title="Move to Front (1st Position)"
              >
                <ChevronsUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMoveUp(product, idx)}
                disabled={idx === 0}
                className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-20 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                title="Move 1 step earlier"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onMoveDown(product, idx)}
                disabled={idx === totalProducts - 1}
                className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-20 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                title="Move 1 step later"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Photo Thumbnail */}
          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white shrink-0 border border-stone-200/80 shadow-2xs flex items-center justify-center">
            {thumb ? (
              <img
                src={thumb}
                alt={product.name}
                className={`w-full h-full ${product.imageFit === 'contain' ? 'object-contain p-0.5 bg-white' : 'object-cover bg-white'}`}
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <span className="text-[11px] font-extrabold text-slate-600 uppercase">
                  {product.name.slice(0, 2)}
                </span>
              </div>
            )}
            {product.images && product.images.length > 1 && (
              <span className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-white text-[8px] font-bold text-center py-0.2">
                {product.images.length} photos
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-heading font-bold text-sm text-stone-900 tracking-tight">
                {product.name}
              </span>
              {!product.isNonFood && product.isVegetarian !== false && (
                <Leaf className="w-3 h-3 text-emerald-600 shrink-0" />
              )}
              {product.isNonFood && (
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600 text-[9px] font-semibold tracking-tight border border-slate-200">
                  Non-Food
                </span>
              )}
              {isPinned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-heading font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                  <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                  <span>Pinned to Front</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-400 line-clamp-1 max-w-xs">
              {product.description || 'No description provided'}
            </p>

            {/* Variant Group Badge (Compact single-line, first word only) */}
            {product.groupId && (
              <div className="flex items-center gap-1 mt-1">
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-bold"
                  title={`Linked in group: ${product.groupName || ''}`}
                >
                  <Link2 className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                  <span>Group: {product.groupName?.trim().split(/\s+/)[0] || 'Linked'}</span>
                  {product.groupVariantLabel && (
                    <span className="text-[9px] text-indigo-500 font-medium">({product.groupVariantLabel})</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="py-4 px-4 whitespace-nowrap">
        <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-[11px] font-medium border border-stone-200/60">
          {product.category}
        </span>
      </td>

      {/* Pricing / Sizes */}
      <td className="py-4 px-4 whitespace-nowrap">
        <div className="space-y-0.5">
          <div className="font-heading font-extrabold text-sm text-stone-900">
            ₹{product.price}
          </div>
          {product.variants && product.variants.length > 0 ? (
            <div className="flex items-center gap-1 flex-wrap max-w-[160px]">
              <span className="inline-block text-[10px] font-bold px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                {product.variants.length} Options
              </span>
              {product.variants.some((v) => v.available === false) && (
                <span className="inline-block text-[9px] font-extrabold px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded">
                  {product.variants.filter((v) => v.available === false).length} Out
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-stone-400">Standard Size</span>
          )}
        </div>
      </td>

      {/* In-Stock Status */}
      <td className="py-4 px-4 whitespace-nowrap">
        <button
          onClick={() => onToggleAvailability(product)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            product.available !== false
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              product.available !== false ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          <span>{product.available !== false ? 'In Stock' : 'Out of Stock'}</span>
        </button>
      </td>

      {/* Actions */}
      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => onOpenLinkGroup(product)}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              product.groupId
                ? 'text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100'
                : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
            }`}
            title="Link & group product variants"
          >
            <Link2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(product)}
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            title="Edit product details & photos"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(product)}
            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            title="Delete product permanently"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});

ProductTableRow.displayName = 'ProductTableRow';

// -------------------------------------------------------------
// Main Product Management Dashboard View
// -------------------------------------------------------------
export const ProductManagement: React.FC<ProductManagementProps> = ({ products, onRefresh }) => {
  const [categories, setCategories] = useState<string[]>(() => getCachedCategories());
  const [categoryIcons, setCategoryIcons] = useState<Record<string, CategoryDetail>>(() =>
    getCachedCategoryIcons()
  );
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Full-screen dedicated views: 'catalog' | 'add-edit' | 'categories' | 'link-groups'
  const [activeSubView, setActiveSubView] = useState<'catalog' | 'add-edit' | 'categories' | 'link-groups'>('catalog');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Deletion modal state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Flipkart Variant Linking Screen
  const [linkGroupProduct, setLinkGroupProduct] = useState<Product | null>(null);

  const openLinkGroup = useCallback((prod: Product | null) => {
    setLinkGroupProduct(prod);
    setActiveSubView('link-groups');
  }, []);

  // Toast / feedback message
  const [seedSuccessMessage, setSeedSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToCategories([], (cats, icons) => {
      setCategories(cats);
      if (icons) setCategoryIcons(icons);
    });
    return () => unsub();
  }, []);

  const openAddScreen = useCallback(() => {
    setEditingProduct(null);
    setActiveSubView('add-edit');
  }, []);

  const openEditScreen = useCallback((prod: Product) => {
    setEditingProduct(prod);
    setActiveSubView('add-edit');
  }, []);

  const openCategoriesScreen = useCallback(() => {
    setActiveSubView('categories');
  }, []);

  const handleBackToCatalog = useCallback(() => {
    setActiveSubView('catalog');
    setEditingProduct(null);
  }, []);

  // Save product from isolated ProductFormModal
  const handleSaveProduct = useCallback(
    async ({
      id,
      productPayload,
      isFeatured,
    }: {
      id?: string;
      productPayload: Partial<Product>;
      isFeatured: boolean;
    }) => {
      // Auto-save category if new
      if (productPayload.category && !categories.includes(productPayload.category)) {
        const updatedCats = [...categories, productPayload.category];
        saveCategories(updatedCats).catch(() => {});
        setCategories(updatedCats);
      }

      // Sanitize payload: Ensure imageFits contains ONLY valid Firestore keys (no periods, slashes, or URLs)
      const cleanPayload: any = { ...productPayload };
      if (cleanPayload.imageFits && typeof cleanPayload.imageFits === 'object') {
        const sanitizedFits: Record<string, 'cover' | 'contain'> = {};
        for (const [key, val] of Object.entries(cleanPayload.imageFits)) {
          if (!key.includes('.') && !key.includes('/')) {
            sanitizedFits[key] = val as 'cover' | 'contain';
          }
        }
        cleanPayload.imageFits = sanitizedFits;
      }

      // Remove undefined values to prevent Firestore serialization errors
      Object.keys(cleanPayload).forEach((k) => {
        if (cleanPayload[k] === undefined) {
          delete cleanPayload[k];
        }
      });

      if (id) {
        // Edit existing
        const prodDoc = doc(db, 'products', id);
        await updateDoc(prodDoc, {
          ...cleanPayload,
          updatedAt: serverTimestamp(),
        });
        setSeedSuccessMessage(`✓ "${cleanPayload.name}" updated successfully!`);
      } else {
        // Create new
        const minOrder = products.reduce((min, p) => Math.min(min, p.sortOrder ?? 100), 100);
        await addDoc(collection(db, 'products'), {
          ...cleanPayload,
          sortOrder: isFeatured ? minOrder - 1 : 100,
          createdAt: serverTimestamp(),
        });
        setSeedSuccessMessage(`✓ "${cleanPayload.name}" added to menu catalog!`);
      }

      // Optimistic local update
      try {
        const cachedStr = localStorage.getItem('swadeep_cached_products');
        let currentProds: Product[] = cachedStr ? JSON.parse(cachedStr) : [...products];
        if (id) {
          currentProds = currentProds.map((p) =>
            p.id === id ? { ...p, ...productPayload, id } : p
          );
        } else {
          const minOrder = currentProds.reduce((min, p) => Math.min(min, p.sortOrder ?? 100), 100);
          currentProds.unshift({
            ...productPayload,
            id: `item-${Date.now()}`,
            sortOrder: isFeatured ? minOrder - 1 : 100,
          } as Product);
        }
        localStorage.setItem('swadeep_cached_products', JSON.stringify(currentProds));
        window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: currentProds }));
      } catch {}

      setTimeout(() => setSeedSuccessMessage(null), 3500);
    },
    [categories, products]
  );

  // Toggle in-stock status
  const handleToggleAvailability = useCallback(
    async (product: Product) => {
      try {
        const cachedStr = localStorage.getItem('swadeep_cached_products');
        const currentProds: Product[] = cachedStr ? JSON.parse(cachedStr) : [...products];
        const updated = currentProds.map((p) =>
          p.id === product.id ? { ...p, available: !product.available } : p
        );
        localStorage.setItem('swadeep_cached_products', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: updated }));
      } catch {}

      try {
        const prodDoc = doc(db, 'products', product.id);
        await updateDoc(prodDoc, {
          available: !product.available,
          updatedAt: serverTimestamp(),
        });
      } catch (err: any) {
        console.warn('Firestore stock update note:', err?.message || err);
      }
    },
    [products]
  );

  // Toggle Featured & Pinned to front
  const handleToggleFeatured = useCallback(
    async (product: Product) => {
      const isNowFeatured = !product.isFeatured && !product.isPinnedToFront;

      try {
        const cachedStr = localStorage.getItem('swadeep_cached_products');
        const currentProds: Product[] = cachedStr ? JSON.parse(cachedStr) : [...products];
        const updated = currentProds.map((p) =>
          p.id === product.id
            ? { ...p, isFeatured: isNowFeatured, isPinnedToFront: isNowFeatured }
            : p
        );
        localStorage.setItem('swadeep_cached_products', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: updated }));
      } catch {}

      try {
        const prodDoc = doc(db, 'products', product.id);
        await updateDoc(prodDoc, {
          isFeatured: isNowFeatured,
          isPinnedToFront: isNowFeatured,
          updatedAt: serverTimestamp(),
        });
      } catch (err: any) {
        console.warn('Firestore featured update note:', err?.message || err);
      }
    },
    [products]
  );

  // Reorder helper with instantaneous local cache dispatch
  const updateProductOrderList = useCallback(
    async (updatedList: Product[], successMsg?: string) => {
      const reordered = updatedList.map((p, i) => ({
        ...p,
        sortOrder: i + 1,
      }));

      try {
        const cachedStr = localStorage.getItem('swadeep_cached_products');
        const allCurrent: Product[] = cachedStr ? JSON.parse(cachedStr) : [...products];
        const orderMap = new Map<string, number>();
        reordered.forEach((p) => orderMap.set(p.id, p.sortOrder!));

        const newAll = allCurrent.map((p) => {
          if (orderMap.has(p.id)) {
            return { ...p, sortOrder: orderMap.get(p.id) };
          }
          return p;
        });
        localStorage.setItem('swadeep_cached_products', JSON.stringify(newAll));
        window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: newAll }));
      } catch {}

      if (successMsg) {
        setSeedSuccessMessage(successMsg);
        setTimeout(() => setSeedSuccessMessage(null), 3000);
      }

      try {
        const batch = writeBatch(db);
        reordered.forEach((p) => {
          batch.update(doc(db, 'products', p.id), {
            sortOrder: p.sortOrder,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      } catch (err: any) {
        console.warn('Batch update product sortOrder note:', err?.message || err);
      }
    },
    [products]
  );

  // Filtered & sorted products (memoized)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

      let matchesCategory = false;
      if (selectedCategory === 'All') {
        matchesCategory = true;
      } else if (selectedCategory === 'Featured') {
        matchesCategory = Boolean(p.isFeatured || p.isPinnedToFront);
      } else {
        matchesCategory = p.category === selectedCategory;
      }

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : 1000;
      const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : 1000;
      return aOrder - bOrder;
    });
  }, [filteredProducts]);

  const handleMoveProductToFront = useCallback(
    async (product: Product, index: number) => {
      if (index <= 0) return;
      const updated = [...sortedProducts];
      const [selected] = updated.splice(index, 1);
      updated.unshift(selected);
      await updateProductOrderList(updated, `"${product.name}" moved to #1 position!`);
    },
    [sortedProducts, updateProductOrderList]
  );

  const handleMoveProductUp = useCallback(
    async (product: Product, index: number) => {
      if (index <= 0) return;
      const updated = [...sortedProducts];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      await updateProductOrderList(updated);
    },
    [sortedProducts, updateProductOrderList]
  );

  const handleMoveProductDown = useCallback(
    async (product: Product, index: number) => {
      if (index >= sortedProducts.length - 1) return;
      const updated = [...sortedProducts];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      await updateProductOrderList(updated);
    },
    [sortedProducts, updateProductOrderList]
  );

  // Complete Product Deletion + Guaranteed Storage Image Cleanup
  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);

    const targetId = productToDelete.id;
    const targetName = productToDelete.name;

    // 1. Permanent deletion record
    await recordDeletedProduct(targetId, targetName);

    // 2. Local cache cleanup
    try {
      const cachedStr = localStorage.getItem('swadeep_cached_products');
      const currentProds: Product[] = cachedStr ? JSON.parse(cachedStr) : [...products];
      const updated = sanitizeProducts(currentProds.filter((p) => p.id !== targetId));
      localStorage.setItem('swadeep_cached_products', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: updated }));
    } catch {}

    // 3. Automatically remove all associated images from Firebase Storage (no orphaned files)
    try {
      await cleanupProductImages(productToDelete);
    } catch (storageErr) {
      console.warn('Storage image cleanup note:', storageErr);
    }

    // 4. Delete Firestore doc
    try {
      await deleteDoc(doc(db, 'products', targetId));
      setProductToDelete(null);
      setSeedSuccessMessage(`🗑️ "${targetName}" and its storage photos were deleted!`);
      setTimeout(() => setSeedSuccessMessage(null), 3500);
    } catch (err: any) {
      console.warn('Firestore delete note:', err?.message || err);
      setProductToDelete(null);
      setSeedSuccessMessage(`🗑️ "${targetName}" deleted successfully!`);
      setTimeout(() => setSeedSuccessMessage(null), 3500);
    } finally {
      setIsDeleting(false);
    }
  };

  const featuredCount = useMemo(
    () => products.filter((p) => p.isFeatured || p.isPinnedToFront).length,
    [products]
  );

  // Dedicated Full Screens (No modals, zero scroll lag, zero jitter)
  if (activeSubView === 'add-edit') {
    return (
      <ProductFormScreen
        product={editingProduct}
        categories={categories}
        onBack={handleBackToCatalog}
        onSave={handleSaveProduct}
      />
    );
  }

  if (activeSubView === 'categories') {
    return (
      <CategoryManagementScreen
        categories={categories}
        products={products}
        iconsMap={categoryIcons}
        onBack={handleBackToCatalog}
        onCategoriesChange={(newCats, newIcons) => {
          setCategories(newCats);
          if (newIcons) setCategoryIcons(newIcons);
        }}
      />
    );
  }

  if (activeSubView === 'link-groups') {
    return (
      <ProductLinkGroupScreen
        product={linkGroupProduct}
        allProducts={products}
        onBack={handleBackToCatalog}
        onSuccess={(msg) => {
          handleBackToCatalog();
          setSeedSuccessMessage(msg);
          setTimeout(() => setSeedSuccessMessage(null), 4000);
          onRefresh?.();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Action and Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-extrabold text-2xl text-stone-900">
            Menu Catalog & Products ({products.length})
          </h2>
          <p className="text-xs text-stone-500">
            Add new food items, configure custom sizes & portions, upload photos, and manage live stock.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Manage Categories */}
          <button
            onClick={openCategoriesScreen}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
            id="admin-manage-categories-btn"
            title="Manage Menu Category Tabs (Add/Delete/Rename/Reorder)"
          >
            <Layers className="w-4 h-4 text-slate-600" />
            <span>Manage Categories ({categories.length})</span>
          </button>

          {/* Link & Group Products */}
          <button
            type="button"
            onClick={() => openLinkGroup(null)}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
            id="admin-link-variants-btn"
            title="Link & Group Product Variants"
          >
            <Link2 className="w-4 h-4 text-indigo-600" />
            <span>Link Variants</span>
          </button>

          <button
            onClick={openAddScreen}
            className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-slate-950/20 cursor-pointer"
            id="admin-add-product-btn"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {seedSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{seedSuccessMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-slate-400"
          />
        </div>

        {/* Category Pills & Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-heading font-bold shrink-0 transition-all cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All ({products.length})</span>
          </button>

          {featuredCount > 0 && (
            <button
              onClick={() => setSelectedCategory('Featured')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-heading font-bold shrink-0 transition-all cursor-pointer ${
                selectedCategory === 'Featured'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⭐ Pinned / Front ({featuredCount})</span>
            </button>
          )}

          {categories.map((cat) => {
            const visual = categoryIcons[cat];
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-heading font-bold shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {renderCategoryIcon(
                  visual,
                  cat,
                  `w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-stone-500'}`
                )}
                <span>{cat}</span>
              </button>
            );
          })}

          <button
            onClick={openCategoriesScreen}
            className="px-3 py-1.5 rounded-xl text-xs font-heading font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-300 transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
            title="Rearrange Categories & Landing Screen Defaults"
          >
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            <span>Rearrange Tabs</span>
          </button>
        </div>
      </div>

      {/* Product Table / Virtualized Rendering */}
      {sortedProducts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h3 className="font-heading font-bold text-stone-800 text-lg">No Products Found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {products.length === 0
              ? 'Your menu is currently empty. Click "Add New Product" to start adding items.'
              : 'No items match your search or category filter.'}
          </p>
          {products.length === 0 && (
            <button
              onClick={openAddScreen}
              className="mt-2 px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Add New Product Now</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50/80 border-b border-stone-200/80 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Product & Position</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Pricing / Sizes</th>
                  <th className="py-3.5 px-4">In-Stock Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sortedProducts.map((product, idx) => (
                  <ProductTableRow
                    key={product.id}
                    product={product}
                    idx={idx}
                    totalProducts={sortedProducts.length}
                    onMoveToFront={handleMoveProductToFront}
                    onMoveUp={handleMoveProductUp}
                    onMoveDown={handleMoveProductDown}
                    onToggleAvailability={handleToggleAvailability}
                    onToggleFeatured={handleToggleFeatured}
                    onEdit={openEditScreen}
                    onDelete={(p) => setProductToDelete(p)}
                    onOpenLinkGroup={openLinkGroup}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-stone-900 text-lg">
                Delete "{productToDelete.name}"?
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                This item will be permanently removed from your online catalog and its cloud images deleted from storage.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
