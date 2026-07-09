# Architecture Decision Records (ADR)

This document tracks major architectural decisions made in the Spintra codebase. All future changes should respect these historical decisions or document new decisions as additional ADRs. This is a decision log, not a changelog — it answers *why*, not *what changed and when* (that's `CHANGELOG_AI.md`).

## Format (for new ADRs going forward)

```
## ADR-NNN: Title
- **Status:** Approved & Completed / Proposed / Superseded
- **Date:** YYYY-MM-DD
- **Context:** What problem or constraint prompted this decision?
- **Decision:** What was decided?
- **Alternatives Considered:** What other approaches were evaluated, and why were they rejected?
- **Consequences:** What are the trade-offs and long-term impact of this choice?
- **Follow-up Actions:** (optional) Any deferred work this decision creates.
```

The 6 ADRs below predate this template. Their "Alternatives Considered" fields were backfilled on 2026-07-04: ADR-001 and ADR-006 quote alternatives that were already stated in the original Context/Decision text, just not labeled as such; ADR-002, ADR-003, ADR-004, and ADR-005 are reconstructed from the "prior approach being replaced" described in each ADR's own Context — reasonable inferences, not contemporaneously recorded, and marked as such below.

---

## ADR-001: Strangler Fig room-client Refactoring
- **Status:** Approved & Completed
- **Date:** 2026-07-03
- **Context:** The `room-client.tsx` component was a monolithic orchestrator exceeding 1,900 lines of code, carrying state logic for all 14 multiplayer sub-activities. A single "big bang" rewrite was rejected due to high regression risks and developer velocity impact.
- **Decision:** Implemented Fowler's Strangler Fig pattern to decouple sub-activities incrementally. Created dynamic registers and providers alongside legacy state branches, allowing games to migrate one-by-one while keeping the main room layout operational.
- **Alternatives Considered:** A single "big bang" rewrite of the entire monolithic `room-client.tsx` in one pass — rejected due to high regression risk and loss of development velocity during the rewrite window (already stated in the original Context above).
- **Consequences:** Safe, regression-free refactoring. Monolithic file size reduced to ~1,000 lines. All 14 games isolated.

---

## ADR-002: Stable/Dynamic Context Separation
- **Status:** Approved & Completed
- **Date:** 2026-07-03
- **Context:** The original room client shared a single React context values object that included the participant roster. Frequent presence updates (joins/leaves) triggered re-render cycles across all active sub-game viewports.
- **Decision:** Split the React context into two separate providers:
  1. `RoomActivityContext` (STABLE): holds static room metadata and event bus callback references. Memoized using `useMemo` so context references never update.
  2. `RoomParticipantsContext` (DYNAMIC): holds only the participant list array.
- **Alternatives Considered** *(reconstructed, not contemporaneously recorded)*: Keep the single unified context (the prior approach) — rejected because it re-renders every consumer on any change, including high-frequency participant join/leave events. A per-activity-type context was also a theoretical option but would have added complexity disproportionate to the actual problem (only 3 of 14 activities need the participant list at all).
- **Consequences:** 11 of the 14 activities do not display user lists and subscribe only to `RoomActivityContext`. They now have a 0% render penalty during room join/leave events. Only the 3 list-based activities (`team-maker`, `tournament`, `name-draw`) re-render.

---

## ADR-003: Dynamic Component Lazy Plugin Registry
- **Status:** Approved & Completed
- **Date:** 2026-07-03
- **Context:** Adding or removing a game previously required manual edits inside `room-client.tsx` in multiple conditional JSX branches and imports.
- **Decision:** Established a lazy-loaded dynamic component plugin registry mapping type slugs to code-split React activities:
  - Path: [`src/app/room/[code]/activities/activity-registry.ts`](file:///c:/Users/tejas/Desktop/Spintra-1/src/app/room/[code]/activities/activity-registry.ts)
  - Components are loaded client-side via Next.js `dynamic()` with `{ ssr: false }`.
- **Alternatives Considered** *(reconstructed, not contemporaneously recorded)*: Continue manually wiring each new game into `room-client.tsx`'s conditional JSX branches and static imports (the prior/status-quo approach) — rejected as the direct cause of the problem this ADR solves: every new game required touching the monolith in multiple places instead of one.
- **Consequences:** Adding a new game now requires only a single registry registration entry. Code-splitting reduces initial JS bundle footprints, generating separate lazy bundles for each sub-game.

---

## ADR-004: Pub/Sub Event Bus for Realtime Broadcasting
- **Status:** Approved & Completed
- **Date:** 2026-07-03
- **Context:** Legacy sub-games used a direct callback bridge (`onActivityEventRef`) that required the parent to know the inner state details of every sub-game to route packets correctly.
- **Decision:** Implemented a Pub/Sub event bus pattern. The room client provides a stable `registerEventListener` callback register and a `sendActivityEvent` broadcast publisher. Mounted activities subscribe to and teardown event listeners dynamically.
- **Alternatives Considered** *(reconstructed, not contemporaneously recorded)*: Keep the direct callback bridge (`onActivityEventRef`, the prior approach, named explicitly in the Context above) — rejected because it required the parent to know every sub-game's internal event structure, coupling the orchestrator to every game's implementation details.
- **Consequences:** Parent client has zero knowledge of game-specific event structures. Uncoupling simplifies type matching and prevents memory leaks on activity swaps.

---

## ADR-005: UUID Generation Sync for Optimistic Local Echoes
- **Status:** Approved & Completed
- **Date:** 2026-07-03
- **Context:** Optimistically rendered chat messages generated alphanumeric IDs. Upon database insert, Postgres assigned UUIDs. Since the local ID and replicated database ID did not match, the duplication checker failed, causing the sender's own bubble to double-render on replication loops. Timezone string differences also broke matches.
- **Decision:** Synced the client's optimistic ID generator to produce valid UUIDs via `crypto.randomUUID()` and explicitly passed this client ID to database INSERT queries. Upgraded duplicate matching comparisons to match raw parsed millisecond timestamps (`.getTime()`).
- **Alternatives Considered** *(reconstructed, not contemporaneously recorded)*: Let the database generate the message ID (via a `DEFAULT gen_random_uuid()` column) instead of the client. Rejected because the client needs its own ID *synchronously*, before the insert round-trip completes, to render the optimistic local echo — a DB-generated ID wouldn't be known until the response came back, forcing a choice between delaying the optimistic render or reconciling two different IDs for the same message (which is the exact bug this ADR fixes). This alternative was independently re-evaluated and re-rejected for the same reason in `CHANGELOG_AI.md` Session 14, when a stale `TASKS.md` debt item proposed the same idea.
- **Consequences:** Complete elimination of double-rendering message bugs while retaining fast local echo feedback.

---

## ADR-006: Unified Activity Prompts Schema & Mount Cache
- **Status:** Approved & Completed
- **Date:** 2026-07-03
- **Context:** Individual game prompts (Truth or Dare, Would You Rather, Never Have I Ever) were historically hardcoded as script arrays inside active viewports. To make these pools customizable via database schemas without causing high DB read loads or code repetition, we needed a generic database pattern.
- **Decision:** 
  1. Created a unified public `activity_prompts` table rather than separate game tables to avoid schema clutter. Standardized on JSONB `prompt_data` blocks to support different question geometries.
  2. Implemented dynamic cache queries. The Host fetches all prompts for that specific activity *once* on component mount, storing them locally. Next drawings select from this local array to prevent DB read load.
  3. Integrated fallback script lists so the app functions natively under offline local fallback setups.
- **Alternatives Considered:** Separate database tables per game (one for Truth or Dare, one for Would You Rather, one for Never Have I Ever) — rejected in favor of one unified `activity_prompts` table with a JSONB `prompt_data` column, to avoid schema clutter (already stated in the original Decision above).
- **Consequences:** Easy dynamic prompt editing via DB tools. High-performance caching, zero DB load on question drawing actions, and full backward compatibility with local setups.

---

## ADR-007: Room Settings Panel scope — editable field set and capacity ceiling
- **Status:** Approved & Implemented (local-verified; live migration push pending)
- **Date:** 2026-07-09
- **Context:** A room's entire configuration is set once at creation (`create-client.tsx`): `name`, `is_public`, `max_participants` (slider 2–50, default 10), and game `type`. Post-creation, only `is_locked` is mutable (a header toggle), plus activity-switching in `party`/`classroom` rooms. The planned Room Settings Panel must decide (A) which of those fields become editable after creation, and (B) what bound to place on `max_participants` and where to enforce it. The data model already permits a host to update any column on their own room (migration 0014: *"the actual host can update anything"*), and the `rooms` UPDATE realtime handler already propagates `name`/`type`/`is_locked`/`max_participants` — so this is a product-scope decision, not a capability gap. Two facts drove it: changing a room's game `type` is not a "setting" (it wipes the active activity, clears the 200-event log, and re-broadcasts — categorically more dangerous than a rename), and `max_participants` is currently bounded only in the browser (DB enforces just `> 0`, migration 0016), leaving the real ceiling unenforceable server-side.
- **Decision:**
  1. **Editable field set (Decision A):** the panel exposes **name, capacity, and visibility (`is_public`)**, and surfaces **lock** in the panel while *keeping the fast header toggle*. **Game-type change is excluded** and deferred as its own scoped feature. This mirrors the creation surface — the least-surprising mental model ("I can change what I set when I created the room") — and draws the scope line exactly where risk jumps discontinuously (the type field), reusing existing realtime + host RLS with no new schema.
  2. **Capacity ceiling (Decision B):** keep **50 as the deliberate product ceiling** and enforce **`2 ≤ max_participants ≤ 50` at the database** via a new CHECK constraint, making the DB the single source of truth inherited by the creation slider, the settings panel, and any raw API call. Defense in depth — a client-side bound is not a bound. The migration must clamp/validate any pre-existing out-of-range rows before adding the constraint.
- **Alternatives Considered:**
  - *(A) Minimal (name + capacity only)* — rejected: leaves an arbitrary gap (a host can't fix an accidentally-private room) despite visibility being a creation-time setting.
  - *(A) Full (+ game-type change)* — rejected for now: highest blast radius; entangles a settings dialog with the activity-lifecycle/event-log reset logic and collides with single-activity room semantics. Belongs with the Scoreboard/XP work that depends on event-log integrity, if ever pursued.
  - *(B) Keep 50 UI-only* — rejected: the DB would still enforce only `> 0`, leaving an unbounded worst case for realtime cost/abuse.
  - *(B) Raise ceiling to 100–200* — rejected as premature: presence reconciliation, the participant-list UI, and realtime throughput are untested at that scale; raising the limit should be a deliberate, load-tested future decision, which B2 reduces to a one-line constraint bump.
- **Consequences:** Host gets the intuitive "edit what I created" control with zero new schema and full reuse of the existing `rooms` UPDATE realtime path and host RLS. Capacity becomes server-authoritative and bounded. Trade-offs: (1) capacity editing obligates a "can't drop below current online count" validation; (2) flipping a room public→private may leave it lingering in other users' Explore lists until refresh, because Explore's realtime subscription is filtered on `is_public=eq.true` (`explore/page.tsx:236`) and a row *leaving* a filtered subscription isn't reliably delivered — a documented minor limitation, not a blocker; (3) rooms are hard-capped at 50 until a future migration (intentional, cheap to change); (4) a host who picks the wrong game must create a new room until game-type change is built.
- **Correction (2026-07-09):** An earlier draft of this ADR and the BA report claimed the `settings`-column reference in `restrict_host_promotion_update()` (migration 0014) was still live and should be cleaned up in this feature. That is **incorrect** — migration **0027** (`0027_fix_host_promotion_trigger_stale_settings_column.sql`) already recreated that function without the `settings` comparison, superseding 0014. There is no dangling reference to clean up; migration 0049's scope is the capacity CHECK only.
- **Follow-up Actions:** (a) Build the panel + the `max_participants` CHECK migration (0049). (b) Log "post-creation game-type change" as a separate future backlog item.

---

## ADR-008: Visual Scoreboard — scope, persistence, and scoring model
- **Status:** Approved & Implemented (local-verified; live migration push pending)
- **Date:** 2026-07-09
- **Context:** A Scoreboard needs a reliable, deterministic way to know "who won" per activity, and a decision on whether standings live only for the current activity session or persist across a host switching games. Evidence gathered before deciding: of the 14 activities, only **Trivia** (`trivia_answer`, RPC-verified via migration 0045) and the **derived** RPS winner (independently computed by every client from `rps_choice` broadcasts — no event exists at all) carry a reliable `user_id`. **Bingo**'s only trustworthy signal, `bingo_verified`, carries a `username` but not a `userId` (the raw `bingo_win` claim has `userId` but is an *unverified* client claim — a naive reducer reading it would count rejected wins). **Name Draw** (`name_draw_winner`) and **Tournament** (`Tournament.winner`) carry only a display-name string, no `user_id` at all, so a scoreboard row can't be reliably attributed when names collide. Persistence is a hard fork, not a preference: the activity event log is capped at 200 events and is wiped on every activity switch and on `activity_reset` (`use-room-subscription.ts`), so a reducer reading only that log is *structurally* incapable of surviving a game switch — cross-activity standings require a durable store outside the log, full stop.
- **Decision:**
  1. **Activity scope (S1):** v1 covers **Trivia + RPS + Bingo** only. `bingo_verified` is extended with an **optional** `userId?: string` (optional so a pre-migration event replaying from an old persisted snapshot doesn't crash the reducer — it's simply skipped). Name Draw and Tournament are deliberately deferred: both already crown a single terminal winner per run with no natural "next round" to accumulate against, so a cumulative score is a conceptual stretch, not just a technical gap.
  2. **Persistence (S2):** a new **durable store** (`room_scores` table, migration TBD) is built now, not deferred to a Phase 2 — standings survive an activity switch, delivering the "who's winning the whole party" experience rather than per-game standings that reset every time the host switches games.
  3. **Reset trigger (S3):** scores are decoupled entirely from activity lifecycle. Neither `activity_reset` nor `changeActivity()` touches `room_scores` — only an explicit, dedicated host **"Reset Scoreboard"** action does. (Choosing Option 2 in S3 — clearing on game-type change — would have quietly re-created the per-session design S2 was chosen specifically to avoid.)
  4. **Scoring rule (S4):** **win + participation**. A verified win earns the full amount; anyone who took a real, structurally one-shot action (a Trivia answer, an RPS choice locked in) earns a smaller participation amount regardless of outcome. (Participation is *not* gameable by spamming — Trivia's answer button and RPS's choice both disable after one action per round; a participant can earn at most one participation credit per round.)
  5. **Bingo's participation signal (S5):** derived from **live `room_participants.is_online` presence at the moment of verification**, read server-side inside the award RPC — not from a new Bingo event, and not from any client's local presence snapshot (which could disagree with another client's during a presence-sync race). Bingo's event surface, already touched twice this session for the infinite-loop and win-verification-by-userId bugs, gains only the one optional field from Decision 1.
  6. **Values:** win = 3 points, participation = 1 point (Bingo's presence-derived participation uses the same 1-point scale).
- **Alternatives Considered:**
  - *(S1)* Fix all 5 activities' identity gaps — rejected: 3 additional touch points for 2 activities where "cumulative score" doesn't conceptually fit. Trivia + RPS only (zero event changes) — rejected: leaves the Scoreboard silently absent in 3/5 games, reading as broken rather than deliberately scoped.
  - *(S2)* Per-activity-session only, with a durable store deferred to a validated Phase 2 — this was the recommended default (lowest risk, zero schema change) but was explicitly not chosen; superseded by the decision above.
  - *(S3)* Clear on game-type change — rejected: undoes the point of choosing a durable store in S2.
  - *(S4)* Win-only — rejected: chosen against the lower-risk recommendation; accepted with the "one action per round" structural limit as the mitigation for gameability.
  - *(S5)* A new `bingo_participating` event — rejected: reopens Bingo's event surface a third time for a distinction (actually-present vs. AFK-but-connected) unlikely to matter to any real host.
- **Consequences:** Delivers a genuine cross-activity leaderboard, not a per-game one — the stronger version of the feature. This durable-store choice carries real implementation weight that a per-session design would not have: (1) **no event in this app carries a stable per-round ID today** — Trivia has `questionId` as a natural key, but RPS has nothing to dedupe a durable write against, and this must be added (a lightweight round marker) as necessary scope, not optional; (2) score writes must go through a `SECURITY DEFINER` RPC that re-verifies the win server-side (reusing Bingo's card-check, Trivia's `verify_trivia_answer`) rather than a raw client INSERT, or the table is trivially spoofable; (3) `room_scores` needs participant-wide (not host-only) SELECT RLS — the opposite visibility model from `room_bans`/`message_reports`; (4) it must be added to the `supabase_realtime` publication explicitly in the same migration, or it silently never fires a single realtime event — the exact bug already found and fixed for `room_bans` in migration 0043.
- **Follow-up Actions:** (a) Design + build `room_scores` migration (table, participant-scoped SELECT RLS, host-only reset DELETE/UPDATE policy, realtime publication entry). (b) Add a RPS round identifier to make its scoring events dedupable. (c) Build the score-award `SECURITY DEFINER` RPC (server-verifies the win; queries `is_online` server-side for Bingo's participation credit). (d) Extend `bingo_verified` with optional `userId`. (e) Build the Scoreboard panel UI + host reset action. (f) See ADR-009 — this RPC is designed to also atomically write XP in the same transaction.
- **Design refinement (2026-07-09, found before implementation began):** a deeper pass surfaced two issues bigger than the per-decision risks above, plus one correction to (b) above.
  1. **Verification-timing race (Bingo, RPS).** Bingo's existing win-check reads the host's *live in-memory* called-numbers state; the server-side RPC can only read the *persisted* copy in `room_activity_state.activity_state`, which is debounced (600ms, max-wait 2s — see `use-room-subscription.ts`). A win claimed at the exact moment it happens could be server-rejected as unverifiable simply because the DB hasn't caught up. RPS's re-derived winner check has the identical dependency. Trivia is unaffected — `verify_trivia_answer` reads the static `trivia_questions` table, not the event log. **Fix:** expose a new `flushActivityState()` method on `RoomActivityContext` (wrapping the existing internal `flushActivityEventLog`) that the winning client calls to force an immediate flush *before* invoking the award RPC — closing the race deterministically rather than relying on the debounce having already fired.
  2. **Reconnect can silently erase an award (XP).** `trackSelf`'s reconnect branch unconditionally writes `xp: currentUserRef.current.xp` from the client's local state into `room_participants` on every reconnect. If the award RPC updates the DB without the awarding client also updating its own `currentUser`/`localStorage`, the next reconnect (e.g. a page refresh moments after winning) overwrites the just-earned XP back to the stale pre-win value. **Fix:** the award RPC must return the new totals, and the calling client must apply that result to its own local state immediately — the DB write is never fire-and-forget.
  3. **Correction to (b):** "add a round identifier to RPS" was under-specified — a client-assigned ID risks two clients minting different IDs for what should be the same round. The correct mechanism: derive a round index from **position in the event log** (count of resets-so-far), which every client already computes identically as a byproduct of replaying the same ordered log. No new ID-generation scheme; the same derivation also supplies Bingo's scoring key.
  4. **Rate-limit exemption:** the award RPC's `room_participants` writes are **exempt** from the existing 30-updates/60s-per-user-per-room limit (migration 0038). That limit exists to throttle untrusted client-initiated writes; a server-verified RPC write is categorically different — the same reasoning already applied to `elect_room_host`, which isn't subject to it either.

---

## ADR-009: XP / Leveling — identity model and award trigger
- **Status:** Approved & Implemented (local-verified; live migration push pending)
- **Date:** 2026-07-09
- **Context:** `room_participants.xp`/`rank` and the five-tier `UserRank` type (`rookie → explorer → challenger → master → legend`) already exist and are fully wired for display (`loadParticipants()` already selects them) but nothing has ever awarded them. This app has no server-side user account — identity is an anonymous Supabase session plus a `localStorage` record (`getOrCreateRoomUser`) — so "where does XP live" has no single obvious answer the way it would in an app with real accounts.
- **Decision:**
  1. **Identity model (X1):** **both** — `localStorage` is the authoritative, persistent total (survives across every room this device joins); it is synced into `room_participants.xp`/`rank` on join/reconnect so other participants can see it. This is not a new pattern: it's the exact mechanism this app already uses for `username`/`avatar_url` (authoritative client-side, synced into the participant row), applied to a column (`xp`) that's already loaded and already being synced — just always with the value 0 today.
  2. **Award trigger (X2):** XP is awarded on **exactly** the same events Scoreboard scores (ADR-008: Trivia/RPS/Bingo, win + participation) — no broader coverage across the other 11 activities. XP is, functionally, "your Scoreboard points, accumulated across every room you've ever played," not a separate achievement system with its own rules.
  3. **Values:** win = 15 XP, participation = 5 XP (a 5× multiple of Scoreboard's point values, since XP is meant to accumulate over a much longer horizon — many rooms over time — not one session). Rank thresholds: rookie = 0, explorer = 100, challenger = 300, master = 700, legend = 1500.
- **Alternatives Considered:**
  - *(X1)* Room-scoped only — rejected: resets to 0 every new room, no real progression; barely distinguishable from Scoreboard. Device-global only (no sync to `room_participants`) — rejected: can't be shown to other participants at all, breaking the "show rank in the participant list" UX this feature exists for.
  - *(X2)* Broad — an XP hook on all 14 activities — rejected: 11 new integration points, 11 separate judgment calls about what's "worth" XP, and 11 new places to get replay-safety wrong, for a philosophically different (engagement vs. competitive-achievement) feature. A middle "flat trickle + win-based" option was also considered and rejected: reintroduces the "two award rules instead of one" pattern already avoided in ADR-008's S4.
- **Consequences:** XP becomes close to a "free" feature once Scoreboard (ADR-008) ships — same trigger, same detector, same replay-safety work, applied to a second durable target. The award RPC (ADR-008's) writes **both** `room_scores` and `room_participants.xp` inside **one transaction**, so a partial failure can never let Score and XP drift apart (Postgres functions are atomic by default — the same "two related writes, one atomic RPC" pattern already used for `elect_room_host`, migration 0046). Known, accepted limitation (already true of this app's entire identity model, not new here): a user who clears browser data loses XP permanently and silently — worth a small, honest UI acknowledgment the first time XP is shown, not a blocker. Two tabs on the same device in two different rooms simultaneously could race writing back to the same `localStorage` value — an accepted edge case consistent with how this app already treats multi-tab identity everywhere else.
- **Follow-up Actions:** (a) `lib/xp.ts` — pure `tierOf(xp)` threshold function + the local-first sync helper. (b) Extend ADR-008's award RPC to also write XP atomically. (c) Render `rank`/XP progress in the participant list (data already loaded, currently unused). (d) Level-up feedback (toast + `fireConfetti`, reusing the existing celebration component) on a threshold crossing only, not every award.
- **Design refinement (2026-07-09):** see ADR-008's design-refinement note item 2 — this is the load-bearing fix for XP specifically. `trackSelf`'s reconnect path already unconditionally writes the client's local `xp` into `room_participants` on every reconnect; without the award RPC's result flowing back into the client's own `currentUser`/`localStorage` state immediately, a reconnect moments after a win would silently regress the DB back to the pre-award value. The local-first sync helper in (a) above must close this loop in both directions, not just push local → room.

---

## ADR-010: Moderation Dashboard — merge scope and action history
- **Status:** Approved & Implemented (local-verified; PR pending)
- **Date:** 2026-07-10
- **Context:** A host's moderation surface is split across two header icons — `MessageReportsPanel` (Flag) and `UnbanPanel` (ShieldOff) — each opening its own dialog. Re-reading both in full before deciding: they are already structurally identical (icon+badge trigger → realtime-subscribed list `Dialog` → nested confirm `Dialog` per row), which is direct evidence for how mechanical a merge would be, not just a general "maybe merge these" guess. Separately, `log_moderation_event()` (migration 0032) writes only to Postgres server logs via `RAISE LOG` — never a queryable table — so no action history exists today in any form the client can read. The two existing tables that *are* queryable, `room_bans` and `message_reports`, have an asymmetry that matters for the history decision: `message_reports.reviewed=true` rows persist (dismissal is a flag flip), but `room_bans` rows are hard-deleted on unban — meaning the fact "this person was unbanned" is erased the instant it happens and cannot be recovered from existing tables at all.
- **Decision:**
  1. **Merge scope (Decision 1):** **full merge** into one tabbed dashboard (Reports / Bans / History) behind a single header icon, replacing both existing icons. The internals of both existing panels are extracted into tab bodies, preserving their exact realtime subscriptions, RLS-backed queries, and confirm-dialog flows verbatim — this is an extraction of two already-parallel implementations into a shared shell, not a redesign of either.
  2. **Action history (Decision 2):** a genuine new **`moderation_actions`** append-only table, written at the 3 existing host-action call sites (dismiss report, kick+ban, unban) — not derived from existing tables. A derived-only history could show past dismissed reports but could never show a past unban (the row is gone), which would make a "History" tab actively misleading the first time a host unbans someone and sees no record of it. Architecturally simpler than ADR-008's `award_score`: a host's own moderation action doesn't need adversarial server-side re-verification the way a participant's self-reported game win does (the host already has unilateral kick/ban/dismiss authority) — a plain host-scoped INSERT policy, matching the RLS pattern `room_bans`/`message_reports` already use, is sufficient.
- **Alternatives Considered:**
  - *(1)* Group visually, keep both panels independent — rejected: zero regression risk, but doesn't deliver an actual dashboard, and gives Decision 2's history no natural home (it would become a third separate icon).
  - *(2)* Derived-only history (`message_reports where reviewed = true`) — rejected: technically free, but silently omits the unban case entirely, which reads as broken rather than incomplete once a host notices.
- **Consequences:** This is the largest single-pass refactor of *live, already-working, security-sensitive* code in the backlog so far — more so than ADR-008's new-code risk, because it touches call sites that currently function correctly (the kick-flow's snapshot-before-delete ordering; unban's dependency on `room_bans` being in the `supabase_realtime` publication, migration 0043). The merge must carry these over exactly, proven via the existing e2e coverage plus new tab-level tests, not just a visual review of the diff. The new `moderation_actions` table must be added to the realtime publication in the same migration it's created — this exact omission has already caused a real, live bug twice this session (`room_bans` in 0043; `restrict_host_participant_update`'s regression in 0050/0051) and is the single most repeated lesson from this session's migrations.
- **Follow-up Actions:** (a) Design `moderation_actions` schema (room_id, action_kind, actor host id, target user id + username snapshot, detail, created_at) + host-scoped RLS + realtime publication entry. (b) Extract `MessageReportsPanel`/`UnbanPanel` internals into tab bodies of one new `ModerationDashboard` component; add one `moderation_actions` INSERT at each of the 3 existing host-action call sites. (c) Wire the new single icon into `room-header.tsx`, removing the two old ones. (d) Port existing report/ban/unban e2e coverage onto the new surface before deleting the old panels; add a History-tab test.
