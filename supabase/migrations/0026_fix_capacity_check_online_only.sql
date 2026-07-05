-- Migration 0026: Room capacity should only count online participants
--
-- Found live while the user was testing Session 41's fixes: a room's
-- effective capacity was shrinking permanently every time someone joined
-- and later disconnected, because a disconnected participant's row is kept
-- (updated to is_online = false), not deleted — see the presence-cleanup
-- effect in use-room-subscription.ts. Both this trigger and every
-- client-side pre-join capacity check (home page, explore page, navbar
-- quick-join, room-client.tsx's verifyAccess) counted every row in
-- room_participants for a room regardless of is_online, so a max_participants
-- = 2 room with one person still connected and one who left an hour ago
-- was permanently treated as full, blocking new joins indefinitely.

create or replace function public.check_room_limit_before_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  max_limit integer;
begin
  -- Get the limit from the rooms table
  select max_participants into max_limit from public.rooms where code = new.room_id;

  -- If room doesn't exist, let it fail at foreign key constraint
  if max_limit is null then
    return new;
  end if;

  -- Count only currently online participants — a disconnected participant's
  -- row is marked is_online = false, not deleted, so it must not count
  -- against capacity.
  select count(*) into current_count
  from public.room_participants
  where room_id = new.room_id and is_online = true;

  if current_count >= max_limit then
    raise exception 'This room has reached its maximum participant limit of %', max_limit;
  end if;

  return new;
end;
$$;
