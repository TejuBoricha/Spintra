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

## [2026-07-04] — Session 22: Resolved All 3 Remaining Documentation Risks

**AI:** Claude Code (Anthropic)
**Task:** User asked to "fix" the 3 risks flagged at the end of Session 21's Documentation Refactoring Report: stale governance review, un-backfilled ADR alternatives, and no automated drift enforcement.
**Files Modified:**
- `docs/DECISIONS.md` — backfilled "Alternatives Considered" into all 6 existing ADRs. ADR-001 and ADR-006 promote an alternative already stated in the original text; ADR-002/003/004/005 reconstruct one from the "prior approach" each decision replaced, explicitly labeled `*(reconstructed, not contemporaneously recorded)*`. ADR-005's entry also cross-references `CHANGELOG_AI.md` Session 14, where the same alternative (DB-generated message IDs) was independently re-evaluated and re-rejected for the same reason.
- `scripts/check-docs-drift.mjs` (NEW) — verifies `docs/*.md`'s real file listing and `supabase/migrations/*.sql`'s real files against `ARCHITECTURE.md` §2's folder diagram and §4's Migrations Applied table; exits non-zero on any mismatch in either direction (undocumented real file, or documented-but-nonexistent file).
- `package.json` — added `"docs:check": "node scripts/check-docs-drift.mjs"`.
- `.github/workflows/ci.yml` — added a "Documentation Drift Check" step running `npm run docs:check`. **Also fixed an unrelated live regression found while editing this file:** `node-version` had silently reverted from `22` back to `20.x` — commit `15c4860` (dated *after* the original Node 22 fix in `5120e3c`) fully rewrote this file for an unrelated reason and reintroduced the old value without anyone noticing. Reverted back to `22`.
- `docs/ARCHITECTURE.md` — updated §2's folder listing to include the new `ENGINEERING_GOVERNANCE_REVIEW_V2.md` file (caught by the new drift script itself, on its first real run after being wired in — see Outcome).
- `docs/ENGINEERING_GOVERNANCE_REVIEW_V2.md` (NEW) — a fresh governance review superseding V1 for currency, per the point-in-time versioning policy established in Session 21 (V1 left unedited as historical record). Rates overall governance 9.5/10 (up from 9.2), documents the newly-implemented drift check, and flags the CI Node-version regression as a concrete example of a new risk category: silent config regressions from uncoordinated sessions overwriting each other's narrow fixes.
- `docs/INDEX.md` — updated the governance-review references (both the routing table and the file-reference table) to point at V2 as current, V1 as historical.
- `docs/TASKS.md` — checked off "Engineering Governance Review Re-run" (now done); added a new Low Priority item to extend the drift script's coverage (context shape, session-number pointer validation) per V2's own recommendation.

**Purpose:**
- Close out the 3 risks honestly flagged at the end of the prior session's report, per the user's explicit request, rather than leaving them as unaddressed "future work" prose.

**Outcome:**
- `npm run typecheck` / `npm run lint` / `npm run build` / `npm run docs:check`: all pass.
- The drift script was validated to actually detect drift, not just pass trivially: manually created a phantom `docs/` file and confirmed the script caught it and exited 1, then removed the test file. It also caught a real omission live during this session (the new `ENGINEERING_GOVERNANCE_REVIEW_V2.md` file, before `ARCHITECTURE.md` was updated to mention it) — direct proof the safeguard works, not just that it was written to look like it does.
- The CI Node-version regression was discovered as a side effect of this work, not the original goal — a reminder that reading a file closely for one reason often surfaces unrelated drift, which is itself an argument for the drift-check habit generalizing beyond just today's two checks.

**Risks:**
- The drift script covers 2 drift vectors (doc file listing, migrations table) out of several possible ones (e.g. context shape vs. real TypeScript interface, cross-doc session-number pointers) — flagged as a new `TASKS.md` item rather than solved today.
- 4 of 6 backfilled ADR alternatives are reconstructed/inferred, not contemporaneous — clearly labeled, but a lower-confidence historical record than if they'd been written at decision time.

