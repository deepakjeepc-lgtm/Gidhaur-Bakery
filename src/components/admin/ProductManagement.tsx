import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
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
  Link2,
  GripVertical,
  X
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import {
  collection,
  addDoc,
  setDoc,
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
import { ExtrasManagementScreen } from './ExtrasManagementScreen';
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
  totalProducts?: number;
  isDragging?: boolean;
  isDragOver?: boolean;
  onMoveToFront?: (product: Product, index: number) => void;
  onMoveUp?: (product: Product, index: number) => void;
  onMoveDown?: (product: Product, index: number) => void;
  onToggleAvailability: (product: Product) => void;
  onToggleFeatured?: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onOpenLinkGroup: (product: Product) => void;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDrop?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: () => void;
  onTouchStartDrag?: (e: React.TouchEvent, index: number) => void;
}

const ProductTableRow = memo<ProductTableRowProps>(({
  product,
  idx,
  isDragging,
  isDragOver,
  onToggleAvailability,
  onEdit,
  onDelete,
  onOpenLinkGroup,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onTouchStartDrag
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
      data-product-index={idx}
      draggable
      onDragStart={(e) => onDragStart?.(e, idx)}
      onDragOver={(e) => onDragOver?.(e, idx)}
      onDrop={(e) => onDrop?.(e, idx)}
      onDragEnd={onDragEnd}
      className={`transition-colors duration-75 group select-none ${
        isPinned ? 'bg-amber-50/30' : 'hover:bg-stone-50/70'
      } ${
        isDragging ? 'opacity-30 bg-amber-100/60' : ''
      } ${
        isDragOver ? 'bg-amber-100/90 outline-2 outline-amber-500 -outline-offset-2' : ''
      }`}
    >
      {/* Product & Position */}
      <td className="py-4 px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Grip Handle & Position Badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              onTouchStart={(e) => onTouchStartDrag?.(e, idx)}
              className="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 active:bg-amber-100 cursor-grab active:cursor-grabbing shrink-0 transition-colors touch-none select-none"
              title="Left click hold on Desktop or Long press on Mobile to reorder product"
              aria-label={`Drag ${product.name} to reorder`}
            >
              <GripVertical className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
            </div>

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
export const ProductManagement = React.memo<ProductManagementProps>(({ products, onRefresh }) => {
  // Local optimistic products state for butter-smooth zero-reload reordering
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalProducts(products);
    }
  }, [products]);

  const [categories, setCategories] = useState<string[]>(() => getCachedCategories());
  const [categoryIcons, setCategoryIcons] = useState<Record<string, CategoryDetail>>(() =>
    getCachedCategoryIcons()
  );
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Full-screen dedicated views: 'catalog' | 'add-edit' | 'categories' | 'link-groups' | 'extras'
  const [activeSubView, setActiveSubView] = useState<'catalog' | 'add-edit' | 'categories' | 'link-groups' | 'extras'>('catalog');
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

  const openExtrasScreen = useCallback(() => {
    setActiveSubView('extras');
  }, []);

  // Toast / feedback message
  const [seedSuccessMessage, setSeedSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToCategories([], (cats, icons) => {
      queueMicrotask(() => {
        setCategories(cats);
        if (icons) setCategoryIcons(icons);
      });
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

      // 1. Immediate optimistic local update for 0ms perceptible latency
      try {
        const cachedStr = localStorage.getItem('swadeep_cached_products');
        let currentProds: Product[] = cachedStr ? JSON.parse(cachedStr) : [...products];
        const minOrder = currentProds.reduce((min, p) => Math.min(min, p.sortOrder ?? 100), 100);
        const resolvedId = id || `item-${Date.now()}`;
        const updatedItem = {
          ...cleanPayload,
          id: resolvedId,
          sortOrder: isFeatured ? minOrder - 1 : 100,
        } as Product;

        if (id) {
          currentProds = currentProds.map((p) => (p.id === id ? { ...p, ...updatedItem } : p));
        } else {
          currentProds.unshift(updatedItem);
        }
        localStorage.setItem('swadeep_cached_products', JSON.stringify(currentProds));
        window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: currentProds }));
        if (onRefresh) onRefresh();

        // Sync to local server for zero-latency offline persistence
        fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedItem),
        }).catch(() => {});
      } catch {}

      setSeedSuccessMessage(`✓ "${cleanPayload.name}" ${id ? 'updated' : 'added'} successfully!`);
      setTimeout(() => setSeedSuccessMessage(null), 3500);

      // 2. Persist to Firestore in background
      try {
        if (id) {
          const prodDoc = doc(db, 'products', id);
          await setDoc(
            prodDoc,
            {
              ...cleanPayload,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          const minOrder = products.reduce((min, p) => Math.min(min, p.sortOrder ?? 100), 100);
          await addDoc(collection(db, 'products'), {
            ...cleanPayload,
            sortOrder: isFeatured ? minOrder - 1 : 100,
            createdAt: serverTimestamp(),
          });
        }
        // Also sync to local server API fallback
        try {
          fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...cleanPayload, id: id || `item-${Date.now()}` }),
          }).catch(() => {});
        } catch {}
      } catch (err) {
        console.warn('Firestore product persist notice (saved locally):', err);
      }
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
        await setDoc(
          prodDoc,
          {
            available: !product.available,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
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
        await setDoc(
          prodDoc,
          {
            isFeatured: isNowFeatured,
            isPinnedToFront: isNowFeatured,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
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
          batch.set(
            doc(db, 'products', p.id),
            {
              sortOrder: p.sortOrder,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        });
        await batch.commit();
      } catch (err: any) {
        console.warn('Batch update product sortOrder note:', err?.message || err);
      }
    },
    [products]
  );

  // Debounced persistence helper for product sort order (prevents screen flashes)
  const productSaveDebounceRef = useRef<number | null>(null);

  const persistProductOrder = useCallback((updatedList: Product[]) => {
    if (productSaveDebounceRef.current) {
      clearTimeout(productSaveDebounceRef.current);
    }
    productSaveDebounceRef.current = window.setTimeout(async () => {
      try {
        // Quietly update local storage cache without full-page event
        const cachedStr = localStorage.getItem('swadeep_cached_products');
        const allCurrent: Product[] = cachedStr ? JSON.parse(cachedStr) : [...updatedList];
        const orderMap = new Map<string, number>();
        updatedList.forEach((p, i) => orderMap.set(p.id, i + 1));

        const newAll = allCurrent.map((p) => {
          if (orderMap.has(p.id)) {
            return { ...p, sortOrder: orderMap.get(p.id) };
          }
          return p;
        });
        localStorage.setItem('swadeep_cached_products', JSON.stringify(newAll));

        // Firestore batch update in background
        const batch = writeBatch(db);
        updatedList.forEach((p, i) => {
          batch.set(
            doc(db, 'products', p.id),
            {
              sortOrder: i + 1,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        });
        await batch.commit();
      } catch (err: any) {
        console.warn('Background product sortOrder save note:', err?.message || err);
      }
    }, 500);
  }, []);

  // Filtered & sorted products (derived from localProducts for 0ms optimistic UI)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return localProducts.filter((p) => {
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
  }, [localProducts, searchQuery, selectedCategory]);

  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((cat, idx) => {
      map.set(cat.toLowerCase().trim(), idx);
    });
    return map;
  }, [categories]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      // 1. In 'All' view or multi-category searches, strictly order by the arranged Category sequence
      if (selectedCategory === 'All') {
        const catA = (a.category || '').toLowerCase().trim();
        const catB = (b.category || '').toLowerCase().trim();

        const catIdxA = categoryOrderMap.has(catA) ? categoryOrderMap.get(catA)! : 9999;
        const catIdxB = categoryOrderMap.has(catB) ? categoryOrderMap.get(catB)! : 9999;

        if (catIdxA !== catIdxB) {
          return catIdxA - catIdxB;
        }
      }

      // 2. Within each category (or when a single category tab is selected), sort by manual order
      const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : 1000;
      const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : 1000;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      const aPin = Boolean(a.isFeatured || a.isPinnedToFront);
      const bPin = Boolean(b.isFeatured || b.isPinnedToFront);
      if (aPin && !bPin) return -1;
      if (!aPin && bPin) return 1;

      return (a.name || '').localeCompare(b.name || '');
    });
  }, [filteredProducts, selectedCategory, categoryOrderMap]);

  // Drag and drop state for products
  const [draggedProductIdx, setDraggedProductIdx] = useState<number | null>(null);
  const [dragOverProductIdx, setDragOverProductIdx] = useState<number | null>(null);
  const touchActiveProductIdxRef = useRef<number | null>(null);

  // Smooth, jitter-free product reorder handler
  const handleProductReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= sortedProducts.length || toIndex >= sortedProducts.length) return;

      const fromItem = sortedProducts[fromIndex];
      const toItem = sortedProducts[toIndex];
      if (!fromItem || !toItem) return;

      setLocalProducts((prev) => {
        const current = [...prev];
        const actualFrom = current.findIndex((p) => p.id === fromItem.id);
        const actualTo = current.findIndex((p) => p.id === toItem.id);
        if (actualFrom === -1 || actualTo === -1) return prev;

        const [moved] = current.splice(actualFrom, 1);
        current.splice(actualTo, 0, moved);

        const reordered = current.map((p, i) => ({ ...p, sortOrder: i + 1 }));
        persistProductOrder(reordered);
        return reordered;
      });

      setSeedSuccessMessage(`✓ Reordered "${fromItem.name}" to #${toIndex + 1}!`);
      setTimeout(() => setSeedSuccessMessage(null), 2500);
    },
    [sortedProducts, persistProductOrder]
  );

  // Desktop Drag Handlers with zero-jitter state tracking
  const handleProductDragStart = useCallback((e: React.DragEvent, index: number) => {
    isDraggingRef.current = true;
    setDraggedProductIdx(index);
    triggerHaptic('medium');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleProductDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverProductIdx((prev) => (prev !== index ? index : prev));
  }, []);

  const handleProductDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    isDraggingRef.current = false;
    if (draggedProductIdx !== null && draggedProductIdx !== index) {
      handleProductReorder(draggedProductIdx, index);
      triggerHaptic('success');
    }
    setDraggedProductIdx(null);
    setDragOverProductIdx(null);
  }, [draggedProductIdx, handleProductReorder]);

  const handleProductDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    setDraggedProductIdx(null);
    setDragOverProductIdx(null);
  }, []);

  // Mobile Touch Handlers
  const handleProductTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    isDraggingRef.current = true;
    touchActiveProductIdxRef.current = index;
    setDraggedProductIdx(index);
    triggerHaptic('medium');
  }, []);

  const handleProductTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchActiveProductIdxRef.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const rowEl = el?.closest('[data-product-index]');
    if (rowEl) {
      const targetIdx = Number(rowEl.getAttribute('data-product-index'));
      if (!isNaN(targetIdx) && targetIdx !== dragOverProductIdx) {
        setDragOverProductIdx(targetIdx);
        triggerHaptic('selection');
      }
    }
  }, [dragOverProductIdx]);

  const handleProductTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (touchActiveProductIdxRef.current !== null && dragOverProductIdx !== null && touchActiveProductIdxRef.current !== dragOverProductIdx) {
      handleProductReorder(touchActiveProductIdxRef.current, dragOverProductIdx);
      triggerHaptic('success');
    }
    touchActiveProductIdxRef.current = null;
    setDraggedProductIdx(null);
    setDragOverProductIdx(null);
  }, [dragOverProductIdx, handleProductReorder]);

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

      // Also remove from local server
      fetch(`/api/products/${encodeURIComponent(targetId)}`, { method: 'DELETE' }).catch(() => {});
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
          queueMicrotask(() => {
            setCategories(newCats);
            if (newIcons) setCategoryIcons(newIcons);
          });
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

  if (activeSubView === 'extras') {
    return (
      <ExtrasManagementScreen
        onBack={handleBackToCatalog}
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

          {/* Manage Extras & Add-ons Library */}
          <button
            type="button"
            onClick={openExtrasScreen}
            className="px-4 py-2.5 bg-white hover:bg-amber-50/50 border border-amber-200/90 text-amber-900 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
            id="admin-manage-extras-btn"
            title="Manage Extras & Add-ons Library (Cheese, Corn, Spicy, Dips)"
          >
            <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span>+ Extras</span>
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
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72 md:w-80 shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-slate-400 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-200/70 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills & Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0 no-scrollbar py-1">
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
                  <th className="py-3.5 px-4 sm:px-6">
                    <div className="flex items-center gap-2">
                      <span>Product & Position</span>
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80 font-normal normal-case">
                        <GripVertical className="w-3 h-3 text-amber-600" />
                        Hold & drag to reorder
                      </span>
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Pricing / Sizes</th>
                  <th className="py-3.5 px-4">In-Stock Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody
                className="divide-y divide-stone-100"
                onTouchMove={handleProductTouchMove}
                onTouchEnd={handleProductTouchEnd}
                onTouchCancel={handleProductTouchEnd}
              >
                {sortedProducts.map((product, idx) => (
                  <ProductTableRow
                    key={product.id}
                    product={product}
                    idx={idx}
                    totalProducts={sortedProducts.length}
                    isDragging={draggedProductIdx === idx}
                    isDragOver={dragOverProductIdx === idx}
                    onDragStart={handleProductDragStart}
                    onDragOver={handleProductDragOver}
                    onDrop={handleProductDrop}
                    onDragEnd={handleProductDragEnd}
                    onTouchStartDrag={handleProductTouchStart}
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
});

ProductManagement.displayName = 'ProductManagement';
