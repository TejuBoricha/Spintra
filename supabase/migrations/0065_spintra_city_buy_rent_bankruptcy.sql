-- Spintra City — Slice 3: buying, rent, tax, insolvency and bankruptcy.
-- Requirements FR-11, FR-12, FR-18 (docs/SPINTRA_CITY_SPEC.md §7).
--
-- Scope note. Deliberately NOT in this slice, and each left as an explicit
-- no-op rather than a half-implementation:
--   * building and mortgaging  — Slice 4 (FR-13, FR-14)
--   * trading                  — Slice 5 (FR-20…FR-24)
--   * auctions and card decks  — Slice 6 (FR-15, FR-17, FR-19)
-- Because Slice 4 has not landed, a player facing a debt they cannot cover in
-- cash has no way to raise funds yet, so insolvency goes straight to
-- bankruptcy. That is the correct behaviour for §3.1D's rule ("if maximum
-- liquidation still falls short, bankruptcy is declared immediately rather
-- than forcing a pointless liquidation ritual") — it just happens that in
-- Slice 3 the maximum liquidation is always zero. Slice 4 widens it.

-- ---------------------------------------------------------------------------
-- 1. Rent
-- ---------------------------------------------------------------------------
-- Rent lives server-side with the price table for the same reason: it is money.
-- Kept as its own function so buy/rent/bankruptcy all agree on one definition
-- and a test can assert it directly.
create or replace function public.city_rent_for(
  p_match_id uuid,
  p_space_idx integer,
  p_dice_total integer
)
returns integer
security definer
set search_path = public
language plpgsql
stable
as $$
declare
  v_space public.city_board_spaces;
  v_asset public.city_assets;
  v_owned_in_group integer;
  v_group_size integer;
begin
  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;

  -- unowned, or owned but mortgaged: no rent (FR-12)
  if v_asset.id is null or v_asset.is_mortgaged then
    return 0;
  end if;

  if v_space.kind = 'airport' then
    select count(*) into v_owned_in_group
      from public.city_assets a
      join public.city_board_spaces s on s.idx = a.space_idx
     where a.match_id = p_match_id and a.owner_seat = v_asset.owner_seat
       and s.kind = 'airport' and not a.is_mortgaged;
    return case v_owned_in_group when 1 then 30 when 2 then 60
                                 when 3 then 120 when 4 then 240 else 0 end;
  end if;

  if v_space.kind = 'utility' then
    select count(*) into v_owned_in_group
      from public.city_assets a
      join public.city_board_spaces s on s.idx = a.space_idx
     where a.match_id = p_match_id and a.owner_seat = v_asset.owner_seat
       and s.kind = 'utility' and not a.is_mortgaged;
    return coalesce(p_dice_total, 0) * case when v_owned_in_group >= 2 then 12 else 5 end;
  end if;

  if v_space.kind <> 'property' then
    return 0;
  end if;

  -- Developed: rent[1] is the undeveloped base, so N buildings reads rent[N+1].
  if v_asset.buildings > 0 then
    return v_space.rent[v_asset.buildings + 1];
  end if;

  -- Undeveloped: a complete country doubles the base rent (CONTENT.md §4).
  select count(*) filter (where a.owner_seat = v_asset.owner_seat), count(*)
    into v_owned_in_group, v_group_size
    from public.city_board_spaces s
    left join public.city_assets a
      on a.space_idx = s.idx and a.match_id = p_match_id
   where s.country = v_space.country;

  return v_space.rent[1] * case when v_owned_in_group = v_group_size then 2 else 1 end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Bankruptcy (DESIGN.md §3.1D)
-- ---------------------------------------------------------------------------
-- One sequence for every entry point. Internal — never granted to clients;
-- bankruptcy is something the engine concludes, never something a player asks
-- for mid-debt to dodge a payment.
create or replace function public.city_bankrupt_seat(
  p_match_id uuid,
  p_seat integer,
  p_creditor_seat integer  -- null = owed to the bank
)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_cash integer;
  v_left integer;
  v_winner integer;
