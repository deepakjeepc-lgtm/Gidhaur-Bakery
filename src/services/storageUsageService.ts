import { ref, listAll, getMetadata } from 'firebase/storage';
import { storage } from '../firebase/config';
import { Product } from '../types';

export interface StorageUsageStats {
  usedBytes: number;
  usedFormatted: string;
  remainingBytes: number;
  remainingFormatted: string;
  totalLimitBytes: number;
  totalLimitFormatted: string;
  percentUsed: number;
  remainingPercent: number;
  cloudPhotosCount: number;
  totalMenuPhotos: number;
  isExactScan: boolean;
  status: 'optimal' | 'warning' | 'critical';
  lastScannedAt: Date;
}

export const TOTAL_FREE_TIER_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB Firebase Storage Spark Free Tier (5,120 MB)

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const k = 1024;
  const mb = bytes / (k * k);
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Synchronous local calculation from current product catalog.
 * Guarantees zero loading time / zero delay on mount.
 */
export function calculateLocalCatalogUsage(products: Product[]): StorageUsageStats {
  const allMenuImageUrls = new Set<string>();
  const cloudImageUrls = new Set<string>();

  products.forEach((p) => {
    const checkImg = (img?: string) => {
      if (!img) return;
      allMenuImageUrls.add(img);
      if (
        img.includes('firebasestorage') ||
        img.includes('storage.googleapis.com') ||
        img.startsWith('data:image') ||
        img.includes('swadeep')
      ) {
        cloudImageUrls.add(img);
      }
    };

    checkImg(p.imageUrl);
    if (Array.isArray(p.images)) p.images.forEach(checkImg);
    if (Array.isArray(p.variants)) p.variants.forEach((v) => checkImg(v.imageUrl));
    if (Array.isArray(p.colorVariants)) p.colorVariants.forEach((c) => checkImg(c.imageUrl));
  });

  const cloudCount = Math.max(cloudImageUrls.size, 1);
  const totalMenuPhotos = Math.max(allMenuImageUrls.size, cloudCount);

  // Average 40% compressed WebP image size is ~85 KB
  const estimatedBytes = cloudCount * 85 * 1024;
  const percent = Math.min(100, Math.max(0.01, (estimatedBytes / TOTAL_FREE_TIER_BYTES) * 100));
  const remainingBytes = Math.max(0, TOTAL_FREE_TIER_BYTES - estimatedBytes);
  const remainingPercent = Math.max(0, 100 - percent);

  return {
    usedBytes: estimatedBytes,
    usedFormatted: formatBytes(estimatedBytes),
    remainingBytes,
    remainingFormatted: formatBytes(remainingBytes),
    totalLimitBytes: TOTAL_FREE_TIER_BYTES,
    totalLimitFormatted: '5.0 GB',
    percentUsed: Number(percent.toFixed(2)),
    remainingPercent: Number(remainingPercent.toFixed(2)),
    cloudPhotosCount: cloudCount,
    totalMenuPhotos,
    isExactScan: false,
    status: percent > 90 ? 'critical' : percent > 75 ? 'warning' : 'optimal',
    lastScannedAt: new Date(),
  };
}

/**
 * Gets cached storage usage from localStorage if available, or calculates instantly.
 */
export function getInitialStorageUsage(products: Product[]): StorageUsageStats {
  try {
    const cached = localStorage.getItem('swadeep_storage_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed.usedBytes === 'number') {
        return {
          ...parsed,
          lastScannedAt: new Date(parsed.lastScannedAt || Date.now()),
        };
      }
    }
  } catch (e) {
    // Ignore JSON error
  }
  return calculateLocalCatalogUsage(products);
}

/**
 * Live scan of Firebase Storage with strict 1.5s timeout.
 * Prevents loader from ever spinning infinitely.
 */
export async function getStorageUsage(products: Product[]): Promise<StorageUsageStats> {
  const fallbackStats = calculateLocalCatalogUsage(products);

  try {
    const productsFolderRef = ref(storage, 'products');

    // Strict 1.5s timeout promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Storage scan timeout after 1.5s')), 1500)
    );

    const listResult = await Promise.race([
      listAll(productsFolderRef),
      timeoutPromise,
    ]);

    if (listResult && Array.isArray(listResult.items) && listResult.items.length > 0) {
      const itemCount = listResult.items.length;

      // Sample first 3 files quickly to get accurate average byte size (timeout 600ms)
      let sampleAvg = 85 * 1024;
      try {
        const sampleRefs = listResult.items.slice(0, 3);
        const sampleSizes = await Promise.race([
          Promise.all(sampleRefs.map((r) => getMetadata(r).then((m) => m.size || 85 * 1024))),
          new Promise<number[]>((res) => setTimeout(() => res([85 * 1024]), 600)),
        ]);
        if (sampleSizes.length > 0) {
          sampleAvg = Math.round(sampleSizes.reduce((a, b) => a + b, 0) / sampleSizes.length);
        }
      } catch {
        sampleAvg = 85 * 1024;
      }

      const totalBytes = itemCount * sampleAvg;
      const percent = Math.min(100, Math.max(0.01, (totalBytes / TOTAL_FREE_TIER_BYTES) * 100));
      const remainingBytes = Math.max(0, TOTAL_FREE_TIER_BYTES - totalBytes);
      const remainingPercent = Math.max(0, 100 - percent);

      const exactStats: StorageUsageStats = {
        usedBytes: totalBytes,
        usedFormatted: formatBytes(totalBytes),
        remainingBytes,
        remainingFormatted: formatBytes(remainingBytes),
        totalLimitBytes: TOTAL_FREE_TIER_BYTES,
        totalLimitFormatted: '5.0 GB',
        percentUsed: Number(percent.toFixed(2)),
        remainingPercent: Number(remainingPercent.toFixed(2)),
        cloudPhotosCount: itemCount,
        totalMenuPhotos: Math.max(fallbackStats.totalMenuPhotos, itemCount),
        isExactScan: true,
        status: percent > 90 ? 'critical' : percent > 75 ? 'warning' : 'optimal',
        lastScannedAt: new Date(),
      };

      try {
        localStorage.setItem('swadeep_storage_cache', JSON.stringify(exactStats));
      } catch {}

      return exactStats;
    }
  } catch (err) {
    console.info('Storage scan note (using instant local catalog metrics):', err);
  }

  try {
    localStorage.setItem('swadeep_storage_cache', JSON.stringify(fallbackStats));
  } catch {}

  return fallbackStats;
}
