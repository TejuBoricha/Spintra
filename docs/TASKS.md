# Spintra Project Task List & Technical Debt

This document tracks all active, remaining, and completed tasks for the Spintra project, including technical debt items and upcoming roadmap priorities. This is the planning document — implementation detail for completed items lives in `CHANGELOG_AI.md`, not here.

---

## High Priority

Pre-launch hardening — required before publishing the site publicly on the open internet. None of the Medium Priority items below are launch-blocking; these are.

- `[x]` **Abuse & Moderation Controls:** Implemented via migration `0012_moderation_controls.sql` + client changes, applied to the live Supabase project 2026-07-04 and verified end-to-end against production (report, kick, and ban-on-rejoin all confirmed working live). **Correction:** host-only kick already existed before this session (the original wording above was wrong) — the real gap closed here is that a kicked user could immediately rejoin. Delivered: (1) ban-on-kick (`room_bans` table + before-insert trigger blocks rejoin), (2) message reporting (`message_reports` table, insert-only, reviewed via Supabase SQL editor — no admin UI), (3) client-side per-viewer block/mute (`localStorage`, everyone can use it, not just the host), (4) basic chat profanity/spam filter (`src/lib/chat-filter.ts`).
- `[x]` **Rate Limiting on Room/Message Creation:** Prevent anonymous-session spam (mass room creation, message flooding) at the Supabase/API layer. Implemented as DB-level before-insert triggers (migration `0011_rate_limiting.sql`), applied to the live Supabase project 2026-07-04.
- `[x]` **Legal Basics:** Add a Terms of Service, Privacy Policy, and cookie/consent notice covering the anonymous Supabase auth sessions and any stored data. Required before onboarding real public users. Placeholders filled in 2026-07-04 (Session 36): operator is Tejas Gogara, jurisdiction is India, contact is `tejasboricha225@gmail.com` for both support and privacy inquiries. Not reviewed by counsel — acceptable for a solo/hobby project at this scale, worth revisiting if the site starts handling payments or scales significantly.
- `[ ]` **Production Error Monitoring:** Wire up error tracking/alerting (e.g. Sentry) so failures and abuse patterns are visible once real strangers — not just known testers — are using the site.
- `[x]` **Tournament room activity was fundamentally broken:** Found via a full pre-launch Product Readiness Audit (Session 37) — the room-based Tournament activity only generated one flat round of random pairings with no scoring/advancement/winner, so a Tournament room could never actually finish. Fixed by extracting the standalone `/tools/tournament` page's bracket engine into `src/lib/tournament-engine.ts` and building a real room activity on top of it (all 4 formats, realtime-synced). See `CHANGELOG_AI.md` Session 37.

---

## Medium Priority

- `[ ]` **Visual Scoreboard:** Build a persistent real-time leaderboard component displaying user ranks during and after trivia activities. **Audit note (Session 37):** Trivia's `correctCount` resets every question with no running total or defined "game over" screen — this is the concrete gap this item would close.
- `[x]` **Tournament Bracket Tree UI:** Substantially delivered as a side effect of the Session 37 Critical fix — the room activity now renders real round-columns (winners/losers/grand-final) via `BracketColumns`, not a flat list. Not a connective-line tree diagram, but no longer flat.
- `[ ]` **XP and Leveling System:** Implement an XP rewards engine that updates player stats and ranks (e.g. rookie to explorer to challenger) upon activity wins.
- `[ ]` **Room Settings Panel:** Add host configurations for max participant counts, chat moderation, and activity timers.
- `[x]` **Room Share Link / QR Code:** Add a shareable link or QR code for room invites (currently the 6-character code must be communicated manually).
- `[ ]` **Message reports have no host-facing UI:** `message_reports` (migration 0012) is insert-only with no select policy — reports are invisible inside the app itself, only reviewable via the Supabase SQL editor. Found in the Session 37 audit.
- `[ ]` **RLS policies broader than intended (2 spots):** the host-election escape hatch on `rooms` (migration 0006) and the host-update-participant policy (migration 0007) both grant column-unrestricted `UPDATE`, not just the one field each was meant for. Not exploited today, but worth tightening. Found in the Session 37 audit.
- `[ ]` **Room lock not enforced at the database level:** join and chat lock checks are client-side only (`use-room-subscription.ts`, `use-room-chat.ts`); a direct Supabase call from devtools bypasses a "locked" room entirely. Found in the Session 37 audit.
- `[ ]` **Presence can get stuck "online" after a crash/backgrounded tab:** no server-side heartbeat/timeout in either demo or Supabase mode. Found in the Session 37 audit.
- `[ ]` **`@tanstack/react-query` is wired into the app with zero call sites:** dead dependency (or undocumented one) — either remove it or start using it and document why. Found in the Session 37 audit.

