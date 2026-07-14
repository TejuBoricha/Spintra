-- ============================================================================
-- Issue 9: Round Robin JSON Size Constraint
--
-- A 50-player Round Robin generates 1,225 matches, which when serialized
-- to JSON exceeds the previous 100KB safeguard. We increase this safeguard
-- to 500KB to safely accommodate maximum-capacity tournament states.
--
-- Correction: the size-bounded activity_state column lives on
-- public.room_activity_state (migration 0035 moved it off public.rooms
-- entirely — rooms.activity_state hasn't existed since then), so this
-- migration originally targeted the wrong table and silently failed to
-- apply (rooms.activity_state doesn't exist — "column does not exist").
-- The constraint this migration actually needs to widen is the one
-- migration 0039 placed on room_activity_state, 100KB -> 500KB.
-- ============================================================================

alter table public.room_activity_state
  drop constraint if exists room_activity_state_size_check;

alter table public.room_activity_state
  add constraint room_activity_state_size_check
  check (pg_column_size(activity_state) < 500000);
