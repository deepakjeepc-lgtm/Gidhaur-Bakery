const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Extracts storage file path from a Firebase Storage URL or gs:// reference
 */
function extractFilePath(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;

  try {
    // 1. Direct path
    if (urlOrPath.startsWith('products/') || urlOrPath.startsWith('categories/') || urlOrPath.startsWith('banners/')) {
      return urlOrPath;
    }

    // 2. gs:// URI
    if (urlOrPath.startsWith('gs://')) {
      const parts = urlOrPath.replace('gs://', '').split('/');
      parts.shift(); // remove bucket
      return decodeURIComponent(parts.join('/'));
    }

    // 3. Download URL
    if (urlOrPath.includes('firebasestorage.googleapis.com')) {
      const match = urlOrPath.match(/\/o\/([^?#]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
  } catch (err) {
    logger.warn('Failed to parse file path from URL:', err);
  }

  return null;
}

/**
 * Cloud Function triggered automatically when any product document is deleted from Firestore.
 * Identifies all associated images (primary photo, gallery images, variant photos)
 * and deletes them from Firebase Storage to prevent orphaned files.
 */
exports.onProductDeletedCleanupImages = onDocumentDeleted('products/{productId}', async (event) => {
  const snap = event.data;
  if (!snap) {
    logger.info('No document snapshot data found for deleted product.');
    return;
  }

  const product = snap.data();
  const productId = event.params.productId;
  logger.info(`Product deleted: ${productId} (${product.name || 'unnamed'}). Starting image cleanup...`);

  // Gather all image URLs from the product document
  const rawUrls = [];

  if (product.imageUrl) rawUrls.push(product.imageUrl);

  if (Array.isArray(product.images)) {
    product.images.forEach((img) => img && rawUrls.push(img));
  }

  if (Array.isArray(product.variants)) {
    product.variants.forEach((v) => v && v.imageUrl && rawUrls.push(v.imageUrl));
  }

  if (Array.isArray(product.colorVariants)) {
    product.colorVariants.forEach((c) => c && c.imageUrl && rawUrls.push(c.imageUrl));
  }

  // Filter to keep only Firebase Storage URLs
  const storageUrls = rawUrls.filter(
    (url) =>
      typeof url === 'string' &&
      !url.includes('unsplash.com') &&
      !url.includes('photo-1546069901-ba9599a7e63c') &&
      (url.includes('firebasestorage.googleapis.com') ||
        url.startsWith('gs://') ||
        url.startsWith('products/'))
  );

  const uniquePaths = Array.from(
    new Set(storageUrls.map((url) => extractFilePath(url)).filter(Boolean))
  );

  if (uniquePaths.length === 0) {
    logger.info(`No Firebase Storage files found for deleted product ${productId}.`);
    return;
  }

  logger.info(`Found ${uniquePaths.length} image files to delete for product ${productId}:`, uniquePaths);

  const bucket = admin.storage().bucket();
  let deletedCount = 0;

  for (const filePath of uniquePaths) {
    try {
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        deletedCount++;
        logger.info(`Successfully deleted file from storage: ${filePath}`);
      } else {
        logger.info(`File already gone from storage: ${filePath}`);
      }
    } catch (err) {
      logger.error(`Error deleting storage file ${filePath}:`, err);
    }
  }

  logger.info(
    `Cleanup complete for product ${productId}. Deleted ${deletedCount}/${uniquePaths.length} images.`
  );
});
