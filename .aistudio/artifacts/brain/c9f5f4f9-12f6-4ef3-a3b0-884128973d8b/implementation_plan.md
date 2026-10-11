# Implementation Plan: iPhone PWA Safe Back Button & Swipe Navigation for My Order

## 1. Problem Diagnosis & Root Cause
On iPhone when added to the home screen (Safari standalone PWA mode):
1. **Double-trigger WebKit crash & URL bar reveal**: When opening "My Order" (CartDrawer) multiple times and pressing the back button, `window.history.back()` attempts to pop state when no pushed state exists or when history stack length is at root (length 1 in PWA standalone mode). This causes WebKit to crash (*"A problem repeatedly occurred"*) or break out of standalone full-screen mode, revealing the browser URL bar.
2. **First tap no-op issue**: The back button previously relied on `window.history.back()`, which doesn't trigger if the pushState race condition occurs, leaving the user with an unresponsive back button on the first tap.
3. **No extra Firebase reads**: This navigation issue is 100% frontend UI state & browser lifecycle behavior; zero Firebase reads or writes will be triggered.

---

## 2. Technical Architecture & Solution

### A. Instant UI State Closure (`CartDrawer.tsx`)
- Modify `handleClose` in `CartDrawer.tsx`:
  - Directly invoke `setIsCartOpen(false)` so the "My Order" view closes immediately on first tap without lag or dependency on browser history.
  - Safely synchronize browser history state only if `window.history.state?.modal === 'cart'`, using a guarded single-hop or clean state replacement rather than risking out-of-bounds history traversal on iOS standalone PWAs.
  - Add quick visual/haptic feedback (`triggerHaptic('light')`).

### B. Safe Swipe-to-Close Gesture Support
- In addition to card swipe-to-adjust quantity, support edge swipe / rightward swipe gesture on the My Order screen to close the view smoothly:
  - Detect left-to-right swipe on the header or screen edge (`deltaX > 75px` with horizontal dominance).
  - Animate smooth exit and call `setIsCartOpen(false)` safely without triggering history crashes.

### C. Coordinated Modal History in `App.tsx` & `CheckoutModal.tsx`
- Ensure `App.tsx` popstate listener cleanly respects instant close transitions without leaving stale modal flags in history.
- Ensure transitioning from Cart to Checkout and back remains seamless.

---

## 3. Verification & Testing
1. **Compilation & Linting**: Run `compile_applet` and `lint_applet` to ensure error-free code.
2. **iPhone Standalone PWA Verification**:
   - Open My Order screen -> tap back button -> closes instantly on 1st tap.
   - Reopen My Order screen immediately -> tap back button -> closes cleanly without opening URL bar or crashing WebKit.
   - Test swipe gesture from left edge to close My Order.
3. **Zero Firebase Spike**: Verify no extra Firestore operations are invoked.
