import {
  collection,
  query,
  where,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Order } from '../types';
import { dbConnectionService } from './dbConnectionService';
import { guardedOnSnapshot } from './firestoreReadGuard';
import { ARCHIVE_STORAGE_KEYS, getDeletedOrderIds, ensureCleanSlateReset } from './orderArchiveService';

type OrderSubscriber = (orders: Order[]) => void;

class OrderListenerService {
  private subscribers = new Set<OrderSubscriber>();
  private activeUnsubscribe: Unsubscribe | null = null;
  private cachedOrders: Order[] = [];
  private lastFetchErrorTime = 0;
  private isConnecting = false;

  constructor() {
    ensureCleanSlateReset();
    // Load existing cached admin orders on service initialization
    try {
      const raw = localStorage.getItem(ARCHIVE_STORAGE_KEYS.ADMIN_LIVE_CACHE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const deletedSet = getDeletedOrderIds();
          this.cachedOrders = parsed.filter((o) => {
            if (!o || o.isArchived || o.archived || o.status === 'archived' || o.status === 'completed' || o.isDeleted) {
              return false;
            }
            const id1 = String(o?.id || '').toLowerCase();
            const id2 = String(o?.orderId || '').toLowerCase();
            return !deletedSet.has(id1) && !deletedSet.has(id2);
          });
        }
      }
    } catch {}

    // Keep listener alive for active admin subscribers so background / locked phone receives incoming orders.
    // If connection dropped due to network sleep, re-verify attachment when visible.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.subscribers.size > 0 && !this.activeUnsubscribe) {
          this.ensureListenerAttached();
        }
      });
    }
  }

  /**
   * Subscribe to live active orders.
   * Exclusively used on Admin, Kitchen, Prep, and Delivery screens.
   * NEVER used on customer screens.
   * Single singleton onSnapshot across the browser tab.
   */
  public subscribe(callback: OrderSubscriber): () => void {
    this.subscribers.add(callback);

    // Immediately deliver cached orders
    if (this.cachedOrders.length > 0) {
      callback(this.cachedOrders);
    }

    // Attach single Firestore listener
    this.ensureListenerAttached();

    return () => {
      this.subscribers.delete(callback);
      if (this.subscribers.size === 0) {
        this.detachListener();
      }
    };
  }

  public getOrders(): Order[] {
    return this.cachedOrders;
  }

  private ensureListenerAttached(): void {
    if (this.activeUnsubscribe || this.isConnecting) return;

    // Cooldown on error: 60s
    if (Date.now() - this.lastFetchErrorTime < 60000) {
      return;
    }

    try {
      this.isConnecting = true;
      const ordersCol = collection(db, 'orders');

      // Include delivered and rejected so Today's delivered/cancelled orders remain visible in Today's tab until midnight
      // and automatically sync to Archive without vanishing from the snapshot.
      const q = query(
        ordersCol,
        where('status', 'in', ['pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'rejected'])
      );

      this.activeUnsubscribe = guardedOnSnapshot(
        q,
        'orderListenerService.activeOrders',
        (snapshot: any) => {
          this.isConnecting = false;
          const deletedSet = getDeletedOrderIds();
          const list: Order[] = [];
          snapshot.forEach((docSnap: any) => {
            const data = docSnap.data() as Order;
            const id1 = String(docSnap.id || '').toLowerCase();
            const id2 = String(data.orderId || docSnap.id || '').toLowerCase();
            if (
              deletedSet.has(id1) ||
              deletedSet.has(id2) ||
              (data as any).isDeleted ||
              (data as any).isArchived ||
              (data as any).archived ||
              (data as any).status === 'archived' ||
              (data as any).status === 'completed'
            ) {
              return;
            }
            list.push({
              ...data,
              id: docSnap.id,
              orderId: data.orderId || docSnap.id,
            });
          });

          // Sort in JavaScript memory (descending by createdAt)
          list.sort((a, b) => {
            const timeA = a.createdAt instanceof Date
              ? a.createdAt.getTime()
              : a.createdAt && typeof (a.createdAt as any).toDate === 'function'
              ? (a.createdAt as any).toDate().getTime()
              : a.createdAt
              ? new Date(a.createdAt).getTime()
              : 0;

            const timeB = b.createdAt instanceof Date
              ? b.createdAt.getTime()
              : b.createdAt && typeof (b.createdAt as any).toDate === 'function'
              ? (b.createdAt as any).toDate().getTime()
              : b.createdAt
              ? new Date(b.createdAt).getTime()
              : 0;

            return timeB - timeA;
          });

          this.cachedOrders = list;
          try {
            localStorage.setItem(ARCHIVE_STORAGE_KEYS.ADMIN_LIVE_CACHE, JSON.stringify(list));
          } catch {}

          dbConnectionService.recordSnapshotArrival(snapshot.metadata?.fromCache);

          this.subscribers.forEach((cb) => {
            try {
              cb(list);
            } catch (err) {
              console.warn('Error in order subscriber callback:', err);
            }
          });
        },
        (error: any) => {
          this.isConnecting = false;
          this.lastFetchErrorTime = Date.now();
          console.warn('Singleton order listener note (quota/offline, serving local cache):', error?.message || error);
          dbConnectionService.recordFirestoreError(error);

          this.subscribers.forEach((cb) => {
            try {
              cb(this.cachedOrders);
            } catch {}
          });

          if (
            error?.code === 'resource-exhausted' ||
            error?.code === 'unavailable' ||
            String(error?.message || '').toLowerCase().includes('quota')
          ) {
            this.detachListener();
          }
        }
      );
    } catch (err) {
      this.isConnecting = false;
      this.lastFetchErrorTime = Date.now();
      console.warn('Could not attach singleton order listener:', err);
    }
  }

  private detachListener(): void {
    if (this.activeUnsubscribe) {
      try {
        this.activeUnsubscribe();
      } catch {}
      this.activeUnsubscribe = null;
    }
    this.isConnecting = false;
  }
}

export const orderListenerService = new OrderListenerService();

export function subscribeToSharedOrders(callback: (orders: Order[]) => void): () => void {
  return orderListenerService.subscribe(callback);
}
