-- Spintra City — BUG-007 round C: the autopilot engine (FR-26, FR-27,
-- FR-28, FR-45 complete, FR-47). The single riskiest round in this plan —
-- see C:\Users\tejas\.claude\plans\cozy-gliding-moore.md for the full design
-- reasoning this migration implements.
--
-- ---------------------------------------------------------------------------
-- 1. Two more _core extractions, needed so the new liquidation loop below
--    can sell/mortgage on an away seat's behalf without duplicating the
--    even-build rule or the mortgage math a second time.
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

  v_return := v_space.build_cost / 2;
  update public.city_assets set buildings = buildings - 1 where id = v_asset.id;
  update public.city_match_players set cash = cash + v_return
   where match_id = p_match_id and seat = p_seat;
  perform public.city_try_settle_debt(p_match_id, p_seat);

  return jsonb_build_object('space', p_space_idx, 'buildings', v_asset.buildings - 1,
                            'returned', v_return);
end;
$fn$;

revoke all on function public.city_sell_building_core(uuid, integer, integer) from public, anon, authenticated;

create or replace function public.city_sell_building(p_match_id uuid, p_space_idx integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_me public.city_match_players;
begin
  perform public.city_rate_limit_check(
    (select room_code from public.city_matches where id = p_match_id), auth.uid()::text);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text,
    p_allow_off_turn_debt => true);

  return public.city_sell_building_core(p_match_id, v_me.seat, p_space_idx);
end;
$fn$;

