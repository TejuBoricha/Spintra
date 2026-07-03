# CHANGELOG_AI.md — Spintra AI Work Log
> Chronological history of all significant AI-generated changes.
> **Append only. Never delete or modify existing entries.**

---

## Format

```
## [YYYY-MM-DD] — Session Title
**AI:** [assistant name if known]
**Task:** Brief description
**Files Modified:** list of files
**Purpose:** why this was done
**Outcome:** what was achieved
**Risks:** any known risks introduced
```

---

## [2026-07-03] — Session 1-2: Foundation, Bugs & Presence

**AI:** Antigravity IDE (Google DeepMind)
**Task:** Fix hydration mismatch, presence bugs, host self-healing, RLS
**Files Modified:**
- `src/app/room/[code]/room-client.tsx` — added `hasMounted` pattern, presence cleanup on unmount, host batch-update for stale participants
- `supabase/migrations/0007_allow_host_update_participants.sql` (NEW) — RLS policy allowing host to update participant rows

**Purpose:**
- Hydration mismatch: `isHost` was reading localStorage during SSR, causing React hydration to fail
- Presence: users were not going offline when they closed the tab
- Host self-healing: disconnected users were stuck as "online" until the page was refreshed

**Outcome:**
- Hydration mismatch resolved — `isHost` now gated behind `hasMounted`
- Presence correctly updates on `beforeunload`, `pagehide`, and component unmount
- Host can now mark disconnected participants as offline
- All 7 DB migrations applied

**Risks:** None — additive changes only

---

## [2026-07-03] — Session 3: Activity Improvements

**AI:** Antigravity IDE (Google DeepMind)
**Task:** Fix biased shuffles, add confetti, add AnimatePresence
**Files Modified:**
- `src/lib/utils.ts` — added `shuffleArray<T>(arr: T[]): T[]` (Fisher-Yates)
- `src/app/room/[code]/activities/bingo-activity.tsx` — replaced biased sort with `shuffleArray`
- `src/app/room/[code]/activities/word-scramble-activity.tsx` — replaced biased sort with `shuffleArray`
- `src/app/room/[code]/activities/trivia-activity.tsx` — replaced biased sort with `shuffleArray`
- `src/app/room/[code]/room-client.tsx` — added `fireConfetti()` calls on wins, `AnimatePresence` on chat + participants

**Purpose:**
- `sort(() => Math.random() - 0.5)` is statistically biased — produces non-uniform distributions
- Confetti improves feedback for winners
- AnimatePresence makes UI feel more alive

**Outcome:**
- Fisher-Yates shuffle implemented and applied to 3 affected activities
- Confetti fires on game wins in all activities
- Smooth enter/exit animations on chat messages and participant entries

**Risks:** None — improvements only, no breaking changes

---

## [2026-07-03] — Session 4: Partial Modularisation (4/14 Activities)

**AI:** Antigravity IDE (Google DeepMind)
**Task:** Create RoomActivityContext, migrate 4 activities to zero-prop context pattern
**Files Modified:**
- `src/app/room/[code]/context/room-activity-context.tsx` (NEW) — context, hook
- `src/app/room/[code]/room-client.tsx` — added `listenersRef`, `registerEventListener`, `handleActivityEvent`, `RoomActivityContext.Provider`, converted 4 imports to `next/dynamic`
- `src/app/room/[code]/activities/lucky-wheel-activity.tsx` — fully migrated
- `src/app/room/[code]/activities/bingo-activity.tsx` — fully migrated
- `src/app/room/[code]/activities/guess-number-activity.tsx` — fully migrated
- `src/app/room/[code]/activities/word-scramble-activity.tsx` — fully migrated

**Purpose:**
- Previous architecture put all game state in room-client.tsx (monolith)
- Context + Pub/Sub pattern decouples activities from the root component
- `next/dynamic` with `ssr: false` splits these into separate lazy-loaded JS chunks

**Outcome:**
- 4 of 14 activities are now self-contained with zero props
- `registerEventListener` / `handleActivityEvent` infrastructure in place for all remaining activities
- `npm run typecheck`: 0 errors
- `npm run lint`: 0 warnings
- `npm run build`: passes, 22 pages generated

