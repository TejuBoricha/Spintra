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

## [2026-07-04/05] — Session 37: Pre-Launch Product Readiness Audit + Critical/High Fixes

**AI:** Claude Code (Anthropic)
**Task:** User asked for a full Product Readiness Audit of the entire repository (functional completeness, integration gaps, state management, database/RLS security, architecture, UX, performance, security, docs) as if about to launch publicly, then asked to fix the Critical and High severity findings.

**Audit method:** 4 parallel deep-dive research passes (user flows & integration, database/RLS/security, state management & architecture, UX/performance & docs drift), synthesized into a severity-ranked report (33 findings: 1 Critical, 6 High, 11 Medium, 15 Low) delivered as an Artifact. Full findings are recorded in `TASKS.md`'s High/Medium/Low tiers; only the fixes are detailed here.

**Fixed (High):**
- **Room creation silent failure** (`create-client.tsx`): any Supabase insert error other than rate-limiting used to fall back to a local-only room that looked shareable but wasn't. Now hard-stops with a clear error on any failure.
- **Kick not enforced in demo mode + ban not checked pre-entry** (new `src/lib/room-bans.ts`, `use-room-subscription.ts`, `room-client.tsx`): kicking in demo mode only broadcast a transient message — a kicked user could reload and rejoin instantly. Now persists a per-room ban in localStorage, checked the same way Supabase mode's `room_bans` table is. Also moved the ban check (both modes) into the pre-entry gate so it happens before the room UI mounts, instead of after a confusing flash. Required migration `0013_room_bans_self_select.sql` (a self-scoped select policy — `room_bans` had no select policy at all, so the client could never check its own ban status), applied to the live Supabase project.
- **Demo-mode sharing has no cross-device warning** (`room-header.tsx`, `room-client.tsx`): the QR dialog and copy-link toast now explicitly warn when running in demo mode, instead of relying solely on a small header badge.
- **Sidebar toggle rebuilding the entire realtime channel** (`room-client.tsx`): `addIncomingMessage`'s callback depended on `showParticipants`/`isMobileSidebarOpen` directly, giving it a new identity on every sidebar toggle and tearing down/rebuilding the whole Supabase channel (missed events during the gap). Fixed by reading those values from refs instead.
- **Light mode "broken across most screens"** — investigated, not blindly trusted. Screenshotted 5 pages in light mode (Explore, Trivia, Would-You-Rather, Tournament, Team Maker) and found the pages already render correctly: `globals.css` has a pre-existing `.light` CSS override layer (`.light .text-white`, `.light [class*="border-white/"]`, etc., with careful gradient-button exceptions) that already neutralizes this class of bug app-wide. The audit's "High" call was a static-analysis false positive that didn't check for runtime CSS overrides. Still applied a token-consistency cleanup (hardcoded `text-white`/`bg-white/`/`border-white/` → `text-foreground`/`bg-muted`/`border-border`) across ~10 files where it was genuine page content, since it's more maintainable than relying on the blanket `!important` CSS layer — but this was downgraded from a bug fix to a cleanup pass.