---

## [2026-07-04] — Session 21: Full Documentation System Refactor

**AI:** Claude Code (Anthropic)
**Task:** User requested a full onboarding review of the documentation system, followed by explicit implementation of the findings: give every doc in `docs/` a single, non-overlapping responsibility without losing any historical information (relocate, don't delete).
**Files Modified:**
- `docs/ARCHITECTURE.md` — fixed a live bug (Authentication Flow §5 still referenced a nonexistent `users` table); rewrote the stale mid-refactor folder structure (activities were marked `[TO CREATE]`/`LEGACY: to be migrated (Step 3)` though the migration completed in Session 6; `docs/` listing was missing 6 real files and listed 2 deleted ones; root falsely listed `AI_HANDOFF.md`, which never existed); removed "target architecture"/"legacy" language from §3/§6 now that the migration is complete; added the previously-undocumented `soundEnabled` field to the `RoomActivityContext` shape (verified against the actual source file); added a new Design Pattern #5 "Error Isolation" documenting the `ErrorBoundary` (previously mentioned only in `HANDOFF.md`/`CHANGELOG_AI.md`, never explained in `ARCHITECTURE.md` itself); added a consolidated "Migrations Applied" table (§4) and "APIs / Integration Points" list (§4), both relocated from the old `AI_CONTEXT.md`.
- `docs/AI_CONTEXT.md` — fully rewritten to exactly 7 current-state-only fields (Current Milestone, Overall Progress, Current Objective, Current Focus, Known Issues, Current Assumptions, Next Recommended Task) plus a "See Also" pointer section. Removed: Features Completed / Bugs Fixed / DB Migrations checklist / Modularisation bullets / Recent Architectural Changes / Recent Session Notes (all pure duplicates of this file's own history — every fact already exists in `CHANGELOG_AI.md`); Frontend Status / Database Status / APIs Implemented (pure duplicates of `ARCHITECTURE.md` §1/§12, the latter less accurate than the ARCHITECTURE.md version); Remaining Roadmap (duplicate of `TASKS.md`, except 2 items that existed *only* here — relocated, not dropped, see below); Exact Point Where Development Stopped / Next Task to Perform (duplicates `HANDOFF.md`'s job); Technical Debt (duplicates `TASKS.md`'s Technical Debt Backlog, except 1 item that existed *only* here — relocated, see below).
- `docs/HANDOFF.md` — fully rewritten to exactly 4 fields (Last Completed Task, Current Task, Current Blockers, Next Recommended Task). Removed Project Overview / Current Architecture & Conventions (pure duplicates of `ARCHITECTURE.md`) and Current Progress / Roadmap Remaining Work (pure duplicates of `CHANGELOG_AI.md` and `TASKS.md` respectively — every bullet already exists in one of those two).
- `docs/TASKS.md` — restructured into High/Medium/Low Priority + In Progress + Completed. Before trimming `AI_CONTEXT.md`, rescued 3 items that existed *only* there and nowhere else: "Room Share Link / QR Code" and "Investigate Zustand for Game State" (both now in this file), and "Static prompt lists hardcoded" (previously only in `ENGINEERING_GOVERNANCE_REVIEW.md`, now tracked here too since this is the actual backlog document). Added a new "Engineering Governance Review Re-run" item per the new policy below. Completed section trimmed to title + date + `CHANGELOG_AI.md` session pointer only — all narrative detail removed since it's already fully present in `CHANGELOG_AI.md`.
- `docs/INDEX.md` — rebuilt with a task-oriented routing table ("If I am performing X task, which documents should I read?") as the primary section; the original file-level reference table kept as a secondary section below it.
- `docs/DECISIONS.md` — added a Format section specifying the ADR template for future entries (Context / Decision / Alternatives Considered / Consequences / Follow-up Actions). The 6 existing ADRs were not rewritten, per instruction — they predate the template and lack the new "Alternatives Considered" field.
- `docs/ENGINEERING_GOVERNANCE_REVIEW.md` — added a header note establishing it as a point-in-time snapshot that should not be patched reactively; future reviews should be new dated sections/files, and staleness should be tracked in `TASKS.md` instead (which now has exactly that entry).
- `docs/CHANGELOG_AI.md` — this entry, plus the previously-missing Session 20 entry (added earlier in this same session) documenting the `AI_RULES.md` Definition of Done and `START_HERE.md` Completion Policy work, which had been reported via Mandatory Change Reports in-conversation but never synced to this file.

**Purpose:**
- The review that preceded this task found 8 concrete issues: `AI_CONTEXT.md` badly out of scope (historical/architecture/roadmap duplication), `HANDOFF.md` grown far beyond session-continuity, `TASKS.md`'s Completed section duplicating the changelog with no priority tiers, a **live** phantom-`users`-table bug still present in `ARCHITECTURE.md` despite being fixed elsewhere, a stale mid-refactor folder structure diagram, `INDEX.md` being file-indexed rather than task-indexed, `DECISIONS.md`'s ADR template missing "alternatives considered," and `ENGINEERING_GOVERNANCE_REVIEW.md` being patched reactively despite its own "not part of daily workflow" spec.
- The user's explicit constraint was "do NOT lose historical information — relocate instead of delete," which required verifying, for every piece of content removed from `AI_CONTEXT.md`/`HANDOFF.md`/`TASKS.md`, that the same fact already existed (or was freshly relocated) elsewhere before deleting it.

**Outcome:**
- Documentation-only change; no source files touched, so compilation/lint/build gates don't apply.
- Final validation performed: grepped every `docs/*.md` cross-reference (`ARCHITECTURE.md §N`, `AI_RULES.md §N`, file paths) to confirm none broke; confirmed `ARCHITECTURE.md`'s top-level section numbers (1–12) were undisturbed by the additions; confirmed no dangling reference to a section name removed from `AI_CONTEXT.md`/`HANDOFF.md` exists elsewhere (the only matches were `CHANGELOG_AI.md`'s own historical entries correctly describing past states in past tense); verified the actual `docs/` folder listing and root directory against the filesystem directly (`ls`) rather than trusting the existing diagram, which is exactly how the `AI_HANDOFF.md`-that-never-existed and the 2-already-deleted `PRODUCTION_AUDIT_REPORT*.md` entries were caught.
- Every document now has exactly one responsibility with no unnecessary duplication remaining between them (some deliberate, spec-required overlap remains between `AI_CONTEXT.md`'s and `HANDOFF.md`'s "Next Recommended Task" fields, since both are explicitly required by the user's own spec and the two docs are meant to be read together per `INDEX.md`'s "Resume work" routing row).

**Risks:**
- `ENGINEERING_GOVERNANCE_REVIEW.md`'s actual findings/ratings (9.2/10, dated 2026-07-03) are now confirmed stale given this refactor and several bug fixes since, but were deliberately left unedited per its own new point-in-time policy — flagged instead via the new `TASKS.md` backlog item. Treat that rating as historical, not current, until a fresh review is run.
- The 6 existing ADRs in `DECISIONS.md` lack "Alternatives Considered" and were not backfilled — acceptable per instruction, but means historical rationale for those 6 decisions is incomplete if ever needed.
- No automated check enforces "no duplication" or "diagram matches repository" going forward — this refactor was a manual, one-time correction. A lightweight periodic drift check (e.g. a script diffing `ARCHITECTURE.md`'s folder listing against the real `docs/`/`supabase/migrations/` contents) would catch this class of staleness earlier next time; not implemented today, out of scope.

---

## [2026-07-04] — Session 20: AI_RULES.md Definition of Done + START_HERE.md Completion Policy

**AI:** Claude Code (Anthropic)
**Task:** Two explicit user requests, landed together: (1) add a "Definition of Done" / Mandatory Change Report section to `AI_RULES.md`, (2) add a "Completion Policy" section to `START_HERE.md`.
**Files Modified:**
- `docs/AI_RULES.md` — added new §9 "Definition of Done & Mandatory Change Reporting": a 5-point completion gate tying "task complete" to a report being presented in-conversation, the exact report template (`# Status`/`# Severity`/.../`# Future Recommendations`), required-vs-optional reporting scope, and an "engineering communication" rule favoring completeness over brevity. Replaced the old 18-field report list embedded in §6 with a one-line pointer to §9 to avoid two competing templates in one document. Sections 1–8 otherwise untouched.
- `docs/START_HERE.md` — added a "Completion Policy" section stating the 4 completion conditions and pointing to `AI_RULES.md` §9 for the full template rather than duplicating it.

**Purpose:**
- Formalize a binding, structured end-of-task reporting requirement so no session (this AI or another) can silently stop after writing code without documenting what changed, why, how it was verified, and what risk remains.

**Outcome:**
- Documentation-only change; no source files touched.
- Both changes landed in a single commit (`dba53ad`) since `docs/START_HERE.md` was already staged before the `AI_RULES.md` commit was made — not a deliberate merge, just how the staging happened to land.

**Risks:** None.

---

## [2026-07-04] — Session 19: Remove Redundant Event Type Casts (14 Activity Files)

**AI:** Claude Code (Anthropic)
**Task:** User asked for improvements to the existing codebase without adding new features. Investigated the event-handling code across all activities, since `ARCHITECTURE.md` §8 documents "discriminated unions preferred over string literal checks with type coercion" as a coding standard.
**Files Modified:** all 14 files in `src/app/room/[code]/activities/` — `bingo-activity.tsx`, `coin-flip-activity.tsx`, `dice-activity.tsx`, `guess-number-activity.tsx`, `lucky-wheel-activity.tsx`, `name-draw-activity.tsx`, `never-have-i-ever-activity.tsx`, `rps-activity.tsx`, `team-maker-activity.tsx`, `tournament-activity.tsx`, `trivia-activity.tsx`, `truth-or-dare-activity.tsx`, `word-scramble-activity.tsx`, `would-you-rather-activity.tsx`.

**Purpose:**
- `ActivityEvent` in `src/lib/types.ts` is already a real discriminated union on `kind`, and `registerEventListener`'s callback parameter is correctly typed as `ActivityEvent` — so `switch (event.kind) { case "bingo_call": ... }` (or the equivalent `if` chains) already narrows `event` to the exact matching member type automatically, with no cast needed.
- Every one of the 14 activity files nonetheless did `const payload = event as { number: number }` (or similar) right after the narrowing check — completely redundant, and worse, a type-safety hazard: the inline anonymous shape is a hand-typed duplicate of the real type (e.g. `BingoCallEvent`) that TypeScript won't catch drifting out of sync if the real type changes later. This directly contradicted the documented coding standard while sitting right on top of the correctly-built discriminated union.

**Outcome:**
- `npm run typecheck` / `npm run lint` / `npm run build`: all pass, confirming TypeScript's narrowing works correctly without the casts.
- Zero behavior change — these were compile-time-only constructs; the emitted JS accessing `event.number` vs `payload.number` (where `payload = event`) is identical at runtime. No live testing needed for this reason; this is a type-safety-only cleanup.
- 14 files touched, net -28 lines.

**Risks:** None — purely removing dead/redundant type assertions; verified by the type checker itself, which is the authoritative check for this specific kind of change.

---

## [2026-07-04] — Session 18: HANDOFF.md Sync (End-of-Session)

**AI:** Claude Code (Anthropic)
**Task:** Bring `HANDOFF.md` up to date — it still described the pre-session "Dynamic UI Audio Integration" stopping point, missing this entire session's work (Sessions 11–17).
**Files Modified:**
- `docs/HANDOFF.md` — added a "Current Progress" bullet per Session 11–17 change; updated "Last Completed Task"; removed chat-pagination/mobile-viewport from "Roadmap Remaining Work" (both now done) and added the room settings panel item back in from `TASKS.md`; added a "Known verification gap" note under Verification Status covering the two changes that were only statically verified, not live-tested.

**Purpose:**
- `AI_RULES.md`'s End-of-Session Checklist (and now §8) requires the handoff doc to reflect the exact stopping point before a session ends — it had drifted several sessions behind.

**Outcome:** Documentation-only change.
**Risks:** None.

---

## [2026-07-04] — Session 17: AI_RULES.md — New "Context Optimization" Section

**AI:** Claude Code (Anthropic)
**Task:** Add a "Context Optimization" section to `AI_RULES.md` per explicit user request.
**Files Modified:**
- `docs/AI_RULES.md` — appended new §8 "Context Optimization" (selective reading over exhaustive reading; use `START_HERE.md`/`INDEX.md`; prefer summaries; don't re-read unchanged docs mid-session; keep docs concise/archived, with `CHANGELOG_AI.md` as the explicit append-only exception). Sections 1–7 left untouched, appended as a new final section rather than renumbering, per the user's "do not modify other sections unless necessary" instruction.

**Purpose:**
- Formalizes, as a binding rule rather than a one-off file, the selective-reading philosophy introduced in Session 16's `docs/START_HERE.md`/`docs/INDEX.md`.

**Outcome:**
- Documentation-only change; no source files touched.

**Risks:** None.

---

## [2026-07-04] — Session 16: New docs/START_HERE.md + docs/INDEX.md, Removed Conflicting Root Entry Point

**AI:** Claude Code (Anthropic)
**Task:** Create a lightweight `docs/START_HERE.md` per explicit user request (entry point directing readers to read only task-relevant docs, not everything).
**Files Modified:**
- `docs/START_HERE.md` (NEW) — explains the AI Engineering Workflow, states `docs/` is the source of truth, directs readers to `docs/INDEX.md` and to read selectively, points to `AI_RULES.md` for the engineering constitution (not duplicated here), and states the end-of-session documentation-sync requirement. Kept under one page per the request.
- `docs/INDEX.md` (NEW) — one-line-per-file lookup table for every doc in `docs/`, created because `START_HERE.md` needed something concrete to point readers to for "read only what's relevant."
- `START_HERE.md` (DELETED, project root) — the root file from Session 8 told readers to read all 7 docs "in order" before writing any code, directly contradicting the new `docs/START_HERE.md`'s "read only what's relevant" instruction. Flagged the conflict to the user, who chose deletion over keeping both or redirecting.

**Purpose:**
- User explicitly requested this file with a specific philosophy (selective reading over exhaustive reading) different from the existing root entry point.

**Outcome:**
- Single, unambiguous entry point now exists at `docs/START_HERE.md`.
- No other files reference the deleted root `START_HERE.md` except `CHANGELOG_AI.md`'s own Session 8 entry, which is append-only and correctly reflects what existed at that time — left untouched.

**Risks:** None — documentation only.

---

## [2026-07-04] — Session 15: ER Diagram + Corrected Phantom `users` Table

**AI:** Claude Code (Anthropic)
**Task:** Add the Mermaid ER diagram requested in `ENGINEERING_GOVERNANCE_REVIEW.md` and `TASKS.md`.
**Files Modified:**
- `docs/ARCHITECTURE.md` — added §12 (Mermaid ER diagram) generated directly from all 8 migration files; fixed the folder-structure listing, which was missing `0008_create_activity_prompts.sql`.
- `docs/AI_CONTEXT.md` — corrected the "Database Status > Tables" list, which claimed a `users` table (username/avatar_url/xp/rank) that does not exist anywhere in the schema; those columns are actually on `room_participants` directly. Also corrected the "Primary key for rooms" note: `id` (uuid) is the literal PK, but `code` is what every foreign key and query actually targets.
- `docs/ENGINEERING_GOVERNANCE_REVIEW.md` — closed its own "ER Diagram" backlog item, which had inherited the same incorrect `users`-table assumption.

**Purpose:**
- Before drawing a diagram, verified the actual schema by running `grep "create table" supabase/migrations/*.sql` directly rather than trusting `AI_CONTEXT.md`'s existing table list — which is exactly how the phantom `users` table was caught. Only 4 tables actually exist: `rooms`, `room_participants`, `chat_messages`, `activity_prompts`.

**Outcome:**
- Documentation-only change, no source files touched, so the compilation/lint/build gates don't apply here.
- ER diagram documents the two real foreign keys (`room_participants.room_id` / `chat_messages.room_id` → `rooms.code`, NOT `rooms.id`), the `replica identity full` requirement for realtime DELETE events, and the client-generated chat message ID pattern from ADR-005.

**Risks:** None — documentation only.

---

## [2026-07-04] — Session 14: Message ID Generation (Judgment Call, Not Literal Debt Item)

**AI:** Claude Code (Anthropic)
**Task:** Close the "Message ID Generation" debt item in `TASKS.md`.
**Files Modified:**
- `src/app/room/[code]/room-client.tsx` — `generateUUID()`: added a `crypto.getRandomValues()`-based path between the `crypto.randomUUID()` fast path and the `Math.random()` last resort.

**Purpose:**
- The debt item as literally written proposed migrating to "native database UUID serialization" when browser APIs fail. Investigated first: `msg.id = generateUUID()` is generated client-side specifically so it can be used for the optimistic local render *and* passed explicitly to the `chat_messages` insert (`id: msg.id`) — this is ADR-005's fix for a duplicate-message bug caused by client/DB ID mismatches. If the database generated the ID instead, the client wouldn't know the real ID until the insert round-trip returned, breaking optimistic rendering and reintroducing exactly the bug ADR-005 fixed.
- Chose not to implement the literal suggestion for this reason. Instead made the actual improvement available without an architecture change: the existing fallback (used only when `crypto.randomUUID()` is unavailable, i.e. non-secure/non-HTTPS contexts) used `Math.random()`, which isn't cryptographically random. Swapped it for `crypto.getRandomValues()`, which has broader support than `randomUUID()` and is real entropy.

**Outcome:**
- `npm run typecheck` / `npm run lint` / `npm run build`: all pass.
- Verified the new fallback path directly: ran the exact logic in Node with `crypto.webcrypto`, generated 10 UUIDs, all matched a strict UUIDv4 regex (correct version/variant nibbles).
- In practice this fallback path is rarely hit at all — `crypto.randomUUID()` has near-universal support in any HTTPS deployment (Vercel and equivalent hosts serve HTTPS by default) since 2021-2022 across all major browsers.

**Risks:** None — the fast path (`crypto.randomUUID()`) is unchanged; only the rarely-hit fallback was upgraded, and it was verified independently before landing.

---

## [2026-07-04] — Session 13: Mobile Viewport Audit

**AI:** Claude Code (Anthropic)
**Task:** Audit Lucky Wheel, Bingo, and Tournament for mobile/small-screen layout bugs (per the `TASKS.md` debt item).
**Files Modified:**
- `src/app/room/[code]/activities/tournament-activity.tsx` — match row span: added `min-w-0 break-words`; sibling `Badge`: added `shrink-0`.

**Purpose:**
- The debt item bundled three games together, but only one was actually broken. Lucky Wheel uses a fixed `w-64 h-64` (256px) wheel with `max-w-[70px] truncate` on entry labels — safely fits any phone viewport. Bingo uses fixed `w-11 h-11` (44px) cells × 5 columns — total card width ~260px, also safe. Tournament's match rows joined all member names into a single string (`round.members.join(" vs ")`) inside a `flex items-center gap-3` row with no `min-w-0`/wrap — flex items default to `min-width: auto`, so two moderately long usernames could force the row wider than the viewport, causing horizontal overflow on narrow screens.
- Swept every other room activity for the same `.join(...)`-into-unconstrained-span pattern; none found (team-maker maps members individually; rps shows one username at a time — an existing, uniform, lower-risk pattern used across the whole app, not a localized bug).

**Outcome:**
- `npm run typecheck` / `npm run lint` / `npm run build`: all pass.
- Not live-tested at actual mobile viewport widths (would require a live room + a real device/emulator session); the fix is a standard, low-risk Tailwind flexbox correction (`min-w-0` + `break-words` is the conventional fix for this exact overflow class).

**Risks:** None — additive CSS-only change, no logic touched.

---

## [2026-07-04] — Session 12: Chat Pagination

**AI:** Claude Code (Anthropic)
**Task:** Implement "Load older messages" for room chat, closing the `TASKS.md` debt item.
**Files Modified:**
- `src/app/room/[code]/room-client.tsx`:
  - Added `hasMoreMessages` / `loadingOlderMessages` state and a `chatScrollContainerRef` ref.
  - Initial `loadMessages` effect now sets `hasMoreMessages` based on whether a full page (100) was returned.
  - New `loadOlderMessages` callback: queries `chat_messages` with `.lt("created_at", oldestLoadedMessage.created_at)`, descending, limit 50; prepends results; restores scroll position via `requestAnimationFrame` using the viewport's `scrollHeight` delta.
  - Added a "Load older messages" button above the message list, shown only while `hasMoreMessages` is true.

**Purpose:**
- Previously the chat only ever fetched the most recent 100 messages on mount with no way to see anything older — in an active/long-running room, earlier messages became permanently unreachable on rejoin.

**Outcome:**
- `npm run typecheck` / `npm run lint` / `npm run build`: all pass.
- **Not live-tested.** Chat pagination requires a real Supabase connection (no BroadcastChannel fallback exists for chat), and this sandbox cannot reach the live Supabase project, nor can a second dev-server instance be started in this directory without stopping the user's already-running server (Next.js enforces a single-instance lock per project directory). Verified via static analysis, typecheck/lint/build, and by matching an established scroll-preservation pattern — not via an actual click-through.

**Risks:**
- The `.lt()` cursor doesn't disambiguate messages sharing the exact same millisecond timestamp — accepted as a low-probability edge case rather than adding a compound cursor, per the KISS/YAGNI principle in `AI_RULES.md`.
- Scroll-position restoration assumes the `[data-slot="scroll-area-viewport"]` DOM structure inside `@base-ui/react`'s `ScrollArea` — if that internal structure changes in a future dependency bump, the scroll-restore silently no-ops (falls back to `viewport` being `null`) rather than crashing, but should be re-verified after any `@base-ui/react` upgrade.

---

## [2026-07-04] — Session 11: Security Fix, CI/Node Bump, Dependabot, Word Scramble UX Fix

**AI:** Claude Code (Anthropic)
**Task:** Redact a leaked DB credential, close CI deprecation warning, add dependency auditing, fix a silent-failure UX bug found via user report.
**Files Modified:**
- `docs/AI_CONTEXT.md` — redacted a committed live Postgres connection string (plaintext password, matching the live `.env.local` project ref); added a "Recent Session Notes" entry documenting the fix
- `.github/workflows/ci.yml` — `node-version: 20` → `22` (GitHub Actions deprecated Node 20 runners)
- `package.json` / `package-lock.json` — added `engines.node: ">=20.9.0"` (matches Next.js's own actual minimum)
- `.github/dependabot.yml` (NEW) — weekly npm + github-actions dependency update PRs
- `src/app/tools/word-scramble/page.tsx`, `src/app/room/[code]/activities/word-scramble-activity.tsx` — added `toast.error("Not quite — try again!")` on a wrong guess (previously silent apart from an easily-missed sound cue), matching the existing `toast` pattern already used in `lucky-wheel-activity.tsx`
- `README.md` — restructured with a table of contents; corrected stale "11 tools" count to 14; added the `activities/` folder to the documented project structure
- `.vscode/settings.json` (NEW) — file-nesting config for the Explorer sidebar (cosmetic only)

**Purpose:**
- The leaked connection string is a real, live credential in a public repo — highest priority per the Security decision-priority rule in `AI_RULES.md`.
- CI was silently running on a forced Node 24 override with a deprecation warning; pinning explicitly avoids drift.
- No automated dependency scanning existed (flagged as a gap in `ENGINEERING_GOVERNANCE_REVIEW.md`).
- User reported "word scramble does nothing when I submit" — traced to a real bug (no visual feedback on wrong guesses), not a UX misunderstanding (bingo was separately verified as working correctly via live Playwright testing).

**Outcome:**
- Credential redacted and pushed; **rotation of the actual Supabase database password still requires manual action in the Supabase dashboard — not something an AI assistant can do.**
- `npm run typecheck` / `npm run lint` / `npm run build`: all pass.
- Word Scramble fix live-verified in the standalone page via Playwright (toast appears on wrong guess); the room-activity version was not live-tested this session because Next.js's dev-server lock prevented running an isolated second instance without stopping the user's own running dev server — the fix is an identical 3-line change to the already-verified pattern.

**Risks:**
- The leaked password must still be rotated by the user; this session's fix only prevents further exposure from the current file state, it does not undo prior exposure.
- Word Scramble room-activity fix is unverified live (see above) — low risk given it mirrors a proven pattern, but flagged for honesty per `AI_RULES.md` verification requirements.

---

## [2026-07-03] — Session 10: Dynamic UI Audio Integration & Premium Sound Effects
**AI:** Antigravity (Google DeepMind)
**Task:** Expose soundEnabled state in Stable Context, add volume toggle control in the Room Header, and play real-time synthesized audio feedback across modular games.
**Files Modified/Created:**
- `src/app/room/[code]/context/room-activity-context.tsx` — Exposed `soundEnabled: boolean` inside room activity Stable Context interface
- `src/app/room/[code]/room-client.tsx` — Initialized local sound toggle state (saving/loading preferences asynchronously from `localStorage` to avoid Next.js hydration anomalies) and rendered a mute/unmute header trigger button
- `src/app/room/[code]/activities/coin-flip-activity.tsx` — Triggered `playCoinFlip` and `playTick` audio feedback on flipping events
- `src/app/room/[code]/activities/dice-activity.tsx` — Triggered `playDiceRoll` and `playTick` audio feedback on rolling actions
- `src/app/room/[code]/activities/truth-or-dare-activity.tsx` — Triggered `playSwipe` on card draw broadcasts
- `src/app/room/[code]/activities/would-you-rather-activity.tsx` — Triggered `playSwipe` on new prompts and `playPop` on vote submissions
- `src/app/room/[code]/activities/never-have-i-ever-activity.tsx` — Triggered `playSwipe` on prompts and `playPop` on confessions
- `src/app/room/[code]/activities/word-scramble-activity.tsx` — Triggered `playSwipe` on new scrambled words, `playSuccess` on winner selections, and `playFailure` on local incorrect guesses
- `src/app/room/[code]/activities/lucky-wheel-activity.tsx` — Triggered `playSwipe` on spins and `playSuccess` on target selections
- `src/app/room/[code]/activities/trivia-activity.tsx` — Triggered `playSwipe` on questions, `playPop` on others' answers, `playSuccess` on correct player answers, and `playFailure` on incorrect player choices

**Purpose:**
- Provide premium Web Audio API synthesized sound feedback to multiplayer room games to match the single-player tool pages.
- Deliver cross-client synchronized audio cues on game progression steps.
- Give participants full local control to mute/unmute room audio feeds.

**Outcome:**
- Highly responsive sound feedback added across all 8 live activity components.
- Persistent user mute controls enabled.
- All quality gates (linting, typechecking, production compile) successfully verified.

**Risks:** None.

---

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

