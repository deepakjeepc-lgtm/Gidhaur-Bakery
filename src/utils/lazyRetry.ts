import React, { ComponentType, lazy } from 'react';

/**
 * Robust lazy import with automatic retry on chunk loading failure.
 * When Vite builds new bundles or dev server restarts, previous chunk hashes change,
 * causing browsers with cached HTML to throw:
 * "Failed to fetch dynamically imported module"
 * This helper retries with exponential backoff and refreshes stale cached chunks gracefully.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  interval = 1000
): React.LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remainingRetries: number) => {
        factory()
          .then(resolve)
          .catch((error) => {
            const isChunkError =
              error?.message?.includes('Failed to fetch dynamically imported module') ||
              error?.message?.includes('error loading dynamically imported module') ||
              error?.message?.includes('Importing a module script failed');

            if (remainingRetries > 0) {
              setTimeout(() => {
                attempt(remainingRetries - 1);
              }, interval);
            } else if (isChunkError && typeof window !== 'undefined') {
              // Stale chunk from deployment/restart: check if we haven't already reloaded once
              const reloadKey = 'chunk_reload_' + window.location.pathname;
              const hasReloaded = sessionStorage.getItem(reloadKey);
              if (!hasReloaded) {
                sessionStorage.setItem(reloadKey, 'true');
                window.location.reload();
                return;
              }
              sessionStorage.removeItem(reloadKey);
              reject(error);
            } else {
              reject(error);
            }
          });
      };

      attempt(retries);
    })
  );
}
