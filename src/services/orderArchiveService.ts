import { Order } from '../types';

export const ARCHIVE_STORAGE_KEYS = {
  ACTIVE_ORDERS: 'gidhaur_active_orders',
  ARCHIVED_ORDERS: 'gidhaur_orders_history',
  CUSTOMER_OWN_ORDERS: 'gidhaur_customer_device_orders',
  ADMIN_LIVE_CACHE: 'gidhaur_admin_live_orders_cache',
  DELETED_ORDER_IDS: 'gidhaur_deleted_order_ids',
  RECENT_ORDERS: 'gidhaur_recent_orders',
  LEGACY_RECENT_ORDERS: 'swadeep_recent_orders',
  LAST_CHECKED_DATE: 'gidhaur_last_order_rollover_date',
  CLEAN_SLATE_V2: 'gidhaur_clean_slate_v2',
  FIRESTORE_CLEAN_SLATE_V2: 'gidhaur_firestore_clean_slate_v2',
};

/**
 * One-time complete purge of all legacy/old order data across localStorage and sessionStorage
 * so no device ever displays old or unplaced orders.
 */
export function ensureCleanSlateReset(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(ARCHIVE_STORAGE_KEYS.CLEAN_SLATE_V2) === 'done') {
      return;
    }
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.CUSTOMER_OWN_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.RECENT_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.LEGACY_RECENT_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.ACTIVE_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.ARCHIVED_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.ADMIN_LIVE_CACHE);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.DELETED_ORDER_IDS);
    localStorage.removeItem('swadeep_order_tracking_id');
    localStorage.removeItem('gidhaur_order_tracking_id');
    try {
      sessionStorage.removeItem('gidhaur_orders_session');
    } catch {}
    localStorage.setItem(ARCHIVE_STORAGE_KEYS.CLEAN_SLATE_V2, 'done');
  } catch (err) {
    console.warn('Clean slate reset note:', err);
  }
}

// Run immediately on module load
ensureCleanSlateReset();

/**
 * Returns a consistent local calendar date string (YYYY-MM-DD).
 */
