import {
  DocumentReference,
  SetOptions,
  WriteBatch,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch as fsWriteBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Global Firestore Write Guard & Spike Prevention
 * 
 * Objectives:
 * 1. Eliminate infinite loops where a reactive useEffect writes to Firestore repeatedly.
 * 2. Block rapid accidental double clicks / burst submissions (e.g., toggle spam, double-tap order button).
 * 3. Enforce a circuit breaker: If > 40 writes occur within 10 seconds, pause writes and log alert.
 * 4. Deduplicate writes: If an identical write to the same docId is triggered within 300ms, drop the duplicate.
 */

interface WriteEvent {
  timestamp: number;
  docPath: string;
  tag: string;
}

class FirestoreWriteGuard {
  private totalWritesCount = 0;
  private recentWrites: WriteEvent[] = [];
  private lastWriteByPath = new Map<string, number>();
  private blockedUntil = 0;

  private readonly WINDOW_MS = 10 * 1000; // 10-second sliding window
  private readonly MAX_WRITES_PER_WINDOW = 40; // Max 40 writes per 10s
  private readonly BLOCK_DURATION_MS = 30 * 1000; // 30s circuit-breaker lock
  private readonly DEDUPLICATE_DEBOUNCE_MS = 300; // 300ms duplicate suppression

  /**
   * Checks if writes are temporarily locked by the circuit breaker
   */
  public isRateLimited(): boolean {
    const now = Date.now();
    if (this.blockedUntil > now) {
      return true;
    }

    // Prune events outside window
    this.recentWrites = this.recentWrites.filter((w) => now - w.timestamp < this.WINDOW_MS);

    if (this.recentWrites.length >= this.MAX_WRITES_PER_WINDOW) {
      this.blockedUntil = now + this.BLOCK_DURATION_MS;
      console.error(
        `🚨 [FS WRITE GUARD SPIKE BLOCKED] Exceeded ${this.MAX_WRITES_PER_WINDOW} writes in 10s! Write operations paused until ${new Date(
          this.blockedUntil
        ).toLocaleTimeString()} to prevent loop/quota spike.`
      );
      this.dispatchAlertEvent();
      return true;
    }

    return false;
  }

  /**
   * Checks if an identical document was written within debounce threshold (double-click protection)
   */
  public isDebounced(docPath: string): boolean {
    const now = Date.now();
    const last = this.lastWriteByPath.get(docPath) || 0;
    if (now - last < this.DEDUPLICATE_DEBOUNCE_MS) {
      console.warn(`⚠️ [FS WRITE GUARD] Suppressed rapid duplicate write to ${docPath} (${now - last}ms ago).`);
      return true;
    }
    return false;
  }

  /**
   * Records a successful write attempt
   */
  public recordWrite(docPath: string, tag: string): void {
    const now = Date.now();
    this.totalWritesCount++;
    this.lastWriteByPath.set(docPath, now);
    this.recentWrites.push({ timestamp: now, docPath, tag });

    // Informational log
    console.log(
      `📝 [FS WRITE] ${tag} | Doc: ${docPath} | Total writes: ${this.totalWritesCount} (Last 10s: ${this.recentWrites.length})`
    );
  }

  public getTotalWrites(): number {
    return this.totalWritesCount;
  }

  public getBlockedRemainingSeconds(): number {
    const now = Date.now();
    return this.blockedUntil > now ? Math.ceil((this.blockedUntil - now) / 1000) : 0;
  }

  private dispatchAlertEvent(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('fs_write_spike_blocked', {
          detail: {
            blockedRemainingSeconds: this.getBlockedRemainingSeconds(),
            totalWrites: this.totalWritesCount,
          },
        })
      );
    }
  }
}

export const writeGuard = new FirestoreWriteGuard();

/**
 * Guarded setDoc wrapper with debounce and loop circuit breaker
 */
export async function guardedSetDoc<T = any>(
  docRef: DocumentReference<T>,
  data: any,
  options?: SetOptions,
  callerTag = 'unknown'
): Promise<void> {
  const path = docRef.path;

  if (writeGuard.isRateLimited()) {
    throw new Error(`Firestore write paused by safety circuit breaker. (${callerTag})`);
  }

  if (writeGuard.isDebounced(path)) {
    return; // Silently drop rapid identical spam
  }

  writeGuard.recordWrite(path, `setDoc: ${callerTag}`);
  if (options) {
    return setDoc(docRef, data, options);
  }
  return setDoc(docRef, data);
}

/**
 * Guarded updateDoc wrapper with debounce and loop circuit breaker
 */
export async function guardedUpdateDoc<T = any>(
  docRef: DocumentReference<T>,
  data: any,
  callerTag = 'unknown'
): Promise<void> {
  const path = docRef.path;

  if (writeGuard.isRateLimited()) {
    throw new Error(`Firestore update paused by safety circuit breaker. (${callerTag})`);
  }

  if (writeGuard.isDebounced(path)) {
    return; // Drop rapid repeat
  }

  writeGuard.recordWrite(path, `updateDoc: ${callerTag}`);
  return updateDoc(docRef, data);
}

/**
 * Guarded deleteDoc wrapper
 */
export async function guardedDeleteDoc<T = any>(
  docRef: DocumentReference<T>,
  callerTag = 'unknown'
): Promise<void> {
  const path = docRef.path;

  if (writeGuard.isRateLimited()) {
    throw new Error(`Firestore delete paused by safety circuit breaker. (${callerTag})`);
  }

  writeGuard.recordWrite(path, `deleteDoc: ${callerTag}`);
  return deleteDoc(docRef);
}

/**
 * Helper to create a guarded batch
 */
export function createGuardedBatch(callerTag = 'batch'): WriteBatch {
  if (writeGuard.isRateLimited()) {
    throw new Error(`Firestore batch paused by safety circuit breaker. (${callerTag})`);
  }
  return fsWriteBatch(db);
}
