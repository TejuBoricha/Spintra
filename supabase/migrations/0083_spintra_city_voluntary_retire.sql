-- Spintra City — BUG-007 round E: voluntary retire (FR-29's other half).
--
-- Migration 0074 already gave kick/ban/room-leave full match awareness via
-- city_retire_seat, fired by a trigger on room_participants deletion. What was
-- still missing is the case where a player stays in the room but wants out of
-- the MATCH specifically: city_retire_seat itself is internal-only (revoked
-- from public/anon/authenticated at 0074:113), reachable exclusively through
-- that trigger, so there was no client-callable "I retire" action.
--
-- This is a thin shell, not new game logic. It authorizes and rate-limits
-- exactly like every other command RPC, resolves the caller's own seat, and
-- delegates to the existing city_retire_seat — the same liquidation-to-the-
-- bank sequence kick/ban/leave already use (DESIGN.md §3.1D: "Retire /
-- forced retire / mid-match kick: treated exactly as bankruptcy to the
-- bank"). No debt gate: a player may retire while owing a debt exactly as
-- DESIGN.md describes — retiring forgives the debt to the bank rather than
-- requiring it be settled first, identical to today's kick/leave behavior.
create or replace function public.city_retire_self(p_match_id uuid)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;

  select * into v_match from public.city_matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'CITY_MATCH_NOT_FOUND';
  end if;

  perform public.city_rate_limit_check(v_match.room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  select * into v_match from public.city_matches where id = p_match_id;

  if v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_me.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.status in ('bankrupt', 'retired') then
    raise exception 'CITY_SEAT_OUT';
  end if;

  perform public.city_retire_seat(p_match_id, v_me.seat);
end;
$$;

grant execute on function public.city_retire_self(uuid) to anon, authenticated;