---

## Low Priority

- `[x]` **Trivia Database Migration:** Migrate the static [`src/lib/trivia-questions.ts`](file:///c:/Users/tejas/Desktop/Spintra-1/src/lib/trivia-questions.ts) file to a database table to support dynamic admin editing/moderation. Intentionally deferred — see `ENGINEERING_GOVERNANCE_REVIEW.md` §3 for the reasoning (hardcoded lists stay lightweight and support the offline `BroadcastChannel` fallback with zero DB setup).
- `[x]` **Static Prompt Lists → Database-Driven:** Truth or Dare / Would You Rather / Never Have I Ever already have a dynamic path via `activity_prompts` (migration `0008`), but Word Scramble's word bank is still a hardcoded array. Same deferral reasoning as above applies.
- `[x]` **Investigate Zustand for Game State:** Zustand is installed (`ARCHITECTURE.md` §1) but unused. Worth investigating only if game state ever needs to persist across activity switches — not currently needed (see `ARCHITECTURE.md` §6 "No Zustand in Rooms"). See [ZUSTAND_INVESTIGATION.md](file:///c:/Users/tejas/Desktop/Spintra-1/docs/ZUSTAND_INVESTIGATION.md).
- `[x]` **Engineering Governance Review Re-run:** Done 2026-07-04 — see `ENGINEERING_GOVERNANCE_REVIEW_V2.md` (new dated file, per the versioning policy; V1 left unedited as historical record).
- `[x]` **Extend `scripts/check-docs-drift.mjs` coverage:** Done 2026-07-04 — extended to verify React context shapes, docs/INDEX.md file alignment, file and relative link validations, and package.json scripts coverage. See engineering report.
- `[ ]` **Minor cleanup items from the Session 37 pre-launch audit** (none launch-blocking, batch these together when convenient): ban check happens after room UI mounts rather than before (banned users see a brief flash before being bounced — Supabase mode only, demo mode is now fixed); QR code has no fallback if the third-party image endpoint fails; no route-level `loading.tsx`/`error.tsx` anywhere in the App Router; a couple of icon-only buttons (username edit confirm/cancel, emoji picker) lack `aria-label`s and there's no `aria-live` region for chat; several missing DB constraints (`max_participants > 0`, `message_reports.message_id` FK, bounds-checking `trivia_questions.correct_index`); missing index on `activity_prompts.activity_type`; trivia's answer key (`correct_index`) is world-readable via RLS; chat profanity filter is client-side only (bypassable via a direct insert); host-election tiebreak ordering isn't DB-enforced; a few small dead-code items (`UserRole.spectator`, `rooms.settings` jsonb column, `spintra-room-lock-{code}` localStorage key, `markMessageUnreadIfHidden` in `use-room-chat.ts`); `games.ts` defines 16 entries not 14 (14 real + 2 create-only pseudo-types).

---

## In Progress

None currently.

---

## Completed

Title, completion date, and a pointer to the full implementation detail in `CHANGELOG_AI.md` — no narrative here by design.

| Title | Completed | CHANGELOG_AI.md Session |
|---|---|---|
| Pre-Launch Product Readiness Audit + Critical/High Fixes (Tournament room activity, kick/ban enforcement, room creation safety, realtime channel stability, sharing warnings) | 2026-07-04/05 | Session 37 |
| Legal Page Placeholders Filled In (entity, jurisdiction, contact) | 2026-07-04 | Session 36 |
| Dependabot PR Review & Triage (4 Actions bumps merged, 15/16 npm bumps applied, eslint 10 held back) | 2026-07-04 | Session 35 |
| Demo-Mode Room Activity Never Auto-Activated Fix | 2026-07-04 | Session 34 |
| Double-Elimination Tournament Bracket Fix (losers-bracket matches never completed) | 2026-07-04 | Session 33 |
| Abuse & Moderation Controls (ban-on-kick, report, block, chat filter) | 2026-07-04 | Session 32 |
| Rate Limiting on Room Creation & Chat Messages | 2026-07-04 | Session 31 |
| Pre-Launch Legal Basics (Terms, Privacy, Cookie Notice) | 2026-07-04 | Session 30 |
| Zustand State Management Investigation | 2026-07-04 | Session 28 |
| Database-Driven Trivia & Word Scramble Migration | 2026-07-04 | Session 28 |
| Room Share Link / QR Code | 2026-07-04 | Session 27 |
| Explore Page Live Feed, Join Codes, Portal Modals, Profile Editor, and Race Fixes | 2026-07-04 | Session 27 |
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
