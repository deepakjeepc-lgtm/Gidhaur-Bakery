import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Star,
  Layers,
  Link2,
  GripVertical,
  Ban,
  X
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import {
  collection,
  setDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Product } from '../../types';
import {
  recordDeletedProduct,
  unblacklistProduct,
  sanitizeProducts,
  saveProductsToIndexedDB
} from '../../services/productService';
import { cleanupProductImages } from '../../services/storageCleanupService';
import {
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
import { isQuotaExhausted } from '../../services/quotaService';
import { AdminQuotaBlockedModal } from './AdminQuotaBlockedModal';

interface ProductManagementProps {
  products: Product[];
  onRefresh?: () => void;
  onUpdateProducts?: (products: Product[]) => void;
}

interface ProductRowCardProps {
  product: Product;
  idx: number;
  isDragging?: boolean;
  isDragOver?: boolean;
  onToggleAvailability: (product: Product) => void;
  onToggleFeatured: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onOpenLinkGroup: (product: Product) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onTouchStartDrag: (e: React.TouchEvent, index: number) => void;
}

const ProductRowCard = memo<ProductRowCardProps>(({
  product,
  idx,
  isDragging,
  isDragOver,
  onToggleAvailability,
  onToggleFeatured,
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
  const isAvailable = product.available !== false;

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
    <div
      data-product-index={idx}
      draggable
      onDragStart={(e) => onDragStart(e, idx)}
      onDragOver={(e) => onDragOver(e, idx)}
      onDrop={(e) => onDrop(e, idx)}
      onDragEnd={onDragEnd}
      className={`border select-none p-2.5 sm:p-3 ${
        isDragOver
          ? 'border-[#FFFFFF] bg-[#242427]'
          : isDragging
          ? 'opacity-40 border-[#3F3F46] bg-[#18181B]'
          : !isAvailable
          ? 'bg-[#121212] border-[#27272A]'
          : isPinned
          ? 'bg-[#18181B] border-[#3F3F46] hover:bg-[#242427]'
          : 'bg-[#18181B] border-[#27272A] hover:bg-[#242427] hover:border-[#3F3F46]'
      }`}
      style={{
        contentVisibility: isDragging || isDragOver ? 'visible' : 'auto',
        containIntrinsicSize: '100px',
      }}
    >
      <div className="flex flex-col sm:flex-row items-start gap-3">
        {/* Left: Drag Handle + Rank + Compact Square Thumbnail */}
        <div className="flex items-start gap-2.5 shrink-0 w-full sm:w-auto">
          <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
            <div
              onTouchStart={(e) => onTouchStartDrag(e, idx)}
              className="p-1 text-[#71717A] hover:text-[#FFFFFF] hover:bg-[#242427] cursor-grab active:cursor-grabbing touch-none select-none"
              title="Hold & drag to reorder position"
              aria-label={`Drag ${product.name} to reorder`}
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
            <span
              className="text-[11px] font-mono font-bold tabular-nums px-1.5 py-0.2 bg-[#0A0A0A] border border-[#27272A] text-[#71717A]"
              title={`Position #${idx + 1}`}
            >
              #{idx + 1}
            </span>
          </div>

          <div className="flex flex-col items-center shrink-0">
            {!isAvailable && (
              <div className="w-14 sm:w-16 bg-[#EF4444]/15 border border-[#EF4444]/50 text-[#EF4444] font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-center py-0.2 mb-1">
                SOLD OUT
              </div>
            )}
            <div className={`relative w-14 h-14 sm:w-16 sm:h-16 aspect-square border overflow-hidden flex items-center justify-center shrink-0 ${
              !isAvailable ? 'border-[#27272A] bg-[#0A0A0A]' : 'border-[#27272A] bg-[#121212]'
            }`}>
              {thumb ? (
                <img
                  src={thumb}
                  alt={product.name}
                  className={`w-full h-full ${
                    product.imageFit === 'contain' ? 'object-contain p-1 bg-[#121212]' : 'object-cover bg-[#121212]'
                  } ${!isAvailable ? 'opacity-50 grayscale' : ''}`}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="text-xs font-mono font-bold text-[#71717A] uppercase tracking-[0.08em]">
                  {product.name.slice(0, 2)}
                </span>
              )}
              {product.images && product.images.length > 1 && (
                <span className="absolute bottom-0.5 right-0.5 bg-[#0A0A0A] border border-[#27272A] text-[#FFFFFF] text-[9px] font-mono font-bold px-1 py-0.2">
                  {product.images.length} IMG
                </span>
              )}
            </div>
          </div>

          {/* Mobile-only quick title beside image for compact screens */}
          <div className="sm:hidden flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#A1A1AA]">
              <span className="text-[#A1A1AA]">{product.category}</span>
              <span>·</span>
              <span className={product.isVegetarian !== false ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                {product.isNonFood ? 'NON-FOOD' : product.isVegetarian !== false ? 'PURE VEG' : 'NON-VEG'}
              </span>
              {product.groupId && (
                <>
                  <span>·</span>
                  <span className="text-[#FFFFFF] font-mono font-semibold">
                    {product.groupName?.trim().split(/\s+/)[0] || 'LINKED'}
                  </span>
                </>
              )}
            </div>
            <h3 className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-[15px] text-[#FFFFFF] tracking-[-0.01em] leading-[1.35]">
              {product.name}
            </h3>
            {product.description && (
              <p className="mt-1 text-[11px] text-[#A1A1AA] line-clamp-1 leading-relaxed">{product.description}</p>
            )}
          </div>
        </div>

        {/* Center + Right Details Column */}
        <div className="flex-1 min-w-0 w-full flex flex-col justify-between">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-2.5">
            {/* Desktop Metadata Kicker & Title */}
            <div className="hidden sm:block min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#A1A1AA]">
                <span className="text-[#A1A1AA]">{product.category}</span>
                <span>·</span>
                <span className={product.isVegetarian !== false ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                  {product.isNonFood ? 'NON-FOOD' : product.isVegetarian !== false ? 'PURE VEG' : 'STANDARD'}
                </span>
                {typeof product.prepTimeMinutes === 'number' && product.prepTimeMinutes > 0 && (
                  <>
                    <span>·</span>
                    <span>{product.prepTimeMinutes} MIN PREP</span>
                  </>
                )}
                {product.groupId && (
                  <>
                    <span>·</span>
                    <span className="text-[#FFFFFF] font-mono font-semibold">
                      {product.groupName || 'LINKED'}
                      {product.groupVariantLabel ? ` (${product.groupVariantLabel})` : ''}
                    </span>
                  </>
                )}
              </div>

              <h3 className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-[15px] sm:text-[16px] text-[#FFFFFF] tracking-[-0.01em] leading-[1.35]">
                {product.name}
              </h3>

              {product.description && (
                <p className="mt-1 text-xs text-[#A1A1AA] max-w-2xl leading-relaxed line-clamp-2">
                  {product.description}
                </p>
              )}
            </div>

            {/* Inline Pricing & All Sizes Breakdown (Matte Minimal Badges with 6px vertical spacing) */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] font-mono font-semibold tabular-nums tracking-[0.04em] lg:justify-end shrink-0">
              {product.variants && product.variants.length > 0 ? (
                product.variants.map((v, vIdx) => {
                  const vOut = v.available === false;
                  return (
                    <span
                      key={`${v.name}-${vIdx}`}
                      className={`px-2 py-0.5 border text-[11px] font-mono font-semibold tabular-nums tracking-[0.04em] ${
                        vOut
                          ? 'bg-[#0A0A0A] border-[#27272A] text-[#71717A] line-through'
                          : 'bg-[#0A0A0A] border-[#27272A] text-[#F4F4F5]'
                      }`}
                    >
                      {v.name} <strong className="font-mono font-bold text-[#FFFFFF]">₹{v.price}</strong>
                    </span>
                  );
                })
              ) : (
                <span className="px-2.5 py-0.5 border border-[#27272A] bg-[#0A0A0A] text-[#F4F4F5] font-mono font-semibold text-[12px] tabular-nums tracking-[0.04em]">
                  PRICE <strong className="font-mono font-bold text-xs sm:text-sm text-[#FFFFFF]">₹{product.price}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Bottom Editorial Action Strip */}
          <div className="mt-2.5 pt-2 border-t border-[#27272A] flex items-center justify-between gap-4 font-mono">
            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="inline-flex items-center gap-1.5 text-[#A1A1AA] hover:text-[#FFFFFF] text-[11px] font-bold uppercase tracking-[0.1em] cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#71717A]" />
                <span>EDIT</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleFeatured(product)}
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] cursor-pointer ${
                  isPinned ? 'text-[#F59E0B]' : 'text-[#A1A1AA] hover:text-[#F59E0B]'
                }`}
                title="Pin or unpin product to front of catalog"
              >
                <Star className={`w-3.5 h-3.5 ${isPinned ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#71717A]'}`} />
                <span>HERO</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleAvailability(product)}
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] cursor-pointer ${
                  isAvailable
                    ? 'text-[#10B981] hover:text-[#EF4444]'
                    : 'text-[#EF4444] hover:text-[#10B981]'
                }`}
                title={isAvailable ? 'Click to mark Sold Out' : 'Click to mark back In Stock'}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{isAvailable ? 'IN STOCK · MARK OUT' : 'SOLD OUT · RESTORE'}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenLinkGroup(product)}
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] cursor-pointer ${
                  product.groupId ? 'text-[#FF5500]' : 'text-[#A1A1AA] hover:text-[#FFFFFF]'
                }`}
                title="Link product variants"
              >
                <Link2 className="w-3.5 h-3.5 text-[#71717A]" />
                <span>{product.groupId ? 'LINKED' : 'LINK'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onDelete(product)}
              className="p-1 text-[#71717A] hover:text-[#EF4444] cursor-pointer shrink-0"
              title="Delete product permanently"
              aria-label={`Delete ${product.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ProductRowCard.displayName = 'ProductRowCard';

// -------------------------------------------------------------
export const ProductManagement = React.memo<ProductManagementProps>(({ products, onRefresh, onUpdateProducts }) => {
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
  const [quotaBlockedModalOpen, setQuotaBlockedModalOpen] = useState(false);

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
    if (isQuotaExhausted()) {
      triggerHaptic('error');
      setQuotaBlockedModalOpen(true);
      return;
    }
    setEditingProduct(null);
    setActiveSubView('add-edit');
  }, []);

  const openEditScreen = useCallback((prod: Product) => {
    if (isQuotaExhausted()) {
      triggerHaptic('error');
      setQuotaBlockedModalOpen(true);
      return;
    }
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

// Helper to recursively remove all undefined properties so Firestore never rejects payloads
function cleanPayloadDeep<T>(val: T): T {
  if (val === null || val === undefined) return null as any;
  if (Array.isArray(val)) {
    return val.map(cleanPayloadDeep).filter((v) => v !== undefined) as any;
  }
  if (typeof val === 'object' && !(val instanceof Date)) {
    const cleaned: any = {};
    for (const [key, v] of Object.entries(val as any)) {
      if (v !== undefined) {
        cleaned[key] = cleanPayloadDeep(v);
      }
    }
    return cleaned;
  }
  return val;
}

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
      // Guard: Block saving if Firestore daily limit is reached
      if (isQuotaExhausted()) {
        triggerHaptic('error');
        setQuotaBlockedModalOpen(true);
        return;
      }

      // Auto-save category if new
      if (productPayload.category && !categories.includes(productPayload.category)) {
        const updatedCats = [...categories, productPayload.category];
        saveCategories(updatedCats).catch(() => {});
        setCategories(updatedCats);
      }

      // Sanitize payload: Ensure imageFits contains ONLY valid Firestore keys (no periods, slashes, or URLs)
      let cleanPayload: any = { ...productPayload };
      if (cleanPayload.imageFits && typeof cleanPayload.imageFits === 'object') {
        const sanitizedFits: Record<string, 'cover' | 'contain'> = {};
        for (const [key, val] of Object.entries(cleanPayload.imageFits)) {
          if (!key.includes('.') && !key.includes('/')) {
            sanitizedFits[key] = val as 'cover' | 'contain';
          }
        }
        cleanPayload.imageFits = sanitizedFits;
      }

      // Recursively strip all undefined values so Firestore never throws Unsupported field value: undefined
      cleanPayload = cleanPayloadDeep(cleanPayload);

      // Determine document reference & persistent ID upfront (0 Firestore reads)
      const newDocRef = id ? doc(db, 'products', id) : doc(collection(db, 'products'));
      const resolvedId = id || newDocRef.id;

      // Un-blacklist product if it was previously in local deleted sets
      unblacklistProduct(resolvedId, cleanPayload.name);

      // 1. Immediate optimistic local update for 0ms perceptible latency
      try {
        let currentProds: Product[] = localProducts.length > 0 ? [...localProducts] : [...products];
        const minOrder = currentProds.reduce((min, p) => Math.min(min, p.sortOrder ?? 100), 100);
        const updatedItem = {
          ...cleanPayload,
          id: resolvedId,
          sortOrder: isFeatured ? minOrder - 1 : (cleanPayload.sortOrder ?? 100),
        } as Product;

        let itemReplaced = false;
        if (id) {
          currentProds = currentProds.map((p) => {
            if (String(p.id) === String(id)) {
              itemReplaced = true;
              return { ...p, ...updatedItem };
            }
            return p;
          });
        }
        if (!itemReplaced) {
          currentProds.unshift(updatedItem);
        }

        // Update local state immediately so table never drops to 0!
        setLocalProducts(currentProds);
        if (onUpdateProducts) onUpdateProducts(currentProds);

        // Auto-switch to the category so user immediately sees the item
        if (cleanPayload.category) {
          setSelectedCategory(cleanPayload.category);
          setSearchQuery('');
        }

        // Save to IndexedDB
        saveProductsToIndexedDB(currentProds).catch(() => {});

        // Safe localStorage write
        try {
          localStorage.setItem('swadeep_cached_products', JSON.stringify(currentProds));
        } catch {}

        // Dispatch update event with complete array
        window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: currentProds }));
        if (onRefresh) onRefresh();

        // Sync to local server for zero-latency offline persistence
        fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedItem),
        }).catch(() => {});
      } catch (err) {
        console.warn('Optimistic product update error:', err);
      }

      setSeedSuccessMessage(`✓ "${cleanPayload.name}" ${id ? 'updated' : 'added'} successfully!`);
      setTimeout(() => setSeedSuccessMessage(null), 3500);

      // 2. Persist to Firestore in background (STRICTLY 0 reads, 1 atomic write)
      try {
        await setDoc(
          newDocRef,
          {
            ...cleanPayload,
            id: resolvedId,
            ...(id
              ? { updatedAt: serverTimestamp() }
              : { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
          },
          { merge: true }
        );
      } catch (err: any) {
        console.warn('Firestore product persist notice (saved locally & server):', err?.message || err);
      }
    },
    [categories, products, localProducts, onRefresh]
  );

  // Toggle in-stock status
  const handleToggleAvailability = useCallback(
    async (product: Product) => {
      const currentProds = localProducts.length > 0 ? [...localProducts] : [...products];
      const updated = currentProds.map((p) =>
        p.id === product.id ? { ...p, available: !product.available } : p
      );
      setLocalProducts(updated);
      saveProductsToIndexedDB(updated).catch(() => {});
      try {
        localStorage.setItem('swadeep_cached_products', JSON.stringify(updated));
      } catch {}
      window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: updated }));

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
    [products, localProducts]
  );

  // Toggle Featured & Pinned to front
  const handleToggleFeatured = useCallback(
    async (product: Product) => {
      const isNowFeatured = !product.isFeatured && !product.isPinnedToFront;
      const currentProds = localProducts.length > 0 ? [...localProducts] : [...products];
      const updated = currentProds.map((p) =>
        p.id === product.id
          ? { ...p, isFeatured: isNowFeatured, isPinnedToFront: isNowFeatured }
          : p
      );
      setLocalProducts(updated);
      saveProductsToIndexedDB(updated).catch(() => {});
      try {
        localStorage.setItem('swadeep_cached_products', JSON.stringify(updated));
      } catch {}
      window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: updated }));

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
    [products, localProducts]
  );



  // Debounced persistence helper for product sort order (prevents screen flashes)
  const productSaveDebounceRef = useRef<number | null>(null);

  const persistProductOrder = useCallback((updatedList: Product[]) => {
    if (productSaveDebounceRef.current) {
      clearTimeout(productSaveDebounceRef.current);
    }
    productSaveDebounceRef.current = window.setTimeout(async () => {
      try {
        const orderMap = new Map<string, number>();
        updatedList.forEach((p, i) => orderMap.set(p.id, i + 1));

        const baseList = localProducts.length > 0 ? localProducts : products;
        const newAll = baseList.map((p) => {
          if (orderMap.has(p.id)) {
            return { ...p, sortOrder: orderMap.get(p.id) };
          }
          return p;
        });

        setLocalProducts(newAll);
        saveProductsToIndexedDB(newAll).catch(() => {});
        try {
          localStorage.setItem('swadeep_cached_products', JSON.stringify(newAll));
        } catch {}
        window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: newAll }));

        // 1. Sync to local server with 0 Firestore writes
        try {
          fetch('/api/products/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orders: updatedList.map((p, i) => ({ id: p.id, sortOrder: i + 1 })),
            }),
          }).catch(() => {});
        } catch {}

        // 2. Only write documents that actually changed position in Firestore
        const changedProducts = updatedList
          .map((p, i) => ({ ...p, nextSort: i + 1 }))
          .filter((p) => p.sortOrder !== p.nextSort);

        if (changedProducts.length > 0) {
          const batch = writeBatch(db);
          changedProducts.slice(0, 50).forEach((p) => {
            batch.set(
              doc(db, 'products', p.id),
              {
                sortOrder: p.nextSort,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          });
          await batch.commit();
        }
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
      } else if (selectedCategory === 'SoldOut') {
        matchesCategory = p.available === false;
      } else {
        const pCat = (p.category || '').trim().toLowerCase();
        const sCat = selectedCategory.trim().toLowerCase();
        const normPCat = pCat.replace(/&/g, 'and').replace(/\s+/g, ' ');
        const normSCat = sCat.replace(/&/g, 'and').replace(/\s+/g, ' ');
        matchesCategory =
          pCat === sCat ||
          normPCat === normSCat ||
          (normPCat.includes('gift hamper') && normSCat.includes('gift hamper')) ||
          (normPCat.includes('combo') && normSCat.includes('combo'));
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
      saveProductsToIndexedDB(updated).catch(() => {});
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
    () => localProducts.filter((p) => p.isFeatured || p.isPinnedToFront).length,
    [localProducts]
  );

  const soldOutCount = useMemo(
    () => localProducts.filter((p) => p.available === false).length,
    [localProducts]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach((cat) => {
      const sCat = cat.trim().toLowerCase();
      const normSCat = sCat.replace(/&/g, 'and').replace(/\s+/g, ' ');
      counts[cat] = localProducts.filter((p) => {
        const pCat = (p.category || '').trim().toLowerCase();
        const normPCat = pCat.replace(/&/g, 'and').replace(/\s+/g, ' ');
        return (
          pCat === sCat ||
          normPCat === normSCat ||
          (normPCat.includes('gift hamper') && normSCat.includes('gift hamper')) ||
          (normPCat.includes('combo') && normSCat.includes('combo'))
        );
      }).length;
    });
    return counts;
  }, [localProducts, categories]);

  return (
    <>
      {/* 0-Delay Sub-Screen: Add / Edit Product (Persisted in DOM for instant 0ms open & back) */}
      <div className={activeSubView === 'add-edit' ? 'block' : 'hidden'}>
        <ProductFormScreen
          product={editingProduct}
          categories={categories}
          onBack={handleBackToCatalog}
          onSave={handleSaveProduct}
        />
      </div>

      {/* 0-Delay Sub-Screen: Category Management */}
      <div className={activeSubView === 'categories' ? 'block' : 'hidden'}>
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
      </div>

      {/* 0-Delay Sub-Screen: Flipkart Link Groups */}
      <div className={activeSubView === 'link-groups' ? 'block' : 'hidden'}>
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
      </div>

      {/* 0-Delay Sub-Screen: Extras Management */}
      <div className={activeSubView === 'extras' ? 'block' : 'hidden'}>
        <ExtrasManagementScreen
          onBack={handleBackToCatalog}
        />
      </div>

      {/* Main Catalog View (Persisted in DOM for instant 0ms switching) */}
      <div className={activeSubView === 'catalog' ? 'space-y-5' : 'hidden'}>
        {/* Lekhix Editorial Minimal Catalog Header (Direct Canvas + Razor-sharp 1px border divider) */}
        <div className="pb-4 border-b border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4 text-[#FFFFFF]">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[18px] font-bold uppercase tracking-[0.04em] text-[#FFFFFF] font-['Plus_Jakarta_Sans',sans-serif]">
              CATALOG
            </h2>
            <span className="text-[11px] font-mono font-medium text-[#A1A1AA] uppercase tracking-[0.14em]">
              {localProducts.length} PRODUCTS · {categories.length} CATEGORIES
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={openCategoriesScreen}
              className="px-4 py-2.5 bg-[#18181D] hover:bg-[#242429] border border-[#2E2E36] hover:border-[#3F3F46] text-[#F5F5F7] text-[11px] font-bold uppercase tracking-[0.18em] flex items-center gap-2 cursor-pointer rounded-none"
              id="admin-manage-categories-btn"
            >
              <Layers className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0" />
              <span className="tracking-[0.18em]">CATEGORIES ({categories.length})</span>
            </button>

            <button
              type="button"
              onClick={() => openLinkGroup(null)}
              className="px-4 py-2.5 bg-[#18181D] hover:bg-[#242429] border border-[#2E2E36] hover:border-[#3F3F46] text-[#F5F5F7] text-[11px] font-bold uppercase tracking-[0.18em] flex items-center gap-2 cursor-pointer rounded-none"
              id="admin-link-variants-btn"
            >
              <Link2 className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0" />
              <span className="tracking-[0.18em]">LINK VARIANTS</span>
            </button>

            <button
              type="button"
              onClick={openExtrasScreen}
              className="px-4 py-2.5 bg-[#18181D] hover:bg-[#242429] border border-[#2E2E36] hover:border-[#3F3F46] text-[#F5F5F7] text-[11px] font-bold uppercase tracking-[0.18em] flex items-center gap-2 cursor-pointer rounded-none"
              id="admin-manage-extras-btn"
            >
              <span className="tracking-[0.18em]">+ EXTRAS</span>
            </button>

            <button
              type="button"
              onClick={openAddScreen}
              className="px-5 py-2.5 bg-[#FFFFFF] hover:bg-zinc-200 text-[#111111] text-[11px] font-bold uppercase tracking-[0.18em] flex items-center gap-2 cursor-pointer border border-[#FFFFFF] shrink-0 rounded-none"
              id="admin-add-product-btn"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3] shrink-0" />
              <span className="tracking-[0.18em]">ADD PRODUCT</span>
            </button>
          </div>
        </div>

        {seedSuccessMessage && (
          <div className="p-3 bg-[#18181B] border border-[#10B981] text-[#FFFFFF] text-xs font-mono font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>{seedSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSeedSuccessMessage(null)}
              className="text-[#A1A1AA] hover:text-[#FFFFFF] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Lekhix Editorial Category Filter Strip & Search (Pure Matte Black with Breathable Spacing) */}
        <div className="pb-3 border-b border-[#27272A] flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-[#FFFFFF]">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 border whitespace-nowrap cursor-pointer font-bold uppercase tracking-[0.08em] rounded-none ${
                selectedCategory === 'All'
                  ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                  : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427] font-medium'
              }`}
            >
              ALL ({localProducts.length})
            </button>

            {featuredCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCategory('Featured')}
                className={`px-3 py-1.5 border whitespace-nowrap cursor-pointer font-bold uppercase tracking-[0.08em] rounded-none ${
                  selectedCategory === 'Featured'
                    ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                    : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427] font-medium'
                }`}
              >
                ★ HERO ({featuredCount})
              </button>
            )}

            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = categoryCounts[cat] ?? 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 border whitespace-nowrap cursor-pointer uppercase tracking-[0.08em] rounded-none ${
                    isSelected
                      ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A] font-bold'
                      : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427] font-medium'
                  }`}
                >
                  {cat.toUpperCase()} ({count})
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSelectedCategory('SoldOut')}
              className={`px-3 py-1.5 border whitespace-nowrap cursor-pointer uppercase tracking-[0.08em] rounded-none ${
                selectedCategory === 'SoldOut'
                  ? 'border-[#EF4444] bg-[#EF4444] text-[#FFFFFF] font-bold'
                  : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#EF4444] font-medium'
              }`}
            >
              SOLD OUT ({soldOutCount})
            </button>
          </div>

          <div className="relative w-full lg:w-72 shrink-0 font-mono">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A] pointer-events-none" />
            <input
              type="text"
              placeholder="FILTER CATALOG..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-2 bg-[#121212] border border-[#27272A] focus:border-[#FFFFFF] text-[11px] font-mono font-medium text-[#FFFFFF] placeholder:text-[#71717A] placeholder:font-mono placeholder:uppercase placeholder:tracking-[0.1em] focus:outline-none uppercase tracking-[0.1em] rounded-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#71717A] hover:text-[#FFFFFF] cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      {/* Single-Column (1-Product-Per-Row) Structured List */}
      {sortedProducts.length === 0 ? (
        <div className="bg-[#18181B] border border-[#27272A] p-10 text-center space-y-3">
          <div className="w-10 h-10 border border-[#27272A] bg-[#121212] flex items-center justify-center text-[#71717A] mx-auto">
            <ImageIcon className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-[#FFFFFF] text-sm uppercase tracking-[0.06em]">NO MATCHING ITEMS</h3>
          {products.length === 0 && (
            <button
              type="button"
              onClick={openAddScreen}
              className="mt-2 px-4 py-2 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-bold text-[11px] font-mono uppercase tracking-[0.06em] cursor-pointer inline-flex items-center gap-1.5 border border-[#FF5500]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>ADD FIRST PRODUCT</span>
            </button>
          )}
        </div>
      ) : (
        <div
          className="space-y-2.5"
          onTouchMove={handleProductTouchMove}
          onTouchEnd={handleProductTouchEnd}
          onTouchCancel={handleProductTouchEnd}
        >
          {sortedProducts.map((product, idx) => (
            <ProductRowCard
              key={product.id}
              product={product}
              idx={idx}
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
        </div>
      )}

      {/* Delete Confirmation Modal (Pure Matte Black) */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#18181B] border border-[#EF4444] max-w-sm w-full p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-[#EF4444] block">
                PERMANENT DELETION
              </span>
              <h3 className="font-bold text-[#FFFFFF] text-base">
                Delete &quot;{productToDelete.name}&quot;?
              </h3>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2 border border-[#27272A] bg-[#121212] text-[#FFFFFF] font-bold text-[11px] font-mono uppercase tracking-[0.06em] hover:bg-[#242427] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                className="flex-1 py-2 bg-[#EF4444] hover:bg-[#dc2626] text-[#FFFFFF] font-bold text-[11px] font-mono uppercase tracking-[0.06em] cursor-pointer disabled:opacity-50 border border-[#EF4444]"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Quota Blocked Informational Modal */}
      <AdminQuotaBlockedModal
        isOpen={quotaBlockedModalOpen}
        onClose={() => setQuotaBlockedModalOpen(false)}
      />
    </div>
    </>
  );
});

ProductManagement.displayName = 'ProductManagement';
