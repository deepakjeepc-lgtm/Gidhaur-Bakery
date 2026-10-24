# Implementation Plan: Background Notifications (PWA & APK), Android Top Status Bar + Bottom Edge-to-Edge Fix (No Bottom Black Strip) & `AABBCC` Removal

## 1. Objective & Root Cause Analysis

1. **Android Top Status Bar Visibility + Bottom Edge-to-Edge Fullscreen (No Bottom "Black Patti")**
   - **Top Status Bar Root Cause**: Both `/public/manifest.json` and `/public/manifest.webmanifest` specify `"display_override": ["fullscreen", "standalone", ...]`. Because `"fullscreen"` is listed first, Android PWAs and APK builders (TWA / WebAPK / WebView wrappers) enter Android's immersive fullscreen mode (`SYSTEM_UI_FLAG_FULLSCREEN`), hiding the top status bar.
   - **Bottom Black Strip ("Black Patti") Root Cause**: On Android gesture navigation devices (with the bottom home indicator pill), a black strip appears at the bottom when:
     1. The viewport or root container (`100vh` / `100dvh`) stops above the gesture navigation inset (`env(safe-area-inset-bottom)`), exposing the underlying black WebView/window canvas, or
     2. Fixed bottom sheets/modals (`CheckoutModal`, `ProductModal`, `OrderSuccessModal`, `CartDrawer`) use `max-h-[100dvh]` without extending their surface background through `env(safe-area-inset-bottom, 0px)` to the very bottom pixel (`100lvh` / `bottom: 0`), or
     3. `<meta name="theme-color">` and `html, body` background colors aren't dynamically synchronized with the active surface (`#f6f8fb` / `#ffffff` on Storefront, `#0A0A0C` on Admin/Staff portals).
   - **Fix**:
     - Remove `"fullscreen"` from `display_override` in `/public/manifest.json` and `/public/manifest.webmanifest` so `"standalone"` is primary—keeping the **top system status bar always visible**.
     - Keep `viewport-fit=cover` in `/index.html` and configure `html, body, #root` in `/src/index.css` to stretch across the full physical screen (`min-height: 100lvh; min-height: -webkit-fill-available; bottom: 0`) with matching surface backgrounds (`#f6f8fb` for Storefront, `#0A0A0C` for Admin Console) so the bottom home indicator area is drawn edge-to-edge over the app background instead of a black bar.
     - Update bottom-anchored modals/drawers and navigation (`MobileBottomNav.tsx`, `CartDrawer.tsx`, `CheckoutModal.tsx`, `ProductModal.tsx`, `OrderSuccessModal.tsx`) so their backgrounds extend flush to `bottom: 0` with internal `padding-bottom: max(env(safe-area-inset-bottom, 0px), ...)`—giving a true edge-to-edge bottom fullscreen look with zero black strip ("black patti").

2. **Notifications When App is Closed or Removed from Background (Customer + Admin)**
   - **Root Cause**:
     - Notifications currently only fire from foreground React components (`TrackOrderPage.tsx` for customers and `useOrderSoundAlert.ts` in `AdminDashboard.tsx` for admins). When the app is closed or swiped away from background recents, React unmounts and nothing wakes up the Service Worker.
     - `/public/sw.js` lacks a `push` event listener, background sync / periodic check handlers, and Web Push (`PushManager`) subscription integration with `server.ts`.
   - **Fix (Zero Extra Firestore Reads/Writes)**:
     - **Web Push (`web-push` VAPID) + Service Worker (`push` event in `/public/sw.js`)**:
       - Auto-generate & persist VAPID keys in `data/store.json` on `server.ts` and expose `GET /api/push/vapid-public-key` and `POST /api/push/subscribe`.
       - When Admin logs in / opens Admin Panel (or enables notifications), subscribe the device's Service Worker `pushManager` with `role: 'admin'`.
       - When a Customer places an order or tracks an order, subscribe the device's Service Worker `pushManager` with `role: 'customer'`, linked to their `orderId` and `phone`.
       - Whenever an order is created (`POST /api/orders`) or its status changes (`PATCH /api/orders/:id`), `server.ts` immediately dispatches a native Web Push notification payload to matching Admin and Customer subscriptions—waking up `/public/sw.js` even when the app is completely closed!
     - **Service Worker Background Sync & APK WebView Support**:
       - Add `push`, `sync`, `periodicsync`, and background order-status check handlers in `/public/sw.js` against `/api/orders` (0 Firestore reads) so APK builders and installed PWAs reliably show lock-screen & status-bar notifications.
       - Run customer & admin live SSE notification monitoring (`subscribeToLiveSync`) globally in `App.tsx` whenever the device has active customer orders today or an active Admin session.

