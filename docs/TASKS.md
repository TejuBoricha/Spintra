# Spintra Project Task List & Technical Debt

This document tracks all active, remaining, and completed tasks for the Spintra project, including technical debt items and upcoming roadmap priorities. This is the planning document — implementation detail for completed items lives in `CHANGELOG_AI.md`, not here.

---

## High Priority

None currently. No open bugs or security issues.

---

## Medium Priority

- `[ ]` **Visual Scoreboard:** Build a persistent real-time leaderboard component displaying user ranks during and after trivia activities.
- `[ ]` **Tournament Bracket Tree UI:** Replace the flat matches list with a visual tree rendering matches in quarter/semi-final brackets.
- `[ ]` **XP and Leveling System:** Implement an XP rewards engine that updates player stats and ranks (e.g. rookie to explorer to challenger) upon activity wins.
- `[ ]` **Room Settings Panel:** Add host configurations for max participant counts, chat moderation, and activity timers.
- `[ ]` **Room Share Link / QR Code:** Add a shareable link or QR code for room invites (currently the 6-character code must be communicated manually).

---

## Low Priority

- `[ ]` **Trivia Database Migration:** Migrate the static [`src/lib/trivia-questions.ts`](file:///c:/Users/tejas/Desktop/Spintra-1/src/lib/trivia-questions.ts) file to a database table to support dynamic admin editing/moderation. Intentionally deferred — see `ENGINEERING_GOVERNANCE_REVIEW.md` §3 for the reasoning (hardcoded lists stay lightweight and support the offline `BroadcastChannel` fallback with zero DB setup).
- `[ ]` **Static Prompt Lists → Database-Driven:** Truth or Dare / Would You Rather / Never Have I Ever already have a dynamic path via `activity_prompts` (migration `0008`), but Word Scramble's word bank is still a hardcoded array. Same deferral reasoning as above applies.
- `[ ]` **Investigate Zustand for Game State:** Zustand is installed (`ARCHITECTURE.md` §1) but unused. Worth investigating only if game state ever needs to persist across activity switches — not currently needed (see `ARCHITECTURE.md` §6 "No Zustand in Rooms").
- `[x]` **Engineering Governance Review Re-run:** Done 2026-07-04 — see `ENGINEERING_GOVERNANCE_REVIEW_V2.md` (new dated file, per the versioning policy; V1 left unedited as historical record).
- `[x]` **Extend `scripts/check-docs-drift.mjs` coverage:** Done 2026-07-04 — extended to verify React context shapes, docs/INDEX.md file alignment, file and relative link validations, and package.json scripts coverage. See engineering report.

---

## In Progress

None currently.

---

## Completed

Title, completion date, and a pointer to the full implementation detail in `CHANGELOG_AI.md` — no narrative here by design.

| Title | Completed | CHANGELOG_AI.md Session |
|---|---|---|
| Foundation & Presence Bugs (hydration mismatch, host self-healing, RLS) | 2026-07-03 | Session 1–2 |
| Activity Randomization Improvements (Fisher-Yates shuffle, confetti, AnimatePresence) | 2026-07-03 | Session 3 |
| Zero-Prop Modular Refactor (context split, plugin registry, ErrorBoundary, all 14 activities) | 2026-07-03 | Sessions 4–6 |
| Trivia Expansion & Host Controls (50-question bank, category/difficulty filters) | 2026-07-03 | Session 7 |
| Local Echo Duplication Hotfix (chat message dedup) | 2026-07-03 | Session 7 |
| Continuous Integration Pipeline (`ci.yml`) | 2026-07-03 | Session 8 |
| Dynamic Prompts Migration (`activity_prompts` table, migration 0008) | 2026-07-03 | Session 9 |
| Dynamic UI Audio Integration (sound effects, mute toggle) | 2026-07-03 | Session 10 |
| Security & Ops Cleanup (leaked credential redacted, CI Node bump, Dependabot, Word Scramble UX fix, README restructure) | 2026-07-04 | Session 11 |
| Chat Pagination ("Load older messages") | 2026-07-04 | Session 12 |
| Mobile Viewport Audit (Tournament overflow fix) | 2026-07-04 | Session 13 |
| Message ID Entropy (`crypto.getRandomValues()` fallback) | 2026-07-04 | Session 14 |
| ER Diagram + Phantom `users` Table Correction | 2026-07-04 | Session 15 |
| Documentation Entry Point (`START_HERE.md` + `INDEX.md`) | 2026-07-04 | Session 16 |
| `AI_RULES.md` Context Optimization Section | 2026-07-04 | Session 17 |
| `HANDOFF.md` Sync | 2026-07-04 | Session 18 |
| Redundant Event Type Casts Removed (all 14 activities) | 2026-07-04 | Session 19 |
| `AI_RULES.md` Definition of Done + Mandatory Change Report | 2026-07-04 | Session 20 |
| Documentation System Refactor | 2026-07-04 | Session 21 |
| ADR Backfill, Automated Drift Check, CI Node-Version Fix, Governance Review V2 | 2026-07-04 | Session 22 |
| Composed `verify`/`ci` Scripts, Stale-Reference Cleanup, README Polish | 2026-07-04 | Session 23 |
