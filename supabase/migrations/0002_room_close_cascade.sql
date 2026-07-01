-- Spintra: cascade cleanup when a room is closed.
--
-- room_participants and chat_messages reference rooms.code via a plain text
-- column (see 0001_init_schema_and_rls.sql's caveat on the app's auth-free
-- trust model) rather than a foreign key, so deleting a room row on its own
-- would leave orphaned participant/message rows behind. This trigger deletes
-- them alongside the room whenever a room is closed (see the "Close Room"
-- host action in room-client.tsx, which deletes the rooms row and relies on
-- every other client's "rooms" DELETE realtime subscription to detect it).

create or replace function public.cleanup_room_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.room_participants where room_id = old.code;
  delete from public.chat_messages where room_id = old.code;
  return old;
end;
$$;

drop trigger if exists trg_cleanup_room_children on public.rooms;
create trigger trg_cleanup_room_children
  before delete on public.rooms
  for each row execute function public.cleanup_room_children();

-- The client's "rooms" DELETE subscription filters on `code=eq.<roomCode>`.
-- Postgres logical replication (which Realtime reads) only ships primary-key
-- columns in the DELETE "old" record by default, and `code` isn't the primary
-- key here (`id` is) — so without this, Realtime can't evaluate the filter
-- against the old row and silently drops the event for every subscriber.
alter table public.rooms replica identity full;
