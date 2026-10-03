import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';
import { Product } from '../types';

/**
 * Parses Firebase Storage path from either:
 * - Full download URL: https://firebasestorage.googleapis.com/v0/b/.../o/products%2Ffilename.webp?alt=media&token=...
 * - gs:// path: gs://swadeep-2e33a.firebasestorage.app/products/filename.webp
 * - Relative storage path: products/filename.webp
 */
export function extractStoragePath(urlOrPath: string): string | null {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;

  try {
    // 1. Check if it's already a clean path
    if (urlOrPath.startsWith('products/') || urlOrPath.startsWith('categories/') || urlOrPath.startsWith('banners/')) {
      return urlOrPath;
    }

    // 2. gs:// URL
    if (urlOrPath.startsWith('gs://')) {
      const parts = urlOrPath.replace('gs://', '').split('/');
      parts.shift(); // remove bucket name
      return decodeURIComponent(parts.join('/'));
    }

    // 3. Firebase Storage public download URL
    if (urlOrPath.includes('firebasestorage.googleapis.com')) {
      const match = urlOrPath.match(/\/o\/([^?#]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
  } catch (err) {
    console.warn('Error parsing storage path:', err);
  }

  return null;
}

/**
 * Collects all image URLs stored across a Product document:
 * - Primary imageUrl
 * - images[] gallery
 * - variants[].imageUrl
 * - colorVariants[].imageUrl
 */
export function collectAllProductImages(product: Partial<Product>): string[] {
  const urls: string[] = [];

  if (product.imageUrl && typeof product.imageUrl === 'string') {
    urls.push(product.imageUrl);
  }

  if (Array.isArray(product.images)) {
    for (const img of product.images) {
      if (img && typeof img === 'string' && !urls.includes(img)) {
        urls.push(img);
      }
    }
  }

  if (Array.isArray(product.variants)) {
    for (const v of product.variants) {
      if (v?.imageUrl && typeof v.imageUrl === 'string' && !urls.includes(v.imageUrl)) {
        urls.push(v.imageUrl);
      }
    }
  }

  if (Array.isArray(product.colorVariants)) {
    for (const c of product.colorVariants) {
      if (c?.imageUrl && typeof c.imageUrl === 'string' && !urls.includes(c.imageUrl)) {
        urls.push(c.imageUrl);
      }
    }
  }

  // Filter out dummy/placeholder images or Unsplash photos
  return urls.filter((url) => {
    return (
      url &&
      !url.includes('unsplash.com') &&
      !url.includes('photo-1546069901-ba9599a7e63c') &&
      (url.includes('firebasestorage.googleapis.com') ||
        url.startsWith('gs://') ||
        url.startsWith('products/'))
    );
  });
}

/**
 * Deletes a single file from Firebase Storage safely.
 */
export async function deleteStorageFileByUrl(urlOrPath: string): Promise<boolean> {
  try {
    const storagePath = extractStoragePath(urlOrPath);
    if (!storagePath) {
      // Try direct ref fallback if it was a full URL
      if (urlOrPath.includes('firebasestorage.googleapis.com')) {
        const directRef = ref(storage, urlOrPath);
        await deleteObject(directRef);
        return true;
      }
      return false;
    }

    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
    return true;
  } catch (err: any) {
    // If the file does not exist (already deleted), treat as success
    if (err?.code === 'storage/object-not-found') {
      return true;
    }
    console.warn(`Could not delete storage file (${urlOrPath}):`, err?.message || err);
    return false;
  }
}

/**
 * Comprehensive Product Image Cleanup:
 * 1. Identifies all images in the product.
 * 2. Deletes them from Firebase Storage directly via client SDK.
 * 3. Asynchronously notifies backend server to log and ensure zero orphaned files.
 */
export async function cleanupProductImages(product: Partial<Product>): Promise<{
  totalIdentified: number;
  deletedCount: number;
  errors: string[];
}> {
  const images = collectAllProductImages(product);
  const errors: string[] = [];
  let deletedCount = 0;

  // Run client-side storage deletions in parallel
  const deletePromises = images.map(async (url) => {
    try {
      const ok = await deleteStorageFileByUrl(url);
      if (ok) deletedCount++;
    } catch (err: any) {
      errors.push(`Failed to delete ${url}: ${err?.message || err}`);
    }
  });

  await Promise.allSettled(deletePromises);

  // Notify backend server utility for redundancy
  try {
    fetch('/api/cleanup-product-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        productName: product.name,
        imageUrls: images,
      }),
    }).catch(() => {});
  } catch {}

  return {
    totalIdentified: images.length,
    deletedCount,
    errors,
  };
}
