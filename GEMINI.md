# Gemini & Antigravity Project Instructions

## Project Context
- **Name:** Swadeep Cake Shop & Restaurant
- **Architecture:** React 19 + TypeScript + Vite + Tailwind CSS + Firebase Firestore
- **Database ID:** `ai-studio-swadeep-c9f5f4f9-12f6-4ef3-a3b0-884128973d8b`

## Architectural Directives
1. **Frontend Isolation:** All design iterations, styling upgrades, layout revisions, and CSS animations must be isolated to `src/components/` and `src/utils/motion.ts`.
2. **Logic Preservation:** Do not alter `src/services/`, `src/firebase/`, `src/context/`, or `src/types/` without explicit authorization.
3. **Loop & Spike Immunity:**
   - No direct `firebase/firestore` write or read invocations in JSX.
   - Guarded reads: enforced by `src/services/firestoreReadGuard.ts`.
   - Guarded writes: enforced by `src/services/firestoreWriteGuard.ts`.
   - No cyclical `useEffect` dependencies that fire Firestore mutations.
