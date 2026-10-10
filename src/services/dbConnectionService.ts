/**
 * dbConnectionService.ts
 *
 * Provides a zero-read, event-driven live database connection monitor.
 * STRICT ZERO-LOOP DESIGN:
 * - NO background setInterval or polling queries that burn Firestore reads.
 * - Listens exclusively to existing snapshot events from orderListenerService,
 *   window online/offline events, and Firestore error events.
 * - Immediate red blinking state when quota is exhausted or disconnected.
 * - Pulsing green state when live connected to Firestore.
 */

import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  getQuotaUsageStats,
  recordQuotaExhaustedEvent,
  QuotaMetric
} from './quotaTrackerService';

export type DbStatus = 'connected' | 'quota-full' | 'disconnected' | 'connecting';

export interface DbConnectionDetails {
  status: DbStatus;
  isLive: boolean;
  isQuotaFull: boolean;
  isOnline: boolean;
  lastSyncTime: Date | null;
  lastErrorMessage: string | null;
  fromCache: boolean;
  latencyMs: number | null;
}

type Listener = (details: DbConnectionDetails) => void;

class DbConnectionService {
  private status: DbStatus = 'connecting';
  private lastSyncTime: Date | null = new Date();
  private lastErrorMessage: string | null = null;
  private fromCache: boolean = false;
  private latencyMs: number | null = null;
  private listeners: Set<Listener> = new Set();
  private isTestingConnection: boolean = false;

  constructor() {
    // 1. Initial status detection based on browser network & quota state
    if (typeof window !== 'undefined') {
      const isOnline = navigator.onLine;
      const quota = getQuotaUsageStats();

      if (!isOnline) {
        this.status = 'disconnected';
        this.lastErrorMessage = 'Internet disconnected (Offline)';
        this.lastSyncTime = new Date();
      } else if (quota.isExhausted) {
        this.status = 'quota-full';
        this.lastErrorMessage = quota.exhaustedReason || 'Daily Spark quota read limit reached (50,000 reads)';
        this.lastSyncTime = new Date();
      } else {
        // Assume connected/connecting initially
        this.status = 'connected';
        this.lastSyncTime = new Date();
      }

      // 2. Listen to browser network changes
      window.addEventListener('online', () => {
        const currentQuota = getQuotaUsageStats();
        if (currentQuota.isExhausted) {
          this.updateState({
            status: 'quota-full',
            lastSyncTime: new Date(),
            lastErrorMessage: currentQuota.exhaustedReason || 'Daily quota limit reached',
          });
        } else {
          this.updateState({
            status: 'connected',
            lastSyncTime: new Date(),
            lastErrorMessage: null,
          });
        }
      });

      window.addEventListener('offline', () => {
        this.updateState({
          status: 'disconnected',
          lastErrorMessage: 'Internet connection lost (Offline)',
        });
      });

      // 3. Listen to quota tracker state updates
      window.addEventListener('gidhaur_quota_updated', (e: any) => {
        const metric: QuotaMetric = e.detail;
        if (metric?.isExhausted) {
          this.updateState({
            status: 'quota-full',
            lastErrorMessage: metric.exhaustedReason || 'Daily quota read limit exceeded',
          });
        } else if (this.status === 'quota-full' && !metric?.isExhausted && navigator.onLine) {
          this.updateState({
            status: 'connected',
            lastErrorMessage: null,
          });
        }
      });
    }
  }

  /**
   * Called passively whenever the singleton order listener receives data.
   * Zero added reads—uses existing stream metadata.
   */
  public recordSnapshotArrival(fromCache: boolean = false): void {
    const quota = getQuotaUsageStats();
    if (quota.isExhausted) {
      this.updateState({
        status: 'quota-full',
        lastSyncTime: new Date(),
        fromCache: true,
      });
      return;
    }

    if (!navigator.onLine) {
      this.updateState({
        status: 'disconnected',
        lastSyncTime: new Date(),
        fromCache: true,
      });
      return;
    }

    this.updateState({
      status: 'connected',
      lastSyncTime: new Date(),
      fromCache,
      lastErrorMessage: null,
    });
  }

