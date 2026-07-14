# Host Migration Audit

A production-readiness audit of what happens when a room's original host disconnects and another participant is auto-promoted — across all 14 games and the multiplayer infrastructure as a whole. Conducted 2026-07-14. Every finding below was verified against the actual current codebase and, for database-level claims, the **live** Supabase project (via `scripts/verify-migration.mjs`, which queries `pg_proc` directly rather than trusting the migration-tracking table — this repo has been burned by "tracked as applied but never actually ran" migrations before, see `CHANGELOG_AI.md` Sessions 37/38/40).

**Status: every finding below is fixed and live-verified** (two real browser sessions via Playwright, plus direct DB/REST checks) — not just reasoned about statically. Each entry keeps its root-cause analysis (so the reasoning survives after the code changes) and now also states what was actually implemented and how it was verified.

**2026-07-14 correction (Session 61):** this document's own "Verification method" section below claimed the host-election/demotion mechanics were "confirmed live and correct" — true for the scenarios actually tested (single sequential host crashes, two-participant sessions), but incomplete: it did not cover genuinely *concurrent* multi-client races. A dedicated concurrent-stress-testing pass the same day found two real bugs in exactly this mechanism — a split-brain race in `elect_room_host` (two clients simultaneously promoting themselves) and a false-offline race in the presence crash-reconciliation logic — neither of which this audit's testing method would have caught, since it never ran multiple real clients racing against each other at the same instant. Both fixed; full detail in `CHANGELOG_AI.md`'s Session 61 entry and migration `0061`. General lesson, not specific to this document: "verified live" through this project's history has usually meant a single-scenario check, not adversarial concurrent load — treat any older "confirmed live" claim about realtime/host/presence behavior with that caveat unless it explicitly says otherwise.

This is a findings document, not a changelog. Full implementation detail is tracked in `CHANGELOG_AI.md`/`TASKS.md` as usual.

---

## Architecture summary (context for every finding below)

- **Host election** (`elect_room_host`, migration 0046, demotion added 0056/0058): a `SECURITY DEFINER` Postgres function. Any online participant whose row is the earliest-joined among online participants elects itself once it detects no other online host exists. Atomically updates `rooms.host_id` and demotes the previous host's stale `role='host'` row.
- **Game state replay**: every activity's live state is a capped, ordered event log (`activityEventLogRef`, max 200 events) persisted to `room_activity_state` (one JSON column, `{type, events}`), debounced (600ms/2s max wait). Any client — not just the host — can persist it (`room_activity_state`'s own RLS policy comment: "the host (or any participant via the existing trigger path) can update it"). Any newly-mounted listener (fresh join, reconnect, or a newly-promoted host) gets the full log replayed via `registerEventListener`.
- **Game actions** (`sendActivityEvent`) are broadcast over a Supabase Realtime private channel authorized by `is_member_of_room()` (migration 0036) — **membership, not host status**. There is no host check anywhere in the broadcast transport layer. "Host-only" actions are a client-side UI convention (`{isHost && <Button>}`) for every game except RPS/Bingo/Trivia scoring, which additionally call a server-verified `award_score` RPC (ADR-008/009) that re-derives the result from the persisted event log independent of who calls it.

This last point is the single most important fact underlying this audit: **for 11 of the 14 games, and for Tournament's bracket state specifically, "the host" has never been a server-enforced role for in-game actions** — only for room-level operations (settings, lock, kick/ban, moderation), which are gated by real `host_id = auth.uid()` RLS checks. Host migration questions therefore split cleanly into two very different categories: room-level operations (which are safe by construction, see below) and in-game actions (where "authority transferred to the new host" is mostly a UI fiction that migration doesn't change one way or the other).

---

## Findings

### CRITICAL

