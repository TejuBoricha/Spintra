-- Migration 0062: Close the rooms-table privacy bypass.
--
-- "rooms_select" (0005_enable_anonymous_auth_rls.sql) has been `using (true)`
-- since anonymous auth was introduced, and was never tightened when
-- room_participants/chat_messages were hardened in migration 0009 (that
-- migration's own comment, carried into 0035, explicitly notes this was
-- still true and left unaddressed). In practice this means any anon-key
-- holder — the key ships in every page load, it is not a secret — can list
-- every room ever created via a direct REST call, including private ones:
-- code, name, type, host_id, is_locked. Since a room's `code` is the actual
-- join credential ("Off = invite-only via code" per the create-room UI),
-- this fully defeats privacy for any private, unlocked room: a stranger
-- doesn't need an invite, they can enumerate codes directly and join.
--
-- The fix has two parts:
--   1. Tighten "rooms_select" to the same is_public/host/member pattern
--      migration 0009 already uses for room_participants/chat_messages.
--   2. RLS policies decide visibility per-row from the requester's identity
--      alone — they cannot see "the caller already knew this exact code"
--      versus "the caller enumerated all rows". A policy tight enough to
--      stop enumeration would also block a legitimate invited friend from
--      looking up the one room they were actually given a code for. So a
--      SECURITY DEFINER RPC (get_room_by_code) is added for the "I have an
--      exact code, tell me about this one room" case the join flow needs —
--      matching the existing is_member_of_room/elect_room_host pattern.
--      Enumeration is impossible through it: it takes exactly one code and
--      returns at most one row (code is UNIQUE), never a list.

drop policy if exists "rooms_select" on public.rooms;
create policy "rooms_select" on public.rooms
  for select using (
    is_public = true
    or host_id = auth.uid()::text
    or public.is_member_of_room(code, auth.uid()::text)
  );

create or replace function public.get_room_by_code(p_code text)
returns table (
  id uuid,
  code text,
  name text,
  type text,
  is_locked boolean,
  max_participants integer,
  host_id text
)
security definer
set search_path = public
language sql
stable
as $$
  select r.id, r.code, r.name, r.type, r.is_locked, r.max_participants, r.host_id
  from public.rooms r
  where r.code = p_code;
$$;

revoke execute on function public.get_room_by_code(text) from public;
grant execute on function public.get_room_by_code(text) to anon, authenticated;