  /**
   * Called when any Firestore error occurs across the app.
   */
  public recordFirestoreError(error: any): void {
    const errorStr = String(error?.message || error?.code || error || '').toLowerCase();
    const isExhausted =
      error?.code === 'resource-exhausted' ||
      errorStr.includes('resource-exhausted') ||
      errorStr.includes('quota') ||
      errorStr.includes('rate limit') ||
      errorStr.includes('429');

    const isOffline =
      !navigator.onLine ||
      error?.code === 'unavailable' ||
      errorStr.includes('failed to get document because the client is offline') ||
      errorStr.includes('client is offline');

    if (isExhausted) {
      recordQuotaExhaustedEvent(true, error?.message || 'Daily free tier limit (50,000 reads) reached');
      this.updateState({
        status: 'quota-full',
        lastErrorMessage: 'Daily quota limit reached (50,000 reads) - Serving local cache',
      });
    } else if (isOffline) {
      this.updateState({
        status: 'disconnected',
        lastErrorMessage: 'Database offline / Network unavailable',
      });
    } else {
      this.updateState({
        lastErrorMessage: error?.message || 'Connection error',
      });
    }
  }

  /**
   * Explicitly triggered ONLY when the admin clicks "Test Connection" button.
   * STRICTLY manual, never in a loop. Consumes exactly 1 read for diagnosis.
   */
  public async testConnectionManual(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    if (this.isTestingConnection) {
      return { success: false, message: 'Test already in progress', latencyMs: 0 };
    }

    if (!navigator.onLine) {
      this.updateState({
        status: 'disconnected',
        lastErrorMessage: 'Internet disconnected',
      });
      return { success: false, message: 'Internet connection nahi hai (Offline)', latencyMs: 0 };
    }

    this.isTestingConnection = true;
    const startTime = performance.now();

    try {
      // Perform 1 lightweight read bounded to limit(1)
      const testQuery = query(collection(db, 'settings'), limit(1));
      const snap = await getDocs(testQuery);
      const latencyMs = Math.round(performance.now() - startTime);
      const isFromCache = snap.metadata.fromCache;

      if (isFromCache && !navigator.onLine) {
        this.updateState({
          status: 'disconnected',
          latencyMs,
          fromCache: true,
          lastErrorMessage: 'Served from offline cache',
        });
        return {
          success: false,
          message: 'Offline cache se data aaya, live network connect nahi hua.',
          latencyMs,
        };
      }

      // If successful live response
      recordQuotaExhaustedEvent(false);
      this.updateState({
        status: 'connected',
        latencyMs,
        fromCache: isFromCache,
        lastSyncTime: new Date(),
        lastErrorMessage: null,
      });

      return {
        success: true,
        message: `Database live connected! Response time: ${latencyMs}ms`,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      this.recordFirestoreError(err);
      return {
        success: false,
        message: err?.message || 'Connection test failed',
        latencyMs,
      };
    } finally {
      this.isTestingConnection = false;
    }
  }

  /**
   * Subscribe to connection changes
   */
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Emit immediate current state
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): DbConnectionDetails {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const quota = getQuotaUsageStats();
    let currentStatus = this.status;

    if (!isOnline) {
      currentStatus = 'disconnected';
    } else if (quota.isExhausted) {
      currentStatus = 'quota-full';
    }

    return {
      status: currentStatus,
      isLive: currentStatus === 'connected',
      isQuotaFull: currentStatus === 'quota-full',
      isOnline,
      lastSyncTime: this.lastSyncTime || new Date(),
      lastErrorMessage: this.lastErrorMessage,
      fromCache: this.fromCache,
      latencyMs: this.latencyMs,
    };
  }

  private updateState(partial: Partial<DbConnectionDetails>): void {
    if (partial.status !== undefined) this.status = partial.status;
    if (partial.lastSyncTime !== undefined) this.lastSyncTime = partial.lastSyncTime;
    if (partial.lastErrorMessage !== undefined) this.lastErrorMessage = partial.lastErrorMessage;
    if (partial.fromCache !== undefined) this.fromCache = partial.fromCache;
    if (partial.latencyMs !== undefined) this.latencyMs = partial.latencyMs;

    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.warn('Listener error in dbConnectionService:', e);
      }
    });
  }
}

export const dbConnectionService = new DbConnectionService();
