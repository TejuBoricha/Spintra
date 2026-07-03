# AI Handoff — Spintra Project

Portable context for any AI assistant (Antigravity, Claude Code, VS Code Agent, Cursor, Windsurf, Gemini CLI, etc.) to resume work immediately.

---

## 1. Project Overview
Spintra is a real-time multiplayer party game and classroom activity platform. Users host "rooms" (using a 6-character code) and play games in real time using Supabase Realtime (with an offline BroadcastChannel fallback for local development).

- **URL:** http://localhost:3000
- **Room Route:** `/room/[code]` (e.g. `/room/3NJUZL`)
- **Technology Stack:** Next.js (App Router), React 19, TypeScript, Tailwind CSS, Supabase JS, Framer Motion, canvas-confetti.

---

## 2. Current Architecture & Conventions
- **De-monolithised Room Client:** The main orchestrator ([room-client.tsx](file:///c:/Users/tejas/Desktop/Spintra-1/src/app/room/[code]/room-client.tsx)) is fully modular. It uses:
  - **Dynamic Registry:** [activity-registry.ts](file:///c:/Users/tejas/Desktop/Spintra-1/src/app/room/[code]/activities/activity-registry.ts) mapping game slugs to dynamic imports.
  - **Separated Contexts:** `RoomActivityContext` (stable callbacks/metadata) and `RoomParticipantsContext` (dynamic list) to optimize rendering and prevent join/leave cascades.
  - **Class ErrorBoundary:** Wraps the dynamic activity viewport to protect multiplayer rooms from single-game crashes.
- **Real-Time Pub/Sub:** Sub-games trigger named actions using the `sendActivityEvent` callback and listen to updates via `registerEventListener`.
- **Fisher-Yates Shuffling:** Game shufflers must call `shuffleArray` from `src/lib/utils.ts` to guarantee uniform randomness.
- **Components:** Named exports only; client-side components must carry the `"use client"` directive.

---

## 3. Current Progress
- **Modular Refactoring:** All 14 games migrated to the dynamic registry pattern. Legacy switch-cases and monolithic state hooks deleted.
- **Trivia Expansion:** Created [trivia-questions.ts](file:///c:/Users/tejas/Desktop/Spintra-1/src/lib/trivia-questions.ts) containing 50 questions across 6 categories. Added host settings (Category and Difficulty dropdown selectors) and badges displaying categories/difficulties on participant screens.
- **Duplicate Message Hotfix:** Replaced client-generated alphanumeric IDs with valid UUIDs, passed them explicitly to the database insert statement to unify references, and matched timestamps via raw millisecond comparison (`.getTime()`) to prevent local echo duplication.
- **Continuous Integration Pipeline:** Configured local verification pipelines (install dependencies, dependency audit scans, strict tsc compilation, lint rules checking, next production build validation, Playwright chromium smoke test suite execution) as a GitHub Actions workflow.

---

## 4. Current State
- **Last Completed Task:** GitHub Actions CI workflow implemented.
- **Roadmap Remaining Work:**
  1. Add visual scoreboard/leaderboard mapping trivia score tallies.
  2. Implement visual tree rendering for Tournament bracket matchups.
  3. Create an XP/leveling system reward trigger for winning activities.
  4. Optimize chat scrolling/pagination and mobile viewport constraints.

---

## 5. Verification Status
- `npm run typecheck`: ✅ Pass (0 errors)
- `npm run lint`: ✅ Pass (0 warnings)
- `npm run build`: ✅ Pass (22 static/dynamic routes compiled successfully)
- **Continuous Integration:** ✅ Pass (GitHub Actions workflow configured in `.github/workflows/ci.yml`)
- **Local Dev Server:** `npm run dev`
