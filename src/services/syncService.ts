import { BannerSettings, Order } from '../types';
import { applyServerBannerSettings } from './bannerService';

type SyncEventHandlers = {
  onBannerSettings?: (settings: BannerSettings) => void;
  onOrdersUpdate?: (orders: Order[]) => void;
  onSettingsUpdate?: (settings: any) => void;
};

const subscribers: Set<SyncEventHandlers> = new Set();
let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;

/**
 * Initializes real-time Server-Sent Events (SSE) connection to sync state across
 * simulator, mobile phones (e.g. iPhone), and any open client tabs.
 */
export function initLiveSync(): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
    return () => {};
  }

  const connect = () => {
    try {
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource('/api/sync/events');

      eventSource.onopen = () => {
        reconnectAttempts = 0;
      };

      // Initial full snapshot from server
      eventSource.addEventListener('init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.bannerSettings) {
            applyServerBannerSettings(data.bannerSettings);
            subscribers.forEach((s) => s.onBannerSettings?.(data.bannerSettings));
          }
          if (Array.isArray(data.orders)) {
            subscribers.forEach((s) => s.onOrdersUpdate?.(data.orders));
          }
          if (data.settings) {
            subscribers.forEach((s) => s.onSettingsUpdate?.(data.settings));
          }
        } catch (err) {
          console.warn('Error parsing sync init event:', err);
        }
      });

      // Real-time banner settings broadcast
      eventSource.addEventListener('banner_settings', (e: MessageEvent) => {
        try {
          const settings = JSON.parse(e.data) as BannerSettings;
          applyServerBannerSettings(settings);
          subscribers.forEach((s) => s.onBannerSettings?.(settings));
        } catch (err) {
          console.warn('Error parsing banner_settings sync event:', err);
        }
      });

      // Real-time orders broadcast
      eventSource.addEventListener('orders_update', (e: MessageEvent) => {
        try {
          const orders = JSON.parse(e.data) as Order[];
          subscribers.forEach((s) => s.onOrdersUpdate?.(orders));
        } catch (err) {
          console.warn('Error parsing orders_update sync event:', err);
        }
      });

      // General settings broadcast
      eventSource.addEventListener('settings_update', (e: MessageEvent) => {
        try {
          const settings = JSON.parse(e.data);
          subscribers.forEach((s) => s.onSettingsUpdate?.(settings));
        } catch (err) {
          console.warn('Error parsing settings_update sync event:', err);
        }
      });

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Exponential backoff reconnection capped at 10s
        const delay = Math.min(10000, 1000 * Math.pow(1.5, reconnectAttempts++));
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, delay);
      };
    } catch (err) {
      console.warn('SSE connection initiation note:', err);
    }
  };

  connect();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

/**
 * Register handler for real-time live sync events from the server
 */
export function subscribeToLiveSync(handlers: SyncEventHandlers): () => void {
  subscribers.add(handlers);
  return () => {
    subscribers.delete(handlers);
  };
}
