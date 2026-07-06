-- Migration 0029: Close the room-capacity check's TOCTOU race
--
-- Found in the Session 41 audit: check_room_limit_before_join() (0009,
-- fixed for online-only counting in 0026) counts rows and compares against
-- max_participants with no locking. Under Postgres's default READ COMMITTED
-- isolation, two concurrent joins to the same room each run their own
-- `select count(*)` before either INSERT commits — neither sees the other's
-- uncommitted row, so both can see room for one last slot and both insert,
-- letting a room exceed max_participants under concurrent joins.
--
-- Fixed with a transaction-scoped advisory lock keyed on the room code:
-- pg_advisory_xact_lock serializes the count-then-insert for joins racing on
-- the *same* room (the second waits for the first transaction to commit or
-- roll back, so it always sees the up-to-date count) while joins to
-- different rooms remain fully concurrent (different lock keys). The lock
-- is released automatically at transaction end, including on the
-- exception's implicit rollback.

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
