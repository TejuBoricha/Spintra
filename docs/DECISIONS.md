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