export function getLocalDateString(dateInput?: any): string {
  try {
    let d: Date;
    if (!dateInput) {
      d = new Date();
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
      d = new Date(dateInput);
    } else if (dateInput && typeof dateInput.toDate === 'function') {
      // Firestore Timestamp
      d = dateInput.toDate();
    } else if (dateInput && dateInput.seconds) {
      d = new Date(dateInput.seconds * 1000);
    } else {
      d = new Date();
    }

    if (isNaN(d.getTime())) {
      d = new Date();
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    const fallback = new Date();
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`;
  }
}

/**
 * Returns today's local date string (YYYY-MM-DD).
 */
export function getTodayDateString(): string {
  return getLocalDateString(new Date());
}

/**
 * Checks whether an order was created today.
 */
export function isOrderFromToday(order: Order | any, todayStr: string = getTodayDateString()): boolean {
  if (!order || !order.createdAt) return false;
  const orderDateStr = getLocalDateString(order.createdAt);
  return orderDateStr === todayStr;
}

/**
 * Reads permanently deleted order IDs (tombstones) so deleted orders never resurrect.
 */
export function getDeletedOrderIds(): Set<string> {
  try {
    ensureCleanSlateReset();
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEYS.DELETED_ORDER_IDS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((id) => String(id).toLowerCase()));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

/**
 * Marks one or more order IDs as permanently deleted.
 */
export function markOrderPermanentlyDeleted(orderId: string, extraIds: string[] = []): void {
  try {
    const existing = getDeletedOrderIds();
    [orderId, ...extraIds].forEach((id) => {
      if (id) existing.add(String(id).toLowerCase());
    });
    const arr = Array.from(existing).slice(-300);
    localStorage.setItem(ARCHIVE_STORAGE_KEYS.DELETED_ORDER_IDS, JSON.stringify(arr));
  } catch {}
}

/**
 * Returns ONLY orders explicitly placed on this specific customer device today,
 * excluding deleted, archived, completed, or previous-day orders.
 * Never migrates or reads from any shared or admin cache key.
 */
export function getCustomerOwnOrders(): any[] {
  try {
    ensureCleanSlateReset();
    const todayStr = getTodayDateString();
    const deletedSet = getDeletedOrderIds();
    const rawOwn = localStorage.getItem(ARCHIVE_STORAGE_KEYS.CUSTOMER_OWN_ORDERS);

    // Always keep legacy keys purged so nothing ever leaks
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.LEGACY_RECENT_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.RECENT_ORDERS);

    if (!rawOwn) return [];

    let list: any[] = [];
    try {
      const parsed = JSON.parse(rawOwn);
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    } catch {
      return [];
    }

    // Strict filter: must be explicitly placed on this device, have valid items, be from TODAY, and not be deleted/archived/completed
    const validTodayOrders = list.filter((o) => {
      if (!o || (!o.orderId && !o.id)) return false;
      if (o.placedOnThisDevice !== true) return false;
      if (!Array.isArray(o.items) || o.items.length === 0) return false;
      if (
        o.isArchived ||
        o.archived ||
        o.status === 'archived' ||
        o.status === 'completed' ||
        o.isDeleted
      ) {
        return false;
      }
      const idLower = String(o.id || '').toLowerCase();
      const ordIdLower = String(o.orderId || '').toLowerCase();
      if ((idLower && deletedSet.has(idLower)) || (ordIdLower && deletedSet.has(ordIdLower))) {
        return false;
      }
      return isOrderFromToday(o, todayStr);
    });

    if (validTodayOrders.length !== list.length) {
      localStorage.setItem(ARCHIVE_STORAGE_KEYS.CUSTOMER_OWN_ORDERS, JSON.stringify(validTodayOrders));
    }

    return validTodayOrders;
  } catch {
    return [];
  }
}

/**
 * Saves an order explicitly placed by the customer on this device.
 */
export function saveCustomerOwnOrder(order: any): void {
  try {
    ensureCleanSlateReset();
    const existing = getCustomerOwnOrders();
    const orderId = order.orderId || order.id;
    const enriched = {
      ...order,
      placedOnThisDevice: true,
      createdAt: order.createdAt || new Date().toISOString()
    };
    const updated = [
      enriched,
      ...existing.filter((o) => (o.orderId || o.id) !== orderId && o.id !== order.id)
    ].slice(0, 15);
    localStorage.setItem(ARCHIVE_STORAGE_KEYS.CUSTOMER_OWN_ORDERS, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving customer own order:', err);
  }
}

/**
 * Purges a specific order from customer device storage (e.g. when archived or deleted by Admin).
 */
export function removeCustomerOwnOrder(orderId: string, extraIds: string[] = []): void {
  try {
    const keysToRemove = new Set(
      [orderId, ...extraIds].filter(Boolean).map((k) => String(k).toLowerCase())
    );
    const cleanKey = (storageKey: string) => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      try {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const filtered = list.filter((o: any) => {
            const id1 = String(o?.id || '').toLowerCase();
            const id2 = String(o?.orderId || '').toLowerCase();
            return !keysToRemove.has(id1) && !keysToRemove.has(id2);
          });
          localStorage.setItem(storageKey, JSON.stringify(filtered));
        }
      } catch {}
    };

    cleanKey(ARCHIVE_STORAGE_KEYS.CUSTOMER_OWN_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.RECENT_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.LEGACY_RECENT_ORDERS);
  } catch (err) {
    console.warn('Error removing customer own order:', err);
  }
}

/**
 * Clears all customer device tracking history and recent orders.
 */
export function clearAllTrackingHistory(): void {
  try {
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.CUSTOMER_OWN_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.RECENT_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.LEGACY_RECENT_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.ACTIVE_ORDERS);
    localStorage.removeItem('swadeep_recent_orders');
    localStorage.removeItem('gidhaur_recent_orders');
    localStorage.removeItem('gidhaur_active_orders');
    localStorage.removeItem('swadeep_order_tracking_id');
    localStorage.removeItem('gidhaur_order_tracking_id');
    try {
      sessionStorage.clear();
    } catch {}
    window.dispatchEvent(new CustomEvent('gidhaur_tracking_history_cleared'));
  } catch (err) {
    console.warn('Error clearing tracking history:', err);
  }
}

/**
 * Reads all archived orders from persistent storage (excluding permanently deleted IDs).
 */
export function getArchivedOrders(): Order[] {
  try {
    ensureCleanSlateReset();
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEYS.ARCHIVED_ORDERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deletedSet = getDeletedOrderIds();
    return parsed.filter((o) => {
      if (!o || (!o.id && !o.orderId)) return false;
      const id1 = String(o?.id || '').toLowerCase();
      const id2 = String(o?.orderId || '').toLowerCase();
      return !deletedSet.has(id1) && !deletedSet.has(id2);
    });
  } catch {
    return [];
  }
}

/**
 * Saves archived orders to persistent storage and notifies listeners.
 */
export function saveArchivedOrders(orders: Order[]): void {
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEYS.ARCHIVED_ORDERS, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent('gidhaur_order_history_updated', { detail: orders }));
  } catch (err) {
    console.warn('Error saving archived orders:', err);
  }
}

/**
 * Records a delivered order immediately into the Admin Archive for counting & revenue auditing,
 * while allowing it to remain visible in Today's Delivered list until midnight.
 */
export function recordDeliveredOrderInArchive(order: Order): Order[] {
  if (!order || (!order.id && !order.orderId)) return getArchivedOrders();
  const existing = getArchivedOrders();
  const key = String(order.orderId || order.id).toLowerCase();
  const existingIdx = existing.findIndex(
    (o) => String(o.orderId || o.id).toLowerCase() === key
  );

  const archivedEntry: Order = {
    ...order,
    status: 'delivered',
    archivedAt: (order as any).archivedAt || new Date().toISOString(),
  };

  let updated: Order[];
  if (existingIdx >= 0) {
    updated = [...existing];
    updated[existingIdx] = { ...updated[existingIdx], ...archivedEntry };
  } else {
    updated = [archivedEntry, ...existing];
  }

  saveArchivedOrders(updated);
  try {
    fetch('/api/orders/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: archivedEntry }),
    }).catch(() => {});
  } catch {}

  return updated;
}

/**
 * Syncs archived orders from the backend Express store (0 Firestore reads).
 */
export async function syncArchivedOrdersFromServer(): Promise<Order[]> {
  try {
    const res = await fetch('/api/orders/archive');
    if (!res.ok) return getArchivedOrders();
    const serverArchived = await res.json();
    if (!Array.isArray(serverArchived) || serverArchived.length === 0) {
      return getArchivedOrders();
    }
    const deletedSet = getDeletedOrderIds();
    const localArchived = getArchivedOrders();
    const mergedMap = new Map<string, Order>();

    localArchived.forEach((o) => {
      const k = String(o.orderId || o.id).toLowerCase();
      if (k && !deletedSet.has(k)) mergedMap.set(k, o);
    });
    serverArchived.forEach((o: Order) => {
      if (!o || (!o.id && !o.orderId)) return;
      const k = String(o.orderId || o.id).toLowerCase();
      if (k && !deletedSet.has(k)) {
        mergedMap.set(k, { ...(mergedMap.get(k) || {}), ...o });
      }
    });

    const merged = Array.from(mergedMap.values()).sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    if (merged.length !== localArchived.length) {
      saveArchivedOrders(merged);
    }
    return merged;
  } catch {
    return getArchivedOrders();
  }
}

/**
 * Pure helper (safe inside React useMemo with 0 storage side-effects):
 * Splits incoming live orders into:
 * 1) todayOrders: orders created today that are not manually archived
 * 2) pastOrArchivedOrders: orders from previous days (any status) OR manually archived orders
 * 3) deliveredTodayOrders: orders created today whose status is 'delivered' (to also audit in Archive)
 */
export function partitionDailyOrdersPure(
  incomingOrders: Order[],
  todayStr: string = getTodayDateString(),
  deletedSet: Set<string> = new Set()
): {
  todayOrders: Order[];
  pastOrArchivedOrders: Order[];
  deliveredTodayOrders: Order[];
} {
  const todayOrders: Order[] = [];
  const pastOrArchivedOrders: Order[] = [];
  const deliveredTodayOrders: Order[] = [];

  for (let i = 0; i < incomingOrders.length; i++) {
    const order = incomingOrders[i];
    if (!order || (!order.id && !order.orderId)) continue;
    const idLower = String(order.id || '').toLowerCase();
    const ordIdLower = String(order.orderId || '').toLowerCase();
    if ((idLower && deletedSet.has(idLower)) || (ordIdLower && deletedSet.has(ordIdLower))) {
      continue;
    }

    const isManuallyArchived =
      Boolean((order as any).isArchived) ||
      Boolean((order as any).archived) ||
      (order as any).status === 'archived' ||
      (order as any).status === 'completed';

    const isToday = isOrderFromToday(order, todayStr);

    if (isToday && !isManuallyArchived) {
      todayOrders.push(order);
      if (order.status === 'delivered') {
        deliveredTodayOrders.push(order);
      }
    } else {
      pastOrArchivedOrders.push({
        ...order,
        archivedAt: (order as any).archivedAt || new Date().toISOString(),
        isPreviousDayArchive: !isToday,
      });
    }
  }

  return { todayOrders, pastOrArchivedOrders, deliveredTodayOrders };
}

/**
 * Daily Rollover & Delivered Audit Synchronization:
 * Persists any past-day orders (regardless of status) and any delivered orders into the Admin Archive.
 */
export function performDailyOrderRollover(
  incomingOrders: Order[]
): {
  todayOrders: Order[];
  archivedOrders: Order[];
  newlyArchivedCount: number;
  pastOrderIdsToPurge: string[];
} {
  const todayStr = getTodayDateString();
  const deletedSet = getDeletedOrderIds();
  const existingArchive = getArchivedOrders();
  const archiveMap = new Map<string, Order>();

  existingArchive.forEach((o) => {
    const key = String(o.orderId || o.id).toLowerCase();
    if (key && !deletedSet.has(key)) {
      archiveMap.set(key, o);
    }
  });

  const { todayOrders, pastOrArchivedOrders, deliveredTodayOrders } = partitionDailyOrdersPure(
    incomingOrders,
    todayStr,
    deletedSet
  );

  let newlyArchivedCount = 0;
  const pastOrderIdsToPurge: string[] = [];
  const ordersToSyncToServer: Order[] = [];

  // 1. Move all previous-day or manually archived orders (any status) into Archive
  pastOrArchivedOrders.forEach((order) => {
    const key = String(order.orderId || order.id).toLowerCase();
    if (!key) return;
    const prev = archiveMap.get(key);
    if (!prev || prev.status !== order.status) {
      newlyArchivedCount++;
      ordersToSyncToServer.push(order);
    }
    archiveMap.set(key, { ...(prev || {}), ...order });
    if (order.id) pastOrderIdsToPurge.push(order.id);
    if (order.orderId && order.orderId !== order.id) pastOrderIdsToPurge.push(order.orderId);
  });

  // 2. Ensure all today's delivered orders are also recorded in Archive for counting & revenue audit
  deliveredTodayOrders.forEach((order) => {
    const key = String(order.orderId || order.id).toLowerCase();
    if (!key) return;
    const prev = archiveMap.get(key);
    if (!prev || prev.status !== 'delivered' || prev.totalAmount !== order.totalAmount) {
      newlyArchivedCount++;
      const archivedCopy: Order = {
        ...order,
        archivedAt: (order as any).archivedAt || new Date().toISOString(),
      };
      archiveMap.set(key, archivedCopy);
      ordersToSyncToServer.push(archivedCopy);
    }
  });

  const allArchived = Array.from(archiveMap.values()).sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  const hasChanged = newlyArchivedCount > 0 || existingArchive.length !== allArchived.length;

  if (hasChanged) {
    saveArchivedOrders(allArchived);
    if (ordersToSyncToServer.length > 0) {
      try {
        fetch('/api/orders/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: ordersToSyncToServer }),
        }).catch(() => {});
      } catch {}
    }
  }

  // Purge any previous-day customer orders automatically on rollover check
  getCustomerOwnOrders();

  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEYS.LAST_CHECKED_DATE, todayStr);
  } catch {}

  return {
    todayOrders,
    archivedOrders: hasChanged ? allArchived : existingArchive,
    newlyArchivedCount,
    pastOrderIdsToPurge,
  };
}

/**
 * Manually archives an order into history.
 */
export function archiveSingleOrder(order: Order): void {
  const existing = getArchivedOrders();
  const key = String(order.orderId || order.id).toLowerCase();
  const filtered = existing.filter((o) => String(o.orderId || o.id).toLowerCase() !== key);
  const archivedRecord: Order = {
    ...order,
    isArchived: true,
    archivedAt: new Date().toISOString(),
    isManualArchive: true,
  };
  const updated = [archivedRecord, ...filtered];
  saveArchivedOrders(updated);
  try {
    fetch('/api/orders/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: archivedRecord }),
    }).catch(() => {});
  } catch {}
}

/**
 * Permanently deletes a single order from history and records a deletion tombstone.
 */
export function deleteArchivedOrder(orderId: string, extraId?: string): void {
  markOrderPermanentlyDeleted(orderId, extraId ? [extraId] : []);
  removeCustomerOwnOrder(orderId, extraId ? [extraId] : []);
  const existing = getArchivedOrders();
  const updated = existing.filter(
    (o) => o.id !== orderId && o.orderId !== orderId && (!extraId || (o.id !== extraId && o.orderId !== extraId))
  );
  saveArchivedOrders(updated);
}

/**
 * Permanently clears the entire order history archive.
 */
export function clearAllArchivedOrders(): void {
  try {
    const existing = getArchivedOrders();
    existing.forEach((o) => {
      markOrderPermanentlyDeleted(o.orderId || o.id, [o.id, o.orderId]);
    });
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.ARCHIVED_ORDERS);
    window.dispatchEvent(new CustomEvent('gidhaur_order_history_updated', { detail: [] }));
  } catch (err) {
    console.warn('Error clearing archived orders:', err);
  }
}

