-- Migration 0044: Denormalize Participant Count on Rooms
--
-- Adds participant_count to public.rooms to optimize the Explore page
-- queries and completely remove the need for table-wide wildcard subscriptions
-- to room_participants. Kept in sync via AFTER triggers.

-- 1. Add column to rooms table
alter table public.rooms
  add column if not exists participant_count integer not null default 0 check (participant_count >= 0);

-- 2. Trigger function to synchronize participant count on rooms
create or replace function public.sync_room_participant_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_online = true then
      update public.rooms
      set participant_count = participant_count + 1
      where code = new.room_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.is_online = false and new.is_online = true then
      update public.rooms
      set participant_count = participant_count + 1
      where code = new.room_id;
    elsif old.is_online = true and new.is_online = false then
      update public.rooms
      set participant_count = greatest(0, participant_count - 1)
      where code = new.room_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.is_online = true then
      update public.rooms
      set participant_count = greatest(0, participant_count - 1)
      where code = old.room_id;
    end if;
  end if;
  return null;
end;
$$;

-- 3. Register the trigger on room_participants
drop trigger if exists trg_sync_room_participant_count on public.room_participants;
create trigger trg_sync_room_participant_count
  after insert or update or delete on public.room_participants
  for each row execute function public.sync_room_participant_count();

-- 4. Backfill count values for existing active rooms
update public.rooms r
set participant_count = (
  select count(*)
  from public.room_participants rp
  where rp.room_id = r.code
    and rp.is_online = true
);
