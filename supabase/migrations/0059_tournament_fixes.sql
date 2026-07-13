-- ============================================================================
-- Issue 9: Round Robin JSON Size Constraint
--
-- A 50-player Round Robin generates 1,225 matches, which when serialized 
-- to JSON exceeds the previous 100KB safeguard. We increase this safeguard
-- to 500KB to safely accommodate maximum-capacity tournament states.
-- ============================================================================

alter table public.rooms
  drop constraint if exists room_activity_state_size_check;

alter table public.rooms
  add constraint room_activity_state_size_check
  check (pg_column_size(activity_state) < 500000);
