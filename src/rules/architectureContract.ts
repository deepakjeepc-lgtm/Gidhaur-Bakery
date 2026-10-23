/**
 * ARCHITECTURAL CONTRACT & BOUNDARY ENFORCEMENT
 * 
 * This file specifies the strict boundary between the PRESENTATION (UI/Styling/Animations)
 * and the CORE ENGINE (Firebase/State/Sync/Business Logic).
 * 
 * Rules for Antigravity & AI Assistants:
 * 1. UI components in `src/components/` must only render props and call methods exposed by hooks/context.
 * 2. NEVER invoke raw Firestore read/write methods (`getDocs`, `onSnapshot`, `setDoc`, `updateDoc`)
 *    directly inside component files.
 * 3. ALL data reads must pass through cached services and `firestoreReadGuard.ts`.
 * 4. ALL data writes must pass through validated service handlers and `firestoreWriteGuard.ts`.
 * 5. NEVER add state mutations inside `useEffect` that are also subscribed to by the same hook (prevents infinite loops).
 */

export const CodebaseBoundary = {
  // Zones where design, animations, CSS, and layout can be modified freely:
  SAFE_FRONTEND_ZONES: [
    'src/components/**/*',
    'src/utils/motion.ts',
    'src/index.css',
    'public/**/*',
  ],

  // Zones containing core database, state, and business logic (LOCKED):
  PROTECTED_LOGIC_ZONES: [
    'src/services/**/*',
    'src/firebase/**/*',
    'src/context/**/*',
    'src/types/**/*',
    'firestore.rules',
    'firebase-blueprint.json',
  ],

  LIMITS: {
    MAX_READS_PER_MINUTE: 200,
    MAX_WRITES_PER_10_SECONDS: 40,
    DEBOUNCE_SUBMISSION_MS: 300,
  },
} as const;
