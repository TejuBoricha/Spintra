-- Spintra City — BUG-007 round D: durable full-match pause (FR-31, FR-48).
--
-- No cron work needed here -- cleanup_inactive_rooms() (0063) already gives
-- City rooms a 24h threshold instead of the standard 2h, specifically
-- because of this exact requirement (its own comment cites it). This round
-- is purely about the match reaching `status='paused'` at all (it never has
-- before now) and resuming correctly.
--
-- New column: when the match paused (needed to shift the timed-mode wall
-- clock forward by the pause duration on resume -- FR-50's "only pauses for
-- a full-match pause" is precisely this case, distinct from an ordinary
-- turn-clock pause). city_matches has been column-grant-restricted since
-- 0063 (BUG-035/0081 already caught this once this session), so the new
-- column needs an explicit grant, unlike a column on city_match_players.
alter table public.city_matches
  add column if not exists paused_at timestamptz;

grant select (paused_at) on public.city_matches to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. The pause transition itself -- city_run_autopilot_from_current's loop
--    already tracked v_found_present but never acted on it (deliberately
--    left for this round, per 0086's own header comment).
--
--    Also fixes a real bug in 0086's own loop bound, found while testing
--    this exact pause transition: it exited at `i > v_seat_count + 1`, one
--    iteration MORE than the number of distinct seats -- meaning with N
--    seats all away, the loop necessarily revisits one of them a 2nd time
--    (pigeonhole: N+1 resolutions across only N seats) before giving up.
--    That "extra" revisit counts toward the SAME forced-retire streak a
--    genuine 2nd turn would (FR-28), so purely detecting "is anyone home"
--    could spuriously force-retire whichever seat happened to be resolved
--    first -- a real player, every bit as away as the rest of the table,
--    penalised only for being first in line. The bound is exactly
--    v_seat_count: checking each seat once is sufficient to conclude nobody
--    is present, and never revisits a seat within one pause-detection pass.
-- ---------------------------------------------------------------------------
create or replace function public.city_run_autopilot_from_current(p_match_id uuid)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_current integer;
  v_seat public.city_match_players;
  v_away boolean;
  v_result text;
  v_streak integer;
  v_seat_count integer;
  v_found_present boolean := false;
  i integer := 0;
begin
  select count(*) into v_seat_count from public.city_match_players
   where match_id = p_match_id and status not in ('bankrupt', 'retired');

  loop
    i := i + 1;
    exit when i > v_seat_count;

    select current_seat into v_current from public.city_matches where id = p_match_id;
    exit when v_current is null;

    select * into v_seat from public.city_match_players
     where match_id = p_match_id and seat = v_current;

    v_away := v_seat.disconnected_at is not null
      and now() - v_seat.disconnected_at >= interval '60 seconds';

    if not v_away then
      v_found_present := true;
      exit;
    end if;

    v_result := public.city_resolve_autopilot_turn(p_match_id, v_current);

    if v_result = 'auction_pending' then
      v_found_present := true;
      exit;
    end if;

    if v_result = 'bankrupt' then
      perform public.city_advance_turn(p_match_id);
      continue;
    end if;

    update public.city_match_players
       set consecutive_autopilot_turns = consecutive_autopilot_turns + 1
     where match_id = p_match_id and seat = v_current
    returning consecutive_autopilot_turns into v_streak;

    if v_streak >= 2 then
      perform public.city_retire_seat(p_match_id, v_current);
    else
      perform public.city_advance_turn(p_match_id);
    end if;
  end loop;

  -- FR-31: cycled through every active seat (or ran out of seats to check)
  -- without finding anyone present, and didn't stop for an independently-
  -- resolving auction either -- the match pauses durably rather than being
  -- silently stuck on a stalled table forever. The `status = 'active'`
  -- guard makes this a no-op once the match has already finished (e.g. a
  -- bankruptcy cascaded down to the last player mid-loop).
  if not v_found_present then
    update public.city_matches set status = 'paused', paused_at = now()
     where id = p_match_id and status = 'active';
  end if;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Resume on reconnect (FR-48) -- the one branch 0084's disconnect-
--    tracking trigger deliberately left unwritten, since status='paused'
--    wasn't reachable until part 1 above existed. FR-48: a fresh full turn
--    clock, not the stored remainder -- unlike the auction/trade pause
--    mechanism, which preserves the true remainder, a match paused for
--    minutes or hours makes a preserved remainder absurd (DESIGN.md's own
--    example: instantly timing out on a 3-second leftover from six hours
--    ago). The timed-mode wall clock (`started_at`) is a different case and
--    DOES shift by the exact pause duration, the same mechanism 0085's
--    auction fix already established, so a long pause doesn't silently eat
--    into the match's own time limit.
-- ---------------------------------------------------------------------------
create or replace function public.city_track_disconnect()
returns trigger
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match_id uuid;
  v_seat integer;
  v_was_paused_at timestamptz;
begin
  select m.id, p.seat into v_match_id, v_seat
    from public.city_matches m
    join public.city_match_players p on p.match_id = m.id
   where m.room_code = new.room_id
     and m.status = 'active'
     and p.user_id = new.user_id
     and p.status in ('seated', 'active');

  if v_match_id is not null then
    if new.is_online then
      update public.city_match_players
         set disconnected_at = null,
             consecutive_autopilot_turns = 0
       where match_id = v_match_id and seat = v_seat;
    else
      update public.city_match_players
         set disconnected_at = now()
       where match_id = v_match_id and seat = v_seat and disconnected_at is null;
    end if;
    return new;
  end if;

  -- The match wasn't 'active' above -- the one case still worth checking is
  -- a 'paused' match this reconnecting user is actually seated in, which the
  -- query above deliberately excludes (it only matches active matches).
  if new.is_online then
    select m.id, m.paused_at, p.seat into v_match_id, v_was_paused_at, v_seat
      from public.city_matches m
      join public.city_match_players p on p.match_id = m.id
     where m.room_code = new.room_id
       and m.status = 'paused'
       and p.user_id = new.user_id
       and p.status in ('seated', 'active');

    if v_match_id is not null then
      update public.city_match_players
         set disconnected_at = null,
             consecutive_autopilot_turns = 0
       where match_id = v_match_id and seat = v_seat;

      update public.city_matches
         set status = 'active',
             paused_at = null,
             started_at = case when v_was_paused_at is not null
               then started_at + (now() - v_was_paused_at)
               else started_at end,
             turn_started_at = now(),
             turn_clock_elapsed_ms = 0,
             turn_clock_paused_at = null
       where id = v_match_id;

      -- The reconnecting player may not even be current_seat -- if whoever
      -- is still away, resolve immediately rather than waiting on a future
      -- clock expiry, same as every other resume/advance path in this plan.
      perform public.city_run_autopilot_from_current(v_match_id);
    end if;
  end if;

  return new;
end;
$fn$;

revoke all on function public.city_track_disconnect() from public, anon, authenticated;

drop trigger if exists city_track_disconnect on public.room_participants;
create trigger city_track_disconnect
after update of is_online on public.room_participants
for each row
when (old.is_online is distinct from new.is_online)
execute function public.city_track_disconnect();
