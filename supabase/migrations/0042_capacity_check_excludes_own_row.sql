-- Migration 0042: Room capacity check must not count the joining user's own row
--
-- Found live while manually testing this session's fixes: joining a room
-- capped at 2 as a genuine 2nd participant raised "This room has reached
-- its maximum participant limit of 2" even though the join actually
-- succeeded (confirmed via direct DB query: both rows existed, is_online =
-- true). Root cause: `check_room_limit_before_join()` (0009, online-only
-- counting added 0026, TOCTOU race closed 0029) is a `before insert`
-- trigger that fires on every upsert attempt against room_participants,
-- including one that will resolve via `on conflict (room_id, user_id) do
-- update` into updating the caller's OWN existing row rather than adding a
-- new participant. The count query never excluded `new.user_id`, so a
-- redundant/duplicate upsert for a user who is already one of the counted
-- online participants can see the room at capacity (because they
-- themselves are one of the online rows) and reject its own upsert.
--
-- In dev mode this reliably reproduces via React Strict Mode's intentional
-- double-invocation of effects (a diagnostic-only behavior in `next dev`,
-- not production): the room-join effect can call the join upsert twice in
-- quick succession before the first call's result is reflected back,
-- so the second call still believes it's a "new" join. The same flaw could
-- also misfire in production during a legitimate fast-reconnect race (a
-- stale "not yet a participant" snapshot triggering a genuine upsert-for-
-- self before the caller's own prior row is recognized) — a narrow but
-- real correctness gap, not just a dev-mode artifact.
--
-- Fix: exclude the joining user's own row from the capacity count. A
-- genuinely new participant still correctly gets blocked once the room is
-- at capacity (their own row can't already be one of the counted rows);
-- only a self-referential upsert for someone already online is exempted.

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
  -- Serializes concurrent joins to this specific room so the count below
  -- can't be read by two transactions before either has inserted its row.
  perform pg_advisory_xact_lock(hashtextextended(new.room_id, 0));

  -- Get the limit from the rooms table
  select max_participants into max_limit from public.rooms where code = new.room_id;

  -- If room doesn't exist, let it fail at foreign key constraint
  if max_limit is null then
    return new;
  end if;

  -- Count only currently online participants, excluding the joining user's
  -- own row if they already have one — an upsert that resolves to updating
  -- their own existing row isn't adding a new body to the room, so it must
  -- not be counted against their own capacity check.
  select count(*) into current_count
  from public.room_participants
  where room_id = new.room_id and is_online = true and user_id <> new.user_id;

  if current_count >= max_limit then
    raise exception 'This room has reached its maximum participant limit of %', max_limit;
  end if;

  return new;
end;
$$;