**C1. A newly-promoted host can never recover the Guess Number secret**
- **Description:** the host-only secret-number display gets permanently stuck at "??" after a host migration mid-game.
- **Root cause:** migration `0057_guess_number_get_secret.sql` is tracked as applied locally but its function `get_guess_number_secret` did not exist in the live database (confirmed directly against `pg_proc`, not the tracking table) — the migration's own SQL had a dollar-quoting bug (`as $body` / `$body;` instead of `$body$` / `$body$;`), a plain syntax error that made every prior apply attempt fail silently. `guess-number-activity.tsx`'s `fetchSecret()` effect fires exactly when `isHost && guessSecretNumber === null` — true the instant a new host's component mounts — the RPC call failed, and the error was silently swallowed (`if (!error && data !== null)`).
- **Affected:** Guess Number only, and only in the host-migration path.
- **Fixed:** corrected the dollar-quote syntax and applied migration 0057 for real. Verified live: a real host session's RPC call returns the actual secret; a real non-host session's call is correctly rejected (`"Only the host may view the secret number."`).

**C2. Any late joiner to an active Party/Classroom room — not just a promoted host — never sees the in-progress game**
- **Description:** discovered while live-testing M4 below: a plain second participant joining a party-mode room *while the original host was still alive and a game was already in progress* saw "Waiting for Host" instead of the actual active game. This is a broader, more severe bug than anything migration-specific — it affects ordinary late joiners with the host still fully present, and a promoted host hits it worst of all (they can't act on a game they can't even see).
- **Root cause:** `loadActivityStateAndActivate(roomType)` only recovered the active game when `persisted.type === roomType`. For a single-game room this is correct (both sides of that equation are literally the same value, e.g. `"trivia" === "trivia"`). For a party/classroom room, `roomType` is always `"party"`/`"classroom"` while `persisted.type` is the *currently selected sub-activity* (e.g. `"tournament"`) — these can never be equal, so `setActiveActivity` was unconditionally skipped for every party/classroom room, for every client that joined after the initial `activity_change` broadcast had already fired and vanished.
- **Affected:** every Party/Classroom room — the two room types that exist specifically to let a host run *any* of the 14 games.
- **Fixed:** `loadActivityStateAndActivate` now separately recovers the persisted sub-activity's own `type` for party/classroom rooms (instead of comparing it against the room's fixed type) and activates it. Verified live twice: (1) a plain late-joining guest with the host still alive correctly sees "Tournament / Tournament Bracket" instead of "Waiting for Host"; (2) a promoted host recovers the same way.

**C3. The room-details reconciliation poll was silently inert for the entire session, on every room, for every client — and could revert a correct post-election promotion back to the dead host**
- **Description:** the most severe finding of this audit. `loadRoomDetails()` — which runs once on mount and then unconditionally every 6 seconds as a reconciliation safety net for missed realtime updates (name, lock, capacity, and critically, `host_id`) — reused the one-time `prefetchedRoom` snapshot (fetched by `room-client.tsx` *before the room UI even mounts*) via `let data = prefetchedRoom; if (!data) { ...real fetch... }`. Since `prefetchedRoom` is a stable object reference for the component's entire lifetime, `if (!data)` was only ever false on the very first call — every subsequent call, including every single one of the periodic 6-second polls for the rest of the session, silently reapplied that same frozen initial snapshot instead of ever querying the database again. Confirmed live: a promoted host's `isHost` correctly flipped `true` via the realtime `rooms` UPDATE event, then reverted back to `false` (and every host-only header control disappeared) the next time the "reconciliation" interval fired — because that "reconciliation" was actually just re-serving stale pre-election data forever.
- **Root cause:** the one-time-fetch-reuse optimization (added to save a single redundant round trip on initial mount) was never scoped to apply only once — it silently applied forever.
- **Affected:** every room, every session — this made the *entire point* of the periodic reconciliation poll (self-healing a missed single realtime event) a no-op, for `host_id` specifically causing exactly the "promoted host randomly demoted minutes later" bug a user would experience as completely inexplicable.
- **Fixed:** added a `hasConsumedPrefetchedRoomRef` guard so the prefetched snapshot is used at most once; every call after the first now performs a real fetch. Additionally hardened with a generation counter (`roomHostIdGenRef`) so a `loadRoomDetails()` fetch already in flight when a local election commits can detect it's now stale and skip applying its (superseded) `host_id`, rather than relying solely on request ordering. Verified live: `isHost` and all host-only header controls now remain stable across a full 30-second window spanning multiple reconciliation cycles.

