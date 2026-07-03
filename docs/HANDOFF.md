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
- **Dynamic Prompt Migration:** Created and seeded the `activity_prompts` database table (migration `0008`) and refactored Truth or Dare, Would You Rather, and Never Have I Ever to fetch prompts dynamically with local fallbacks.
- **Dynamic UI Audio Integration:** Expose `soundEnabled` state inside Stable Context, implement client volume controls (caching preference to `localStorage`), and connect synchronized synthesized audio feedback loops (coin flips, dice rolling clatters, card draws, button/confession pops, correct chimes, incorrect buzzers) across modular game viewports.
- **Security Fix (Claude Code):** Redacted a live Postgres connection string/password that had been committed to `AI_CONTEXT.md`. The password itself was rotated by the user directly in the Supabase dashboard — not something an AI assistant can do.
- **CI/Ops (Claude Code):** Bumped CI to Node 22 (GitHub deprecated Node 20 runners), added an `engines` field to `package.json`, and added `.github/dependabot.yml` for automated weekly dependency PRs.
- **Word Scramble UX Fix (Claude Code):** Wrong guesses previously gave no visible feedback (only an easily-missed sound) in both `/tools/word-scramble` and the in-room `word-scramble-activity.tsx`. Added `toast.error` feedback to both.
- **Chat Pagination (Claude Code):** Added a "Load older messages" button (cursor-based on `created_at`, 50/page, scroll-position preserved) — chat previously only ever fetched the most recent 100 messages with no way to reach older history.
- **Mobile Viewport Fix (Claude Code):** Audited Lucky Wheel, Bingo, and Tournament. Only Tournament had a real bug — match rows joined member names into an unconstrained flex-item span with no `min-w-0`/wrap, which could overflow on narrow screens. Fixed; the other two were already safe.
- **Message ID Entropy (Claude Code):** Upgraded the `generateUUID()` fallback (used only when `crypto.randomUUID()` is unavailable) from `Math.random()` to `crypto.getRandomValues()`. Deliberately did *not* move to database-generated UUIDs as a stale debt note suggested — that would have reintroduced the duplicate-message bug ADR-005 fixed, since the client needs its own ID synchronously for optimistic rendering.
- **ER Diagram + Doc Correction (Claude Code):** Added a Mermaid ER diagram to `ARCHITECTURE.md` §12, generated directly from the migration files. In the process, caught and corrected a real documentation bug: `AI_CONTEXT.md` and `ENGINEERING_GOVERNANCE_REVIEW.md` both referenced a `users` table that does not exist anywhere in the schema.
- **Documentation Workflow (Claude Code):** Added `docs/START_HERE.md` (selective-reading entry point) and `docs/INDEX.md` (one-line-per-file lookup table); removed the conflicting root `START_HERE.md` (which told readers to read all docs "in order," the opposite of the new file). Added `AI_RULES.md` §8 "Context Optimization" formalizing this philosophy as a binding rule.

---

## 4. Current State
- **Last Completed Task:** Documentation workflow overhaul (`START_HERE.md`/`INDEX.md`/`AI_RULES.md` §8) and a batch of real bug fixes found via a self-directed improvement pass (chat pagination, tournament mobile overflow, message ID entropy, ER diagram + phantom `users` table correction).
- **Roadmap Remaining Work:**
  1. Add visual scoreboard/leaderboard mapping trivia score tallies.
  2. Implement visual tree rendering for Tournament bracket matchups.
  3. Create an XP/leveling system reward trigger for winning activities.
  4. Room settings panel (max participants, chat moderation, activity timers).

---

## 5. Verification Status
- `npm run typecheck`: ✅ Pass (0 errors)
- `npm run lint`: ✅ Pass (0 warnings)
- `npm run build`: ✅ Pass
- **Continuous Integration:** ✅ Pass (GitHub Actions workflow configured in `.github/workflows/ci.yml`, now on Node 22)
- **Local Dev Server:** `npm run dev`
- **Known verification gap:** Chat pagination and the in-room Word Scramble fix were verified via typecheck/lint/build and static analysis only, not a live multi-client click-through — this sandbox cannot reach the live Supabase project, and a second dev-server instance can't be started in this directory while another is already running (Next.js enforces a single-instance lock per project directory). If picking this up next, a live smoke test of both would close that gap.
