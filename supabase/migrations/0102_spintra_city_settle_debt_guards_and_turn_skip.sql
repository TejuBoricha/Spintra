-- Spintra City — a fourth `/code-review high` round on PR #43 (2026-09-22,
-- same diff, now including 0101) found four more real bugs, all verified by
-- reading the current live code directly before fixing:
--
-- 1. city_settle_auction (0094) never got the finished-match guard its
--    sibling money-movers (city_charge, city_bankrupt_seat, city_retire_seat)
--    got across 0098-0101. It unconditionally inserts into city_assets and
--    debits the winning bidder's cash before ever touching city_matches
--    (the only table 0097's freeze trigger protects). An auction running
--    independently of the current turn (an off-turn debtor's forced
--    liquidation can finish the match mid-transaction while an unrelated
--    auction is still open) can settle after the match is already scored,
--    corrupting already-paid-out state with no error surfaced anywhere.
--
-- 2. city_try_settle_debt (0090) has no guard at all -- not even a
--    v_match select. Every *direct* caller (city_mortgage, city_sell_building
--    via city_assert_can_manage) is protected upstream, but it's also
--    invoked by city_settle_debt_on_cash, an AFTER UPDATE OF cash trigger
--    that fires on ANY city_match_players cash write anywhere -- including
--    finding 1's unguarded write. A single unguarded write in
--    city_settle_auction could cascade into a second corrupting write here,
--    invisible to review that only reads explicit call sites, since this
--    path is a trigger, not a call. Every caller already discards this
--    function's boolean return via `perform`, so the guard's return value
--    is unobservable either way -- purely a safety no-op.
--
-- 3. city_run_autopilot_from_current's `if v_result = 'bankrupt'` branch
--    (present unchanged since 0086) calls city_advance_turn -- but
--    city_bankrupt_seat (0092) already self-advances the turn when it
--    bankrupts the current seat. city_liquidate_for_debt's only path to a
--    bankruptcy is through city_bankrupt_seat (confirmed by reading its
--    full body), so this branch's own city_advance_turn call has been
--    redundant since 0092 landed, for every autopilot path -- nobody
--    revisited this specific branch when that fix shipped elsewhere.
--    Failure scenario: an away seat's debt-liquidation autopilot sweep
--    bankrupts them with 2+ players still active; the turn advances twice
--    in one autopilot pass, silently skipping the next player's entire turn.
--
-- 4. city_pass_auction's (0089) "everyone eligible passed" check compares
--    two different seat populations. v_eligible excludes away seats
--    (disconnected >= 60s); v_passed counts raw entries in passed_seats
--    with no away-status filter at all. A seat that passed while present,
--    then went away, stays counted in v_passed (correctly reflecting they
--    did pass) but is also excluded from v_eligible's denominator (also
--    correct in isolation) -- the two counts no longer measure the same
--    population, so v_passed >= v_eligible can go true while a present,
--    active, never-passed bidder is still eligible and waiting. Fix:
--    v_passed now counts the same population v_eligible does (active,
--    non-high-bidder, not away) intersected with passed_seats, restoring
--    the sound "same filter on both sides" invariant 0069 originally had
--    before 0089's away-seat exclusion was added to only one side of it.

create or replace function public.city_settle_auction(
  p_match_id uuid, p_force boolean
)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_auction public.city_auctions;
  v_space public.city_board_spaces;
  v_winner public.city_match_players;
begin
  if not p_force then
    perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  end if;

  select * into v_match from public.city_matches where id = p_match_id;
  if v_match.status <> 'active' then
    return jsonb_build_object('settled', false);
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

  update public.city_matches
     set phase = 'optional_actions',
         turn_started_at = case when turn_clock_paused_at is not null
           then turn_started_at + (now() - turn_clock_paused_at)
           else turn_started_at end,
         turn_clock_paused_at = null
   where id = p_match_id and phase = 'auction';

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id,
    case when v_auction.high_seat is null then 'auction_unsold' else 'auction_won' end,
    v_auction.high_seat,
    jsonb_build_object('space', v_auction.space_idx,
      'price', case when v_auction.high_seat is null then 0 else v_auction.high_bid end));

  perform public.city_run_autopilot_from_current(p_match_id);

  return jsonb_build_object(
    'settled', true,
    'space', v_auction.space_idx,
    'name', v_space.name,
    'winner_seat', v_auction.high_seat,
    'price', case when v_auction.high_seat is null then 0 else v_auction.high_bid end
  );
end;
$fn$;

revoke all on function public.city_settle_auction(uuid, boolean) from public, anon, authenticated;

create or replace function public.city_try_settle_debt(p_match_id uuid, p_seat integer)
returns boolean
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_me public.city_match_players;
  v_next public.city_debt_queue;
