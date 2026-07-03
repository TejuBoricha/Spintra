# Architecture Decision Records (ADR)

This document tracks major architectural decisions made in the Spintra codebase. All future changes should respect these historical decisions or document new decisions as additional ADRs.

---

## ADR-001: Strangler Fig room-client Refactoring
- **Status:** Approved & Completed
- **Date:** 2026-07-03
- **Context:** The `room-client.tsx` component was a monolithic orchestrator exceeding 1,900 lines of code, carrying state logic for all 14 multiplayer sub-activities. A single "big bang" rewrite was rejected due to high regression risks and developer velocity impact.
- **Decision:** Implemented Fowler's Strangler Fig pattern to decouple sub-activities incrementally. Created dynamic registers and providers alongside legacy state branches, allowing games to migrate one-by-one while keeping the main room layout operational.
- **Consequences:** Safe, regression-free refactoring. Monolithic file size reduced to ~1,000 lines. All 14 games isolated.

---

## ADR-002: Stable/Dynamic Context Separation
- **Status:** Approved & Completed
- **Date:** 2026-07-03
- **Context:** The original room client shared a single React context values object that included the participant roster. Frequent presence updates (joins/leaves) triggered re-render cycles across all active sub-game viewports.
- **Decision:** Split the React context into two separate providers:
  1. `RoomActivityContext` (STABLE): holds static room metadata and event bus callback references. Memoized using `useMemo` so context references never update.
  2. `RoomParticipantsContext` (DYNAMIC): holds only the participant list array.
- **Consequences:** 11 of the 14 activities do not display user lists and subscribe only to `RoomActivityContext`. They now have a 0% render penalty during room join/leave events. Only the 3 list-based activities (`team-maker`, `tournament`, `name-draw`) re-render.

---

## ADR-003: Dynamic Component Lazy Plugin Registry
- **Status:** Approved & Completed
- **Date:** 2026-07-03
- **Context:** Adding or removing a game previously required manual edits inside `room-client.tsx` in multiple conditional JSX branches and imports.
- **Decision:** Established a lazy-loaded dynamic component plugin registry mapping type slugs to code-split React activities:
  - Path: [`src/app/room/[code]/activities/activity-registry.ts`](file:///c:/Users/tejas/Desktop/Spintra-1/src/app/room/[code]/activities/activity-registry.ts)
  - Components are loaded client-side via Next.js `dynamic()` with `{ ssr: false }`.
- **Consequences:** Adding a new game now requires only a single registry registration entry. Code-splitting reduces initial JS bundle footprints, generating separate lazy bundles for each sub-game.

---

## ADR-004: Pub/Sub Event Bus for Realtime Broadcasting
- **Status:** Approved & Completed
- **Date:** 2026-07-03
- **Context:** Legacy sub-games used a direct callback bridge (`onActivityEventRef`) that required the parent to know the inner state details of every sub-game to route packets correctly.
- **Decision:** Implemented a Pub/Sub event bus pattern. The room client provides a stable `registerEventListener` callback register and a `sendActivityEvent` broadcast publisher. Mounted activities subscribe to and teardown event listeners dynamically.
- **Consequences:** Parent client has zero knowledge of game-specific event structures. Uncoupling simplifies type matching and prevents memory leaks on activity swaps.

---

## ADR-005: UUID Generation Sync for Optimistic Local Echoes
- **Status:** Approved & Completed
- **Date:** 2026-07-03
- **Context:** Optimistically rendered chat messages generated alphanumeric IDs. Upon database insert, Postgres assigned UUIDs. Since the local ID and replicated database ID did not match, the duplication checker failed, causing the sender's own bubble to double-render on replication loops. Timezone string differences also broke matches.
- **Decision:** Synced the client's optimistic ID generator to produce valid UUIDs via `crypto.randomUUID()` and explicitly passed this client ID to database INSERT queries. Upgraded duplicate matching comparisons to match raw parsed millisecond timestamps (`.getTime()`).
- **Consequences:** Complete elimination of double-rendering message bugs while retaining fast local echo feedback.
