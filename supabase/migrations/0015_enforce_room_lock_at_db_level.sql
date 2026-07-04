-- Migration 0015: Enforce room lock at the database level
--
-- Found in the Session 37 pre-launch audit: locking a room only blocked new
-- joins/chat client-side (use-room-subscription.ts / use-room-chat.ts) — a
-- direct Supabase call from devtools bypassed it entirely. These triggers
-- mirror the client's own semantics: the host can always join/chat in their
-- own room; anyone else is blocked while the room is locked. Existing
-- participants reconnecting always go through UPDATE, never INSERT, so a
-- before-insert check here only ever affects genuinely new joins — the same
-- case the client already restricts.

create or replace function public.check_room_lock_before_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room_locked boolean;
  room_host_id text;
begin
  select is_locked, host_id into room_locked, room_host_id
  from public.rooms
  where code = new.room_id;

  if room_locked and new.user_id <> room_host_id then
    raise exception 'This room is locked by the host.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_room_lock_before_join on public.room_participants;
create trigger trg_check_room_lock_before_join
  before insert on public.room_participants
  for each row execute function public.check_room_lock_before_join();

create or replace function public.check_room_lock_before_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room_locked boolean;
  room_host_id text;
begin
  select is_locked, host_id into room_locked, room_host_id
  from public.rooms
  where code = new.room_id;

  if room_locked and new.user_id <> room_host_id then
    raise exception 'This room is locked — only the host can send messages right now.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_room_lock_before_message on public.chat_messages;
create trigger trg_check_room_lock_before_message
  before insert on public.chat_messages
  for each row execute function public.check_room_lock_before_message();
