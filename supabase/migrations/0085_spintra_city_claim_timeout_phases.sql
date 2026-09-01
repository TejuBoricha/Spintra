-- Spintra City — BUG-007 round B: per-phase clock-expiry defaults (FR-41,
-- FR-45 partial), plus a pre-existing auction-clock bug found while reading
-- the code for this round (folded in here since it shares the same "shift
-- the deadline forward by the paused duration" mechanism).
--
-- city_claim_timeout (0076) only ever resolved a stall two ways: bankrupt
-- (pending_debt > 0) or end-turn (everything else) — a disclosed, deliberate
-- scope reduction at the time (FR-41 names three defaults: auto-roll,
-- decline-to-auction, end-turn; 0076 shipped only the third). This closes
-- the gap for awaiting_roll and required_decision(may_buy), plus the
-- detention-exit decision DESIGN.md §3.1A also requires a default for.
--
-- Round C's raise-funds default (auto-liquidate before bankrupting) is
-- deliberately NOT here — it needs the same "resolve a decision nobody is
-- making" engine the autopilot cascade needs, so it belongs with that
-- engine, not bolted on early. Today's immediate-bankrupt-on-debt behavior
-- is unchanged in this migration.
--
-- ---------------------------------------------------------------------------
-- 1. _core extractions — reused by city_claim_timeout below AND by round C's
--    autopilot cascade, so the actual roll/decline/detention-exit logic
--    lives in exactly one place regardless of who's invoking it.
-- ---------------------------------------------------------------------------
-- Each public shell keeps 100% of its original checks in 100% original
-- order — a real client's behavior does not change by one error code. Each
-- _core function independently re-validates the state invariants a caller
-- bypassing the shell (a clock default, not a player) still needs enforced;
-- what it deliberately does NOT do is re-derive identity, rate-limit, or
-- re-acquire the lock — those are shell-only concerns, and the shell's
-- caller is always already holding the match's advisory lock when _core is
-- invoked internally (city_claim_timeout below takes it before branching).

create or replace function public.city_roll_dice_core(p_match_id uuid, p_seat integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_me public.city_match_players;
  v_dice integer[];
  v_from integer;
  v_to integer;
  v_passed boolean := false;
  v_salary constant integer := 200;
  v_is_doubles boolean;
  v_detained boolean := false;
  v_landing jsonb;
  v_next_phase text;
  v_result jsonb;
begin
  select * into v_match from public.city_matches where id = p_match_id;
  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  if v_match.id is null or v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;
  if v_me.id is null or v_me.status in ('bankrupt', 'retired') then
    raise exception 'CITY_SEAT_OUT';
  end if;
  if v_me.pending_debt > 0 then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;
  if v_me.in_detention then
    raise exception 'CITY_IN_DETENTION';
  end if;
  if v_match.phase <> 'awaiting_roll' then
    raise exception 'CITY_WRONG_PHASE';
  end if;

  v_dice := public.city_derive_dice(v_match.rng_seed, v_match.rng_counter);
  v_is_doubles := v_dice[1] = v_dice[2];
  v_from := v_me.position;

  if v_is_doubles and v_match.doubles_count = 2 then
    v_to := 10;
    v_detained := true;
  else
    v_to := (v_from + v_dice[1] + v_dice[2]) % 40;
    v_passed := (v_from + v_dice[1] + v_dice[2]) >= 40;
  end if;

  update public.city_match_players
     set position = v_to,
         cash = cash + case when v_passed then v_salary else 0 end,
         in_detention = case when v_detained then true else in_detention end,
         detention_turns = case when v_detained then 0 else detention_turns end
   where id = v_me.id;

  if v_detained then
    v_landing := jsonb_build_object('action', 'detained', 'to', 10);
  else
    v_landing := public.city_resolve_landing(p_match_id, v_me.seat, v_to, v_dice[1] + v_dice[2]);
  end if;

  v_next_phase := case
    when v_landing->>'action' in ('may_buy', 'must_raise_funds') then 'required_decision'
    when v_landing->'result'->'landing'->>'action' in ('may_buy', 'must_raise_funds')
      then 'required_decision'
    when v_landing->'result'->>'action' = 'must_raise_funds' then 'required_decision'
    else 'optional_actions' end;

  v_result := jsonb_build_object(
    'dice', v_dice, 'from', v_from, 'to', v_to,
    'passed_departure', v_passed,
    'salary', case when v_passed then v_salary else 0 end,
    'doubles', v_is_doubles, 'detained', v_detained,
    'landing', v_landing
  );

  update public.city_matches
     set rng_counter = rng_counter + 1,
         last_roll = v_dice,
         last_roll_result = v_result,
         last_roll_turn = turn_number,
         doubles_count = case
           when v_detained then 0
           when v_is_doubles then doubles_count + 1
           else 0 end,
         phase = v_next_phase,
         turn_started_at = now(),
         turn_clock_elapsed_ms = 0,
         turn_clock_paused_at = null
   where id = p_match_id;

  return v_result;
end;
$fn$;

revoke all on function public.city_roll_dice_core(uuid, integer) from public, anon, authenticated;

create or replace function public.city_roll_dice(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
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
  if v_me.pending_debt > 0 then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;
  if v_me.in_detention then
    raise exception 'CITY_IN_DETENTION';
  end if;
  if v_match.phase <> 'awaiting_roll' then
    raise exception 'CITY_WRONG_PHASE';
  end if;

  return public.city_roll_dice_core(p_match_id, v_me.seat);
end;
$fn$;

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
    update public.city_matches set phase = 'optional_actions' where id = p_match_id;
    return jsonb_build_object('auction', false, 'space', v_me.position);
  end if;

  insert into public.city_auctions (match_id, space_idx, ends_at, hard_ends_at)
  values (p_match_id, v_me.position, now() + interval '15 seconds',
          now() + interval '2 minutes')
  returning id into v_auction_id;

  update public.city_matches
     set phase = 'auction', turn_clock_paused_at = now()
   where id = p_match_id;

  return jsonb_build_object('auction', true, 'auction_id', v_auction_id,
    'space', v_me.position, 'price', v_space.price);
end;
$fn$;

revoke all on function public.city_decline_purchase_core(uuid, integer) from public, anon, authenticated;

create or replace function public.city_decline_purchase(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
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

  if v_match.status is distinct from 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_me.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.seat is distinct from v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;

  return public.city_decline_purchase_core(p_match_id, v_me.seat);
end;
$fn$;

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
    if v_charge->>'action' = 'must_raise_funds' then
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
    update public.city_match_players
       set in_detention = (v_charge->>'action' = 'must_raise_funds'),
           detention_turns = 0
     where id = v_me.id;
    return jsonb_build_object('released', v_charge->>'action' <> 'must_raise_funds',
      'method', 'forced_pay', 'dice', v_dice, 'fee', v_fee, 'charge', v_charge);
  end if;

  update public.city_match_players
     set detention_turns = detention_turns + 1 where id = v_me.id;
  update public.city_matches set phase = 'optional_actions' where id = p_match_id;
  return jsonb_build_object('released', false, 'method', 'roll', 'dice', v_dice,
    'attempts_left', 2 - v_me.detention_turns);
end;
$fn$;

revoke all on function public.city_leave_detention_core(uuid, integer, text) from public, anon, authenticated;

create or replace function public.city_leave_detention(p_match_id uuid, p_method text)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;
  if p_method not in ('pay', 'visa', 'roll') then
    raise exception 'CITY_BAD_ACTION';
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
  if v_me.seat <> v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;

  return public.city_leave_detention_core(p_match_id, v_me.seat, p_method);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Per-phase claim_timeout defaults (FR-41, FR-45 partial)
-- ---------------------------------------------------------------------------
-- Everything above the branch is unchanged from 0076 verbatim. The branch
-- itself grows from two outcomes to four:
--   pending_debt > 0        -> bankrupt (unchanged; round C upgrades this)
--   in_detention             -> attempt doubles (the sole zero-cost option;
--                                the core function's own cascade already
--                                force-pays on the 3rd failure)
--   phase = 'awaiting_roll'  -> auto-roll
--   phase = 'required_decision' (debt already ruled out above, so this can
--                                only be a buy/decline stall) -> decline
--   else (optional_actions)  -> end-turn (unchanged)
create or replace function public.city_claim_timeout(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_caller public.city_match_players;
  v_stalled public.city_match_players;
  v_deadline timestamptz;
  v_next integer;
  v_result jsonb;
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

  select * into v_caller from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_caller.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;

  if v_match.current_seat is null then
    raise exception 'CITY_NO_ACTIVE_TURN';
  end if;

  if v_match.phase = 'auction' or v_match.turn_clock_paused_at is not null then
    raise exception 'CITY_TURN_CLOCK_PAUSED';
  end if;

  v_deadline := v_match.turn_started_at + make_interval(secs => v_match.pace_seconds);
  if now() < v_deadline then
    raise exception 'CITY_TURN_CLOCK_STILL_RUNNING';
  end if;

  select * into v_stalled from public.city_match_players
   where match_id = p_match_id and seat = v_match.current_seat;

  if v_stalled.pending_debt > 0 then
    perform public.city_bankrupt_seat(p_match_id, v_stalled.seat, v_stalled.pending_creditor_seat);
    v_result := jsonb_build_object('resolution', 'bankrupt', 'seat', v_stalled.seat);
  elsif v_stalled.in_detention then
    v_result := public.city_leave_detention_core(p_match_id, v_stalled.seat, 'roll')
      || jsonb_build_object('resolution', 'detention_roll', 'seat', v_stalled.seat);
  elsif v_match.phase = 'awaiting_roll' then
    v_result := public.city_roll_dice_core(p_match_id, v_stalled.seat)
      || jsonb_build_object('resolution', 'auto_roll', 'seat', v_stalled.seat);
  elsif v_match.phase = 'required_decision' then
    v_result := public.city_decline_purchase_core(p_match_id, v_stalled.seat)
      || jsonb_build_object('resolution', 'auto_decline', 'seat', v_stalled.seat);
  else
    -- optional_actions (or any other non-terminal phase): end-turn, uniformly.
    select seat into v_next
      from public.city_match_players
     where match_id = p_match_id
       and status not in ('bankrupt', 'retired')
       and seat > v_stalled.seat
     order by seat limit 1;

    if v_next is null then
      select seat into v_next
        from public.city_match_players
       where match_id = p_match_id
         and status not in ('bankrupt', 'retired')
       order by seat limit 1;
    end if;

    update public.city_matches
       set current_seat = v_next,
           phase = case when v_next is not null then 'awaiting_roll' else phase end,
           turn_number = turn_number + 1,
           doubles_count = 0,
           turn_started_at = now(),
           turn_clock_elapsed_ms = 0,
           turn_clock_paused_at = null
     where id = p_match_id;

    v_result := jsonb_build_object('resolution', 'end_turn', 'seat', v_stalled.seat, 'next_seat', v_next);
  end if;

  return v_result;
end;
$fn$;

grant execute on function public.city_claim_timeout(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. A pre-existing bug, found while reading this code for this round: the
--    auction-settle path clears turn_clock_paused_at but never shifts
--    turn_started_at forward by however long the auction actually ran, so a
--    long auction could leave the active player's clock already expired the
--    instant they got control back -- contradicting DESIGN.md's "the active
--    player's turn clock pauses for its duration". Not introduced by this
--    migration; shares its fix with the trade-pause mechanism round F adds.
-- ---------------------------------------------------------------------------
create or replace function public.city_settle_auction(
  p_match_id uuid, p_force boolean default false
)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_auction public.city_auctions;
  v_space public.city_board_spaces;
  v_winner public.city_match_players;
begin
  if not p_force then
    perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  end if;

  select * into v_auction from public.city_auctions
   where match_id = p_match_id and status = 'running';
  if v_auction.id is null then
    raise exception 'CITY_NO_AUCTION';
  end if;

  if not p_force and now() < least(v_auction.ends_at, v_auction.hard_ends_at) then
    raise exception 'CITY_AUCTION_STILL_RUNNING';
  end if;

  select * into v_space from public.city_board_spaces where idx = v_auction.space_idx;

  if v_auction.high_seat is not null then
    select * into v_winner from public.city_match_players
     where match_id = p_match_id and seat = v_auction.high_seat;

    if v_winner.cash >= v_auction.high_bid and v_winner.status = 'active' then
      insert into public.city_assets (match_id, space_idx, owner_seat)
      values (p_match_id, v_auction.space_idx, v_auction.high_seat)
      on conflict (match_id, space_idx) do nothing;

      update public.city_match_players set cash = cash - v_auction.high_bid
       where id = v_winner.id;
    else
      v_auction.high_seat := null;
    end if;
  end if;

  update public.city_auctions
     set status = 'settled', settled_at = now(),
         high_seat = v_auction.high_seat
   where id = v_auction.id;

  -- Hand the turn back to whoever it belonged to, and resume their clock --
  -- shifting the deadline forward by exactly how long the auction paused it,
  -- so the true remaining time (not a reset, not silently docked) survives.
  update public.city_matches
     set phase = 'optional_actions',
         turn_started_at = case when turn_clock_paused_at is not null
           then turn_started_at + (now() - turn_clock_paused_at)
           else turn_started_at end,
         turn_clock_paused_at = null
   where id = p_match_id and phase = 'auction';

  return jsonb_build_object(
    'settled', true,
    'space', v_auction.space_idx,
    'name', v_space.name,
    'winner_seat', v_auction.high_seat,
    'price', case when v_auction.high_seat is null then 0 else v_auction.high_bid end
  );
end;
$fn$;
