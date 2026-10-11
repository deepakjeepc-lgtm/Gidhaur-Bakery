/**
 * Quota & Fallback Service
 * Manages daily Firestore quota status with zero Firestore reads.
 */

const STORAGE_KEY_EXHAUSTED_DATE = 'swadeep_quota_exhausted_date';
const STORAGE_KEY_TEST_MODE = 'swadeep_quota_test_mode';

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Checks whether the daily Firestore quota is exhausted.
 * Returns true if test simulation is active OR if an actual quota error occurred today.
 */
export function isQuotaExhausted(): boolean {
  try {
    // 1. Check if admin simulation toggle is on
    const testMode = localStorage.getItem(STORAGE_KEY_TEST_MODE);
    if (testMode === 'true') {
      return true;
    }

    // 2. Check if quota exhausted date matches today
    const exhaustedDate = localStorage.getItem(STORAGE_KEY_EXHAUSTED_DATE);
    if (exhaustedDate && exhaustedDate === getTodayString()) {
      return true;
    }
  } catch (e) {
    console.warn('Quota check error:', e);
  }
  return false;
}

/**
 * Checks if the quota simulation mode is specifically active via Admin toggle.
 */
export function isQuotaTestMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_TEST_MODE) === 'true';
  } catch {
    return false;
  }
}

/**
 * Turns admin simulation mode on or off.
 */
export function setQuotaTestMode(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY_TEST_MODE, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_TEST_MODE);
    }
    window.dispatchEvent(new CustomEvent('swadeep_quota_status_changed', { detail: { testMode: enabled } }));
  } catch (e) {
    console.warn('Set quota test mode error:', e);
  }
}

/**
 * Marks today's quota as exhausted when a Firestore quota error is caught.
 */
export function markQuotaExhausted(): void {
  try {
    localStorage.setItem(STORAGE_KEY_EXHAUSTED_DATE, getTodayString());
    window.dispatchEvent(new CustomEvent('swadeep_quota_status_changed', { detail: { exhausted: true } }));
  } catch (e) {
    console.warn('Mark quota exhausted error:', e);
  }
}

/**
 * Manually resets all quota limits (both test mode and today's exhausted mark).
 */
export function resetQuotaStatus(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_EXHAUSTED_DATE);
    localStorage.removeItem(STORAGE_KEY_TEST_MODE);
    window.dispatchEvent(new CustomEvent('swadeep_quota_status_changed', { detail: { reset: true } }));
  } catch (e) {
    console.warn('Reset quota status error:', e);
  }
}

/**
 * Checks if an error is a Firebase resource-exhausted error
 */
export function isFirestoreQuotaError(error: any): boolean {
  if (!error) return false;
  const msg = String(error?.message || error?.code || error || '').toLowerCase();
  return (
    msg.includes('resource-exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('quota-exceeded') ||
    msg.includes('resource_exhausted') ||
    error?.code === 'resource-exhausted'
  );
}
