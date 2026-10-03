import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';
import { UploadedImageResult, processAndUploadImage } from '../utils/image';

/**
 * Upload an already prepared WebP Blob to Firebase Storage
 */
export async function uploadWebPToStorage(
  blob: Blob,
  folder = 'products',
  customName?: string
): Promise<string> {
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = customName || `${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
  const fileRef = ref(storage, `${folder}/${fileName}`);

  const uploadPromise = uploadBytes(fileRef, blob, {
    contentType: blob.type || 'image/webp',
    cacheControl: 'public, max-age=31536000',
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Firebase Storage timeout')), 3000)
  );

  await Promise.race([uploadPromise, timeoutPromise]);
  return await getDownloadURL(fileRef);
}

/**
 * Process single or multiple files with WebP compression in parallel for lightning speed.
 * Multiple images finish together in ~100-200ms instead of waiting sequentially.
 */
export async function uploadOptimizedImages(
  files: File[],
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    folder?: string;
    cropMode?: 'cover' | 'contain' | 'fill';
    onProgress?: (completed: number, total: number, result: UploadedImageResult) => void;
  }
): Promise<UploadedImageResult[]> {
  const total = files.length;
  let completed = 0;

  // Process all files in parallel
  const tasks = files.map(async (file) => {
    const res = await processAndUploadImage(file, options);
    completed++;
    if (options?.onProgress) {
      options.onProgress(completed, total, res);
    }
    return res;
  });

  return await Promise.all(tasks);
}

/**
 * Optional helper to delete an image from Firebase Storage if needed
 */
export async function deleteStorageImage(urlOrPath: string): Promise<boolean> {
  try {
    if (!urlOrPath || !urlOrPath.includes('firebasestorage.googleapis.com')) {
      return false;
    }
    const fileRef = ref(storage, urlOrPath);
    await deleteObject(fileRef);
    return true;
  } catch (err) {
    console.warn('Could not delete image from Firebase Storage:', err);
    return false;
  }
}
