/**
 * quotaTrackerService.ts
 * Tracks Firebase Firestore daily quota consumption, rate-limit thresholds,
 * and provides countdown calculations to the next UTC midnight (05:30 AM IST) reset.
 */

export interface QuotaMetric {
  readsLimit: number;
  writesLimit: number;
  deletesLimit: number;
  estimatedReads: number;
  estimatedWrites: number;
  estimatedDeletes: number;
  activeListenersCount: number;
  isExhausted: boolean;
  exhaustedReason?: string;
  lastUpdated: string;
  quotaResetUtc: string;
}

const STORAGE_KEY_QUOTA = 'gidhaur_firestore_quota_tracker_v1';

// Standard Firebase Spark Free Tier limits
export const SPARK_LIMITS = {
  DAILY_READS: 50000,
  DAILY_WRITES: 20000,
  DAILY_DELETES: 20000,
  SIMULTANEOUS_CONNECTIONS: 100,
  MAX_PEAK_BURST_PER_MIN: 600,
};

/**
 * Calculates remaining time until next Google Cloud project quota reset (Midnight Pacific / 12:30 PM IST / 07:00 UTC)
 */
export function getTimeUntilQuotaReset(): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  totalSeconds: number;
  resetDate: Date;
} {
  const now = new Date();
  
  // Google Cloud API consumer quotas reset daily at midnight Pacific Time (07:00 UTC / 12:30 PM IST)
  let nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7, 0, 0, 0));
  if (now.getTime() >= nextReset.getTime()) {
    // If today's 07:00 UTC has passed, next reset is tomorrow at 07:00 UTC
    nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 7, 0, 0, 0));
  }

  const diffMs = Math.max(0, nextReset.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return {
    hours,
    minutes,
    seconds,
    formatted,
    totalSeconds,
    resetDate: nextReset,
  };
}

/**
 * Returns today's UTC date key (e.g. "2026-10-08") to auto-reset daily stats
 */
function getTodayUtcKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}-${d.getUTCDate().toString().padStart(2, '0')}`;
}

export function getQuotaUsageStats(): QuotaMetric {
  const todayKey = getTodayUtcKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUOTA);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.todayKey === todayKey) {
        return {
          readsLimit: SPARK_LIMITS.DAILY_READS,
          writesLimit: SPARK_LIMITS.DAILY_WRITES,
          deletesLimit: SPARK_LIMITS.DAILY_DELETES,
          estimatedReads: data.estimatedReads || 0,
          estimatedWrites: data.estimatedWrites || 0,
          estimatedDeletes: data.estimatedDeletes || 0,
          activeListenersCount: data.activeListenersCount || 4,
          isExhausted: !!data.isExhausted,
          exhaustedReason: data.exhaustedReason || '',
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          quotaResetUtc: '00:00 UTC (05:30 AM IST)',
        };
      }
    }
  } catch {}

  // Defaults for a fresh day
  return {
    readsLimit: SPARK_LIMITS.DAILY_READS,
    writesLimit: SPARK_LIMITS.DAILY_WRITES,
    deletesLimit: SPARK_LIMITS.DAILY_DELETES,
    estimatedReads: 512,
    estimatedWrites: 18,
    estimatedDeletes: 0,
    activeListenersCount: 4,
    isExhausted: false,
    exhaustedReason: '',
    lastUpdated: new Date().toISOString(),
    quotaResetUtc: '00:00 UTC (05:30 AM IST)',
  };
}

export function saveQuotaUsageStats(stats: Partial<QuotaMetric>): void {
  try {
    const current = getQuotaUsageStats();
    const todayKey = getTodayUtcKey();
    const updated = {
      ...current,
      ...stats,
      todayKey,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_QUOTA, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('gidhaur_quota_updated', { detail: updated }));
  } catch {}
}

export function recordQuotaExhaustedEvent(isExhausted: boolean, reason = 'Daily quota limit reached / Rate limit burst'): void {
  saveQuotaUsageStats({
    isExhausted,
    exhaustedReason: isExhausted ? reason : '',
    // If exhausted, adjust estimated reads to near 100%
    ...(isExhausted ? { estimatedReads: Math.max(getQuotaUsageStats().estimatedReads, SPARK_LIMITS.DAILY_READS) } : {})
  });
}

export function incrementOperationEstimate(type: 'read' | 'write' | 'delete', count = 1): void {
  const current = getQuotaUsageStats();
  if (type === 'read') {
    saveQuotaUsageStats({ estimatedReads: current.estimatedReads + count });
  } else if (type === 'write') {
    saveQuotaUsageStats({ estimatedWrites: current.estimatedWrites + count });
  } else if (type === 'delete') {
    saveQuotaUsageStats({ estimatedDeletes: current.estimatedDeletes + count });
  }
}
