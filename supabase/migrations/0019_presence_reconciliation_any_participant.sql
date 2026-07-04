-- Migration 0019: Let any participant mark a crashed peer offline, not just the host
--
-- Found in the Session 37 audit: a participant's is_online row can get
-- stuck "true" after a crash/backgrounded tab if no host happens to be
-- connected to run the existing crash-detection reconciliation (client
-- code gates this on isHostRef.current). Worse: since only the room's
-- host may update another participant's row, if the HOST is the one who
-- crashed, literally nobody can ever correct their stale is_online — which
-- also permanently blocks host succession (the 0001 trigger checks
-- `role='host' and is_online=true` before letting anyone self-promote).
--
-- Fix: any current participant of a room may flip ANOTHER participant's
-- is_online from true to false (never to true, never any other column) —
-- this can only ever make the data more accurate, never less, and closes
-- the "stale host blocks succession forever" hole. The host's existing
-- broader (but still is_online-only, per migration 0014) permission is
-- unchanged.

drop policy if exists "participants_update" on public.room_participants;
create policy "participants_update" on public.room_participants
  for update using (
    user_id = auth.uid()::text
    or exists (
      select 1 from public.rooms
      where code = room_id and host_id = auth.uid()::text
    )
    or exists (
      select 1 from public.room_participants rp
      where rp.room_id = room_participants.room_id and rp.user_id = auth.uid()::text
    )
  ) with check (
    user_id = auth.uid()::text
    or exists (
      select 1 from public.rooms
      where code = room_id and host_id = auth.uid()::text
    )
    or exists (
      select 1 from public.room_participants rp
      where rp.room_id = room_participants.room_id and rp.user_id = auth.uid()::text
    )
  );

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

  -- The room's actual host may change is_online on anyone's row (existing
  -- crash-detection behavior).
  if exists (
    select 1 from public.rooms
    where code = old.room_id and host_id = auth.uid()::text
  ) then
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
  end if;

  -- Any other participant of the same room may only flip is_online from
  -- true to false — never to true, never any other column. This is the
  -- new reconciliation path: it can only make stale data more accurate.
  if new.username is distinct from old.username
    or new.avatar_url is distinct from old.avatar_url
    or new.xp is distinct from old.xp
    or new.rank is distinct from old.rank
    or new.role is distinct from old.role
    or new.room_id is distinct from old.room_id
    or new.user_id is distinct from old.user_id
    or new.joined_at is distinct from old.joined_at
    or old.is_online is distinct from true
    or new.is_online is distinct from false
  then
    raise exception 'A participant may only mark another participant''s is_online false.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restrict_host_participant_update on public.room_participants;
create trigger trg_restrict_host_participant_update
  before update on public.room_participants
  for each row execute function public.restrict_host_participant_update();