begin
  select cash into v_cash from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  if p_creditor_seat is null then
    -- Owed to the bank: properties return to the bank unowned and unmortgaged.
    -- The classic game auctions them immediately; that is a long cascade at the
    -- least interesting moment of a match and is a knowing divergence (§3.1D).
    delete from public.city_assets where match_id = p_match_id and owner_seat = p_seat;
  else
    -- Owed to a player: cash and properties transfer, mortgages carried over.
    update public.city_match_players
       set cash = cash + greatest(v_cash, 0)
     where match_id = p_match_id and seat = p_creditor_seat;
    update public.city_assets
       set owner_seat = p_creditor_seat
     where match_id = p_match_id and owner_seat = p_seat;
  end if;

  update public.city_match_players
     set status = 'bankrupt', cash = 0, final_net_worth = 0
   where match_id = p_match_id and seat = p_seat;

  -- Classic mode ends when exactly one non-bankrupt player remains. Without
  -- this a bankruptcy would leave the match running with nobody able to win.
  select count(*), min(seat) into v_left, v_winner
    from public.city_match_players
   where match_id = p_match_id and status not in ('bankrupt', 'retired');

  if v_left <= 1 then
    update public.city_matches
       set status = 'finished', finished_at = now(), phase = null, current_seat = null
     where id = p_match_id;
    if v_winner is not null then
      update public.city_match_players
         set final_net_worth = cash
       where match_id = p_match_id and seat = v_winner;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Landing resolution
-- ---------------------------------------------------------------------------
-- Charges what the space demands and returns a description of what happened.
-- Internal, and called from inside city_roll_dice's transaction: if resolution
-- were a second RPC the client had to make, a client could simply decline to
-- call it and never pay rent.
create or replace function public.city_resolve_landing(
  p_match_id uuid,
  p_seat integer,
  p_space_idx integer,
  p_dice_total integer
)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_space public.city_board_spaces;
  v_asset public.city_assets;
  v_me public.city_match_players;
  v_rent integer;
  v_owed integer := 0;
  v_creditor integer;
begin
  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;
  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;

  -- Corners. "Detained" is the only one that acts; Departure's salary is paid
  -- by the mover, and Layover is deliberately a no-op.
  if v_space.kind = 'corner' then
    if v_space.name = 'Detained' then
      update public.city_match_players set position = 10
       where match_id = p_match_id and seat = p_seat;
      return jsonb_build_object('action', 'detained', 'to', 10);
    end if;
    return jsonb_build_object('action', 'none');
  end if;

  -- Card spaces resolve in Slice 6; landing on one is a no-op until then.
  if v_space.kind = 'card' then
    return jsonb_build_object('action', 'card_pending', 'deck', v_space.deck);
  end if;

  if v_space.kind = 'tax' then
    v_owed := v_space.tax_amount;
    v_creditor := null;
  elsif v_asset.id is null then
    -- Unowned and buyable: block the turn on a real decision (FR-11).
    return jsonb_build_object('action', 'may_buy', 'price', v_space.price, 'space', p_space_idx);
  elsif v_asset.owner_seat = p_seat then
    return jsonb_build_object('action', 'own_space');
  else
    v_rent := public.city_rent_for(p_match_id, p_space_idx, p_dice_total);
    if v_rent = 0 then
      return jsonb_build_object('action',
        case when v_asset.is_mortgaged then 'mortgaged_no_rent' else 'no_rent' end);
    end if;
    v_owed := v_rent;
    v_creditor := v_asset.owner_seat;
  end if;

  if v_owed = 0 then
    return jsonb_build_object('action', 'none');
  end if;

  if v_me.cash >= v_owed then
    update public.city_match_players set cash = cash - v_owed
     where match_id = p_match_id and seat = p_seat;
    if v_creditor is not null then
      update public.city_match_players set cash = cash + v_owed
       where match_id = p_match_id and seat = v_creditor;
    end if;
    return jsonb_build_object('action',
      case when v_creditor is null then 'paid_tax' else 'paid_rent' end,
      'amount', v_owed, 'to_seat', v_creditor);
  end if;

  -- Cannot cover it. Until Slice 4 there is nothing to sell or mortgage, so
  -- maximum liquidation is zero and §3.1D declares bankruptcy immediately.
  perform public.city_bankrupt_seat(p_match_id, p_seat, v_creditor);
  return jsonb_build_object('action', 'bankrupt', 'owed', v_owed, 'to_seat', v_creditor);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. city_roll_dice now resolves the landing in the same transaction