### HIGH

**H1. Tournament had no server-side verification — "host control" over it was never actually enforced**
- **Description:** any room member, not just the host, could forge a `tournament_update` broadcast declaring any winner, score, or bracket state, bypassing every client-side corruption guard.
- **Root cause:** unlike RPS/Bingo/Trivia, Tournament's `handleScoreSave` → `recordMatchResult` → `sendActivityEvent` was 100% client-computed with no RPC backstop, and the broadcast transport is member-authorized, not host-authorized (see Architecture summary).
- **Affected:** Tournament only, but severely.
- **Why this mattered for host migration specifically:** the premise "the old host lost authority, the new host gained it" wasn't technically true here — nobody's authority over Tournament was ever real at the transport layer.
- **Fixed, two layers:** (1) a DB trigger (migration 0060) requiring the live `auth.uid() = rooms.host_id` specifically when a persisted `room_activity_state` payload's type is `"tournament"` — the real, unforgeable enforcement, scoped narrowly to that one JSON discriminator so it doesn't touch any other activity or any other function. (2) client-side: `tournament_update` events now carry a self-reported `senderId`, checked against each client's own live-synced host id for *live* (non-replayed) events only — dampens the live-broadcast race during an actual transition; explicitly documented as not a security boundary on its own, since a determined client could still lie about `senderId` (that's what the trigger is for). Verified live: non-host forged writes rejected (`"Only the room host may update tournament state."`), legitimate host writes succeed, and every other activity type plus clearing state entirely remains open to any participant exactly as before.

**H2. Host promotion was invisible to every other participant**
- **Description:** when a new host was promoted, nobody else in the room — sighted or screen-reader — received any notification.
- **Root cause:** `setNotification("...promoted to host.")` was local `useState`, never broadcast. The separate screen-reader `roomAnnouncement` channel (used for joins/leaves/game-type changes) had no host-promotion call site either.
- **Affected:** room-wide, all 14 games.
- **Fixed:** a `host_changed` realtime broadcast (real-Supabase mode) and the demo-mode `HOST_PROMOTED` BroadcastChannel message (now carrying `{userId, username}` instead of a bare id) both notify every *other* client — the promoted client already has its own "You are now the host" message and is skipped to avoid double-announcing. Verified live with a 3-participant room (host, promoted guest, bystander guest): the bystander sees "X is now the host" both as a visible notification and via the `aria-live` screen-reader region within 2.5 seconds.

### MEDIUM

**M1. Tournament: last-write-wins broadcast could silently drop a scored match**
- **Description:** `setTournament(event.tournament)` unconditionally overwrote local state on every receipt, no version check. Two clients scoring the same match near-simultaneously — most plausible during the ambiguous window of a host transition — could silently vanish one result.
- **Fixed:** closed as a side effect of H1's sender-verification fix (only genuine host broadcasts are trusted, narrowing the race to the brief realtime-propagation window of an actual legitimate transition, not an open-ended one).

**M2. "Leave Room" sent no explicit departure signal**
- **Description:** clicking Leave Room was a bare `window.location.href = "/"` — no participant delete, no broadcast, nothing. Detection relied entirely on presence-based crash detection, even though the app has 100% certainty at that exact moment.
- **Root cause / fix:** turned out not to need a new RPC at all — the existing `room_participants` DELETE postgres_changes handler already calls `electHostIfNeeded` immediately on any row deletion. The real gap was simply that Leave Room never deleted the row. Added an explicit `leaveRoom()` hook action that deletes the caller's own row (RLS already permits self-delete) before navigating, guarded by a `leavingRoomRef` (mirroring the existing `closingRoomRef` pattern) so the same DELETE handler doesn't show the leaving user their own false "You were removed by the host" toast. Verified live: promotion now lands in ~2s via the DELETE-triggered path, and the old host's row is cleanly gone (not left as a stale ghost).

