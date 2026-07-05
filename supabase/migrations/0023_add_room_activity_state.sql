-- Migration 0023: Persist activity state so refresh/reconnect can recover it
--
-- Found in the Session 41 production-readiness audit: none of the 14 room
-- activities persisted their live game state anywhere — everything lived
-- only in each activity component's in-memory React state, hydrated purely
-- by listening forward to realtime broadcast events. A phone locking, a tab
-- backgrounding, or a simple refresh mid-game showed a blank/idle screen
-- with no way back in, for every activity, since nothing was ever written
-- to the database.
--
-- This column holds a capped, ordered log of the current activity's events
-- (`{ type: string, events: ActivityEvent[] }`, capped client-side at 200
-- entries) — not a derived snapshot. Every activity already communicates
-- game-state changes exclusively through `sendActivityEvent`/
-- `registerEventListener` (see use-room-subscription.ts), so replaying the
-- same event log a reconnecting client would otherwise have received live
-- reconstructs identical state, with no per-activity code required.

alter table public.rooms
  add column if not exists activity_state jsonb;