create or replace function public.city_mortgage_core(p_match_id uuid, p_seat integer, p_space_idx integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_space public.city_board_spaces;
  v_asset public.city_assets;
  v_value integer;
begin
  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;
  if v_asset.id is null or v_asset.owner_seat <> p_seat then
    raise exception 'CITY_NOT_YOURS';
  end if;
  if v_asset.is_mortgaged then
    raise exception 'CITY_ALREADY_MORTGAGED';
  end if;
  if v_asset.buildings > 0 then
    raise exception 'CITY_SELL_BUILDINGS_FIRST';
  end if;

  v_value := round(v_space.price / 2.0)::integer;
  update public.city_assets set is_mortgaged = true where id = v_asset.id;
  update public.city_match_players set cash = cash + v_value
   where match_id = p_match_id and seat = p_seat;
  perform public.city_try_settle_debt(p_match_id, p_seat);

  return jsonb_build_object('space', p_space_idx, 'raised', v_value);
end;
$fn$;

revoke all on function public.city_mortgage_core(uuid, integer, integer) from public, anon, authenticated;

create or replace function public.city_mortgage(p_match_id uuid, p_space_idx integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_me public.city_match_players;
begin
  perform public.city_rate_limit_check(
    (select room_code from public.city_matches where id = p_match_id), auth.uid()::text);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text,
    p_allow_off_turn_debt => true);

  return public.city_mortgage_core(p_match_id, v_me.seat, p_space_idx);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Auto-liquidation before bankruptcy (DESIGN.md §3.1D's actual raise-funds
--    default — "sell developments... mortgage properties... if still short,
--    bankruptcy is unavoidable" — upgrading round B's temporary shortcut).
--    city_charge already guarantees, at the moment a debt is created, that
--    cash + city_max_liquidation covers it (0075) -- so this only needs to
--    keep selling the cheapest thing until the existing city_try_settle_debt
--    trigger (0072, fired on every cash update) clears the debt on its own;
--    the bankrupt fallback exists for safety (e.g. a second stacked debt,
--    BUG-044's still-open gap) rather than the expected path.
-- ---------------------------------------------------------------------------
-- Returns true if the debt was cleared by liquidation alone, false if
-- nothing sellable/mortgageable remained and the seat was bankrupted as the
-- safety-net fallback -- lets callers report the actual outcome precisely.
create or replace function public.city_liquidate_for_debt(p_match_id uuid, p_seat integer)
returns boolean
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_debt integer;
  v_creditor integer;
  v_target integer;
begin
  loop
    select pending_debt into v_debt from public.city_match_players
     where match_id = p_match_id and seat = p_seat;
    exit when coalesce(v_debt, 0) <= 0;

    -- Cheapest sellable building first: only a space that is currently the
    -- highest-built tier in its own country is eligible (city_sell_building
    -- _core's own even-build rule), so this pre-filters exactly the same way
    -- rather than trying an ineligible space and relying on it raising.
    select a.space_idx into v_target
      from public.city_assets a
      join public.city_board_spaces s on s.idx = a.space_idx
     where a.match_id = p_match_id and a.owner_seat = p_seat and a.buildings > 0
       and a.buildings >= (
         select max(coalesce(a2.buildings, 0))
           from public.city_board_spaces s2
           left join public.city_assets a2 on a2.space_idx = s2.idx and a2.match_id = p_match_id
          where s2.country = s.country
       )
     order by s.build_cost asc nulls last, a.space_idx asc
     limit 1;

    if v_target is not null then
      perform public.city_sell_building_core(p_match_id, p_seat, v_target);
      continue;
    end if;

    -- Then the cheapest unmortgaged, building-free space.
    select a.space_idx into v_target
      from public.city_assets a
      join public.city_board_spaces s on s.idx = a.space_idx
     where a.match_id = p_match_id and a.owner_seat = p_seat
       and not a.is_mortgaged and a.buildings = 0
     order by s.price asc nulls last, a.space_idx asc
     limit 1;

    if v_target is not null then
      perform public.city_mortgage_core(p_match_id, p_seat, v_target);
      continue;
    end if;

    -- Nothing left to sell or mortgage but the debt remains -- exit the loop
    -- and fall through to the safety-net bankruptcy below.
    exit;
  end loop;

  select pending_debt, pending_creditor_seat into v_debt, v_creditor
    from public.city_match_players where match_id = p_match_id and seat = p_seat;
  if coalesce(v_debt, 0) > 0 then
    perform public.city_bankrupt_seat(p_match_id, p_seat, v_creditor);
    return false;
  end if;
  return true;
end;
$fn$;

revoke all on function public.city_liquidate_for_debt(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. city_advance_turn — the seat-search + clock-reset block that was
--    identically duplicated in city_end_turn and city_retire_seat. Contains
--    ONLY that shared part: city_end_turn's own trade-offer sweep and
--    timed-mode check, and city_retire_seat's own (deliberately broader)
--    offer cleanup, differ enough between the two callers that unifying
--    them too would be a bigger behavioral change than this round calls for.
-- ---------------------------------------------------------------------------
create or replace function public.city_advance_turn(p_match_id uuid)
returns integer
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_current integer;
  v_next integer;
begin
  select current_seat into v_current from public.city_matches where id = p_match_id;

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

  update public.city_matches
     set current_seat = v_next,
         phase = case when v_next is not null then 'awaiting_roll' else phase end,
         turn_number = turn_number + 1,
         doubles_count = 0,
         turn_started_at = now(),
         turn_clock_elapsed_ms = 0,
         turn_clock_paused_at = null
   where id = p_match_id;

  return v_next;
end;
$fn$;

revoke all on function public.city_advance_turn(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. city_end_turn split, reusing city_advance_turn for its non-doubles
--    branch. The doubles branch (same seat, fresh awaiting_roll) stays
--    exactly as it was -- it is not a turn advance, and city_advance_turn
--    does not need to know about it.
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
  v_again boolean := false;
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

  if v_match.doubles_count between 1 and 2 and v_me.status = 'active' then
    v_again := true;

    update public.city_matches
       set phase = 'awaiting_roll',
           turn_number = turn_number + 1,
           turn_started_at = now(),
           turn_clock_elapsed_ms = 0,
           turn_clock_paused_at = null
     where id = p_match_id;

    return jsonb_build_object('next_seat', p_seat, 'roll_again', true);
  end if;

  -- Round boundary: the seat order wrapped back to or below the seat that
  -- just played. Only then may a timed match end. Checked BEFORE advancing,
  -- against the seat that is about to become current, exactly as the
  -- original inline version did.
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

revoke all on function public.city_end_turn_core(uuid, integer) from public, anon, authenticated;

create or replace function public.city_end_turn(p_match_id uuid)
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
  if v_me.seat <> v_match.current_seat then
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

  return public.city_end_turn_core(p_match_id, v_me.seat);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. The autopilot resolution for one seat's turn (FR-26, FR-27). Escapes
--    with a status rather than looping unconditionally, so the caller (the
--    cascade below) knows whether to keep going, stop for an auction, or
--    count a forced-retire streak.
-- ---------------------------------------------------------------------------
create or replace function public.city_resolve_autopilot_turn(p_match_id uuid, p_seat integer)
returns text
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_me public.city_match_players;
  i integer := 0;
begin
  loop
    i := i + 1;
    -- Generous bound: three doubles plus a handful of debt/queue/detention
    -- steps is the largest a single real turn could ever need.
    exit when i > 12;

    select * into v_match from public.city_matches where id = p_match_id;
    select * into v_me from public.city_match_players
     where match_id = p_match_id and seat = p_seat;

    if v_me.id is null or v_me.status in ('bankrupt', 'retired') then
      return 'bankrupt';
    end if;

    if v_me.pending_debt > 0 then
      perform public.city_liquidate_for_debt(p_match_id, p_seat);
      continue;
    end if;

    if v_me.in_detention then
      -- One attempt per TURN, win or lose -- detention_turns tracks
      -- attempts across separate turns, not within one resolution pass, so
      -- this concludes the turn regardless of outcome rather than looping
      -- back into detention again immediately.
      perform public.city_leave_detention_core(p_match_id, p_seat, 'roll');
      return 'concluded';
    end if;

    if v_match.phase = 'awaiting_roll' then
      perform public.city_roll_dice_core(p_match_id, p_seat);
      continue;
    end if;

    if v_match.phase = 'required_decision' then
      perform public.city_decline_purchase_core(p_match_id, p_seat);
      if (select phase from public.city_matches where id = p_match_id) = 'auction' then
        -- A real auction just opened (2+ other active, debt-free seats) --
        -- a global pause that resolves independently of this seat or any
        -- other away seat. Nothing further to automate right now.
        return 'auction_pending';
      end if;
      continue;
    end if;

    -- optional_actions. A doubles re-roll is free and not something a human
    -- can decline either -- take it, mirroring city_end_turn_core's own
    -- v_again branch exactly (same seat, fresh awaiting_roll).
    if v_match.doubles_count between 1 and 2 then
      update public.city_matches
         set phase = 'awaiting_roll',
             turn_number = turn_number + 1,
             turn_started_at = now(),
             turn_clock_elapsed_ms = 0,
             turn_clock_paused_at = null
       where id = p_match_id;
      continue;
    end if;

    -- Autopilot never builds, mortgages, or trades (FR-27's "safe defaults
    -- only") -- with no roll, decision, or doubles owed, this seat's turn
    -- is genuinely over.
    return 'concluded';
  end loop;

  return 'concluded';
end;
$fn$;

revoke all on function public.city_resolve_autopilot_turn(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. The cascade (FR-26, FR-28, FR-45 complete). Assumes current_seat is
--    already whoever should act next -- it does not advance past a seat
--    itself, so every caller below advances (or retires, which advances on
--    its own) BEFORE invoking this. Loops while the current seat is away;
--    stops the instant a present seat is reached, an auction opens, or (the
--    FR-31 case, wired up fully in round D) no present seat exists anywhere.
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
    exit when i > v_seat_count + 1;

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
      -- Not FR-31's condition -- a genuine, independently-resolving pause,
      -- not "nobody is present". Treated as found-present for this purpose:
      -- nothing more to automate, but not a durable-pause situation either.
      v_found_present := true;
      exit;
    end if;

    if v_result = 'bankrupt' then
      -- city_bankrupt_seat (reached via city_liquidate_for_debt's fallback)
      -- does not itself touch current_seat -- unlike city_retire_seat, it
      -- has no turn to hand off from a voluntary/moderator departure, so
      -- nothing else will advance past this seat without an explicit call.
      perform public.city_advance_turn(p_match_id);
      continue;
    end if;

    -- Turn genuinely concluded (not bankrupt, not an auction) -- count it
    -- toward the forced-retire streak (FR-28).
    update public.city_match_players
       set consecutive_autopilot_turns = consecutive_autopilot_turns + 1
     where match_id = p_match_id and seat = v_current
    returning consecutive_autopilot_turns into v_streak;

    if v_streak >= 2 then
      perform public.city_retire_seat(p_match_id, v_current);
      -- city_retire_seat already advances current_seat itself when it was
      -- this seat's turn -- which, here, it always is.
    else
      perform public.city_advance_turn(p_match_id);
    end if;
  end loop;
end;
$fn$;

revoke all on function public.city_run_autopilot_from_current(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Wire the cascade into the three places a turn can end or a seat can
--    depart. city_retire_seat's own hand-off is mechanically the same
--    seat-search+reset block city_end_turn's used to have -- replaced with
--    a call to city_advance_turn (finding 5 in the plan: neither function
--    acquires its own lock, so this is safe to call from inside the
--    already-locked callers below).
-- ---------------------------------------------------------------------------
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
         pending_debt = 0, pending_creditor_seat = null
   where match_id = p_match_id and seat = p_seat;

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

revoke all on function public.city_retire_seat(uuid, integer) from public, anon, authenticated;

-- The departure trigger (kick/ban/self-leave): after handing the turn off,
-- also give the newly-current seat the same immediate-autopilot treatment
-- any other turn-ending path gets -- otherwise a kick landing directly on an
-- already-away seat would sit idle until a future clock expiry, contrary to
-- FR-27's "resolves the turn immediately on arrival".
create or replace function public.city_retire_seat_on_departure()
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
   where m.room_code = old.room_id
     and m.status = 'active'
     and p.user_id = old.user_id;

  if v_match_id is not null then
    perform public.city_retire_seat(v_match_id, v_seat);
    perform public.city_run_autopilot_from_current(v_match_id);
  end if;

  return old;
end;
$fn$;

revoke all on function public.city_retire_seat_on_departure() from public, anon, authenticated;

-- create or replace function keeps the existing trigger attached (same
-- function, same signature) -- re-declaring it is unnecessary, but harmless
-- and explicit about what this migration touches.
drop trigger if exists city_track_disconnect on public.room_participants;
create trigger city_track_disconnect
after update of is_online on public.room_participants
for each row
when (old.is_online is distinct from new.is_online)
execute function public.city_track_disconnect();

-- city_claim_timeout's own end-turn branch: the inline seat-search+reset
-- duplicate becomes a call to city_advance_turn, then the same immediate
-- autopilot check every other turn-ending path now gets. Every check above
-- the branch is unchanged from 0085.
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
    v_result := jsonb_build_object(
      'resolution', case when public.city_liquidate_for_debt(p_match_id, v_stalled.seat)
        then 'liquidated' else 'bankrupt' end,
      'seat', v_stalled.seat);
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
    v_next := public.city_advance_turn(p_match_id);
    perform public.city_run_autopilot_from_current(p_match_id);
    v_result := jsonb_build_object('resolution', 'end_turn', 'seat', v_stalled.seat, 'next_seat', v_next);
  end if;

  return v_result;
end;
$fn$;

grant execute on function public.city_claim_timeout(uuid) to anon, authenticated;
