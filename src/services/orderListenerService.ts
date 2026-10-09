import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Order } from '../types';

type OrderSubscriber = (orders: Order[]) => void;

class OrderListenerService {
  private subscribers = new Set<OrderSubscriber>();
  private activeUnsubscribe: Unsubscribe | null = null;
  private cachedOrders: Order[] = [];
  private lastFetchErrorTime = 0;
  private isConnecting = false;

  constructor() {
    // Load existing cached orders on service initialization
    try {
      const raw = localStorage.getItem('swadeep_recent_orders');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.cachedOrders = parsed;
        }
      }
    } catch {}
  }

  /**
   * Subscribe to live active orders.
   * If this is the first subscriber, opens a SINGLE Firestore snapshot listener.
   * Subsequent subscribers share the same stream with zero extra reads.
   * Returns an unsubscribe cleanup function.
   */
  public subscribe(callback: OrderSubscriber): () => void {
    this.subscribers.add(callback);

    // Immediately deliver cached orders so subscriber never waits on network
    if (this.cachedOrders.length > 0) {
      callback(this.cachedOrders);
    }

    // Attach single Firestore listener if not already active
    this.ensureListenerAttached();

    return () => {
      this.subscribers.delete(callback);
      // If no components are listening anymore, terminate Firestore stream immediately
      if (this.subscribers.size === 0) {
        this.detachListener();
      }
    };
  }

  /**
   * Returns currently cached orders synchronously
   */
  public getOrders(): Order[] {
    return this.cachedOrders;
  }

  private ensureListenerAttached(): void {
    if (this.activeUnsubscribe || this.isConnecting) return;

    // Throttle reconnect if an error recently occurred (cooldown 60 seconds)
    if (Date.now() - this.lastFetchErrorTime < 60000) {
      return;
    }

    try {
      this.isConnecting = true;
      const ordersCol = collection(db, 'orders');
      // Strictly bounded query: only the latest 25 orders to prevent massive reads
      const q = query(ordersCol, orderBy('createdAt', 'desc'), limit(25));

      this.activeUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
          this.isConnecting = false;
          const list: Order[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Order;
            list.push({
              ...data,
              id: docSnap.id,
              orderId: data.orderId || docSnap.id,
            });
          });

          this.cachedOrders = list;
          try {
            localStorage.setItem('swadeep_recent_orders', JSON.stringify(list));
          } catch {}

          // Broadcast to all active subscribers
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

          // Gracefully serve local cache to all subscribers
          this.subscribers.forEach((cb) => {
            try {
              cb(this.cachedOrders);
            } catch {}
          });

          // If quota exceeded or backend unavailable, detach listener to avoid continuous retry bursts
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
