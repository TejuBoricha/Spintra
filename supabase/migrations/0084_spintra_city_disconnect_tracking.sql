-- Spintra City — BUG-007 round A: disconnect detection (FR-25, hardens FR-30).
--
-- Foundational for the autopilot/forced-retire/durable-pause rounds that
-- follow (C/D) -- they all need to know which seats are genuinely away, and
-- there is no such concept anywhere in city_match_players today.
--
-- No new client heartbeat or polling: this bridges the site-wide presence
-- system every other activity already uses (room_participants.is_online,
-- src/app/room/[code]/hooks/use-room-subscription.ts) into City's own state,
-- via the exact join precedent migration 0074's own departure trigger already
-- established -- room_participants.room_id holds the room CODE, matching
-- city_matches.room_code (confirmed by 0074's own comment). The existing
-- presence-reconciliation "confirm after 4s" debounce (Session 61,
-- AI_CONTEXT.md) runs upstream of is_online itself changing, so this trigger
-- inherits that debouncing for free -- it must not, and does not,
-- re-implement it.
--
-- Restricted to active matches, mirroring 0074's own trigger exactly: a lobby
-- match has no turn clock or autopilot to protect yet, so tracking presence
-- churn before a match even starts would be pure overhead with nothing to
-- read it. consecutive_autopilot_turns already exists as a column (0063) but
-- has never been read or written anywhere -- reset here on reconnect so it is
-- ready for round C to increment, rather than left stale from a hypothetical
-- future feature that was never wired up.
alter table public.city_match_players
  add column if not exists disconnected_at timestamptz;

create or replace function public.city_track_disconnect()
returns trigger
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match_id uuid;
  v_seat integer;
begin
  select m.id, p.seat into v_match_id, v_seat
    from public.city_matches m
    join public.city_match_players p on p.match_id = m.id
   where m.room_code = new.room_id
     and m.status = 'active'
     and p.user_id = new.user_id
     and p.status in ('seated', 'active');

  if v_match_id is null then
    return new;
  end if;

  if new.is_online then
    -- Reconnect: the grace period and any autopilot streak are both over.
    update public.city_match_players
       set disconnected_at = null,
           consecutive_autopilot_turns = 0
     where match_id = v_match_id and seat = v_seat;
  else
    -- Disconnect: flagged immediately (DESIGN.md §3.1B), no gameplay effect
    -- of its own -- the 60s grace period and autopilot-eligibility are pure
    -- derivations of this timestamp, read by later rounds, not written here.
    update public.city_match_players
       set disconnected_at = now()
     where match_id = v_match_id and seat = v_seat and disconnected_at is null;
  end if;

  return new;
end;
$fn$;

-- Postgres refuses to invoke a trigger function outside trigger context, so
-- this is not independently exploitable -- but it is unearned all the same,
-- same reasoning as 0074's identical revoke on its own trigger function.
revoke all on function public.city_track_disconnect() from public, anon, authenticated;

drop trigger if exists city_track_disconnect on public.room_participants;

create trigger city_track_disconnect
after update of is_online on public.room_participants
for each row
when (old.is_online is distinct from new.is_online)
execute function public.city_track_disconnect();