**Risks:**
- Legacy bridge (`onActivityEventRef`) still present alongside new pattern — dual-fire for 10 legacy activities. This is intentional and will be resolved when all activities are migrated and the bridge is deleted in Step 4.

---

## [2026-07-03] — Session 5: Plan Design + Documentation System

**AI:** Antigravity IDE (Google DeepMind)
**Task:** Design the full 5-step modularisation plan; create AI documentation system
**Files Modified/Created:**
- `AI_HANDOFF.md` (NEW in project root) — portable resume handoff
- `docs/AI_CONTEXT.md` (NEW) — living project memory
- `docs/ARCHITECTURE.md` (NEW) — full architecture documentation
- `docs/CHANGELOG_AI.md` (NEW) — this file
- `docs/AI_RULES.md` (NEW) — mandatory rules for all AI assistants

**Purpose:**
- Formalise the approved 5-step plan with industry patterns (Strangler Fig, Plugin Registry, Pub/Sub, Stable Context)
- Create a persistent AI collaboration system so any AI assistant can resume work without re-analysis

**Outcome:**
- Complete AI documentation system created
- 5-step plan fully designed and documented with exact code for each step
- `AI_HANDOFF.md` verified written to project root (20 KB)

**Risks:** None — documentation only, no code changes

---

<!-- APPEND NEW ENTRIES BELOW THIS LINE -->
<!-- Format: ## [YYYY-MM-DD] — Session Title -->

## [2026-07-03] — Session 9: Database-Driven Activity Prompts & Fallback System
**AI:** Antigravity (Google DeepMind)
**Task:** Refactor prompt viewports to fetch dynamically from database schemas.
**Files Modified/Created:**
- `supabase/migrations/0008_create_activity_prompts.sql` (NEW) — Migration file to create and seed the dynamic activity prompts table
- `src/app/room/[code]/activities/truth-or-dare-activity.tsx` — Updated to load dynamic prompts from Supabase with static backup fallbacks
- `src/app/room/[code]/activities/would-you-rather-activity.tsx` — Updated to load dynamic prompts from Supabase with static backup fallbacks
- `src/app/room/[code]/activities/never-have-i-ever-activity.tsx` — Updated to load dynamic prompts from Supabase with static backup fallbacks

**Purpose:**
- Migrate game prompts from hardcoded client-side script arrays into central database tables for dynamic maintenance and extensions.
- Enable high-fidelity real-time querying without losing zero-configuration local sandbox capabilities (fully preserves BroadcastChannel offline modes).

**Outcome:**
- Unified `activity_prompts` table created and seeded.
- Active prompts fetched dynamically on component mount to reduce runtime DB load.
- Automated tests, lint checks, and typechecks pass with 0 errors.

**Risks:** None.

---

## [2026-07-03] — Session 8: Continuous Integration (CI) Pipeline & Workflow Entrypoint
**AI:** Antigravity (Google DeepMind)
**Task:** Establish professional Continuous Integration workflow via GitHub Actions, apply DevOps optimizations, and create a single onboarding entrypoint.
**Files Modified/Created:**
- `.github/workflows/ci.yml` (NEW) — GitHub Actions CI pipeline configuration
- `START_HERE.md` (NEW) — Onboarding entrypoint and workflow pointer for developers and AI assistants

**Purpose:**
- Implement automated quality gates (caching dependencies, security audits, TypeScript typecheck, ESLint, Next production build validation, and Playwright Chromium smoke test suite).
- Secure pull request merge validation checkpoints.
- Provide a clear, single entrypoint explaining repository workflow rules and document order of operations.

**Outcome:**
- Highly optimized, secure, and cost-efficient CI pipeline created with Next.js and Playwright caches.
- `START_HERE.md` available in the project root.
- All documents, typechecks, and linter runs verified successfully.

**Risks:** None.

---