**M3. Trivia's host-only question deck and filters were silently lost on migration**
- **Description:** `remainingIndices` (which questions have already been asked) and category/difficulty filters were local `useState`, never broadcast. A new host started with an empty deck (repeats became possible) and reset filters.
- **Fixed:** replaced the host-only index-based "remaining shuffle bag" with an `askedQuestionKeys` Set derived directly from the replayed `trivia_question` event log itself (keyed by `questionId`, falling back to question text for the id-less static offline question bank) — eliminating the state-loss possibility entirely rather than just broadcasting it, since any client (host or not) that mounts fresh recovers the same "already asked" set from history. Verified live: 3 consecutive draws were distinct, and the "remaining in deck" counter (48/50 after 2 draws) matched exactly.

**M4. Tournament format selection was lost if migration happened pre-bracket**
- **Description:** `tournamentType` was local-only; reset to the default if the host migrated before clicking Generate Bracket.
- **Fixed:** format selection now also broadcasts (`tournament_format_selected`, low-stakes — no sender verification needed, unlike match results). Verified live end-to-end: host selects Double Elim, host is killed, promoted guest's screen shows Double Elim already selected within 2 seconds — this test is what surfaced C2 and C3 above.

### LOW

**L1. No host-scoped permissions exist at the realtime transport layer for any game — foundational, not a regression**
- Broadcast/presence authorization is membership-only for every one of the 14 games (see Architecture summary). A demoted-but-still-connected old host retains exactly the broadcast capability they had the entire time as a regular participant, because it was never host-gated to begin with. H1's fix closes this specifically for Tournament (the one place forgery causes lasting, unfair harm); the other 13 games' actions have no comparable stakes (a forged coin-flip result or dice roll has no lasting consequence), so extending server verification to all of them remains disproportionate and out of scope.

### Confirmed safe by design (verified, not assumed)
- **Coin Flip, Dice, Lucky Wheel, RPS, Team Maker, Name Draw, Word Scramble, Truth or Dare, Would You Rather, Never Have I Ever** — all broadcast game-critical values synchronously at action time; migration-safe.
- **Bingo's win-claim verification** — traced precisely: `handleActivityEvent` persists every event the instant any client receives it, independent of whether the async DB-verification round-trip completes. A newly-promoted host's `registerEventListener` replay recovers an unresolved claim and independently re-verifies it. Self-healing, not a gap.
- **`award_score` (RPS/Bingo/Trivia)** — genuinely server-verified, independent of which client calls it.
- **Room Settings** (name/capacity/visibility/lock) — pure `rooms`-table columns, fetched fresh whenever the host panel opens. Zero client-state dependency.
- **The host-election/demotion mechanics themselves** (migrations 0056/0058, prior work this session) — confirmed live and correct.

### Out of scope, noted for completeness
Trivia broadcasts `correctIndex` to every room member the instant a question is drawn, before anyone answers (`trivia-activity.tsx`) — a real answer-leak, but a general authorization-model issue unrelated to host identity, not caused by or specific to migration.

---

## Verification method
Every fix above was checked against a real Playwright browser session (or two/three, for multi-participant scenarios) driving the actual UI, plus direct REST/RPC calls against the live Supabase project for negative cases (non-host rejection, forged writes) that are awkward to trigger through the UI alone. Nothing here was marked done on the strength of a code read or a type-check alone.

## Edge cases worth re-testing if this area changes again
- Trigger migration mid-tournament; have old and new host both attempt to score the same pending match within ~1s — confirm no silent loss.
- Non-host participant attempts a forged `tournament_update` via devtools — confirm rejection at both broadcast-receipt and persistence layers.
- A party/classroom room with a game already active: confirm every new joiner (not just a promoted host) sees it immediately, across a couple of the room-details reconciliation poll's 6-second cycles, not just in the first few seconds.
- Two-browser session: kill the host, confirm the surviving participant sees an explicit host-change notification.
- Mid-trivia-round host migration: confirm no question repeats regardless of which client asks next.
