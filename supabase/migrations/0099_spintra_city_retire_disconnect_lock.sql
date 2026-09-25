-- Spintra City — closes a concurrent-departure deadlock found by a fresh
-- 8-agent review round on PR #43 (2026-09-21), verified by reading the
-- current live code directly: neither city_retire_seat (called from the
-- kick/ban/leave-room trigger city_retire_seat_on_departure, 0090) nor
-- city_track_disconnect's durable-pause resume branch (0098) takes the
-- per-match pg_advisory_xact_lock every other match-mutating RPC takes
-- (city_roll_dice, city_claim_timeout, city_retire_self, etc. all take it
-- as their first DB operation on the match). city_retire_self already does
-- this correctly (0090) -- the gap is specific to the two paths above.
--
-- Failure scenario (city_retire_seat): 3 active seats remain. Two players
-- leave the room in the same instant (two separate DELETE FROM
-- room_participants statements = two separate concurrent transactions --
-- e.g. two frustrated players both clicking "Leave" at once, or a kick
-- racing a voluntary leave). Each transaction's city_retire_seat reads
-- city_match_players under READ COMMITTED before the other's UPDATE has
-- committed, so each independently computes v_left = 2 (itself retired, but
-- not yet seeing the other's concurrent retirement) and neither calls
-- city_finish_match. Both commit. The match now has exactly one active seat
-- left but status stays 'active' forever -- nobody advances the turn, no
-- finish is ever triggered, and the room is stuck until an unrelated action
-- happens to re-check win conditions (nothing currently does). The same
-- shape of bug this PR has already closed three times over in city_matches
-- writes (0092/0096/0097/0098) -- this is the analogous gap in the
-- seat-count race that decides whether to finish the match at all.
--
-- Failure scenario (city_track_disconnect's resume branch): two seats of a
-- durably-paused match reconnect in the same instant. Both read
-- status='paused' before either's UPDATE commits, so both independently
-- shift started_at forward by the pause duration and credit the trade-pause
-- budget -- doubling both adjustments instead of applying them once. Lower
-- severity than the deadlock above (self-correcting rather than a permanent
-- stuck state), but the same missing-lock shape, fixed in the same
-- migration since both functions are touched here anyway.
--
-- Fix: take the same lock every other match RPC takes, as the first
-- operation once the match is known, in both places. city_retire_seat gets
-- it at its own top rather than only at each call site, so every current
-- and future caller (the departure trigger, city_retire_self, which already
-- took it before calling this and is unaffected -- pg_advisory_xact_lock is
-- reentrant within one transaction) is covered by one change, matching this
-- codebase's own established "put the shared invariant in the one function
-- everyone already calls" convention (see city_rate_limit_check, 0071).

create or replace function public.city_retire_seat(p_match_id uuid, p_seat integer)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_me public.city_match_players;
  v_left integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));

  select * into v_match from public.city_matches where id = p_match_id;
  if v_match.id is null or v_match.status <> 'active' then
    return;
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;
  if v_me.id is null or v_me.status not in ('seated', 'active') then
    return;
  end if;

  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = p_match_id and status = 'pending'
     and (from_seat = p_seat or to_seat = p_seat);

  delete from public.city_debt_queue where match_id = p_match_id and debtor_seat = p_seat;

  delete from public.city_assets where match_id = p_match_id and owner_seat = p_seat;

  update public.city_match_players
     set status = 'retired', cash = 0, final_net_worth = 0,
         pending_debt = 0, pending_creditor_seat = null,
         disconnected_at = null, consecutive_autopilot_turns = 0
   where match_id = p_match_id and seat = p_seat;

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'retired', p_seat, '{}'::jsonb);

  if v_match.current_seat = p_seat then
    perform public.city_advance_turn(p_match_id);
  end if;

  select count(*) into v_left
    from public.city_match_players
   where match_id = p_match_id and status not in ('bankrupt', 'retired');

  if v_left <= 1 then
    perform public.city_finish_match(p_match_id, 'last_player_standing');
  end if;
end;
$fn$;

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
      -- Two seats of the same paused match reconnecting in the same instant
      -- would otherwise both read status='paused' before either's resume
      -- UPDATE commits, double-applying the started_at shift and the
      -- trade-pause credit below. Same lock every other match-mutating path
      -- takes, taken here for the first time this function needs it.
      perform pg_advisory_xact_lock(hashtextextended(v_match_id::text, 0));

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
             turn_clock_paused_at = null,
             debt_started_at = case when debt_started_at is not null then now() else null end,
             trade_pause_ms_used = trade_pause_ms_used + case
               when trade_pause_started_at is not null
                 then round(extract(epoch from (now() - trade_pause_started_at)) * 1000)::integer
               else 0 end,
             trade_pause_started_at = null
       -- Re-check status='paused' under the lock: a concurrent resume that
       -- landed first (and released the lock) already flipped this row to
       -- 'active', and this UPDATE must not re-apply the shift/credit above
       -- a second time.
       where id = v_match_id and status = 'paused';

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