## [2026-07-03] — Session 7: Trivia Question Bank Expansion, Host Controls & Chat Duplicate Hotfix
**AI:** Antigravity (Google DeepMind)
**Task:** Expand Trivia question bank to 50+ questions with category/difficulty filters and duplicate prevention; fix local echo chat message duplication.
**Files Modified/Created:**
- `src/lib/trivia-questions.ts` (NEW) — dynamic database of 50+ categorized questions
- `src/lib/types.ts` — updated `TriviaQuestionEvent` definition to carry category and difficulty fields
- `src/app/room/[code]/activities/trivia-activity.tsx` — integrated questions bank, built host drop-down controls, implemented badge renders for participants, and added no-repeat deck ledger shuffler
- `src/app/room/[code]/room-client.tsx` — changed client-side `generateId` to valid `generateUUID`, passed client-generated `id` to database `insert` block, and upgraded `isDuplicateMessage` to do timezone-robust millisecond-based `.getTime()` comparison for message duplicate checks

**Purpose:**
- Upgrade the basic Trivia game mode from a small hardcoded set of 8 questions to a robust, high-fidelity experience.
- Give hosts the capability to target specific subjects and difficulty levels.
- Settle duplicate question issues using active deck state.
- Resolve the double-rendering message bug that caused the sender's own chat message to duplicate when the database INSERT triggered a realtime broadcast with a different ID format.

**Outcome:**
- 50 categorized questions available.
- UI elements match the premium glassmorphism theme.
- Chat message duplication fully resolved by syncing client/database IDs and matching timestamps robustly.
- Typecheck, linter, and dynamic build fully verified.

**Risks:** None.

---

## [2026-07-03] — Session 6: Execution of the approved 5-step modularisation plan
**AI:** Antigravity (Google DeepMind)
**Task:** Execute all 5 steps of the approved modularisation plan.
**Files Modified/Created:**
- `src/lib/types.ts` — replaced Record with typed discriminated union of events, added entries for all 14 activities
- `src/app/room/[code]/context/room-activity-context.tsx` — split single context into Stable (RoomActivityContext) and Dynamic (RoomParticipantsContext) contexts
- `src/app/room/[code]/activities/activity-registry.ts` (NEW) — plugin registry for dynamic loading
- `src/app/room/[code]/room-client.tsx` — updated React imports, added ErrorBoundary wrapper class, memoized contexts, and replaced JSX switch case blocks with dynamic registry render
- `src/app/room/[code]/activities/coin-flip-activity.tsx` — migrated to context patterns
- `src/app/room/[code]/activities/dice-activity.tsx` — migrated to context patterns
- `src/app/room/[code]/activities/truth-or-dare-activity.tsx` — migrated to context patterns
- `src/app/room/[code]/activities/would-you-rather-activity.tsx` — migrated to context patterns
- `src/app/room/[code]/activities/never-have-i-ever-activity.tsx` — migrated to context patterns
- `src/app/room/[code]/activities/rps-activity.tsx` — migrated to context patterns
- `src/app/room/[code]/activities/team-maker-activity.tsx` — migrated to context patterns, replaced biased shuffle with Fisher-Yates shuffle
- `src/app/room/[code]/activities/tournament-activity.tsx` — migrated to context patterns, replaced biased shuffle with Fisher-Yates shuffle
- `src/app/room/[code]/activities/name-draw-activity.tsx` — migrated to context patterns
- `src/app/room/[code]/activities/trivia-activity.tsx` — migrated to context patterns
- `src/app/room/[code]/activities/lucky-wheel-activity.tsx` — updated event signatures to be strictly typed
- `src/app/room/[code]/activities/guess-number-activity.tsx` — updated event signatures to be strictly typed
- `src/app/room/[code]/activities/bingo-activity.tsx` — updated event signatures to be strictly typed
- `src/app/room/[code]/activities/word-scramble-activity.tsx` — updated event signatures to be strictly typed

**Purpose:**
- Transition the Spintra multi-player rooms from a monolithic state system to a context-driven, lazy-loaded, isolated component-plugin system.
- Prevent unnecessary page re-renders by splitting context.
- Eliminate type assertions (`as any`) by creating a strictly typed union.
- Make all games crash-isolated with `ErrorBoundary`.

**Outcome:**
- All 14 activity modules successfully refactored and dynamically loaded.
- Zero TypeScript errors (`npm run typecheck` passes).
- Zero ESLint warnings (`npm run lint` passes).
- Production build passes successfully (`npm run build` passes).

**Risks:** None.

---

