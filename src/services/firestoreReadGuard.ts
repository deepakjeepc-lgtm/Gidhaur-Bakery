import {
  DocumentReference,
  DocumentSnapshot,
  Query,
  QuerySnapshot,
  getDoc,
  getDocs,
  onSnapshot,
  Unsubscribe,
  SnapshotListenOptions
} from 'firebase/firestore';

/**
 * Global Firestore Read Guard
 * 1. Logs every Firestore read: "FS READ: <callerTag>" with total running count.
 * 2. If client exceeds 200 reads in 60 seconds, blocks all reads for 10 minutes.
 * 3. Supports emergency switch via localStorage: FS_READS_DISABLED=1.
 */

interface ReadTimestamp {
  timestamp: number;
  count: number;
  tag: string;
}

class FirestoreReadGuard {
  private totalReadsCount = 0;
  private recentReads: ReadTimestamp[] = [];
  private blockedUntil = 0;
  private readonly WINDOW_MS = 60 * 1000; // 1 minute
  private readonly MAX_READS_PER_WINDOW = 200; // 200 reads / min
  private readonly BLOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Check initial emergency switch
    if (this.isEmergencyDisabled()) {
      console.warn('[FS READ GUARD] Emergency lock ACTIVE: FS_READS_DISABLED=1 in localStorage.');
    }
  }

  public isEmergencyDisabled(): boolean {
    try {
      return localStorage.getItem('FS_READS_DISABLED') === '1';
    } catch {
      return false;
    }
  }

  public isRateLimited(): boolean {
    if (this.isEmergencyDisabled()) return true;

    const now = Date.now();
    if (this.blockedUntil > now) {
      return true;
    }

    // Clean up reads older than 60s
    this.recentReads = this.recentReads.filter((r) => now - r.timestamp < this.WINDOW_MS);
    const windowSum = this.recentReads.reduce((sum, r) => sum + r.count, 0);

    if (windowSum >= this.MAX_READS_PER_WINDOW) {
      this.blockedUntil = now + this.BLOCK_DURATION_MS;
      console.error(
        `[FS READ GUARD] EXCEEDED 200 reads in 1 minute (${windowSum} reads). Blocking further reads until ${new Date(
          this.blockedUntil
        ).toLocaleTimeString()}`
      );
      this.dispatchProtectionEvent(true);
      return true;
    }

    return false;
  }

  public recordRead(tag: string, count = 1): void {
    const now = Date.now();
    this.totalReadsCount += count;
    this.recentReads.push({ timestamp: now, count, tag });
    console.log(`[FS READ] ${tag} | +${count} read(s) | Total: ${this.totalReadsCount} (Last min: ${this.getRecentReadsCount()})`);

    // Check if this record tripped the circuit breaker
    if (this.isRateLimited()) {
      this.dispatchProtectionEvent(true);
    }
  }

  public getRecentReadsCount(): number {
    const now = Date.now();
    return this.recentReads
      .filter((r) => now - r.timestamp < this.WINDOW_MS)
      .reduce((sum, r) => sum + r.count, 0);
  }

  public getTotalReads(): number {
    return this.totalReadsCount;
  }

  public getBlockedRemainingSeconds(): number {
    const now = Date.now();
    return this.blockedUntil > now ? Math.ceil((this.blockedUntil - now) / 1000) : 0;
  }

  private dispatchProtectionEvent(isActive: boolean): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('fs_read_protection_changed', {
          detail: {
            isActive,
            blockedRemainingSeconds: this.getBlockedRemainingSeconds(),
            isEmergency: this.isEmergencyDisabled()
          }
        })
      );
    }
  }
}

export const readGuard = new FirestoreReadGuard();

/**
 * Guarded getDoc wrapper
 */
export async function guardedGetDoc<T = any>(
  docRef: DocumentReference<T>,
  callerTag: string
): Promise<DocumentSnapshot<T>> {
  if (readGuard.isRateLimited()) {
    console.warn(`[FS READ BLOCKED] getDoc blocked by Read Guard: ${callerTag}`);
    throw new Error('Firestore read limit protection active. Try again later.');
  }

  readGuard.recordRead(`getDoc: ${callerTag}`, 1);
  return getDoc(docRef);
}

/**
 * Guarded getDocs wrapper
 */
export async function guardedGetDocs<T = any>(
  queryRef: Query<T>,
  callerTag: string
): Promise<QuerySnapshot<T>> {
  if (readGuard.isRateLimited()) {
    console.warn(`[FS READ BLOCKED] getDocs blocked by Read Guard: ${callerTag}`);
    throw new Error('Firestore read limit protection active. Try again later.');
  }

  const snap = await getDocs(queryRef);
  readGuard.recordRead(`getDocs: ${callerTag}`, Math.max(1, snap.size));
  return snap;
}

/**
 * Guarded onSnapshot wrapper
 */
export function guardedOnSnapshot<T = any>(
  queryRef: Query<T> | DocumentReference<T>,
  callerTag: string,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
): Unsubscribe {
  if (readGuard.isRateLimited()) {
    console.warn(`[FS READ BLOCKED] onSnapshot blocked by Read Guard: ${callerTag}`);
    if (onError) onError(new Error('Firestore read limit protection active.'));
    return () => {};
  }

  return onSnapshot(
    queryRef as any,
    (snapshot: any) => {
      // Document snapshot has exists() or QuerySnapshot has size
      const count = 'size' in snapshot ? Math.max(1, snapshot.size) : 1;
      readGuard.recordRead(`onSnapshot: ${callerTag}`, count);
      onNext(snapshot);
    },
    (err: any) => {
      if (onError) onError(err);
    }
  );
}