begin
  select * into v_match from public.city_matches where id = p_match_id;
  if v_match.status <> 'active' then
    return false;
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  if v_me.pending_debt = 0 then
    return true;
  end if;
  if v_me.cash < v_me.pending_debt then
    return false;
  end if;

  update public.city_match_players
     set cash = cash - v_me.pending_debt, pending_debt = 0, pending_creditor_seat = null
   where id = v_me.id;

  if v_me.pending_creditor_seat is not null then
    update public.city_match_players
       set cash = cash + v_me.pending_debt
     where match_id = p_match_id and seat = v_me.pending_creditor_seat;
  end if;

  select * into v_next from public.city_debt_queue
   where match_id = p_match_id and debtor_seat = p_seat
   order by queued_at asc limit 1;

  if v_next.id is not null then
    update public.city_match_players
       set pending_debt = v_next.amount, pending_creditor_seat = v_next.creditor_seat
     where id = v_me.id;
    update public.city_matches set phase = 'required_decision',
      debt_started_at = now()
     where id = p_match_id and current_seat = p_seat;
    delete from public.city_debt_queue where id = v_next.id;
  else
    update public.city_matches set phase = 'optional_actions', debt_started_at = null
     where id = p_match_id and phase = 'required_decision';
  end if;

  return true;
end;
$fn$;

revoke all on function public.city_try_settle_debt(uuid, integer) from public, anon, authenticated;

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
  v_anyone_online boolean;
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
      select exists(
        select 1 from public.city_match_players
         where match_id = p_match_id
           and status not in ('bankrupt', 'retired')
           and (disconnected_at is null or now() - disconnected_at < interval '60 seconds')
      ) into v_anyone_online;
      v_found_present := v_anyone_online;
      exit;
    end if;

    if v_result = 'bankrupt' then
      -- city_liquidate_for_debt's only path to a bankruptcy is through
      -- city_bankrupt_seat, which already advances the turn itself when it
      -- bankrupts the current seat (0092) -- this call would double-advance,
      -- silently skipping the next player's turn. No advance needed here;
      -- just continue to process whichever seat is now current.
      continue;
    end if;

    update public.city_match_players
       set consecutive_autopilot_turns = consecutive_autopilot_turns + 1
     where match_id = p_match_id and seat = v_current
    returning consecutive_autopilot_turns into v_streak;

    if v_streak >= 2 then
      update public.city_match_players set exit_reason = 'autopilot_forced'
       where match_id = p_match_id and seat = v_current;
      perform public.city_retire_seat(p_match_id, v_current);
    else
      perform public.city_advance_turn(p_match_id);
    end if;
  end loop;

  if not v_found_present then
    update public.city_matches set status = 'paused', paused_at = now()
     where id = p_match_id and status = 'active';
  end if;
end;
$fn$;

revoke all on function public.city_run_autopilot_from_current(uuid) from public, anon, authenticated;

create or replace function public.city_pass_auction(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_auction public.city_auctions;
  v_eligible integer;
  v_passed integer;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;

  select * into v_match from public.city_matches where id = p_match_id;
  perform public.city_rate_limit_check(v_match.room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));

  select * into v_auction from public.city_auctions
   where match_id = p_match_id and status = 'running';
  if v_auction.id is null then
    raise exception 'CITY_NO_AUCTION';
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_me.id is null or v_me.status <> 'active' then
    raise exception 'CITY_NOT_SEATED';
  end if;

  if not (v_me.seat = any(v_auction.passed_seats)) then
    update public.city_auctions
       set passed_seats = passed_seats || v_me.seat
     where id = v_auction.id
    returning * into v_auction;
  end if;

  -- Everyone still eligible passed, or is away and couldn't click Pass even
  -- if they wanted to (§3.1E's fast path, extended to FR-49). The standing
  -- high bidder is excluded either way: they aren't waiting on anything.
  -- v_passed must count the exact same population v_eligible does -- a seat
  -- that passed while present and then went away stays correctly counted as
  -- "passed" for a seat that's still eligible today, but must not inflate
  -- the tally for the denominator it's no longer part of once it's away too.
  select count(*) into v_eligible from public.city_match_players
   where match_id = p_match_id and status = 'active'
     and (v_auction.high_seat is null or seat <> v_auction.high_seat)
     and not (
       disconnected_at is not null
       and now() - disconnected_at >= interval '60 seconds'
     );
  select count(*) into v_passed from public.city_match_players
   where match_id = p_match_id and status = 'active'
     and (v_auction.high_seat is null or seat <> v_auction.high_seat)
     and not (
       disconnected_at is not null
       and now() - disconnected_at >= interval '60 seconds'
     )
     and seat = any(v_auction.passed_seats);

  if v_passed >= v_eligible then
    return public.city_settle_auction(p_match_id, true);
  end if;

  return jsonb_build_object('passed', true, 'waiting_on', v_eligible - v_passed);
end;
$fn$;

-- No grant/revoke statement here: CREATE OR REPLACE on an unchanged
-- signature preserves 0069's existing `grant execute ... to anon,
-- authenticated` — city_pass_auction is a genuine client-facing RPC (the
-- "Pass" button), unlike the other functions this migration touches.
