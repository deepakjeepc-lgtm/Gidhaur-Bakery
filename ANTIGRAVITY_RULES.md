# 🛡️ ANTIGRAVITY & AI AGENT ARCHITECTURE RULEBOOK

> **Primary Objective:** Ensure that changes made in **Antigravity** (or any AI IDE) are strictly focused on **Frontend, Design, UI Polish, Layout, and Animations** without breaking backend business logic, corrupting state synchronization, or triggering runaway Firestore loops / read-write spikes.

---

## 1. 🚦 STRICT CODEBASE BOUNDARY (Safe vs Locked Zones)

### 🟢 GREEN ZONE: Safe to Modify & Refine (Frontend & Presentation)
You may freely modify, restyle, animate, and beautify code in these locations:
- `src/components/**` — UI components, layout structures, visual styling, JSX presentation.
- `src/index.css` — Tailwind directives, custom classes, CSS keyframe animations.
- `src/utils/motion.ts` — Design tokens, micro-interactions, transition presets.
- `public/**` — Static assets, icons, illustrations.

**Safe changes include:**
- Adding smooth hover effects, micro-interactions, scale/elevation animations (`hover:-translate-y-0.5`, `transition-all`).
- Polishing typography, spacing (`p-4`, `gap-3`), rounded corners (`rounded-xl`), and color themes.
- Adding tabs, collapsible sections, skeleton loaders, and UI empty states.

---

### 🔴 RED ZONE: Strictly Locked (Business Logic, Sync & Firestore)
**DO NOT MODIFY OR DELETE** unless explicitly instructed to perform a schema migration:
- `src/firebase/**` — Firebase initialization, IndexedDB cache config, auth persistence.
- `src/services/**` — Singleton data services (`productService.ts`, `inventoryService.ts`, `orderListenerService.ts`, etc.).
- `src/context/**` — State providers (`CartContext.tsx`, `OrderContext.tsx`, `AuthContext.tsx`).
- `src/types/**` — Schema interfaces (`Product`, `Order`, `Category`, `DietaryType`).
- `firestore.rules` & `firebase-blueprint.json` — Firestore database rules and schema definitions.
- `server.ts` & `functions/**` — Server proxy routes and cloud functions.

---

## 2. 🚫 CRITICAL ZERO-SPIKE RULES (Preventing Loop & Quota Runaways)

### ❌ Rule 1: No Direct Firestore Calls Inside UI Components
- **NEVER** write `getDocs()`, `getDoc()`, `onSnapshot()`, `setDoc()`, `updateDoc()`, or `deleteDoc()` directly inside `.tsx` component bodies or event handlers.
- **ALWAYS** call the designated service function (e.g., `productService.updateProduct()`, `inventoryService.updateProductStockQuantity()`).
- *Why:* Raw calls bypass the IndexedDB local cache, read deduplicator, and circuit-breaker guard, causing huge read spikes.

### ❌ Rule 2: NEVER Trigger Firestore Writes in `useEffect` with State Dependencies
- **FORBIDDEN PATTERN:**
  ```tsx
  // ⛔ CATASTROPHIC INFINITE LOOP:
  useEffect(() => {
    if (order.status) {
      updateDoc(orderRef, { lastSeen: Date.now() }); // Triggers onSnapshot -> triggers useEffect -> repeat infinitely!
    }
  }, [order]);
  ```
- Any write MUST be triggered by an explicit user gesture (e.g. `onClick`, `onSubmit`), NEVER by an un-guarded reactive cycle.

### ❌ Rule 3: Always Clean Up Firestore Listeners
- If an `onSnapshot` listener is mounted, its unsubscribe callback **MUST** be returned in the cleanup function:
  ```tsx
  useEffect(() => {
    const unsubscribe = guardedOnSnapshot(queryRef, 'callerTag', (snapshot) => {
      // update state
    });
    return () => unsubscribe(); // MANDATORY CLEANUP
  }, []);
  ```

### ❌ Rule 4: Zero-Spike Rate Limits Enforced in Code
- Read Guard: Max 200 reads per minute (`src/services/firestoreReadGuard.ts`).
- Write Guard: Max 40 writes per 10 seconds (`src/services/firestoreWriteGuard.ts`).
- Rapid click debounce: Sub-300ms duplicate writes to the same document are automatically dropped.

---

## 3. 🔄 HOW TO KEEP ANTIGRAVITY & AI STUDIO 100% IN SYNC

1. **Use Git / GitHub as the Single Source of Truth:**
   - When exporting to Antigravity, commit your changes before and after each feature.
   - If you modify code in Antigravity, push to the GitHub repository and pull/sync back to AI Studio.
2. **Single Database Instance:**
   - Both AI Studio and Antigravity connect to the exact same Firestore Database: `ai-studio-swadeep-c9f5f4f9-12f6-4ef3-a3b0-884128973d8b`.
   - Data is always synchronized live in real-time across both environments.
3. **Preserve Interface Contracts:**
   - Never change existing property names in `src/types/index.ts` (e.g. do not rename `dietary` to `dietaryType` or `sellingPrice` to `price`). Adding new optional fields (`newField?: string`) is safe; deleting or renaming existing fields breaks sync between environments.

---

## 4. 🎨 RECOMMENDED DESIGN TOKENS FOR ANTIGRAVITY WORK

Use these standard utility classes for all new components and animations:
- **Card Container:** `bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow`
- **Interactive Button:** `transition-transform duration-150 active:scale-95`
- **Status Badges:**
  - Received / Pending: `bg-amber-50 text-amber-700 border border-amber-200`
  - Preparing / Cooking: `bg-sky-50 text-sky-700 border border-sky-200`
  - Ready / Delivered: `bg-emerald-50 text-emerald-700 border border-emerald-200`
  - Cancelled: `bg-rose-50 text-rose-700 border border-rose-200`
- **Soft Shadows:** `shadow-[0_2px_10px_rgba(0,0,0,0.04)]`
