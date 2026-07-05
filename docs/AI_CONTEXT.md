# AI_CONTEXT.md — Spintra Project Living Memory
> The authoritative source of truth for the **current state** of the project — nothing else.
> Historical implementation details live in `CHANGELOG_AI.md`. Architecture, tech stack, and the
> DB schema live in `ARCHITECTURE.md`. Session-to-session handoff lives in `HANDOFF.md`. Backlog
> and roadmap live in `TASKS.md`. Do not duplicate those here — link to them instead.
> Always update this file after every significant milestone.
> Last updated: 2026-07-05T06:00 IST

---

## Current Milestone

Pre-launch hardening tier: Legal Basics (30, placeholders filled 36), Rate Limiting (31), Abuse & Moderation Controls (32) are done and live. Production Error Monitoring is explicitly deferred by the user's own choice (told them it's a visibility gap, not a launch blocker; they chose to skip it for now) — not an oversight, don't pick it up unprompted. Sessions 30–33 were committed as 4 scoped commits and pushed. That push's CI run then surfaced a second, wholly pre-existing bug (unrelated to Sessions 30–33): rooms created without Supabase configured never auto-activated their game — fixed in Session 34. Session 35 triaged the repo's 5 open Dependabot PRs: merged 4 safe GitHub Actions bumps, and applied 15 of 16 bundled npm updates directly to `main` while holding back `eslint ^10` (upstream-incompatible with `eslint-config-next`). Session 36 filled in the legal pages' real operator/jurisdiction/contact info. **Session 37: full Product Readiness Audit** (33 findings across functional/integration/DB-security/state-management/UX passes) followed by fixing the 1 Critical + 6 High findings — most notably, the multiplayer Tournament room activity could never actually finish a tournament (fixed by extracting a shared `src/lib/tournament-engine.ts` used by both the standalone tool and the new room activity). **Session 38: worked through the remaining backlog** — all 6 Medium findings (RLS column restrictions, DB-level room lock enforcement, missing constraints/index, message-reports host UI, presence reconciliation, react-query removal) plus most of the 15 Low findings. Also discovered and fixed a real production gap along the way: migrations 0008/0010 were tracked as applied but had never actually run (a genuine SQL syntax bug in 0010) — `activity_prompts`/`trivia_questions` didn't exist live until this session, though 5 activities' graceful hardcoded fallbacks meant no real user-facing outage. **Session 39: 13-area platform QA audit** — fixed Live Trending Rooms (auth init), privacy bypass via Recent Activity (is_public filter), broken explore filters (real participant counts, queueMicrotask cutoff), banned-user toast inconsistency (homepage + explore), fake homepage stats (10,000+ rooms, unimplemented chat features), tournament integrity (tie rejection, TBD non-clickable, completed-match re-edit guard), Party vs Classroom distinction (classroomSafe game tagging + picker filter), and pre-existing CRLF bug in docs drift check. A handful of Low findings, room auto-expiry (new Medium Priority), and the 3 larger net-new Medium features (Visual Scoreboard, XP/Leveling, Room Settings Panel) remain queued in `TASKS.md`.

---

## Overall Progress

All planned modularisation (14/14 activities), invite and QR sharing systems, realtime discovery feeds, client profile synchronizations, database-driven activity prompt migrations, security hardening, CI/dependency automation, and documentation-workflow work is complete. Build/lint/typecheck are clean. Two previously-undetected bugs were found and fixed via CI investigation: the double-elimination tournament bracket (Session 33) and demo-mode room activation (Session 34). No other known regressions.

---

## Current Objective

All room joining flows, discovery pages, profile state sync optimizations, database prompts migrations, and workflow rules are complete. Ready for new goals or feature requests.

---

## Current Focus

The High Priority "pre-launch hardening" tier is done except Production Error Monitoring (explicitly deferred). The Session 37 audit's Critical + High findings, Session 38's Medium + most-Low findings, and Session 39's 13-area QA audit are all complete. Remaining: room auto-expiry/lifecycle cleanup (Medium Priority, new in Session 39 — needs pg_cron or Edge Function, requires Supabase admin access), a small number of intentionally-deferred Low findings (see `TASKS.md`), the 3 larger net-new Medium Priority features (visual scoreboard, XP system, room settings panel — each needs its own scoping), and Production Error Monitoring if the user asks for it.

**Workflow change for future sessions:** the Supabase CLI is now linked to the live project (`qjxaehxwuqntyqrdmihs`) — `supabase/config.toml` was created via `supabase init`, the user ran `supabase login` once, and the AI ran `supabase link` + `supabase db push` directly. Future migrations no longer need manual copy-paste into the Supabase Dashboard SQL Editor; run `npx supabase db push --linked --yes` after adding a new migration file. Note: the remote migration-history table was out of sync with reality before this (many migrations 0001-0011 were originally applied by hand) — this was fixed once via `supabase migration repair --status applied <versions> --linked`. **Session 38 caveat:** "applied" in the tracking table does not guarantee the SQL actually ran successfully — `migration repair --status applied` just edits the bookkeeping, it doesn't execute anything. If a later migration touching the same table fails with "relation does not exist," don't assume it's an ordering issue; check the earlier migration's SQL for a real bug and verify the table exists via a direct REST query.

