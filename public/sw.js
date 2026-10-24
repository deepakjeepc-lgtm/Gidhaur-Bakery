const CACHE_NAME = 'gidhaur-bakery-pwa-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/icon-192.svg',
  '/icon-512.svg'
];

// Lightweight state persisted in Service Worker IndexedDB for APK / Background Sync fallback (0 Firestore reads)
const SW_DB_NAME = 'gidhaur_sw_notify_db';
const SW_STORE_NAME = 'sw_state';

function openSwDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SW_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SW_STORE_NAME)) {
        db.createObjectStore(SW_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getSwState(key, fallback) {
  try {
    const db = await openSwDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(SW_STORE_NAME, 'readonly');
      const req = tx.objectStore(SW_STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : fallback);
      req.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

async function setSwState(key, val) {
  try {
    const db = await openSwDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(SW_STORE_NAME, 'readwrite');
      tx.objectStore(SW_STORE_NAME).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // CRITICAL: Never intercept or cache dev dependencies, Vite runtime, or API endpoints
  if (
    url.pathname.includes('/node_modules/') ||
    url.pathname.includes('/.vite/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/api/') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t')
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.startsWith('/assets/') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.jpg') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.webp') ||
            url.hostname.includes('fonts.googleapis.com') ||
            url.hostname.includes('gstatic.com') ||
            url.hostname.includes('unsplash.com'))
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// 1. Native Web Push Event Listener (Fires even when PWA / APK is completely closed or swiped from recents!)
self.addEventListener('push', (event) => {
  let payload = {
    title: '🔔 Gidhaur Bakery Update',
    body: 'Tap to check your order status.',
    tag: 'gidhaur-order-alert',
    url: '/',
    vibrate: [500, 250, 500, 250, 500]
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      try {
        payload.body = event.data.text();
      } catch {}
    }
  }

  const notifyPromise = (async () => {
    // Also record in SW state so background sync doesn't duplicate the same notification
    if (payload.orderId && payload.status) {
      const notifiedStatuses = await getSwState('customerNotifiedStatuses', {});
      const list = notifiedStatuses[payload.orderId] || [];
      if (!list.includes(payload.status)) {
        notifiedStatuses[payload.orderId] = [...list, payload.status];
        await setSwState('customerNotifiedStatuses', notifiedStatuses);
      }
    }
    if (payload.orderId && payload.role === 'admin') {
      const adminSeen = await getSwState('adminNotifiedIds', []);
      if (!adminSeen.includes(payload.orderId)) {
        await setSwState('adminNotifiedIds', [...adminSeen.slice(-100), payload.orderId]);
      }
    }

    // Notify any open client windows so audio chime can ring if app is in background
    try {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsList) {
        client.postMessage({
          type: 'SW_PUSH_RECEIVED',
          payload
        });
      }
    } catch {}

    return self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || `gidhaur-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: payload.vibrate || [500, 250, 500, 250, 500],
      data: {
        url: payload.url || '/',
        role: payload.role || 'customer',
        orderId: payload.orderId || ''
      }
    });
  })();

  event.waitUntil(notifyPromise);
});

// 2. Background Order Status Check for APK WebViews & Background Sync (0 Firestore Reads - uses /api/orders)
async function checkOrdersInBackground() {
  try {
    const isAdminDevice = await getSwState('isAdminDevice', false);
    const trackedOrderIds = await getSwState('trackedOrderIds', []);
    if (!isAdminDevice && (!Array.isArray(trackedOrderIds) || trackedOrderIds.length === 0)) {
      return;
    }

    const res = await fetch('/api/orders', { cache: 'no-store' });
    if (!res.ok) return;
    const orders = await res.json();
    if (!Array.isArray(orders)) return;

    // A. Admin New Order & Cancellation Request Alerts
    if (isAdminDevice) {
      const adminSeen = await getSwState('adminNotifiedIds', []);
      const seenSet = new Set(adminSeen);
      let updatedSeen = false;

      for (const ord of orders) {
        const ordId = String(ord.orderId || ord.id || '');
        if (!ordId) continue;

        if (ord.status === 'pending' && !seenSet.has(ordId)) {
          seenSet.add(ordId);
          updatedSeen = true;
          await self.registration.showNotification(`🔔 New Order Received! #${ordId}`, {
            body: `${ord.customerName || 'Customer'} placed an order for ₹${ord.totalAmount || 0}. Tap to view & accept.`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `admin-order-${ordId}`,
            renotify: true,
            requireInteraction: true,
            vibrate: [500, 250, 500, 250, 500],
            data: { url: '/#admin', role: 'admin', orderId: ordId }
          });
        } else if (ord.cancellationStatus === 'requested' && ord.status !== 'rejected' && !seenSet.has(`cancel-${ordId}`)) {
          seenSet.add(`cancel-${ordId}`);
          updatedSeen = true;
          await self.registration.showNotification(`⚠️ Cancellation Request #${ordId}`, {
            body: `${ord.customerName || 'Customer'} requested to cancel order #${ordId}. Tap to review.`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `admin-cancel-${ordId}`,
            renotify: true,
            requireInteraction: true,
            vibrate: [500, 250, 500],
            data: { url: '/#admin', role: 'admin', orderId: ordId }
          });
        }
      }

      if (updatedSeen) {
        await setSwState('adminNotifiedIds', Array.from(seenSet).slice(-100));
      }
    }

    // B. Customer Order Status Progress Alerts
    if (Array.isArray(trackedOrderIds) && trackedOrderIds.length > 0) {
      const trackedSet = new Set(trackedOrderIds.map((id) => String(id).toLowerCase()));
      const notifiedStatuses = await getSwState('customerNotifiedStatuses', {});
      let statusChanged = false;

      for (const ord of orders) {
        const ordId = String(ord.orderId || ord.id || '');
        const cleanId = ordId.toLowerCase();
        if (!ordId || !trackedSet.has(cleanId)) continue;

        const status = ord.status;
        const already = notifiedStatuses[ordId] || [];
        if (already.includes(status)) continue;

        let title = '';
        let body = '';
        if (status === 'accepted') {
          title = `🎉 Order Confirmed! #${ordId}`;
          body = `Gidhaur Bakery accepted your order. Kitchen preparation will begin shortly!`;
        } else if (status === 'preparing') {
          title = `👨‍🍳 Fresh in the Kitchen! #${ordId}`;
          body = `Your delicious items are now being baked and prepared fresh.`;
        } else if (status === 'out_for_delivery') {
          title = `🛵 Out For Delivery! #${ordId}`;
          body = `Your order is on the way! Delivery rider is en route to your address.`;
        } else if (status === 'delivered') {
          title = `✅ Order Delivered! #${ordId}`;
          body = `Your order from Gidhaur Bakery has been delivered. Enjoy your treats!`;
        } else if (status === 'rejected') {
          title = `⚠️ Order Update #${ordId}`;
          body = `Your order #${ordId} was declined or cancelled. Tap to view details.`;
        }

        if (title) {
          notifiedStatuses[ordId] = [...already, status];
          statusChanged = true;
          await self.registration.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `customer-order-${ordId}-${status}`,
            renotify: true,
            requireInteraction: true,
            vibrate: [300, 150, 300],
            data: { url: '/#track', role: 'customer', orderId: ordId }
          });
        }
      }

      if (statusChanged) {
        await setSwState('customerNotifiedStatuses', notifiedStatuses);
      }
    }
  } catch {}
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'gidhaur-order-sync') {
    event.waitUntil(checkOrdersInBackground());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'gidhaur-order-periodic-sync') {
    event.waitUntil(checkOrdersInBackground());
  }
});

