import { Order } from '../types';

export const ARCHIVE_STORAGE_KEYS = {
  ACTIVE_ORDERS: 'gidhaur_active_orders',
  ARCHIVED_ORDERS: 'gidhaur_orders_history',
  RECENT_ORDERS: 'gidhaur_recent_orders',
  LEGACY_RECENT_ORDERS: 'swadeep_recent_orders',
  LAST_CHECKED_DATE: 'gidhaur_last_order_rollover_date'
};

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
export function isOrderFromToday(order: Order, todayStr: string = getTodayDateString()): boolean {
  if (!order) return false;
  const orderDateStr = getLocalDateString(order.createdAt);
  return orderDateStr === todayStr;
}

/**
 * Clears all customer device tracking history and recent orders.
 */
export function clearAllTrackingHistory(): void {
  try {
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.RECENT_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.LEGACY_RECENT_ORDERS);
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.ACTIVE_ORDERS);
    localStorage.removeItem('swadeep_recent_orders');
    localStorage.removeItem('gidhaur_recent_orders');
    localStorage.removeItem('gidhaur_active_orders');
    localStorage.removeItem('swadeep_customer_profile');
    localStorage.removeItem('gidhaur_customer_profile');
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
 * Reads all archived orders from persistent storage.
 */
export function getArchivedOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEYS.ARCHIVED_ORDERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves archived orders to persistent storage.
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
 * Daily Rollover Rule:
 * Separates orders into:
 * 1) todayOrders: only orders created on the current calendar day.
 * 2) archivedOrders: all orders from yesterday or older (pending, unapproved, delivered, or any status).
 * They are automatically moved to History so the active board resets every day!
 */
export function performDailyOrderRollover(
  incomingOrders: Order[]
): {
  todayOrders: Order[];
  archivedOrders: Order[];
  newlyArchivedCount: number;
} {
  const todayStr = getTodayDateString();
  const existingArchive = getArchivedOrders();
  const archiveMap = new Map<string, Order>();

  // Load existing archived orders into map
  existingArchive.forEach((o) => {
    const key = o.orderId || o.id;
    if (key) archiveMap.set(key, o);
  });

  const todayOrders: Order[] = [];
  let newlyArchivedCount = 0;

  incomingOrders.forEach((order) => {
    const key = order.orderId || order.id;
    const isToday = isOrderFromToday(order, todayStr);

    if (isToday) {
      todayOrders.push(order);
    } else {
      // Order is from a past date. Regardless of status (pending, accepted, delivered, etc.),
      // move it to History as mandated by the daily reset rule.
      if (!archiveMap.has(key)) {
        newlyArchivedCount++;
      }
      archiveMap.set(key, {
        ...order,
        archivedAt: (order as any).archivedAt || new Date().toISOString(),
        isPreviousDayArchive: true
      });
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
  }

  // Update last rollover check date
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEYS.LAST_CHECKED_DATE, todayStr);
  } catch {}

  return {
    todayOrders,
    archivedOrders: hasChanged ? allArchived : existingArchive,
    newlyArchivedCount
  };
}

/**
 * Manually archives an order into history.
 */
export function archiveSingleOrder(order: Order): void {
  const existing = getArchivedOrders();
  const key = order.orderId || order.id;
  const filtered = existing.filter((o) => (o.orderId || o.id) !== key);
  const updated = [
    { ...order, archivedAt: new Date().toISOString(), isManualArchive: true },
    ...filtered
  ];
  saveArchivedOrders(updated);
}

/**
 * Deletes a single order from history.
 */
export function deleteArchivedOrder(orderId: string): void {
  const existing = getArchivedOrders();
  const updated = existing.filter((o) => o.id !== orderId && o.orderId !== orderId);
  saveArchivedOrders(updated);
}

/**
 * Clears the entire order history archive.
 */
export function clearAllArchivedOrders(): void {
  try {
    localStorage.removeItem(ARCHIVE_STORAGE_KEYS.ARCHIVED_ORDERS);
    window.dispatchEvent(new CustomEvent('gidhaur_order_history_updated', { detail: [] }));
  } catch (err) {
    console.warn('Error clearing archived orders:', err);
  }
}