-- ---------------------------------------------------------------------------
create or replace function public.city_roll_dice(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
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
         cash = cash + case when v_passed then v_salary else 0 end
   where id = v_me.id;

  -- Resolve what the player landed on, unless they were sent to Customs by the
  -- doubles rule — in that case the move itself was the consequence.
  if v_detained then
    v_landing := jsonb_build_object('action', 'detained', 'to', 10);
  else
    v_landing := public.city_resolve_landing(p_match_id, v_me.seat, v_to, v_dice[1] + v_dice[2]);
  end if;

  -- A pending purchase blocks the turn; everything else opens optional actions.
  v_next_phase := case when v_landing->>'action' = 'may_buy'
                       then 'required_decision' else 'optional_actions' end;

  update public.city_matches
     set rng_counter = rng_counter + 1,
         last_roll = v_dice,
         doubles_count = case
           when v_detained then 0
           when v_is_doubles then doubles_count + 1
           else 0 end,
         phase = v_next_phase,
         turn_started_at = now(),
         turn_clock_elapsed_ms = 0,
         turn_clock_paused_at = null
   where id = p_match_id;

  return jsonb_build_object(
    'dice', v_dice, 'from', v_from, 'to', v_to,
    'passed_departure', v_passed,
    'salary', case when v_passed then v_salary else 0 end,
    'doubles', v_is_doubles, 'detained', v_detained,
    'landing', v_landing
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Buy / decline
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

create or replace function public.city_decline_purchase(p_match_id uuid)
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
  if not found then
    raise exception 'CITY_MATCH_NOT_FOUND';
  end if;

  perform public.city_rate_limit_check(v_match.room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  select * into v_match from public.city_matches where id = p_match_id;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if not found then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.seat <> v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;
  if v_match.phase <> 'required_decision' then
    raise exception 'CITY_NOTHING_TO_DECLINE';
  end if;

  -- FR-11 sends a declined property to auction. Auctions are Slice 6, so for
  -- now the space simply stays unowned. This is the one place Slice 3 knowingly
  -- under-delivers a MUST, and it is recorded rather than silently skipped.
  update public.city_matches set phase = 'optional_actions' where id = p_match_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. A turn cannot be ended while a required decision is outstanding
-- ---------------------------------------------------------------------------
create or replace function public.city_end_turn(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_next integer;
  v_again boolean := false;
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
  if v_match.phase = 'awaiting_roll' then
    raise exception 'CITY_MUST_ROLL_FIRST';
  end if;
  if v_match.phase = 'required_decision' then
    raise exception 'CITY_DECISION_PENDING';
  end if;

  if v_match.doubles_count between 1 and 2 and v_me.status = 'active' then
    v_again := true;
    v_next := v_me.seat;
  else
    select seat into v_next
      from public.city_match_players
     where match_id = p_match_id
       and status not in ('bankrupt', 'retired')
       and seat > v_me.seat
     order by seat limit 1;

    if v_next is null then
      select seat into v_next
        from public.city_match_players
       where match_id = p_match_id
         and status not in ('bankrupt', 'retired')
       order by seat limit 1;
    end if;
  end if;

  update public.city_matches
     set current_seat = v_next,
         phase = 'awaiting_roll',
         doubles_count = case when v_again then doubles_count else 0 end,
         turn_started_at = now(),
         turn_clock_elapsed_ms = 0,
         turn_clock_paused_at = null
   where id = p_match_id;

  return jsonb_build_object('next_seat', v_next, 'roll_again', v_again);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
-- city_bankrupt_seat and city_resolve_landing stay internal: they are steps the
-- engine takes, never actions a player invokes.
revoke all on function public.city_bankrupt_seat(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.city_resolve_landing(uuid, integer, integer, integer) from public, anon, authenticated;

revoke all on function public.city_buy_property(uuid) from public;
revoke all on function public.city_decline_purchase(uuid) from public;
grant execute on function public.city_buy_property(uuid) to anon, authenticated;
grant execute on function public.city_decline_purchase(uuid) to anon, authenticated;
grant execute on function public.city_rent_for(uuid, integer, integer) to anon, authenticated;
