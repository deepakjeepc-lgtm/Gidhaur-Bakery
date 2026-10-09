import { doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Product, Order } from '../types';
import { getSanitizedCachedProducts, sanitizeProducts } from './productService';

const STORAGE_KEY_CACHED_PRODUCTS = 'swadeep_cached_products';
const STORAGE_KEY_DEDUCTED_ORDERS = 'swadeep_deducted_order_ids';

function getDeductedOrderIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEDUCTED_ORDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
}

function recordOrderDeducted(orderId: string): void {
  try {
    const set = getDeductedOrderIds();
    set.add(orderId);
    const arr = Array.from(set).slice(-300); // keep rolling last 300 IDs
    localStorage.setItem(STORAGE_KEY_DEDUCTED_ORDERS, JSON.stringify(arr));
  } catch {}
}

/**
 * Gets effective stock quantity for a product.
 * If undefined:
 * - If product is available, default is 50 units.
 * - If product is marked unavailable/sold-out, default is 0 units.
 */
export function getProductStock(product: Product): number {
  if (typeof product.stockQuantity === 'number') {
    return Math.max(0, product.stockQuantity);
  }
  return product.available ? 50 : 0;
}

export function getProductLowStockThreshold(product: Product): number {
  return typeof product.lowStockThreshold === 'number' && product.lowStockThreshold >= 0
    ? product.lowStockThreshold
    : 5;
}

export function isItemLowStock(product: Product): boolean {
  const stock = getProductStock(product);
  const threshold = getProductLowStockThreshold(product);
  return product.available && stock > 0 && stock <= threshold;
}

export function isItemOutOfStock(product: Product): boolean {
  return !product.available || getProductStock(product) <= 0;
}

// In-memory debounce queue to batch rapid stock updates and avoid burning write quotas
interface PendingStockUpdate {
  stockQuantity: number;
  available: boolean;
  lowStockThreshold?: number;
}

const pendingUpdatesQueue = new Map<string, PendingStockUpdate>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function flushPendingUpdatesToFirestore() {
  if (pendingUpdatesQueue.size === 0) return;

  const updatesToFlush = new Map(pendingUpdatesQueue);
  pendingUpdatesQueue.clear();

  try {
    const batch = writeBatch(db);
    updatesToFlush.forEach((update, productId) => {
      const ref = doc(db, 'products', productId);
      batch.update(ref, {
        stockQuantity: update.stockQuantity,
        available: update.available,
        ...(typeof update.lowStockThreshold === 'number' ? { lowStockThreshold: update.lowStockThreshold } : {}),
        lastStockUpdated: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
    });

    batch.commit().catch((err) => {
      console.warn('Batch stock update to Firestore note (persisted locally):', err?.message || err);
    });
  } catch (err) {
    console.warn('Could not batch write to Firestore (stored locally):', err);
  }
}

function scheduleDebouncedFirestoreFlush() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    flushPendingUpdatesToFirestore();
  }, 1000);
}

/**
 * Optimistically updates a product's stock quantity and availability
 */
export function updateProductStockQuantity(
  productId: string,
  newQuantity: number,
  overrideAvailable?: boolean,
  customThreshold?: number,
  fallbackCatalog?: Product[]
): Product[] {
  const targetQty = Math.max(0, Math.round(newQuantity));
  const newAvailable = overrideAvailable !== undefined ? overrideAvailable : targetQty > 0;

  let currentProducts = getSanitizedCachedProducts();
  if (!currentProducts || currentProducts.length === 0) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CACHED_PRODUCTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentProducts = parsed;
        }
      }
    } catch {}
  }

  // If still empty, use fallbackCatalog passed from caller component
  if ((!currentProducts || currentProducts.length === 0) && Array.isArray(fallbackCatalog) && fallbackCatalog.length > 0) {
    currentProducts = fallbackCatalog;
  }

  // Safety protection: Never wipe out catalog to 0 if cache reading had a transient glitch
  if (!currentProducts || currentProducts.length === 0) {
    console.warn('Cannot update stock quantity: catalog cache empty, skipping to protect inventory');
    return [];
  }

  const updatedProducts = currentProducts.map((p) => {
    if (p.id === productId) {
      return {
        ...p,
        stockQuantity: targetQty,
        available: newAvailable,
        ...(typeof customThreshold === 'number' ? { lowStockThreshold: customThreshold } : {}),
        lastStockUpdated: new Date().toISOString(),
      };
    }
    return p;
  });

  // 1. Immediately save to localStorage for instant persistence
  try {
    localStorage.setItem(STORAGE_KEY_CACHED_PRODUCTS, JSON.stringify(updatedProducts));
  } catch {}

  // 2. Broadcast custom event for 0ms reactive UI updates across all components
  try {
    window.dispatchEvent(
      new CustomEvent('swadeep_products_updated', { detail: updatedProducts })
    );
  } catch {}

  // 3. Immediately persist to server disk store
  fetch('/api/products/batch-stock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      updates: [
        {
          id: productId,
          stockQuantity: targetQty,
          available: newAvailable,
          lowStockThreshold: customThreshold,
        },
      ],
    }),
  }).catch(() => {});

  // 4. Queue update for debounced Firestore batch write
  pendingUpdatesQueue.set(productId, {
    stockQuantity: targetQty,
    available: newAvailable,
    lowStockThreshold: customThreshold,
  });
  scheduleDebouncedFirestoreFlush();

  return updatedProducts;
}