// Receive state sync from foreground app (Admin role, tracked customer orders, already-notified statuses)
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SYNC_SW_NOTIFICATION_STATE') {
    event.waitUntil(
      (async () => {
        if (typeof data.isAdminDevice === 'boolean') {
          await setSwState('isAdminDevice', data.isAdminDevice);
        }
        if (Array.isArray(data.trackedOrderIds)) {
          await setSwState('trackedOrderIds', data.trackedOrderIds);
        }
        if (Array.isArray(data.adminNotifiedIds)) {
          const existing = await getSwState('adminNotifiedIds', []);
          const merged = Array.from(new Set([...existing, ...data.adminNotifiedIds])).slice(-100);
          await setSwState('adminNotifiedIds', merged);
        }
        if (data.customerNotifiedStatuses && typeof data.customerNotifiedStatuses === 'object') {
          const existing = await getSwState('customerNotifiedStatuses', {});
          const merged = { ...existing, ...data.customerNotifiedStatuses };
          await setSwState('customerNotifiedStatuses', merged);
        }
      })()
    );
  } else if (data.type === 'CHECK_ORDERS_NOW') {
    event.waitUntil(checkOrdersInBackground());
  }
});

// Handle notification tap / click from lock screen or status bar
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  const role = event.notification.data?.role || '';
  const orderId = event.notification.data?.orderId || '';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NAVIGATE_FROM_NOTIFICATION',
            url: urlToOpen,
            role,
            orderId
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
