# Spintra Project Task List & Technical Debt

This document tracks all active, remaining, and completed tasks for the Spintra project, including technical debt items and upcoming roadmap priorities.

---

## 1. Active Priorities

No active task is currently in progress. All refactoring plan steps and trivia question expansions have been completed successfully.

---

## 2. Technical Debt Backlog

- `[ ]` **Trivia Database Migration:** Migrate the static [`src/lib/trivia-questions.ts`](file:///c:/Users/tejas/Desktop/Spintra-1/src/lib/trivia-questions.ts) file to a database table to support dynamic admin editing/moderation.
- `[x]` **Chat Pagination:** Resolved 2026-07-04 (Claude Code) — added a "Load older messages" button using a `created_at` cursor (`.lt()`), 50 messages per page, with scroll-position preservation. Not live-tested (chat requires real Supabase; this sandbox can't reach the live project) — verified via typecheck/lint/build only.
- `[x]` **Message ID Generation:** Resolved 2026-07-04 (Claude Code) as a judgment call, not the literal suggestion — see `CHANGELOG_AI.md` Session 14 for why database-generated UUIDs would regress ADR-005's dedup fix. Instead upgraded the fallback path from `Math.random()` to `crypto.getRandomValues()` for real entropy when `crypto.randomUUID()` is unavailable (non-secure contexts).
- `[x]` **Mobile Viewport Optimization:** Audited 2026-07-04 (Claude Code). Lucky Wheel (fixed 256px) and Bingo (fixed 44px cells) were already safely within any phone viewport width — no fix needed. Found and fixed a real bug in `tournament-activity.tsx`: match rows joined member names into one unconstrained flex-item span (no `min-w-0`/wrap), which could overflow horizontally with long usernames. Added `min-w-0 break-words` to the span and `shrink-0` to the sibling badge.

---

## 3. Future Roadmap Backlog

- `[ ]` **Visual Scoreboard:** Build a persistent real-time leaderboard component displaying user ranks during and after trivia activities.
- `[ ]` **Tournament Bracket Tree UI:** Replace the flat matches list with a visual tree rendering matches in quarter/semi-final brackets.
- `[ ]` **XP and Leveling System:** Implement an XP rewards engine that updates player stats and ranks (e.g. rookie to explorer to challenger) upon activity wins.
- `[ ]` **Room Settings Panel:** Add host configurations for max participant counts, chat moderation, and activity timers.

---

## 4. Completed Milestones

- `[x]` **Phase 1: Foundation & Presence Bugs**
  - Gated `isHost` behind `hasMounted` to prevent server/client hydration mismatches.
  - Implemented self-healing presence checks batching updates for left participants.
  - Applied migration `0007` database updates.
- `[x]` **Phase 2: Activity Randomization Improvements**
  - Swapped biased random sorts for uniform Fisher-Yates array shuffles.
  - Hooked win celebration triggers.
- `[x]` **Phase 3: Zero-Prop Modular Refactor**
  - Extracted shared activity metadata and participants roster to separate stable/dynamic context hooks.
  - Created centralized dynamically split lazy-registry.
  - Modularized all 14 game viewport components to context subscriptions.
  - Deleted legacy monolithic states, switch blocks, and prop declarations in `room-client.tsx`.
- `[x]` **Phase 4: Trivia Expansion & Host Controls**
  - Created 50 categorized question bank with category/difficulty filters.
  - Implemented non-repeat shuffler deck checks.
- `[x]` **Phase 5: Local Echo Duplication Hotfix**
  - Unified UUID representation format between client and database inserts.
  - Upgraded timestamp matching in duplicate message evaluations to parse datetime string formats.
- `[x]` **Phase 6: Continuous Integration Pipeline**
  - Configured GitHub Actions workflow `.github/workflows/ci.yml`.
  - Configured automated NPM dependencies caching and installations.
  - Integrated moderate-level NPM security audits.
  - Configured strict typecheck, linter formatting validation, and production compiles.
  - Configured isolated Playwright E2E smoke tests inside Ubuntu CI containers.
  - Added failed report artifact upload capture hook.
- `[x]` **Phase 7: Dynamic Prompts Migration**
  - Created table `public.activity_prompts` (Migration `0008`) and enabled standard Row Level Security.
  - Seeded dynamic prompts for Truth or Dare, Would You Rather, and Never Have I Ever.
  - Refactored Truth or Dare, Would You Rather, and Never Have I Ever viewports to query prompts dynamically.
  - Built automatic cache initialization on Host mount to minimize DB load.
  - Integrated static hardcoded backup lists for offline local BroadcastChannel mode.
- `[x]` **Phase 8: Dynamic UI Audio Integration**
  - Exposed `soundEnabled` in the stable context interface.
  - Initialized local sound toggle state (with `localStorage` caching) and created header Volume Toggle button.
  - Connected synthesized Web Audio API sound effects (tick, metal flip, low-pitch dice clatter, card swipes, selection pops, success fanfare, failure buzzer) inside all modular multiplayer room activity components.
- `[x]` **Phase 9: Security & Ops Cleanup (Claude Code, 2026-07-04)**
  - Redacted a leaked live Postgres connection string/password from `docs/AI_CONTEXT.md`.
  - Bumped CI to Node 22, added `engines` field to `package.json`.
  - Added `.github/dependabot.yml` (npm + github-actions, weekly).
  - Fixed silent wrong-guess UX in Word Scramble (both `/tools/word-scramble` and `word-scramble-activity.tsx`) — added `toast.error` feedback.
  - Restructured `README.md` (table of contents, corrected game count).
