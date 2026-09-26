-- Classroom safeguards and retention limits (audit X-3, D-7, Q-1).
--
-- 1. The teacher stays the teacher. rooms.created_by records who created
--    a room (server-set, never changed). In a Classroom room only its
--    creator can be host: without this, a teacher whose laptop slept for
--    15 seconds would be replaced by a student (elect_room_host), who would
--    then hold host powers over the class.
--
-- 2. In Classroom rooms only the teacher (the creator) can post in chat.
--    Their users are often children, and free-text chat is how personal
--    details get shared; the teacher can still post instructions. Reading
--    chat and reporting messages are unchanged. The app shows students why
--    their message box is gone (room-sidebar.tsx).
--
-- 3. Retention the privacy policy can promise truthfully:
--    * Rooms with nobody online are still deleted once they're 2 hours
--      old (24 for Spintra City). That depends on presence being right,
--      which it isn't yet (audit R-3: closing a tab never marks you
--      offline, so on production no room has ever been cleaned up). Until
--      that's fixed, and as a backstop after, every room is deleted 7 days
--      after it was created (30 for Spintra City, whose matches can pause
--      for days), with everything that cascades from it: participants,
--      chat, reports, scores, game state, bans.
--    * Spintra's own usage counts (analytics_events) are kept 12 months.
--    * The rate-limit ledgers only matter for minutes; they're kept a day.

alter table public.rooms add column if not exists created_by text;
-- Existing rooms: the creator isn't recorded anywhere, so whoever hosts
-- the room now is treated as its creator. That keeps things as they are
-- (nobody gains or loses a room), and keeps host_id = created_by in every
-- Classroom room from here on, since election can't move it. Guessing from
-- the earliest participant was considered and rejected: a teacher who left
-- and rejoined would lose their own room to a student. Every pre-existing
-- room is removed by the 7-day limit below within a week anyway.
update public.rooms set created_by = host_id where created_by is null;

create or replace function public.force_room_insert_values()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- rooms_insert already requires host_id = auth.uid(), so the creator is
  -- the host at creation.
  new.created_by := new.host_id;
  if auth.uid() is null then
    return new;
  end if;
  new.created_at := now();
  new.participant_count := 0;
  return new;
end;
$$;

-- 0106's version, with created_by added to the server-managed columns.
create or replace function public.restrict_host_promotion_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if current_setting('app.electing_room_host', true) = 'true' then
    if (to_jsonb(new) - 'host_id') is distinct from (to_jsonb(old) - 'host_id') then
      raise exception 'Host election may only change host_id.';
    end if;
    return new;
  end if;

  if pg_trigger_depth() > 1 then
    if (to_jsonb(new) - 'participant_count') is distinct from (to_jsonb(old) - 'participant_count') then
      raise exception 'Only participant_count may change here.';
    end if;
    return new;
  end if;

  if new.host_id is distinct from old.host_id
    or new.participant_count is distinct from old.participant_count
    or new.created_at is distinct from old.created_at
    or new.created_by is distinct from old.created_by
    or new.code is distinct from old.code
    or new.id is distinct from old.id
  then
    raise exception 'That room field is managed by the server.';
  end if;

  return new;
end;
$$;

-- 0106's version, plus: a Classroom room is only ever hosted by its creator.
create or replace function public.elect_room_host(p_room_code text, p_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_host_id text;
  v_room_type text;
  v_created_by text;
  v_has_online_host boolean;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid()::text then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_room_code));

  select host_id, type, created_by into v_current_host_id, v_room_type, v_created_by
  from public.rooms
  where code = p_room_code;

  if not found then
    return false;
  end if;

  if v_current_host_id = p_user_id then
    return false;
  end if;

  if v_room_type = 'classroom' and p_user_id is distinct from v_created_by then
    return false;
  end if;

  if not exists (
    select 1 from public.room_participants
    where room_id = p_room_code and user_id = p_user_id and is_online = true
  ) then
    return false;
  end if;

  -- The current host must be offline, and for at least 15 seconds (0106).
  select exists(
    select 1 from public.room_participants
    where room_id = p_room_code
      and role = 'host'
      and user_id <> p_user_id
      and (is_online = true or offline_since > now() - interval '15 seconds')
  ) into v_has_online_host;

  if v_has_online_host then
    return false;
  end if;

  perform set_config('app.electing_room_host', 'true', true);
  update public.room_participants
  set role = 'participant'
  where room_id = p_room_code and role = 'host' and user_id <> p_user_id;

  update public.room_participants
  set role = 'host'
  where room_id = p_room_code and user_id = p_user_id;

  update public.rooms
  set host_id = p_user_id
  where code = p_room_code;

  return true;
end;
$$;

revoke execute on function public.elect_room_host(text, text) from public, anon;
grant execute on function public.elect_room_host(text, text) to authenticated;

create or replace function public.restrict_classroom_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.rooms
    where code = new.room_id and type = 'classroom' and created_by is distinct from new.user_id
  ) then
    raise exception 'In Classroom rooms only the teacher can post in chat.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restrict_classroom_chat on public.chat_messages;
create trigger trg_restrict_classroom_chat
  before insert on public.chat_messages
  for each row execute function public.restrict_classroom_chat();

create or replace function public.cleanup_inactive_rooms()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Lets the delete through prevent_room_delete_with_live_match (0063).
  perform set_config('app.force_close_room', 'true', true);

  delete from public.rooms
  where code not in (
    select distinct room_id from public.room_participants where is_online = true
  )
  and created_at < now() - interval '2 hours'
  and type <> 'city';

  delete from public.rooms
  where code not in (
    select distinct room_id from public.room_participants where is_online = true
  )
  and created_at < now() - interval '24 hours'
  and type = 'city';

  -- Backstop, whatever presence says.
  delete from public.rooms
  where (type <> 'city' and created_at < now() - interval '7 days')
     or (type = 'city' and created_at < now() - interval '30 days');

  delete from public.analytics_events
  where created_at < now() - interval '12 months';

  delete from public.city_command_attempts
  where created_at < now() - interval '1 hour';
  delete from public.room_participants_update_attempts
  where created_at < now() - interval '1 day';
  delete from public.analytics_events_insert_attempts
  where created_at < now() - interval '1 day';
end;
$$;

revoke execute on function public.cleanup_inactive_rooms() from public, anon, authenticated;
