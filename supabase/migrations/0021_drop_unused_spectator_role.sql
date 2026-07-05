-- Migration 0021: Remove the dead 'spectator' role value.
--
-- Session 38 removed the client-side `UserRole.spectator` enum as dead code
-- (never assigned, never checked anywhere), but the DB check constraint from
-- migration 0001 was never updated to match, leaving 'spectator' as a value
-- the schema still permitted with nothing in the app able to produce or read
-- it. Verified live before this migration: zero `room_participants` rows use
-- `role = 'spectator'` (only 'host' and 'participant' exist), so this is a
-- pure tightening with no data to migrate.

alter table public.room_participants
  drop constraint if exists room_participants_role_check;
alter table public.room_participants
  add constraint room_participants_role_check
  check (role in ('host', 'participant'));