3. **Permanent Removal of `AABBCC` Product**
   - **Root Cause**: A test product with `"id": "gjpphaGqAsJ8G0obkGpn"` and `"name": "AABBCC"` (`price: 1`, category `"Burgers"`) exists in `data/products.json` along with its image files in `public/product-images/`.
   - **Fix**:
     - Permanently remove `"gjpphaGqAsJ8G0obkGpn"` (`AABBCC`) from `data/products.json` and delete `/public/product-images/gjpphagqasj8g0obkgpn-aabbcc*.webp`.
     - Add `"gjpphaGqAsJ8G0obkGpn"` and normalized name `"aabbcc"` to `isProductBlacklisted()` in `src/services/productService.ts` and bump `CATALOG_CACHE_VERSION` so all devices immediately purge it from `localStorage`, `IndexedDB`, and Firestore `products` collection if present.

4. **Additional Glitches Identified & Fixed**
   - **Kitchen, Preparing, Admin & Track Order Server Sync Glitch**: `KitchenDisplayPage.tsx` and `PreparingDisplayPage.tsx` updated Firestore when marking orders `preparing` or `out_for_delivery`, but did not send `PATCH /api/orders/:id` to `server.ts`. Similarly, `AdminDashboard.tsx` (`handleAcceptCancellation` / `handleDeclineCancellation`) and `TrackOrderPage.tsx` (customer cancellation request) did not `PATCH /api/orders/:id`. Adding lightweight `fetch('/api/orders/' + id, { method: 'PATCH', ... })` calls ensures `server.ts` always stays in sync and triggers instant SSE + background Web Push notifications for every status change with **0 extra Firestore reads**.

---

## 2. Planned File Changes

- **`/public/manifest.json` & `/public/manifest.webmanifest`**:
  - Remove `"fullscreen"` from `display_override` so Android PWAs and APK builds use `"standalone"` mode and always keep the top system status bar visible.
- **`/index.html`, `/src/index.css` & `/src/App.tsx`**:
  - Keep `viewport-fit=cover` and dynamically sync `<meta name="theme-color">` and root/body background colors (`#f6f8fb` / `#ffffff` on Storefront, `#0A0A0C` on Admin/Staff portals) so the top status bar stays visible and the bottom gesture home-indicator bar has **zero black strip ("black patti")**.
  - Update bottom-fixed containers and modals (`MobileBottomNav.tsx`, `CartDrawer.tsx`, `CheckoutModal.tsx`, `ProductModal.tsx`, `OrderSuccessModal.tsx`) so their surface backgrounds bleed seamlessly through `env(safe-area-inset-bottom, 0px)` to the bottom screen edge.
  - Attach global customer & admin background notification registration and SSE status listeners in `App.tsx` (0 Firestore reads).
- **`/public/sw.js`**:
  - Add `push` event listener to display high-priority native Android/iOS notifications (`vibrate`, `renotify: true`, `requireInteraction: true`, lock-screen action buttons) when the app is completely closed.
  - Improve `notificationclick` to deep-link directly to `/#admin` for Admin alerts or `/#track` for Customer order updates.
  - Add lightweight background sync / periodic check support for APK WebView wrappers.
- **`/server.ts`**:
  - Add Web Push (`web-push`) VAPID key management and `/api/push/vapid-public-key`, `/api/push/subscribe`, and `/api/push/test` endpoints.
  - Automatically trigger Web Push notifications to registered **Admin** devices on new orders / cancellation requests, and to registered **Customer** devices on order status transitions (`accepted`, `preparing`, `out_for_delivery`, `delivered`, `rejected`).
  - Auto-filter any `AABBCC` product from `loadProducts()`.
- **`/src/utils/sound.ts` & `/src/services/customerNotificationService.ts`**:
  - Add `registerPushSubscription(role, meta)` helper that connects the Service Worker `pushManager` to `/api/push/subscribe` seamlessly when notification permission is granted.
- **`/src/components/admin/AdminDashboard.tsx`, `/src/components/kitchen/KitchenDisplayPage.tsx`, `/src/components/preparing/PreparingDisplayPage.tsx`, `/src/components/TrackOrderPage.tsx`**:
  - Ensure all status transitions and cancellation requests also `PATCH /api/orders/:id` so background push notifications fire on every milestone.
- **`/data/products.json` & `/src/services/productService.ts`**:
  - Permanently delete the `AABBCC` product (`gjpphaGqAsJ8G0obkGpn`) and its WebP images, blacklist `aabbcc` in `isProductBlacklisted()`, and bump `CATALOG_CACHE_VERSION` so cached copies are wiped across all browsers/devices.