/**
 * Bulk updates stock quantity or availability for multiple items at once
 */
export function bulkUpdateInventory(
  productIds: string[],
  action: 'setQuantity' | 'addQuantity' | 'markInStock' | 'markOutOfStock',
  quantityValue?: number,
  fallbackCatalog?: Product[]
): Product[] {
  if (!productIds || productIds.length === 0) return getSanitizedCachedProducts();

  const idSet = new Set(productIds);
  let currentProducts = getSanitizedCachedProducts();
  if (!currentProducts || currentProducts.length === 0) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CACHED_PRODUCTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentProducts = parsed;
        }
      }
    } catch {}
  }

  if ((!currentProducts || currentProducts.length === 0) && Array.isArray(fallbackCatalog) && fallbackCatalog.length > 0) {
    currentProducts = fallbackCatalog;
  }

  if (!currentProducts || currentProducts.length === 0) {
    return [];
  }

  const batchUpdatesPayload: Array<{
    id: string;
    stockQuantity: number;
    available: boolean;
  }> = [];

  const updatedProducts = currentProducts.map((p) => {
    if (!idSet.has(p.id)) return p;

    let newQty = getProductStock(p);
    let newAvail = p.available;

    if (action === 'setQuantity' && typeof quantityValue === 'number') {
      newQty = Math.max(0, quantityValue);
      newAvail = newQty > 0;
    } else if (action === 'addQuantity' && typeof quantityValue === 'number') {
      newQty = Math.max(0, newQty + quantityValue);
      newAvail = newQty > 0;
    } else if (action === 'markInStock') {
      newAvail = true;
      if (newQty === 0) newQty = 25; // Default restock batch
    } else if (action === 'markOutOfStock') {
      newAvail = false;
      newQty = 0;
    }

    pendingUpdatesQueue.set(p.id, {
      stockQuantity: newQty,
      available: newAvail,
    });

    batchUpdatesPayload.push({
      id: p.id,
      stockQuantity: newQty,
      available: newAvail,
    });

    return {
      ...p,
      stockQuantity: newQty,
      available: newAvail,
      lastStockUpdated: new Date().toISOString(),
    };
  });

  // Persist to server disk store
  if (batchUpdatesPayload.length > 0) {
    fetch('/api/products/batch-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: batchUpdatesPayload }),
    }).catch(() => {});
  }

  try {
    localStorage.setItem(STORAGE_KEY_CACHED_PRODUCTS, JSON.stringify(updatedProducts));
    window.dispatchEvent(
      new CustomEvent('swadeep_products_updated', { detail: updatedProducts })
    );
  } catch {}

  scheduleDebouncedFirestoreFlush();
  return updatedProducts;
}

/**
 * Automatically deducts stock when an order is accepted by Kitchen/Admin.
 * Deduplicates to ensure the same order is never deducted twice.
 * If stock hits 0, auto-flags item as 'Sold Out' (available = false) on customer menu.
 */
