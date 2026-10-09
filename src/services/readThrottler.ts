/**
 * Read Throttler & Memory Cache Service
 * Prevents redundant Firestore reads, enforces in-memory cooldown (60s),
 * and eliminates burst requests across component mounts.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ReadThrottlerService {
  private cache = new Map<string, CacheEntry<any>>();
  private lastFetchTimestamp = new Map<string, number>();
  private inFlightRequests = new Map<string, Promise<any>>();

  /**
   * Checks if a collection/key can be fetched from the network or if cooldown is active
   */
  public canFetch(key: string, cooldownMs: number = 60000): boolean {
    const last = this.lastFetchTimestamp.get(key) || 0;
    return Date.now() - last >= cooldownMs;
  }

  /**
   * Marks that a fetch has been initiated/completed
   */
  public markFetched(key: string): void {
    this.lastFetchTimestamp.set(key, Date.now());
  }

  /**
   * Gets cached data if valid within maxAgeMs
   */
  public getCached<T>(key: string, maxAgeMs: number = 300000): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > maxAgeMs) {
      return null;
    }
    return entry.data as T;
  }

  /**
   * Sets cached data in memory
   */
  public setCached<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    this.markFetched(key);
  }

  /**
   * Deduplicates in-flight promises so multiple callers await the same request
   */
  public async deduplicate<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const existing = this.inFlightRequests.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = (async () => {
      try {
        const result = await fetchFn();
        this.setCached(key, result);
        return result;
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  /**
   * Clears cache for a specific key (e.g. after user explicitly updates a collection)
   */
  public invalidate(key: string): void {
    this.cache.delete(key);
    this.lastFetchTimestamp.delete(key);
    this.inFlightRequests.delete(key);
  }

  /**
   * Invalidate all cached data
   */
  public invalidateAll(): void {
    this.cache.clear();
    this.lastFetchTimestamp.clear();
    this.inFlightRequests.clear();
  }
}

export const readThrottler = new ReadThrottlerService();
