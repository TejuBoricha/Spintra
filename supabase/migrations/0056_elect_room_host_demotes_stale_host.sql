-- Migration 0056: elect_room_host demotes the previous host's stale row
--
-- Found while fixing the "join a room whose host already crashed" stuck
-- state: elect_room_host (0046) promotes the new host's row and repoints
-- rooms.host_id, but leaves the dead host's room_participants row at
-- role='host'. Two consequences:
--   1. The People list shows two "Host" entries (one offline) forever.
--   2. If the ex-host later rejoins (their row flips is_online=true with
--      role still 'host'), elect_room_host's "is there another online
--      host?" guard counts them and refuses every future election — a
--      second, harder-to-hit variant of the stuck-room bug.
--
-- The demotion can't be a plain UPDATE inside the function:
-- trg_restrict_host_participant_update (0014) raises on any change to
-- another row's role, regardless of the caller being a SECURITY DEFINER
-- function (RLS is bypassed for the function owner; triggers are not).
-- So this migration:
--   1. Re-creates restrict_host_participant_update() with a
--      transaction-local GUC escape hatch — same pattern award_score
--      established with app.bypass_participant_rate_limit (0050/0052):
--      set_config(..., true) is transaction-scoped, so nothing outside
--      elect_room_host's own transaction can hold the flag.
--   2. Re-creates elect_room_host to set that flag and demote every other
--      role='host' row in the room before promoting the caller. All other
--      lines of both functions are unchanged from 0014/0046.

create or replace function public.restrict_host_participant_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Updating your own row is unrestricted (normal reconnect/profile sync).
  if old.user_id = auth.uid()::text then
    return new;
  end if;

  -- Transaction-local flag set only by elect_room_host (0056): atomic host
  -- election must demote the previous host's stale row, which is exactly
  -- the cross-row role change this trigger otherwise forbids.
  if current_setting('app.electing_room_host', true) = 'true' then
    return new;
  end if;

  if new.username is distinct from old.username
    or new.avatar_url is distinct from old.avatar_url
    or new.xp is distinct from old.xp
    or new.rank is distinct from old.rank
    or new.role is distinct from old.role
    or new.room_id is distinct from old.room_id
    or new.user_id is distinct from old.user_id
    or new.joined_at is distinct from old.joined_at
  then
    raise exception 'A host may only change is_online on another participant''s row.';
  end if;

  return new;
end;
$$;

create or replace function public.elect_room_host(p_room_code text, p_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_exists boolean;
  v_has_online_host boolean;
begin
  -- 1. Verify the room exists
  select exists(select 1 from public.rooms where code = p_room_code) into v_room_exists;
  if not v_room_exists then
    return false;
  end if;

  -- 2. Verify there is no other online host currently in the room
  select exists(
    select 1 from public.room_participants
    where room_id = p_room_code
      and role = 'host'
      and is_online = true
      and user_id <> p_user_id
  ) into v_has_online_host;

  if v_has_online_host then
    return false;
  end if;

  -- 3. Demote the previous host's stale row(s) — transaction-local flag lets
  --    this one cross-row role change through trg_restrict_host_participant_update.
  perform set_config('app.electing_room_host', 'true', true);
  update public.room_participants
  set role = 'participant'
  where room_id = p_room_code and role = 'host' and user_id <> p_user_id;

  -- 4. Update the participant's role to host
  update public.room_participants
  set role = 'host'
  where room_id = p_room_code and user_id = p_user_id;

  -- 5. Update the room's host reference
  update public.rooms
  set host_id = p_user_id
  where code = p_room_code;

  return true;
end;
$$;