export function deductStockForAcceptedOrder(order: Order): Product[] {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return getSanitizedCachedProducts();
  }

  const orderIdentifier = order.id || order.orderId;
  if (!orderIdentifier) return getSanitizedCachedProducts();

  // Deduplication guard: ensure we don't deduct the same order twice
  if (getDeductedOrderIds().has(orderIdentifier) || (order as any).stockDeducted) {
    return getSanitizedCachedProducts();
  }

  const currentProducts = getSanitizedCachedProducts();
  if (currentProducts.length === 0) return [];

  let hasChanged = false;
  const updatedProducts = [...currentProducts];

  order.items.forEach((item) => {
    const itemQty = Math.max(1, Number(item.quantity) || 1);
    const prodIndex = updatedProducts.findIndex((p) => p.id === item.productId);

    if (prodIndex >= 0) {
      const prod = updatedProducts[prodIndex];
      const currentStock = getProductStock(prod);
      const remainingStock = Math.max(0, currentStock - itemQty);
      const isNowAvailable = remainingStock > 0;

      updatedProducts[prodIndex] = {
        ...prod,
        stockQuantity: remainingStock,
        available: isNowAvailable,
        lastStockUpdated: new Date().toISOString(),
      };

      pendingUpdatesQueue.set(prod.id, {
        stockQuantity: remainingStock,
        available: isNowAvailable,
      });

      hasChanged = true;
    }
  });

  // Mark this order as deducted
  recordOrderDeducted(orderIdentifier);

  if (hasChanged) {
    try {
      localStorage.setItem(STORAGE_KEY_CACHED_PRODUCTS, JSON.stringify(updatedProducts));
      window.dispatchEvent(
        new CustomEvent('swadeep_products_updated', { detail: updatedProducts })
      );
    } catch {}

    scheduleDebouncedFirestoreFlush();
  }

  return updatedProducts;
}

/**
 * Exports current inventory to CSV file for downloading
 */
export function exportInventoryToCSV(products: Product[]): void {
  if (!products || products.length === 0) return;

  const headers = [
    'Product ID',
    'Item Name',
    'Category',
    'Retail Price (INR)',
    'Stock Quantity',
    'Status',
    'Low Stock Alert Threshold',
    'Total Inventory Value (INR)',
  ];

  const rows = products.map((p) => {
    const stock = getProductStock(p);
    const status = !p.available || stock === 0 ? 'Out of Stock' : stock <= getProductLowStockThreshold(p) ? 'Low Stock' : 'In Stock';
    const totalVal = (Number(p.price) || 0) * stock;

    return [
      `"${p.id}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.category || 'General').replace(/"/g, '""')}"`,
      p.price || 0,
      stock,
      status,
      getProductLowStockThreshold(p),
      totalVal,
    ].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    `gidhaur-bakery-inventory-${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Opens a print dialog for a clean, professional morning baking audit sheet
 * Uses a safe hidden iframe instead of window.open to comply with iframe security
 */
export function printInventoryAuditSheet(products: Product[]): void {
  const existingFrame = document.getElementById('inventory-print-iframe');
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'inventory-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Gidhaur Bakery - Morning Inventory & Baking Audit</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: 800; color: #881337; margin: 0; }
          .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
          .badge { background: #f1f5f9; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f8fafc; text-align: left; padding: 8px 12px; font-weight: 700; border-bottom: 2px solid #cbd5e1; }
          td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
          .status-out { color: #dc2626; font-weight: 700; }
          .status-low { color: #d97706; font-weight: 700; }
          .status-ok { color: #16a34a; font-weight: 700; }
          .checkbox { width: 16px; height: 16px; border: 1px solid #94a3b8; display: inline-block; border-radius: 3px; }
          .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
          @media print { body { padding: 0; } button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">🥐 Gidhaur Bakery — Live Inventory & Baking Sheet</h1>
            <div class="subtitle">Generated on ${dateStr} • Head Chef & Admin Verification</div>
          </div>
          <div class="badge">Total Tracked: ${products.length} Items</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>Price</th>
              <th style="text-align: center;">Current Stock</th>
              <th style="text-align: center;">Status</th>
              <th style="width: 100px; text-align: center;">Fresh Baked Batch (+)</th>
              <th style="width: 50px; text-align: center;">Verified</th>
            </tr>
          </thead>
          <tbody>
            ${products
              .map((p, idx) => {
                const stock = getProductStock(p);
                const isOut = !p.available || stock === 0;
                const isLow = stock > 0 && stock <= getProductLowStockThreshold(p);
                const statusClass = isOut ? 'status-out' : isLow ? 'status-low' : 'status-ok';
                const statusText = isOut ? 'Sold Out' : isLow ? 'Low Stock' : 'In Stock';

                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.category || 'Bakery'}</td>
                    <td>₹${p.price}</td>
                    <td style="text-align: center; font-weight: 700;">${stock}</td>
                    <td style="text-align: center;" class="${statusClass}">${statusText}</td>
                    <td style="text-align: center; border: 1px dashed #cbd5e1; background: #fafafa;"></td>
                    <td style="text-align: center;"><span class="checkbox"></span></td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Verified By Chef (Signature): _________________________</div>
          <div>Admin Approved: _________________________</div>
          <div>Printed at: ${new Date().toLocaleTimeString('en-IN')}</div>
        </div>
      </body>
    </html>
  `;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn('Print audit sheet error:', e);
    }
    setTimeout(() => {
      try {
        iframe.remove();
      } catch {}
    }, 3000);
  }, 400);
}
