-- Migration 0011: Rate Limiting on Room Creation and Chat Messages
--
-- Prevents anonymous-session spam ahead of public launch: mass room creation
-- and chat flooding. Follows the same before-insert trigger pattern as
-- migration 0009's check_room_limit_before_join (security definer, count +
-- raise exception). RLS already guarantees rooms.host_id / chat_messages.user_id
-- equal auth.uid(), so counting by that column can't be spoofed by a client.

-- ============================================================================
-- 1. Room Creation Rate Limit
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
    raise exception 'Rate limit exceeded: you can create up to % rooms every % minutes. Please wait before creating another room.', room_limit, window_minutes;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_room_creation_rate_limit on public.rooms;
create trigger trg_check_room_creation_rate_limit
  before insert on public.rooms
  for each row execute function public.check_room_creation_rate_limit();

create index if not exists rooms_host_id_created_at_idx
  on public.rooms (host_id, created_at);

-- ============================================================================
-- 2. Chat Message Rate Limit
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
    raise exception 'Rate limit exceeded: you can send up to % messages every % seconds. Please slow down.', message_limit, window_seconds;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_message_rate_limit on public.chat_messages;
create trigger trg_check_message_rate_limit
  before insert on public.chat_messages
  for each row execute function public.check_message_rate_limit();

create index if not exists chat_messages_user_id_created_at_idx
  on public.chat_messages (user_id, created_at);
