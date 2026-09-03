-- Spintra City — PR #43 review fixes.
--
-- A 20-agent code review (2 rounds of 10) against the not-yet-merged
-- feat/spintra-city-design branch found, and this migration closes:
--
--   1. Bankruptcy deadlock: city_bankrupt_seat never handed off the turn
--      (unlike its sibling city_retire_seat), so any bankruptcy that didn't
--      finish the match left current_seat/phase stuck forever — reachable
--      through the ordinary "Declare Bankruptcy" button, not just an edge
--      case. The self-heal path (city_claim_timeout's debt branch) had the
--      identical gap.
--   2. Finished-match resurrection: city_advance_turn's final UPDATE had no
--      `status = 'active'` guard, so a caller reaching it after a nested
--      bankruptcy had already called city_finish_match (status='finished',
--      current_seat=null, phase=null) would write a live-looking turn state
--      back onto the finished row. city_run_autopilot_from_current's own
--      pause-transition UPDATE, 19 lines from the unguarded call, already
--      carried `and status = 'active'` — this was an inconsistency, not an
--      unknown pattern.
--   3. Rounding truncation: the BUG-030 fix (0082) moved city_mortgage_core
--      to `round(price / 2.0)`, but three siblings computing the same
--      "half of build/mortgage value" were never updated to match —
--      city_bankrupt_seat's creditor payout, city_max_liquidation's
--      solvency check, and city_sell_building_core's bank buyback all still
--      truncate. city_max_liquidation disagreeing with city_mortgage_core
--      can force an avoidable bankruptcy (a player who could actually cover
--      a debt by mortgaging is told they can't, by exactly $0.50-$1).
--   4. Detention-bankruptcy mislabeling: city_leave_detention_core's 'pay'
--      and forced-pay branches only checked city_charge's result for
--      'must_raise_funds', so a 'bankrupt' outcome fell through and was
--      reported as a successful release.
--   5. Two auto-resolution branches (failed detention roll; decline-with-
--      no-auction) never refreshed turn_started_at, letting the same
--      still-expired clock immediately re-trigger the next claim_timeout
--      resolution instead of giving the intended per-window pacing.
--   6. city_buy_property was never migrated onto the bankrupt/retired
--      seat-out check every sibling management action gets via
--      city_assert_can_manage (it predates that helper, from 0065).
--   7. city_end_turn_core had no guard against ending a turn while the
--      trade-pause clock is active, silently discarding the pause
--      accounting instead of blocking or resolving it.
--
-- All 7 are launch-blocking or data-correctness bugs found before the
-- feature was merged or its migrations applied to production — nothing
-- here has ever been live.

-- ---------------------------------------------------------------------------
-- 1. city_advance_turn — add the missing status guard (closes #2), and hand
--    a debt-carrying seat a correctly-labeled decision phase with a fresh
--    90s window instead of silently starting them at 'awaiting_roll' with a
--    stale (or absent) debt_started_at.
-- ---------------------------------------------------------------------------
create or replace function public.city_advance_turn(p_match_id uuid)
returns integer
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_current integer;
  v_next integer;
  v_next_owes boolean := false;
begin
  select current_seat into v_current from public.city_matches where id = p_match_id;

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

-- ---------------------------------------------------------------------------
-- 2. city_bankrupt_seat — hand off the turn when the bankrupted seat held
--    it (mirroring city_retire_seat's existing `if v_match.current_seat =
--    p_seat then perform city_advance_turn(...)` pattern exactly), only
--    when the match isn't finishing — closes #1. Also fixes the building-
--    valuation rounding (#3).
-- ---------------------------------------------------------------------------
create or replace function public.city_bankrupt_seat(
  p_match_id uuid, p_seat integer, p_creditor_seat integer
)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_cash integer;
  v_left integer;
  v_developments integer;
begin
  select * into v_match from public.city_matches where id = p_match_id;

  select cash into v_cash from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = p_match_id and status = 'pending'
     and (from_seat = p_seat or to_seat = p_seat);

  delete from public.city_debt_queue where match_id = p_match_id and debtor_seat = p_seat;

  if p_creditor_seat is null then
    delete from public.city_assets where match_id = p_match_id and owner_seat = p_seat;
  else
    select coalesce(sum(a.buildings * round(coalesce(s.build_cost, 0) / 2.0)), 0)::integer
      into v_developments
      from public.city_assets a
      join public.city_board_spaces s on s.idx = a.space_idx
     where a.match_id = p_match_id and a.owner_seat = p_seat;

    update public.city_assets
       set buildings = 0
     where match_id = p_match_id and owner_seat = p_seat;

    update public.city_match_players
       set cash = cash + greatest(v_cash, 0) + v_developments
     where match_id = p_match_id and seat = p_creditor_seat;

    update public.city_assets
       set owner_seat = p_creditor_seat
     where match_id = p_match_id and owner_seat = p_seat;
  end if;

  update public.city_match_players
     set status = 'bankrupt', cash = 0, final_net_worth = 0,
         pending_debt = 0, pending_creditor_seat = null,
         disconnected_at = null, consecutive_autopilot_turns = 0
   where match_id = p_match_id and seat = p_seat;

  update public.city_matches set debt_started_at = null
   where id = p_match_id and current_seat = p_seat;

  select count(*) into v_left
    from public.city_match_players
   where match_id = p_match_id and status not in ('bankrupt', 'retired');

  if v_left <= 1 then
    perform public.city_finish_match(p_match_id, 'last_player_standing');
  elsif v_match.current_seat = p_seat then
    perform public.city_advance_turn(p_match_id);
  end if;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. city_max_liquidation — same rounding fix as city_mortgage_core (0082),
--    applied to the solvency-check function that's supposed to mirror it.
-- ---------------------------------------------------------------------------
create or replace function public.city_max_liquidation(p_match_id uuid, p_seat integer)
returns integer
security definer
set search_path = public
language sql
stable
as $fn$
  select coalesce(sum(
    a.buildings * round(coalesce(s.build_cost, 0) / 2.0)
    + case when a.is_mortgaged then 0 else round(s.price / 2.0) end
  ), 0)::integer
  from public.city_assets a
  join public.city_board_spaces s on s.idx = a.space_idx
  where a.match_id = p_match_id and a.owner_seat = p_seat;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. city_sell_building_core — same rounding fix, for the bank buyback
--    price (was truncating while city_mortgage_core, 54 lines away in the
--    same original file, was already fixed).
-- ---------------------------------------------------------------------------
create or replace function public.city_sell_building_core(p_match_id uuid, p_seat integer, p_space_idx integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_space public.city_board_spaces;
  v_asset public.city_assets;
  v_max integer;
  v_return integer;
begin
  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;
  if v_asset.id is null or v_asset.owner_seat <> p_seat then
    raise exception 'CITY_NOT_YOURS';
  end if;
  if v_asset.buildings = 0 then
    raise exception 'CITY_NOTHING_BUILT';
  end if;

  select max(coalesce(a.buildings, 0)) into v_max
    from public.city_board_spaces s
    left join public.city_assets a on a.space_idx = s.idx and a.match_id = p_match_id
   where s.country = v_space.country;
  if v_asset.buildings < v_max then
    raise exception 'CITY_EVEN_BUILD';
  end if;

  v_return := round(v_space.build_cost / 2.0)::integer;
  update public.city_assets set buildings = buildings - 1 where id = v_asset.id;
  update public.city_match_players set cash = cash + v_return
   where match_id = p_match_id and seat = p_seat;
  perform public.city_try_settle_debt(p_match_id, p_seat);

  return jsonb_build_object('space', p_space_idx, 'buildings', v_asset.buildings - 1,
                            'returned', v_return);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. city_leave_detention_core — a 'bankrupt' outcome from city_charge is
--    no longer folded into "released"; the failed-roll branch now refreshes
--    turn_started_at so a follow-up claim_timeout can't immediately
--    re-trigger on the same still-expired clock.
-- ---------------------------------------------------------------------------
create or replace function public.city_leave_detention_core(p_match_id uuid, p_seat integer, p_method text)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_me public.city_match_players;
  v_dice integer[];
  v_fee constant integer := 90;
  v_charge jsonb;
begin
  if p_method not in ('pay', 'visa', 'roll') then
    raise exception 'CITY_BAD_ACTION';
  end if;

  select * into v_match from public.city_matches where id = p_match_id;
  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  if v_match.id is null or v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;
  if v_me.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if p_seat <> v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;
  if not v_me.in_detention then
    raise exception 'CITY_NOT_DETAINED';
  end if;
  if v_match.phase <> 'awaiting_roll' then
    raise exception 'CITY_WRONG_PHASE';
  end if;

  if p_method = 'visa' then
    if v_me.transit_visas < 1 then
      raise exception 'CITY_NO_VISA';
    end if;
    update public.city_match_players
       set transit_visas = transit_visas - 1, in_detention = false, detention_turns = 0
     where id = v_me.id;
    return jsonb_build_object('released', true, 'method', 'visa');
  end if;

  if p_method = 'pay' then
    v_charge := public.city_charge(p_match_id, v_me.seat, v_fee, null);
    -- Both a "can't afford it yet" and a "just went bankrupt paying it"
    -- outcome are failures to release, not a success — only the absence of
    -- either 'action' means the fee was actually paid and this seat left
    -- detention. city_bankrupt_seat (called inside city_charge) already
    -- handles the seat's own state, including handing off the turn if it
    -- was this seat's.
    if v_charge->>'action' in ('must_raise_funds', 'bankrupt') then
      return jsonb_build_object('released', false, 'method', 'pay', 'charge', v_charge);
    end if;
    update public.city_match_players
       set in_detention = false, detention_turns = 0 where id = v_me.id;
    return jsonb_build_object('released', true, 'method', 'pay', 'fee', v_fee);
  end if;

  -- roll for doubles
  v_dice := public.city_derive_dice(v_match.rng_seed, v_match.rng_counter);
  update public.city_matches
     set rng_counter = rng_counter + 1, last_roll = v_dice where id = p_match_id;

  if v_dice[1] = v_dice[2] then
    update public.city_match_players
       set in_detention = false, detention_turns = 0 where id = v_me.id;
    return jsonb_build_object('released', true, 'method', 'roll', 'dice', v_dice);
  end if;

  if v_me.detention_turns >= 2 then
    -- Third failure: the fee is now mandatory.
    v_charge := public.city_charge(p_match_id, v_me.seat, v_fee, null);
    if v_charge->>'action' = 'bankrupt' then
      update public.city_match_players set detention_turns = 0 where id = v_me.id;
      return jsonb_build_object('released', false, 'method', 'forced_pay', 'dice', v_dice,
        'fee', v_fee, 'charge', v_charge);
    end if;
    update public.city_match_players
       set in_detention = (v_charge->>'action' = 'must_raise_funds'),
           detention_turns = 0
     where id = v_me.id;
    return jsonb_build_object('released', v_charge->>'action' <> 'must_raise_funds',
      'method', 'forced_pay', 'dice', v_dice, 'fee', v_fee, 'charge', v_charge);
  end if;

  update public.city_match_players
     set detention_turns = detention_turns + 1 where id = v_me.id;
  update public.city_matches
     set phase = 'optional_actions', turn_started_at = now(), turn_clock_elapsed_ms = 0
   where id = p_match_id;
  return jsonb_build_object('released', false, 'method', 'roll', 'dice', v_dice,
    'attempts_left', 2 - v_me.detention_turns);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 6. city_decline_purchase_core — same turn_started_at refresh as #5, for
--    the no-auction branch.
-- ---------------------------------------------------------------------------
create or replace function public.city_decline_purchase_core(p_match_id uuid, p_seat integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_me public.city_match_players;
  v_space public.city_board_spaces;
  v_auction_id uuid;
  v_bidders integer;
  v_owned integer;
begin
  select * into v_match from public.city_matches where id = p_match_id;
  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  if v_match.id is null or v_match.status is distinct from 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;
  if v_me.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if p_seat is distinct from v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;
  if v_match.phase is distinct from 'required_decision' then
    raise exception 'CITY_NOTHING_TO_DECLINE';
  end if;

  select * into v_space from public.city_board_spaces where idx = v_me.position;
  if v_space.price is null then
    raise exception 'CITY_NOT_FOR_SALE';
  end if;

  select count(*) into v_owned from public.city_assets
   where match_id = p_match_id and space_idx = v_me.position;
  if v_owned > 0 then
    raise exception 'CITY_ALREADY_OWNED';
  end if;

  select count(*) into v_bidders from public.city_match_players
   where match_id = p_match_id and status = 'active' and pending_debt = 0;

  if v_bidders < 2 then
    update public.city_matches
       set phase = 'optional_actions', turn_started_at = now(), turn_clock_elapsed_ms = 0
     where id = p_match_id;
    return jsonb_build_object('auction', false, 'space', v_me.position);
  end if;

  insert into public.city_auctions (match_id, space_idx, ends_at, hard_ends_at)
  values (p_match_id, v_me.position, now() + interval '15 seconds',
          now() + interval '2 minutes')
  returning id into v_auction_id;

  update public.city_matches
     set phase = 'auction'
   where id = p_match_id;

  return jsonb_build_object('auction', true, 'auction_id', v_auction_id, 'space', v_me.position);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 7. city_buy_property — add the bankrupt/retired seat-out check every
--    sibling management action gets via city_assert_can_manage. This
--    function predates that helper (0065, before 0077) and was never
--    migrated onto it.
-- ---------------------------------------------------------------------------
create or replace function public.city_buy_property(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_space public.city_board_spaces;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;

  select * into v_match from public.city_matches where id = p_match_id;
  if not found then
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
  if not found then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.status in ('bankrupt', 'retired') then
    raise exception 'CITY_SEAT_OUT';
  end if;
  if v_me.seat <> v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;
  if v_match.phase <> 'required_decision' then
    raise exception 'CITY_NOTHING_TO_BUY';
  end if;

  select * into v_space from public.city_board_spaces where idx = v_me.position;
  if v_space.price is null then
    raise exception 'CITY_NOT_FOR_SALE';
  end if;
  -- Re-checked inside the lock: never trust that the space is still unowned
  -- just because it was when the phase was set.
  if exists (select 1 from public.city_assets
              where match_id = p_match_id and space_idx = v_me.position) then
    raise exception 'CITY_ALREADY_OWNED';
  end if;
  if v_me.cash < v_space.price then
    raise exception 'CITY_INSUFFICIENT_FUNDS';
  end if;

  insert into public.city_assets (match_id, space_idx, owner_seat)
  values (p_match_id, v_me.position, v_me.seat);

  update public.city_match_players set cash = cash - v_space.price where id = v_me.id;
  update public.city_matches set phase = 'optional_actions' where id = p_match_id;

  return jsonb_build_object('bought', v_space.name, 'price', v_space.price);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. city_end_turn_core — block ending a turn while the trade-pause clock
--    is active, matching city_claim_timeout's own CITY_TURN_CLOCK_PAUSED
--    handling of the same field, instead of silently discarding the pause.
-- ---------------------------------------------------------------------------
create or replace function public.city_end_turn_core(p_match_id uuid, p_seat integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_me public.city_match_players;
  v_next integer;
begin
  select * into v_match from public.city_matches where id = p_match_id;
  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  if v_match.id is null or v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;
  if v_me.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if p_seat <> v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;
  if v_me.pending_debt > 0 then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;
  if v_match.phase = 'auction' then
    raise exception 'CITY_AUCTION_RUNNING';
  end if;
  if v_match.phase = 'awaiting_roll' then
    raise exception 'CITY_MUST_ROLL_FIRST';
  end if;
  if v_match.phase = 'required_decision' then
    raise exception 'CITY_DECISION_PENDING';
  end if;

  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = p_match_id and status = 'pending'
     and (from_seat = p_seat and created_turn < v_match.turn_number
          or expires_at <= now());

  -- A doubles re-roll is not a hand-off to another seat — it's allowed even
  -- while trade-paused because city_grant_reroll itself correctly resolves
  -- the pause (accumulates elapsed time, clears trade_pause_started_at) as
  -- part of granting the re-roll. Only an actual advance to the next player
  -- (below) would silently discard an unresolved pause, so the guard sits
  -- after this branch, not before it.
  if v_match.doubles_count between 1 and 2 and v_me.status = 'active' then
    perform public.city_grant_reroll(p_match_id);
    return jsonb_build_object('next_seat', p_seat, 'roll_again', true);
  end if;

  if v_match.turn_clock_paused_at is not null then
    raise exception 'CITY_TURN_CLOCK_PAUSED';
  end if;

  select seat into v_next
    from public.city_match_players
   where match_id = p_match_id
     and status not in ('bankrupt', 'retired')
     and seat > p_seat
   order by seat limit 1;
  if v_next is null then
    select seat into v_next
      from public.city_match_players
     where match_id = p_match_id
       and status not in ('bankrupt', 'retired')
     order by seat limit 1;
  end if;

  if v_match.mode = 'timed'
     and v_match.time_limit_minutes is not null
     and now() >= v_match.started_at + make_interval(mins => v_match.time_limit_minutes)
     and v_next <= p_seat then
    return public.city_finish_match(p_match_id, 'time_limit')
           || jsonb_build_object('next_seat', null, 'roll_again', false);
  end if;

  v_next := public.city_advance_turn(p_match_id);
  perform public.city_run_autopilot_from_current(p_match_id);

  return jsonb_build_object('next_seat', v_next, 'roll_again', false);
end;
$fn$;
