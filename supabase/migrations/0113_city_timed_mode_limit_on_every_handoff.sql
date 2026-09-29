-- Spintra City — Timed mode (audit C-4, product decision 2026-09-29): the time
-- limit now ends the match at the end of the round on every path that hands
-- the turn on, not only when a player presses End turn.
--
-- Timed mode (FR-06, FR-07, FR-50) ends when its wall-clock limit has passed
-- and the current round has completed, ranked on net worth. That check was
-- written once, in city_end_turn_core, so it only ran when someone ended their
-- own turn. A turn ended by the server (an idle player's timeout, the
-- autopilot for an away seat, the 0110 tick) goes through city_advance_turn
-- instead and never looked at the limit: a Timed match whose last seat of a
-- round timed out simply carried on into another round, and on an idle table
-- could run on indefinitely.
--
-- city_advance_turn is the one place every hand-off passes through, so the
-- check now lives there too, with the same condition as city_end_turn_core:
-- the limit has passed and the next seat is at or before the current one (the
-- turn is wrapping to a new round). city_end_turn_core keeps its own check, so
-- the End turn path is unchanged; whichever runs first finishes the match.
-- Once the match is finished nothing below can update it: 0097's freeze trigger
-- refuses writes to a finished row, and every caller already tolerates a null
-- next seat (the same value the function returns when nobody is left).
--
-- city_advance_turn is copied from 0092 (its latest definition) with that check
-- added, and the match row now read whole (it was only current_seat) so the
-- check can see the mode and the limit. CREATE OR REPLACE keeps its privileges,
-- so nothing is granted or revoked here: it stays server-only.

create or replace function public.city_advance_turn(p_match_id uuid)
returns integer
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_current integer;
  v_next integer;
  v_next_owes boolean := false;
begin
  select * into v_match from public.city_matches where id = p_match_id;
  v_current := v_match.current_seat;

  update public.city_trade_offers
     set queued = false
   where match_id = p_match_id and to_seat = v_current and queued = true and status = 'pending';

  select seat into v_next
    from public.city_match_players
   where match_id = p_match_id
     and status not in ('bankrupt', 'retired')
     and seat > v_current
   order by seat limit 1;

  if v_next is null then
    select seat into v_next
      from public.city_match_players
     where match_id = p_match_id
       and status not in ('bankrupt', 'retired')
     order by seat limit 1;
  end if;

  -- Timed mode: the limit has passed and this hand-off starts a new round, so
  -- the round that was in progress is complete. Finish instead of dealing the
  -- next turn. (Same condition as city_end_turn_core.)
  if v_match.status = 'active'
     and v_match.mode = 'timed'
     and v_match.time_limit_minutes is not null
     and now() >= v_match.started_at + make_interval(mins => v_match.time_limit_minutes)
     and v_next is not null
     and v_next <= v_current then
    perform public.city_finish_match(p_match_id, 'time_limit');
    return null;
  end if;

  if v_next is not null then
    select pending_debt > 0 into v_next_owes
      from public.city_match_players
     where match_id = p_match_id and seat = v_next;
  end if;

  update public.city_matches
     set current_seat = v_next,
         phase = case
           when v_next is null then phase
           when v_next_owes then 'required_decision'
           else 'awaiting_roll'
         end,
         turn_number = turn_number + 1,
         doubles_count = 0,
         trade_pause_ms_used = 0,
         trade_pause_started_at = null,
         turn_started_at = now(),
         turn_clock_elapsed_ms = 0,
         turn_clock_paused_at = null,
         debt_started_at = case when v_next_owes then now() else debt_started_at end
   where id = p_match_id and status = 'active';

  return v_next;
end;
$fn$;
