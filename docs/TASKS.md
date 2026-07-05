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

- `[x]` **Room auto-expiry / lifecycle cleanup:** Done Session 40 — migration `0020` enables `pg_cron` and schedules the `cleanup_inactive_rooms()` function (already defined in migration `0009`, deletes rooms with no online participants that are >2h old) to run every 30 minutes. Along the way, discovered `0009` itself had never actually executed live (see the new item below) — re-ran it for real, which deleted 23 genuinely abandoned rooms on the spot.
- `[x]` **Systematic migration-history audit:** Done Session 40 — cross-checked all 20 migrations' expected live objects (tables, columns, functions, triggers, policies, constraints, indexes, extensions, realtime publication membership, replica identity, seed-data row counts) against the live database. No further gaps found beyond `0009` (already fixed same session); `0001`–`0008` and `0010`–`0019` all confirmed genuinely live and matching source exactly, seed data counts clean (44 prompts, 50 trivia questions, no duplicates).
- `[ ]` **Visual Scoreboard:** Build a persistent real-time leaderboard component displaying user ranks during and after trivia activities. **Audit note (Session 37):** Trivia's `correctCount` resets every question with no running total or defined "game over" screen — this is the concrete gap this item would close.
- `[x]` **Tournament Bracket Tree UI:** Substantially delivered as a side effect of the Session 37 Critical fix — the room activity now renders real round-columns (winners/losers/grand-final) via `BracketColumns`, not a flat list. Not a connective-line tree diagram, but no longer flat.
- `[ ]` **XP and Leveling System:** Implement an XP rewards engine that updates player stats and ranks (e.g. rookie to explorer to challenger) upon activity wins.
- `[ ]` **Room Settings Panel:** Add host configurations for max participant counts, chat moderation, and activity timers.
- `[x]` **Room Share Link / QR Code:** Add a shareable link or QR code for room invites (currently the 6-character code must be communicated manually).
- `[x]` **Message reports have no host-facing UI:** Done Session 38 — migration `0018` adds a `reviewed` flag + host-scoped select/update policy; new `MessageReportsPanel` (badge count, live via realtime, dismiss action). Verified end-to-end live.
- `[x]` **RLS policies broader than intended (2 spots):** Done Session 38 — migration `0014` adds BEFORE UPDATE triggers restricting the `rooms` host-promotion escape hatch (0006) and the `room_participants` host-update policy (0007) to only the one column each was meant for.
- `[x]` **Room lock not enforced at the database level:** Done Session 38 — migration `0015` adds before-insert triggers on `room_participants`/`chat_messages` mirroring the client's existing lock semantics. Verified live: a locked room now blocks new joins/chat at the DB level, not just client-side.
- `[x]` **Presence can get stuck "online" after a crash/backgrounded tab:** Done Session 38 — migration `0019` lets any participant (not just the host) reconcile a crashed peer's stale `is_online` against live presence. Closes the worst case found while implementing this: if the *host* was the one who crashed, nobody could previously correct their row, which permanently blocked host succession. Verified live with two real anonymous sessions.
- `[x]` **`@tanstack/react-query` is wired into the app with zero call sites:** Done Session 38 — removed entirely (dependency + `QueryClientProvider` wrapper). This app's data fetching is Supabase-direct + realtime; it never needed a query-caching layer.

---

## Low Priority

- `[x]` **Trivia Database Migration:** Migrate the static [`src/lib/trivia-questions.ts`](file:///c:/Users/tejas/Desktop/Spintra-1/src/lib/trivia-questions.ts) file to a database table to support dynamic admin editing/moderation. Intentionally deferred — see `ENGINEERING_GOVERNANCE_REVIEW.md` §3 for the reasoning (hardcoded lists stay lightweight and support the offline `BroadcastChannel` fallback with zero DB setup). **Session 38 note:** the migration creating this table (`0010`) was discovered to have never actually applied in production (see `CHANGELOG_AI.md` Session 37/38) — fixed and re-applied for real; the static file remains the intentional fallback.
- `[x]` **Static Prompt Lists → Database-Driven:** Truth or Dare / Would You Rather / Never Have I Ever already have a dynamic path via `activity_prompts` (migration `0008`), but Word Scramble's word bank is still a hardcoded array. Same deferral reasoning as above applies. **Session 38 note:** same discovery as above — migration `0008` had also never actually applied in production; fixed and re-applied.
- `[x]` **Investigate Zustand for Game State:** Zustand is installed (`ARCHITECTURE.md` §1) but unused. Worth investigating only if game state ever needs to persist across activity switches — not currently needed (see `ARCHITECTURE.md` §6 "No Zustand in Rooms"). See [ZUSTAND_INVESTIGATION.md](file:///c:/Users/tejas/Desktop/Spintra-1/docs/ZUSTAND_INVESTIGATION.md).
- `[x]` **Engineering Governance Review Re-run:** Done 2026-07-04 — see `ENGINEERING_GOVERNANCE_REVIEW_V2.md` (new dated file, per the versioning policy; V1 left unedited as historical record).
- `[x]` **Extend `scripts/check-docs-drift.mjs` coverage:** Done 2026-07-04 — extended to verify React context shapes, docs/INDEX.md file alignment, file and relative link validations, and package.json scripts coverage. See engineering report.
- `[x]` **Cleanup items from the Session 37 pre-launch audit** — the ban-check-timing item was already fixed in Session 37 itself (both Supabase and demo mode now check bans in the pre-entry gate, before the room UI mounts). The rest done Session 38: QR code now falls back to a text notice if the third-party image endpoint fails; added `loading.tsx`/`error.tsx` for `/room/[code]`, `/explore`, `/create` (highest-traffic routes — other routes not yet covered); added missing `aria-label`s (emoji picker, username edit confirm/cancel) and an `aria-live` chat region; added missing DB constraints (`max_participants > 0`, `message_reports.message_id` FK, bounds-checked `trivia_questions.correct_index`) and the `activity_prompts.activity_type` index; removed dead code (`UserRole.spectator`, `rooms.settings` jsonb column — dropped, `spintra-room-lock-{code}` localStorage key, `markMessageUnreadIfHidden`); fixed the `games.ts` count in `ARCHITECTURE.md` (16 entries, not 14). **Not fixed, intentionally deferred:** trivia's answer key (`correct_index`) is still world-readable via RLS (would need a server-side answer-check RPC to fix properly — disproportionate effort for a casual trivia game); the chat profanity filter is still client-side only (bypassable via a direct insert — same reasoning, low severity); host-election "earliest joined" tiebreak ordering still isn't DB-enforced (rare race, cosmetic fairness issue only).

---

## In Progress

None currently.

---

## Completed

Title, completion date, and a pointer to the full implementation detail in `CHANGELOG_AI.md` — no narrative here by design.

| Title | Completed | CHANGELOG_AI.md Session |
|---|---|---|
| Room Auto-Expiry (pg_cron scheduling) + Migration 0009 Live-Recovery | 2026-07-05 | Session 40 |
| Platform QA Audit: Live Trending Feed (auth init fix), Privacy Bypass (is_public filter), Explore Filters (real data), Banned-User Toast Flow, Fake Homepage Stats, Tournament Integrity (ties/TBD/re-edit), Party vs Classroom Distinction (classroomSafe), CRLF drift-check fix | 2026-07-05 | Session 39 |
| Pre-Launch Audit Backlog: RLS Tightening, DB-Level Lock Enforcement, Broken Migrations Discovered & Fixed, Message Reports UI, Presence Reconciliation, Dead Code, UX/A11y Fixes, React Query Removal | 2026-07-05 | Session 38 |
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