**Fixed (Critical):**
- **Multiplayer Tournament rooms could never finish a tournament.** The room activity only generated one flat round of random pairings with no scoring, advancement, or winner, while the standalone `/tools/tournament` page already had a complete single/double-elimination, round-robin, and Swiss engine (including the Session 33 double-elimination fix). Extracted that engine into `src/lib/tournament-engine.ts` (types, generators, and `recordMatchResult` — a pure port of `handleScoreSave`'s state transition) so both the standalone tool and the room activity share one implementation of the trickiest part. Refactored `src/app/tools/tournament/page.tsx` to use it (verified identical behavior via the existing `tests/tournament-double-elimination.spec.ts`, unchanged and still passing). Built a new `src/app/room/[code]/activities/tournament-activity.tsx` on the same engine: host picks a format, generates a bracket from whoever's online, and every action broadcasts via a new `tournament_update` `ActivityEvent` using the room's existing `sendActivityEvent`/`registerEventListener` pattern. Functionally verified end-to-end across two independent browser sessions against the live Supabase project — bracket generation, realtime sync, score recording, and champion declaration all propagate correctly to every participant.

**Verification:** typecheck, lint, build, and the full E2E suite (smoke + tournament specs) all green after every change. The Tournament port was additionally verified live (not just via existing tests) with a two-browser-context Playwright script against the real Supabase project, since it's new functionality the existing test suite doesn't cover.

**Post-push CI catch:** the pushed Tournament-fix commit failed real CI on the Documentation Drift Check — not the usual Windows-CRLF false positive (which was mistakenly assumed at first), but a genuine gap: migration `0013` (added earlier this session) had never been added to `ARCHITECTURE.md`'s Migrations Applied table. Also discovered during the investigation that the established "just reproduce via a fresh git clone" verification method was itself unreliable on this machine — `core.autocrlf=true` smudges CRLF back in on *any* checkout/clone/archive operation, not just the primary working tree. `git show HEAD:<path>` (raw blob, no smudge filter) is the only trustworthy way to inspect exactly what a Linux CI checkout sees. Fixed the table and re-verified via that method before pushing again.

**Deferred / documented, not fixed this session:** the fundamental rate-limit/ban bypass via anonymous-session rotation (accepted architectural trade-off, now explicitly documented in `AI_CONTEXT.md`'s Known Issues rather than silently assumed solved), and all 11 Medium + 15 Low findings (recorded in `TASKS.md` for a future pass).

## [2026-07-04] — Session 36: Legal Page Placeholders Filled In

**AI:** Claude Code (Anthropic)
**Task:** The Terms of Service and Privacy Policy pages (Session 30) shipped with bracketed placeholders for the operating entity, jurisdiction, and contact email — flagged repeatedly since as an outstanding gap before real public launch. User provided the real values.
**Files Modified:**
- `src/app/legal/terms/page.tsx` — entity → "Tejas Gogara", jurisdiction → "India", contact email → `tejasboricha225@gmail.com`.
- `src/app/legal/privacy/page.tsx` — same entity, and both the data-access-request contact and general contact → `tejasboricha225@gmail.com`.

**Purpose:** Close the last flagged gap in the "Legal Basics" pre-launch item. Confirmed with the user that a sole individual (not a registered company) is a legally valid operator for a Terms of Service/Privacy Policy at this scale — formalizing into an LLC or similar is a "when it matters" decision (revenue, real legal risk), not a launch prerequisite.
**Note:** the user's initial privacy-contact email had a likely typo (`@hmail.com`); flagged it and confirmed the intended address (`@gmail.com`, same as the support email) before using it, rather than shipping an unreachable contact address.

**Outcome:** No placeholders remain in either legal page (verified via `grep -n '\[.*\]'` returning no matches). `typecheck` and `lint` pass. Committed as `e5910a1` and pushed to `origin/main`.
**Risks:** None — text-only change, not reviewed by legal counsel (acceptable for a solo/hobby-scale project; worth a real review if the site starts handling payments or scales up significantly).

## [2026-07-04] — Session 35: Dependabot PR Review & Triage

**AI:** Claude Code (Anthropic)
**Task:** User asked to review and merge the repo's 5 open pull requests. All 5 were Dependabot-authored (not user work): 4 GitHub Actions version bumps (`checkout` 4→7, `setup-node` 4→6, `cache` 4→6, `upload-artifact` 4→7) plus one bundled PR with 16 npm package updates.
**Investigation path:**
- All 5 PRs initially showed a failing `validate` (CI) check. Confirmed via `git merge-base --is-ancestor` that their base commit was 27 commits behind `main` — a staleness artifact, not a real regression, since `main`'s own latest CI run was green.
- Posted `@dependabot rebase` comments on all 5 PRs via the GitHub API (using the credential already stored by `git credential fill` for `github.com` — the same one used for `git push` all session) to refresh them against current `main`, then polled `check-runs` until each resolved.
- The 4 Actions-only bumps came back fully green after rebasing and were squash-merged via the API (`PUT /pulls/{n}/merge`).
- The 16-package bundle (`#16`) still failed lint after rebasing. Checked out the PR branch into a separate `git worktree` (kept `main`'s working tree undisturbed), ran `npm install` and `npm run lint` directly: ESLint crashed with `TypeError: contextOrFilename.getFilename is not a function` inside `eslint-plugin-react` (bundled inside `eslint-config-next`), which still calls a context method ESLint 10 removed.
- Diffed `package.json` and isolated the single breaking change: `eslint: ^9 → ^10`. `typescript: ^5 → ^6` and the other 14 bumps were unaffected (typecheck had already passed in CI even under `typescript ^6`).

**Files Modified:**
- `package.json`, `package-lock.json` — applied all 15 safe updates from PR #16 directly to `main` (Next.js 16.2.9→16.2.10, React 19.2.4→19.2.7, `@supabase/supabase-js`, `@tanstack/react-query`, `framer-motion`, `lucide-react`, `three`/`@types/three`, `shadcn`, `@types/node` ^20→^26, `typescript` ^5→^6, `eslint-config-next` 16.2.9→16.2.10). Held `eslint` at `^9`.

**Purpose:** Get the routine, safe dependency maintenance merged without blindly accepting an upstream-incompatible major bump that would have broken `npm run lint` (and therefore CI) on `main`.

**Outcome:**
- Merged: PR #6, #5, #4, #3 (GitHub Actions bumps) — squash-merged into `main`.
- PR #16 closed as superseded (commented with the root-cause explanation) after manually applying its safe subset as commit `b429a16`, verified locally end-to-end before pushing: `npm run verify` (typecheck + lint + docs:check), `npm run build`, and `CI=true npx playwright test tests/smoke.spec.ts` — all green.
- The `eslint ^9 → ^10` bump remains outstanding, blocked upstream on `eslint-config-next`/`eslint-plugin-react` shipping ESLint 10 support. Dependabot will re-propose it once compatible.

**Risks:** None identified — all merged changes verified against the full local `verify`/`build`/E2E pipeline before pushing, matching exactly what CI runs.

## [2026-07-04] — Session 34: Demo-Mode Room Activity Never Auto-Activated

**AI:** Claude Code (Anthropic)
**Task:** After pushing Sessions 30–33, the user asked to check the resulting CI run. It failed again — this time on `tests/smoke.spec.ts`, not the tournament test. Investigated rather than assuming the previous fix was incomplete.
**Investigation path:**
- Confirmed via the GitHub API (`check-runs` + `annotations` endpoints — full log download requires admin rights even on a public repo, so this was the practical ceiling) that `typecheck`/`lint`/`docs:check`/`build` all passed; only "Execute Playwright E2E Smoke Tests" failed.
- Reproduced by matching CI's actual conditions exactly rather than my own local setup: moved `.env.local` aside (CI has never had Supabase secrets configured — nothing in `ci.yml` sets `NEXT_PUBLIC_SUPABASE_*`) and ran with `CI=true` (this flips Playwright's `reuseExistingServer` to `false`, forcing a fresh `next build && next start`, matching the workflow's `webServer` config exactly).
- This reproduced the failure locally: `smoke.spec.ts` failed, `tournament-double-elimination.spec.ts` passed.
- **Checked whether this was a regression from Sessions 30–33 or pre-existing**: checked out the original `700dfcc` commit (before any of my changes) and ran the identical no-Supabase reproduction — both tests failed there too. This confirmed the tournament bug (Session 33) was real and now fixed, but a *second*, wholly unrelated, pre-existing bug in the room/activity initialization path has apparently never been caught by CI before (local development always had `.env.local` present, masking it).
**Root cause found:** `loadRoomDetails` in `src/app/room/[code]/hooks/use-room-subscription.ts` returned immediately when Supabase isn't configured (`if (!supabaseClient) return;`), so `activeActivity` was never set from the room's type in demo/`BroadcastChannel` mode — the room was stuck on the idle "choose an activity" screen instead of the game it was created for. Confirmed via a Playwright script dumping `localStorage`: `create-client.tsx` already writes `spintra-room-type-{code}` and `spintra-room-name-{code}` specifically for this purpose, but nothing ever read them back.
**Files Modified:**
- `src/app/room/[code]/hooks/use-room-subscription.ts` — `loadRoomDetails`'s demo-mode branch now reads `spintra-room-type-{code}`/`spintra-room-name-{code}` from `localStorage` and sets `roomName`/`roomType`/`activeActivity` accordingly, mirroring the Supabase-backed path's logic (skips auto-activation for `party`/`classroom` room types, same as the DB path).

**Outcome:**
- Reproduced both under no-Supabase (`CI=true`, `.env.local` removed) and with Supabase configured: both smoke tests pass in both modes now.
- `npm run typecheck`, `npm run lint`, `npm run build` all clean under both conditions.

**Risks:** None identified — purely additive fallback logic; the Supabase-backed path is untouched.

---

## [2026-07-04] — Session 33: Double-Elimination Tournament Bracket Fix

**AI:** Claude Code (Anthropic)
**Task:** The user shared a screenshot of a failed GitHub Actions CI run for the previously-pushed docs commit (`700dfcc`) and asked what it was. Investigated rather than guessing.
**Investigation path (two false positives before the real cause):**
1. `docs:check` appeared to fail locally ("Could not find the folder structure code block in ARCHITECTURE.md §2") — traced to Windows `core.autocrlf=true` converting the file to CRLF on local checkout; the actual committed git blob is LF-only and matches the checker's regex fine. Confirmed by reading the raw blob via `git show HEAD:docs/ARCHITECTURE.md` in Node and testing the regex directly against those bytes (passed).
2. A stale `.next/dev/types/validator.ts` (left over from earlier `npm run dev` sessions testing the now-stashed `/legal/*` pages) caused a false typecheck error referencing routes that don't exist in the pushed commit. Cleared with `rm -rf .next`.
3. The real failure: `tests/tournament-double-elimination.spec.ts` timed out waiting for "Tournament Champion" to appear.
**Root cause found:** In `src/app/tools/tournament/page.tsx`'s `handleScoreSave`, completing a match *inside the losers bracket* computed `updatedBracket` (correctly marking that match `completed`) but then discarded it — rebuilding `lb` from the stale, pre-update `tournament.losersBracket` before calling `advanceInLosersBracket`. Net effect: the winner correctly advanced to the next round, but the just-played match itself never got marked `completed`, so it stayed "playable" forever and the bracket could never finish. Winners-bracket matches were unaffected (separate code path in the same function), which is why it wasn't obvious from casual play-testing.
**Files Modified:**
- `src/app/tools/tournament/page.tsx` — the losers-bracket branch of `handleScoreSave` now builds `lb` from `updatedBracket` (which already has the just-played match marked completed) instead of a fresh copy of stale `tournament.losersBracket`.
- `docs/TASKS.md`, `docs/CHANGELOG_AI.md` — this entry.

**Outcome:**
- Reproduced the exact CI failure locally by stashing all other uncommitted work and testing against the precise commit that was pushed (`git stash push -u`, ran the CI steps in order, `git stash pop` afterward — confirmed clean restoration).
- Wrote a debug Playwright script that played through the bracket round-by-round, dumping every match's `data-match-status`/`data-match-ready` attributes after each play — this is what surfaced the exact "losers-bracket match never transitions to completed" symptom.
- After the fix: `npm run test:smoke` — both tests pass, including the previously-failing one (now resolves in 4.4s vs. the prior 9.5s timeout). `npm run typecheck` and `npm run build` also clean.

**Risks:** None identified — this is a targeted fix to a proven, reproduced bug, verified by the same E2E test that caught it.

---

## [2026-07-04] — Session 32: Abuse & Moderation Controls (Ban-on-Kick, Report, Block, Chat Filter)

**AI:** Claude Code (Anthropic)
**Task:** Implement the third item of the High Priority "pre-launch hardening" tier: abuse and moderation controls.
**Correction made during investigation:** `TASKS.md`'s original wording ("a host has no way to remove a bad actor") was wrong — kick already existed (`room-sidebar.tsx`'s `UserX` button, `handleKickParticipant` in `use-room-subscription.ts`). The real gap: a kicked user could immediately rejoin the same room. Scoped this task around the actual gap, not the stale description.
**Files Modified/Created:**
- `supabase/migrations/0012_moderation_controls.sql` (NEW) — `room_bans` table + `before insert on room_participants` trigger (`check_room_ban_before_join`, mirrors `0009`/`0011`'s pattern) rejecting a rejoin from a banned `user_id`; `message_reports` table, insert-only (no select policy — reviewed via Supabase SQL editor, consistent with no admin backend).
- `src/lib/blocked-users.ts` (NEW) — `localStorage`-based per-viewer block/mute list (`spintra-blocked-users` key), no DB involved.
- `src/lib/chat-filter.ts` (NEW) — `getChatContentViolation()`: basic profanity/slur blocklist + repeated-character spam heuristic (`(.)\1{6,}`).
- `src/lib/supabase/database.types.ts` — added `room_bans` and `message_reports` table types (required for typecheck against the hand-maintained Supabase types mirror).
- `src/app/room/[code]/hooks/use-room-subscription.ts` — `handleKickParticipant` now also inserts a `room_bans` row (best-effort, doesn't block the kick on failure); join-flow (`trackSelf`) error handling now detects a ban rejection and shows a specific toast.
- `src/app/room/[code]/hooks/use-room-chat.ts` — `sendMessage` now runs `getChatContentViolation()` before sending; added `reportMessage()` (inserts into `message_reports`, one report per message per reporter, tracked via a ref to avoid duplicates).
- `src/app/room/[code]/components/room-sidebar.tsx` — added a Report (flag icon) button on each non-own chat message; added a Block/Unblock button on each non-self participant (available to everyone, not just the host, distinct from the host-only Remove button); messages from blocked users are filtered out of the rendered list.
- `src/app/room/[code]/room-client.tsx` — threads `reportMessage` from the chat hook through to `RoomSidebar`.
- `docs/TASKS.md`, `docs/ARCHITECTURE.md` (migrations table, ER diagram, RLS summary, folder structure), `docs/AI_CONTEXT.md`, `docs/HANDOFF.md` — synced.

**Purpose:**
- Closes the rejoin gap on kick, and adds the report/block/filter tools the backlog named — none of which existed before this session.

**Outcome:**
- `npm run verify` (typecheck, lint, docs-drift) passes cleanly.
- Verified end-to-end against the real UI with a headless Playwright script driving two isolated browser contexts (host + guest): profanity ("you are a fucking idiot") and spam ("aaaaaaaaaaaaaaaa") both correctly rejected client-side before send; a normal message sends fine; the host's Report button click completes without crashing; Block hides the guest's messages from the host's view, Unblock restores them; Kick still succeeds and the guest is redirected to `/explore`.
- **Bug found and fixed during this testing**: the profanity regex was `\b(word)\b` (leading and trailing word boundary), which meant inflected forms like "fucking" never matched, since there's no boundary between "fuck" and "ing". Fixed to `\b(word)` (leading boundary only) so common inflections are caught too.
- **The migration has NOT been applied to the live Supabase project** (confirmed via the test run: both the `room_bans` insert and the `message_reports` insert returned `PGRST205 — Could not find the table`, logged and handled gracefully — kick still succeeded, reporting showed a clear error toast). Same manual step needed as `0011`.

**Risks:**
- The profanity blocklist is a basic, easily-bypassed first pass (no leetspeak/spacing detection) — a known, documented limitation, not a claim of robust moderation.
- Bans are permanent-until-manually-cleared (no un-ban UI yet — would require a direct SQL delete from `room_bans`). Considered building temporary bans / an un-ban UI but deferred as unnecessary v1 complexity.

**Addendum (same day) — CLI linked, migration applied live:** The user asked whether Docker could be installed to let the AI self-apply migrations. Explained that Docker only enables local testing, not pushing to the live project — that needs Supabase CLI auth, which Docker doesn't provide. Instead: user ran `supabase login` once (one-time browser OAuth); the AI ran `supabase init` (created `supabase/config.toml` + `supabase/.gitignore`), `supabase link --project-ref qjxaehxwuqntyqrdmihs`, discovered the remote migration-history table only recognized `0004-0007` as applied (everything else, `0001-0003`/`0008-0011`, was originally applied by hand via the SQL Editor across earlier sessions and never recorded), repaired that history with `supabase migration repair --status applied 0001 0002 0003 0008 0009 0010 0011 --linked` (metadata-only, no SQL executed), then pushed `0012` with `supabase db push --linked --yes`. Re-verified live with a headless Playwright script driving the real production database: message reporting succeeds, kick succeeds, and rejoining after a kick is now correctly blocked with "You have been banned from this room by the host." **Going forward, future migrations can be pushed directly via `supabase db push --linked --yes` — no more manual SQL Editor paste needed.**

---

## [2026-07-04] — Session 31: Rate Limiting on Room Creation & Chat Messages

**AI:** Claude Code (Anthropic)
**Task:** Implement the second item of the High Priority "pre-launch hardening" tier: DB-level rate limiting on room creation and chat message sending.
**Files Modified/Created:**
- `supabase/migrations/0011_rate_limiting.sql` (NEW) — before-insert triggers on `rooms` (8 rooms / 10 min per `host_id`) and `chat_messages` (20 messages / 10 sec per `user_id`), plus supporting composite indexes (`rooms_host_id_created_at_idx`, `chat_messages_user_id_created_at_idx`). Mirrors migration `0009`'s `check_room_limit_before_join` trigger pattern exactly (security definer, count + `raise exception`).
- `src/app/create/create-client.tsx` — `handleCreate`'s catch block now detects a rate-limit rejection (`error.message` containing "rate limit exceeded") and hard-stops with an error toast, instead of falling through to the existing "create locally, sync failed" degraded-mode path (which would have silently pushed the user into a room that was never persisted).
- `src/app/room/[code]/hooks/use-room-chat.ts` — `sendMessage`'s catch block now rolls back the optimistically-added chat message and restores the typed text on any insert failure (previously there was no rollback at all, leaving a "phantom message" visible only to the sender), and shows the specific rate-limit message when applicable.
- `docs/TASKS.md`, `docs/ARCHITECTURE.md` (migrations table + RLS summary), `docs/AI_CONTEXT.md`, `docs/HANDOFF.md` — synced

**Purpose:**
- No throttling existed on room or message creation; the RLS policies only verify `auth.uid()` ownership, not volume, leaving the app open to anonymous-session spam once public.

**Outcome:**
- `npm run verify` (typecheck, lint, docs-drift) passes cleanly.
- **The migration has NOT been applied to the live Supabase project.** No Supabase CLI session (`supabase login`/`link`) or Docker was available in this environment to push or integration-test it. The SQL was hand-verified against migration `0009`'s proven pattern but was not executed against a real Postgres instance. The user must apply it via the Supabase Dashboard SQL Editor or `supabase db push` before it takes effect.

**Risks:**
- Threshold values (8 rooms/10 min, 20 messages/10 sec) are a judgment call, not empirically tuned — may need adjustment based on real usage patterns after launch.

**Addendum (same day):** The user applied `0011_rate_limiting.sql` to the live Supabase project via the Dashboard SQL Editor and confirmed "Success. No rows returned" — rate limiting is now active in production.

---

## [2026-07-04] — Session 30: Legal Basics (Terms of Service, Privacy Policy, Cookie Consent)

**AI:** Claude Code (Anthropic)
**Task:** Implement the first item of the High Priority "pre-launch hardening" tier: a Terms of Service page, a Privacy Policy page, and a global cookie/consent notice.
**Files Modified/Created:**
- `src/app/legal/terms/page.tsx` (NEW) — static RSC Terms of Service page
- `src/app/legal/privacy/page.tsx` (NEW) — static RSC Privacy Policy page
- `src/components/cookie-consent-banner.tsx` (NEW) — client component, `localStorage`-gated (`spintra-cookie-consent`), links to `/legal/privacy`
- `src/components/providers.tsx` — mounts `CookieConsentBanner` globally inside `TooltipProvider`
- `src/app/page.tsx` — added "Terms" and "Privacy" links to the homepage footer
- `docs/TASKS.md`, `docs/ARCHITECTURE.md`, `docs/AI_CONTEXT.md`, `docs/HANDOFF.md` — synced

**Purpose:**
- The site collects real (if anonymous) user data — chat messages, profile fields, session IDs — with no governing policy, and the user confirmed intent to publish live on the public internet.

**Outcome:**
- Both legal pages render correctly (verified via `curl` for titles/200 status and a headless Playwright smoke script for the banner lifecycle: appears on first visit, dismisses on click, stays dismissed after reload via `localStorage`, and both footer links navigate correctly).
- `npm run verify` (typecheck, lint, docs-drift) passes cleanly. One lint error was hit and fixed: `react-hooks/set-state-in-effect` flagged the banner's conditional `setVisible(true)` inside `useEffect`; resolved using the same `queueMicrotask(() => setState(...))` pattern already established in `room-client.tsx`'s `hasMounted` effect.

**Risks:**
- The legal page copy ships with bracketed placeholders (`[Your Company / Legal Entity Name]`, `[Your Jurisdiction]`, `[support@yourdomain.com]`, `[privacy@yourdomain.com]`) that must be filled in with real values before the pages are legally reliable — ideally after review by counsel. This is a content gap, not a code defect.

---

## [2026-07-04] — Session 29: Pre-Launch Hardening Backlog Tier

**AI:** Claude Code (Anthropic)
**Task:** Add a High Priority "pre-launch hardening" tier to the backlog after the user confirmed intent to publish Spintra live on the public internet once ready. No code changes.
**Files Modified:**
- `docs/TASKS.md` — added High Priority tier: Abuse & Moderation Controls, Rate Limiting on Room/Message Creation, Legal Basics (ToS/Privacy/consent), Production Error Monitoring
- `docs/AI_CONTEXT.md` — updated Current Focus and Next Recommended Task to point at the new tier ahead of the Medium Priority engagement features
- `docs/HANDOFF.md` — updated Next Recommended Task to the same effect

**Purpose:**
- The existing Medium Priority backlog (visual scoreboard, tournament bracket UI, XP/leveling, room settings panel) is all engagement polish. None of it addresses the risks of exposing the site to real public traffic, given documented assumptions (no verified identity, no moderation tooling, no legal pages, no error monitoring).

**Outcome:**
- `TASKS.md` now has a High Priority tier ranked above Medium Priority, so the next session starts on launch-blocking work rather than feature polish.

**Risks:** None — documentation/planning only, no code touched.

---

## [2026-07-04] — Session 28: Database Prompts Migration, Zustand Report & PIIA Workflow Enhancements
**AI:** Antigravity (Google DeepMind)
**Task:** Migrate static prompts/trivia questions to dynamic DB schemas, write a Zustand state persistence investigation report, and enhance the Pre-Implementation Impact Assessment (PIIA) rules.
**Files Modified/Created:**
- `supabase/migrations/0010_create_trivia_and_scramble_prompts.sql` (NEW) — Supabase schema migration defining `trivia_questions` and extending `activity_prompts` check constraint, seeding all 37 Canonical questions and 12 Scramble words.
- `src/lib/supabase/database.types.ts` — Updated the TypeScript interface definitions to incorporate the new `trivia_questions` table schema.
- `src/app/room/[code]/activities/trivia-activity.tsx` — Refactored to fetch dynamic trivia questions from Supabase with safe type-casting and offline fallback.
- `src/app/room/[code]/activities/word-scramble-activity.tsx` — Refactored to fetch dynamic scramble words from Supabase with offline fallback.
- `docs/ZUSTAND_INVESTIGATION.md` (NEW) — Zustand state persistence investigation report comparing React Context vs. Zustand store slices.
- `docs/INDEX.md` — Added `ZUSTAND_INVESTIGATION.md` reference to index table.
- `docs/ARCHITECTURE.md` — Added migration `0010`, registered `ZUSTAND_INVESTIGATION.md` in folder structure, and mapped the new `TRIVIA_QUESTIONS` schema inside the database ER mermaid diagram.
- `docs/TASKS.md` — Checked off the database-migration and Zustand investigation tasks.
- `AGENTS.md`, `docs/START_HERE.md`, `docs/AI_RULES.md` — Integrated the refined Pre-Implementation Impact Assessment (PIIA) guidelines incorporating risk classifications, blast radius checklists, and architectural thinking questions.
- `docs/AI_CONTEXT.md` — Updated milestone logs.
- `docs/HANDOFF.md` — Updated handoff pointer.

**Purpose:**
- Transition the hardcoded prompt lists and trivia questions to centralized PostgreSQL database tables, allowing real-time edits, extensions, and content moderation.
- Keep standard static lists as offline fallbacks so the multi-tab BroadcastChannel local sandbox continues to work without database connection details.

**Outcome:**
- Loaded word scramble banks and trivia lists dynamically from database tables.
- Passed typechecks, linter gates, and automated documentation file/drift verification scripts successfully.

**Risks:** No known risks.

---

## [2026-07-04] — Session 27: Explore Realtime Feeds, Custom Join Modals, Portal Views, Profile Sync & Database Race Fixes
**AI:** Antigravity (Google DeepMind)
**Task:** Redesign and implement the complete custom room joining flows, build a live Supabase Explore room & activity feed, build an inline sidebar profile editor, refactor overlays to mount via React Portals, resolve database concurrent insert and host promotion election race condition conflicts, and codify the strict AI development workflow.
**Files Modified/Created:**
- `src/app/explore/page.tsx` — Replaced static mock list with direct live Supabase query feeds, bound Postgres realtime change listeners, added lock/capacity indicators, and added pre-entry capacity/status check alerts.
- `src/app/room/[code]/hooks/use-room-subscription.ts` — Upgraded participant DB insertion to a Postgres upsert on `(room_id, user_id)` conflict to handle race conditions, and muted Promotions conflict errors to debug warnings.
- `src/app/room/[code]/components/room-header.tsx` — Configured QR code overlays, implemented React Portals to append the QR code backdrop to the document root to bypass layout transforms and prevent window cutoff.
- `src/components/layout/navbar.tsx` — Refactored the global Join Room code-entry modal to render via React Portal on `document.body` for perfect centering and header overlap clearance.
- `src/app/page.tsx` — Aligned the Homepage Quick Join card inputs to match the bypass validation logic and improved light mode contrast styles.
- `src/app/room/[code]/components/room-sidebar.tsx` — Upgraded username editing form variables to support adaptive light/dark mode tokens.
- `docs/TASKS.md` — Marked invitation/sharing/discovery backlog tasks as completed.
- `docs/AI_CONTEXT.md` — Synchronized current progress, milestone logs, and objective definitions.
- `docs/HANDOFF.md` — Documented Session 27 details and recommended next tasks.
- `docs/AI_RULES.md` — Updated Startup Checklist and DoD guidelines.
- `AGENTS.md` — Wrote AI bootstrap and onboarding guide workflow guidelines.
- `docs/START_HERE.md` — Added bootstrap mechanism redirect note.

**Purpose:**
- Resolve UX disconnect on custom room entries where copying a link from hosts was the only path.
- Bring the Explore page to life with active real-time rooms and a feed of recent activity cards.
- Prevent layout clipping/overlap bugs caused by ancestor CSS stacking contexts and relative transforms.
- Solve Postgres concurrency conflicts occurring when multiple players mount at the same instant.
- Fix low-contrast inputs and text in Light Mode.

**Outcome:**
- Perfect viewport centering of all modals, completely clearing the header navbar.
- Real-time synced room list, capacity monitors, and active feeds on the Explore page.
- Robust concurrent joining rules (locks/capacity are checked for new joins, but bypassed for returning hosts/players).
- Username edits sync back to database and update all participants instantly.
- Strictly program-enforced AI workflow guidelines for future sessions.
- Codebase builds successfully (`npm run verify` runs typecheck, eslint, and drift-checks with 0 errors).

**Risks:** No known risks.

---

## [2026-07-04] — Session 26: Landing Page WebGL Dynamic Loading Optimization
**AI:** Antigravity (Google Gemini 3.5 Flash)
**Task:** Optimize initial page load bundle metrics for the application home landing page by converting the statically imported 3D WebGL element (`HeroThreeScene`) to client-side lazy loading.
**Files Modified:**
- `src/app/page.tsx` — Converted `HeroThreeScene` to dynamic dynamic loading with `ssr: false`.
- `docs/AI_CONTEXT.md` — Updated milestone info and last updated timestamp.
- `docs/HANDOFF.md` — Updated last completed task to include the home page bundle optimization.

**Purpose:**
- Prevent heavy 3D WebGL render dependencies (Three.js, react-three-fiber, react-three-drei) from inflating the homepage's initial javascript bundle size, improving core web vitals and mobile rendering speeds.

**Outcome:**
- Saved over 1MB of uncompressed JS from the landing page's initial bundle.
- Verified successful production compilation via `npm run build` and zero linter/drift regressions via `npm run verify`.

**Risks:** No known risks.

---

## [2026-07-04] — Session 25: Node.js Config Sync & Activity Registry Integrity Checks
**AI:** Antigravity (Google Gemini 3.5 Flash)
**Task:** Implement Check 7 (Node.js configuration drift check) and Check 8 (Activity Registry and games.ts catalog slug integrity checks) within `check-docs-drift.mjs`.
**Files Modified:**
- `scripts/check-docs-drift.mjs` — Added Check 7 for Node version sync across package.json, CI workflows, .nvmrc, and .node-version; added Check 8 for integrity validation of dynamic activity files, registry entries, and canonical game definition slugs.
- `docs/AI_CONTEXT.md` — Updated last updated timestamp and milestone details.
- `docs/HANDOFF.md` — Logged stopping point and completed items.

**Purpose:**
- Prevent configuration drift and registry configuration mismatch bugs that could cause silent CI regressions or multiplayer room selection failures.

**Outcome:**
- Successfully integrated Check 7 and Check 8 into the drift checker.
- Verified that configuration mismatch and registry errors fail the validation gate with clear, descriptive error logs.
- Confirmed that `npm run verify` runs typecheck, lint, and all 8 checks successfully.

**Risks:** No known risks.

---

## [2026-07-04] — Session 24: Extended Documentation Drift Checker
**AI:** Antigravity (Google Gemini 3.5 Flash)
**Task:** Extend the automated documentation drift check tool (`check-docs-drift.mjs`) to validate React contexts, index file alignment, file and relative link references, and npm script documentation completeness.
**Files Modified:**
- `scripts/check-docs-drift.mjs` — Added Checks 3, 4, 5, and 6 to validate TypeScript context interfaces, INDEX.md, all markdown links, and script references.
- `docs/ARCHITECTURE.md` — Documented `npm run start` in §9 (Build Pipeline).
- `docs/INDEX.md` — Added `INDEX.md` reference to the document lookup table.
- `docs/TASKS.md` — Checked off the script-extension technical debt item.

**Purpose:**
- Prevent documentation drift on context shape changes, link rotations, script updates, and missing index definitions.

**Outcome:**
- Automated all 6 drift validation checks successfully.
- Clean compilation, ESLint validation, and zero-drift verification gates.

**Risks:** No known risks.

---

## [2026-07-04] — Session 23: Composed verify/ci Scripts, Stale-Reference Cleanup, README Polish

**AI:** Claude Code (Anthropic)
**Task:** Staff-Engineer-style review of `scripts/check-docs-drift.mjs` and `package.json`'s validation scripts (user-requested, review-only), followed by implementing the one recommendation with clear value, then two further review passes (documentation accuracy, README look-and-feel) at the user's request.
**Files Modified:**
- `package.json` — added composed `"verify": "npm run typecheck && npm run lint && npm run docs:check"` and `"ci": "npm run verify && npm run build && npm run test:smoke"` scripts. Committed separately from the Session 22 work so the two are distinguishable in history.
- `docs/TASKS.md`, `docs/ENGINEERING_GOVERNANCE_REVIEW_V2.md` — fixed 3 references to `scripts/check-docs-drift.js`, the script's pre-rename name (it was renamed to `.mjs` during Session 22 to satisfy `@typescript-eslint/no-require-imports`, but 2 docs still cited the old name).
- `docs/ARCHITECTURE.md` §9 Build Pipeline, `README.md`'s Scripts table — both were missing `docs:check`/`verify`/`ci` entirely (never updated when those scripts were added); added all three.
- `README.md` — added a GitHub Actions CI status badge; added an explicit "License" section ("All rights reserved" — the repo had none, which silently defaults to no reuse rights); fixed the Testing section, which only listed 3 of the 6 actual CI steps (missing the security audit and documentation drift check); moved the Next.js breaking-changes callout out of the above-the-fold area (it was the first thing a visitor saw after the one-line pitch) into its own "Development notes" section near the bottom.

**Purpose:**
- Turn the review's one unambiguous recommendation (composed local scripts mirroring the CI gate) into an actual change rather than leaving it as unactioned prose.
- Two follow-up "final review" requests surfaced real staleness (wrong script filename in 2 docs, 2 incomplete script inventories) and a structural README issue (dev-facing caveat crowding out the project pitch) — fixed all of them since they were genuine, verified defects rather than speculative polish.

**Outcome:**
- `npm run verify` passes clean after every change in this session.
- Confirmed via repo-wide grep that no `check-docs-drift.js` (old name) references remain anywhere.
- `ci.yml`'s step order (audit → typecheck → lint → docs:check → build → smoke) was confirmed to already match what `npm run ci` executes, plus the audit step — no inconsistency found there, so nothing was changed in `ci.yml` this session.
- Declined to add a screenshot/GIF to the README (no browser/screenshot tool available in this environment) and declined to invent a live-demo URL (none found in the repo) — both left as open, user-owned follow-ups rather than guessed at.

**Risks:** None — documentation/config only, verified against `npm run verify` after each change.

---

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