---

## Known Issues

- **`eslint` intentionally pinned at `^9`.** Dependabot will keep proposing `^10`; do not accept until `eslint-config-next`'s bundled `eslint-plugin-react` ships ESLint 10 support upstream. Confirmed (Session 35) that upgrading crashes `npm run lint` with `TypeError: contextOrFilename.getFilename is not a function` — a removed ESLint 10 API that plugin still calls internally. Verify by installing the bump in a scratch worktree and running `npm run lint` directly, not just by trusting a green CI badge on an unrelated branch.
- **Rate limiting and bans (migrations 0011/0012) are bypassable by rotating the anonymous session.** Both key on `auth.uid()`; since every user is an anonymous, unverified session, clearing browser storage (or an incognito window) resets both instantly. This is an accepted architectural trade-off (frictionless onboarding was a deliberate choice, see migration `0001`'s header), not a bug in the trigger logic — but treat it as "slows down casual abuse," not a real defense against a motivated abuser. Found and explicitly documented in the Session 37 audit; previously an implicit assumption, not written down anywhere.
- **Local CRLF reproduction of CI is unreliable — use `git show`, not clone/checkout.** This machine's global `core.autocrlf=true` smudges LF→CRLF on *any* operation that materializes files on disk (`git clone`, `git archive`, `git checkout-index`), not just the primary working tree — so a "fresh clone to /tmp" still doesn't show what a real Linux CI checkout sees. The only reliable way to inspect true blob content is `git show HEAD:<path>` (or `git cat-file`), which bypasses the smudge filter entirely. Learned the hard way in Session 37 when a genuine `docs:check` failure (a missing migration in `ARCHITECTURE.md`'s table) was initially misdiagnosed as the usual CRLF false positive.
- **Trivia's answer key is world-readable via RLS.** `trivia_questions.correct_index` has a `using (true)` select policy, so any client can fetch the answer before playing. Not fixed — would need a server-side answer-check RPC, disproportionate effort for a casual trivia game at this scale. Documented in `TASKS.md`, found in the Session 37 audit.
- **Chat profanity filter is client-side only.** `src/lib/chat-filter.ts` runs before insert client-side; a direct Supabase call bypasses it entirely. Not fixed, same reasoning as above (low severity, disproportionate effort to fix properly). Documented in `TASKS.md`.
- **Host-election "earliest joined" tiebreak isn't DB-enforced.** The client picks the earliest-joined online participant to self-promote, but the DB trigger only checks "no other online host exists" — a race could let any online participant self-promote first, not necessarily the earliest. Rare, cosmetic fairness issue only, not a security concern. Not fixed.
- **Multiple room membership is not prevented.** A single anonymous user can join multiple rooms simultaneously — there is no server-side enforcement preventing this. Accepted architectural trade-off of the anonymous identity model (frictionless onboarding over strict session constraints). Documented in Session 39; not a launch blocker.
- **Rooms persist indefinitely.** Closed or abandoned rooms are never automatically expired. A scheduled cleanup job (pg_cron or Supabase Edge Function) is the right fix but requires Supabase admin access to configure. Queued as Medium Priority in `TASKS.md` (Session 39).

---

## Current Assumptions

Load-bearing assumptions a new session should be aware of before making changes:

- **No verified user identity.** Every client is a Supabase anonymous auth session (`auth.uid()`) or, if Supabase isn't configured, a random `localStorage` ID — never a verified account. RLS restricts *what shape of data* a request can touch, but cannot confirm a client is who it claims to be. Treat this as "good enough to stop casual abuse," not a secure identity system (see migration `0001`'s header comment).
- **BroadcastChannel fallback is same-browser-only.** When Supabase env vars are absent, multiplayer "works" only across tabs in the same browser — it does not sync across devices or real users. Local-dev/demo convenience only.
- **No session persistence across visits.** Closing a room tab and reopening it does not restore a prior session beyond whatever `localStorage` already holds.
- **Static prompt/question content is English-only, no i18n.**

---

## Next Recommended Task

All High Priority pre-launch hardening items are complete. Session 39's 13-area QA audit is done. Production Error Monitoring remains unimplemented by the user's explicit choice to defer it — do not start it unprompted. Open next steps: room auto-expiry/lifecycle cleanup (Medium Priority, new — needs Supabase admin access for pg_cron), the 3 larger net-new Medium Priority features (Visual Scoreboard, XP/Leveling, Room Settings Panel — each needs its own scoping discussion, don't just start building), the small number of intentionally-deferred Low findings (see `TASKS.md`), or whatever the user raises next.

---

## See Also

- **Architecture, tech stack, DB schema/ER diagram, coding standards** → `ARCHITECTURE.md`
- **Why a past decision was made** → `DECISIONS.md`
- **Full chronological implementation history** → `CHANGELOG_AI.md`
- **Exactly where the previous session stopped** → `HANDOFF.md`
- **Backlog, technical debt, roadmap, priority** → `TASKS.md`
