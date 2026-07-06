-- Migration 0032: Observability for rate-limit/ban trigger rejections
--
-- Found in the Session 41 audit: every rate-limit and ban-enforcement
-- trigger (room creation, chat messages, room joins, message reports, and
-- rejoining after a ban) works correctly, but a rejection is visible only
-- to the one client that triggered it (a toast, then gone) — there is no
-- record anywhere of how often these fire, for which users/rooms, or
-- whether the same identity is repeatedly hitting them (an abuse pattern
-- worth knowing about).
--
-- First attempt at this logged to a moderation_events TABLE, called right
-- before each trigger's `raise exception`. Verified live against the real
-- production database before considering it done — and found it logged
-- zero rows, ever: `raise exception` aborts the entire current transaction,
-- rolling back every data change made within it, including the log INSERT
-- made moments earlier in the same trigger invocation. `RAISE LOG` (a
-- diagnostic message, not a data write) is not part of the transaction's
-- changes and survives exactly the rollback that a table write can't —
-- this is the standard Postgres pattern for "log a rejected action, not
-- just the rejection". Visible via Supabase Dashboard → Logs → Postgres
-- Logs, searchable by "MODERATION_EVENT".

drop table if exists public.moderation_events;

create or replace function public.log_moderation_event(
  p_event_type text,
  p_user_id text,
  p_room_id text,
  p_detail text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise log 'MODERATION_EVENT type=% user_id=% room_id=% detail=%',
    p_event_type, p_user_id, coalesce(p_room_id, '-'), coalesce(p_detail, '-');
end;
$$;

-- ============================================================================
-- 1. Room creation rate limit (0011)
-- ============================================================================
create or replace function public.check_room_creation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room_limit constant integer := 8;
  window_minutes constant integer := 10;
  recent_count integer;
begin
  select count(*) into recent_count
  from public.rooms
  where host_id = new.host_id
    and created_at > now() - (window_minutes || ' minutes')::interval;

  if recent_count >= room_limit then
    perform public.log_moderation_event('room_creation_rate_limit', new.host_id, new.code, recent_count::text || ' rooms in ' || window_minutes || 'm');
    raise exception 'Rate limit exceeded: you can create up to % rooms every % minutes. Please wait before creating another room.', room_limit, window_minutes;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 2. Chat message rate limit (0011)
-- ============================================================================
create or replace function public.check_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  message_limit constant integer := 20;
  window_seconds constant integer := 10;
  recent_count integer;
begin
  select count(*) into recent_count
  from public.chat_messages
  where user_id = new.user_id
    and created_at > now() - (window_seconds || ' seconds')::interval;

  if recent_count >= message_limit then
    perform public.log_moderation_event('message_rate_limit', new.user_id, new.room_id, recent_count::text || ' messages in ' || window_seconds || 's');
    raise exception 'Rate limit exceeded: you can send up to % messages every % seconds. Please slow down.', message_limit, window_seconds;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 3. Room join rate limit (0025)
-- ============================================================================
create or replace function public.check_room_join_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  join_limit constant integer := 20;
  window_minutes constant integer := 10;
  recent_count integer;
begin
  select count(*) into recent_count
  from public.room_participants
  where user_id = new.user_id
    and joined_at > now() - (window_minutes || ' minutes')::interval;

  if recent_count >= join_limit then
    perform public.log_moderation_event('room_join_rate_limit', new.user_id, new.room_id, recent_count::text || ' joins in ' || window_minutes || 'm');
    raise exception 'Rate limit exceeded: you can join up to % rooms every % minutes. Please wait before joining another room.', join_limit, window_minutes;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 4. Message report rate limit (0030)
-- ============================================================================
create or replace function public.check_message_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_limit constant integer := 10;
  window_minutes constant integer := 10;
  recent_count integer;
begin
  select count(*) into recent_count
  from public.message_reports
  where reporter_id = new.reporter_id
    and created_at > now() - (window_minutes || ' minutes')::interval;

  if recent_count >= report_limit then
    perform public.log_moderation_event('message_report_rate_limit', new.reporter_id, new.room_id, recent_count::text || ' reports in ' || window_minutes || 'm');
    raise exception 'Rate limit exceeded: you can submit up to % reports every % minutes. Please wait before reporting again.', report_limit, window_minutes;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 5. Banned-user rejoin rejection (0012)
-- ============================================================================
create or replace function public.check_room_ban_before_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.room_bans
    where room_id = new.room_id and user_id = new.user_id
  ) then
    perform public.log_moderation_event('banned_user_rejoin_attempt', new.user_id, new.room_id, null);
    raise exception 'You have been banned from this room by the host.';
  end if;
  return new;
end;
$$;
