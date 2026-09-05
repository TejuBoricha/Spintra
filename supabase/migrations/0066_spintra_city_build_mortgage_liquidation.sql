-- Spintra City — Slice 4: development tiers, mortgaging, and real liquidation.
-- Requirements FR-13, FR-14, and the half of FR-18 that Slice 3 could not
-- honour (docs/SPINTRA_CITY_SPEC.md §7).
--
-- Slice 3 sent an unpayable debt straight to bankruptcy. That was correct
-- then — with nothing to sell or mortgage, maximum liquidation really was
-- zero, and DESIGN.md §3.1D says to declare immediately rather than force a
-- pointless ritual. This slice gives players something to sell, so the same
-- rule now produces a genuine decision: raise the funds, or go under.

-- ---------------------------------------------------------------------------
-- 1. A debt a player has been given the chance to cover
-- ---------------------------------------------------------------------------
alter table public.city_match_players
  add column if not exists pending_debt integer not null default 0
    check (pending_debt >= 0),
  -- null creditor = owed to the bank (tax)
  add column if not exists pending_creditor_seat integer
    check (pending_creditor_seat is null or pending_creditor_seat between 0 and 7);

grant select (pending_debt, pending_creditor_seat)
  on table public.city_match_players to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. What a seat could raise if it sold everything
-- ---------------------------------------------------------------------------
-- Buildings return half their build cost; an unmortgaged property returns half
-- its list price (CONTENT.md §4). Used to decide whether a debt is survivable
-- at all before offering the player the choice.
create or replace function public.city_max_liquidation(p_match_id uuid, p_seat integer)
returns integer
security definer
set search_path = public
language sql
stable
as $$
  select coalesce(sum(
    a.buildings * (s.build_cost / 2)
    + case when a.is_mortgaged then 0 else s.price / 2 end
  ), 0)::integer
  from public.city_assets a
  join public.city_board_spaces s on s.idx = a.space_idx
  where a.match_id = p_match_id and a.owner_seat = p_seat;
$$;

-- ---------------------------------------------------------------------------
-- 3. Shared guard for the liquidation commands
-- ---------------------------------------------------------------------------
-- Mortgaging and selling are legal on your own turn, and also while you are
-- staring down a pending debt — that is the whole point of the raise-funds
-- window, and it can arrive on a turn that is already yours.
-- Dropped first: an earlier shape of this helper used OUT parameters, and
-- CREATE OR REPLACE cannot change a function's return type.
drop function if exists public.city_assert_can_manage(uuid, text);
create or replace function public.city_assert_can_manage(p_match_id uuid, p_user_id text)
returns public.city_match_players
security definer
set search_path = public
language plpgsql as $$
declare
  v_match public.city_matches;
  v_me public.city_match_players;
begin
  if p_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;

  select * into v_match from public.city_matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'CITY_MATCH_NOT_FOUND';
  end if;
  if v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = p_user_id;
  if v_me.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.status in ('bankrupt', 'retired') then
    raise exception 'CITY_SEAT_OUT';
  end if;
  if v_me.seat <> v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;
  return v_me;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Settle a pending debt the moment it becomes affordable
-- ---------------------------------------------------------------------------
-- Called after every liquidation step rather than left to a "pay now" button:
-- a player who has raised the money has no meaningful choice left, and leaving
-- the debt outstanding would let them sit in the raise-funds phase forever.
create or replace function public.city_try_settle_debt(p_match_id uuid, p_seat integer)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_me public.city_match_players;
begin
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

  update public.city_matches set phase = 'optional_actions'
   where id = p_match_id and phase = 'required_decision';
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Build / sell (FR-13)
-- ---------------------------------------------------------------------------
create or replace function public.city_build(p_match_id uuid, p_space_idx integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_me public.city_match_players;
  v_space public.city_board_spaces;
  v_asset public.city_assets;
  v_min integer;
  v_group_total integer;
  v_group_mine integer;
begin
  perform public.city_rate_limit_check(
    (select room_code from public.city_matches where id = p_match_id), auth.uid()::text);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text);

  if v_me.pending_debt > 0 then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;

  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  if v_space.kind <> 'property' then
    raise exception 'CITY_NOT_DEVELOPABLE';
  end if;

  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;
  if v_asset.id is null or v_asset.owner_seat <> v_me.seat then
    raise exception 'CITY_NOT_YOURS';
  end if;
  if v_asset.buildings >= 5 then
    raise exception 'CITY_FULLY_BUILT';
  end if;

  -- must hold the whole country, and none of it mortgaged
  select count(*), count(*) filter (where a.owner_seat = v_me.seat and not a.is_mortgaged)
    into v_group_total, v_group_mine
    from public.city_board_spaces s
    left join public.city_assets a on a.space_idx = s.idx and a.match_id = p_match_id
   where s.country = v_space.country;
  if v_group_mine < v_group_total then
    raise exception 'CITY_SET_INCOMPLETE';
  end if;

  -- even build: only the lowest tier in the set may be raised
  select min(coalesce(a.buildings, 0)) into v_min
    from public.city_board_spaces s
    left join public.city_assets a on a.space_idx = s.idx and a.match_id = p_match_id
   where s.country = v_space.country;
  if v_asset.buildings > v_min then
    raise exception 'CITY_EVEN_BUILD';
  end if;

  if v_me.cash < v_space.build_cost then
    raise exception 'CITY_INSUFFICIENT_FUNDS';
  end if;

  update public.city_assets set buildings = buildings + 1 where id = v_asset.id;
  update public.city_match_players set cash = cash - v_space.build_cost where id = v_me.id;

  return jsonb_build_object('space', p_space_idx, 'buildings', v_asset.buildings + 1,
                            'cost', v_space.build_cost);
end;
$$;

create or replace function public.city_sell_building(p_match_id uuid, p_space_idx integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_me public.city_match_players;
  v_space public.city_board_spaces;
  v_asset public.city_assets;
  v_max integer;
  v_return integer;
begin
  perform public.city_rate_limit_check(
    (select room_code from public.city_matches where id = p_match_id), auth.uid()::text);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text);

  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;
  if v_asset.id is null or v_asset.owner_seat <> v_me.seat then
    raise exception 'CITY_NOT_YOURS';
  end if;
  if v_asset.buildings = 0 then
    raise exception 'CITY_NOTHING_BUILT';
  end if;

  -- even build in reverse: only the highest tier in the set may be lowered
  select max(coalesce(a.buildings, 0)) into v_max
    from public.city_board_spaces s
    left join public.city_assets a on a.space_idx = s.idx and a.match_id = p_match_id
   where s.country = v_space.country;
  if v_asset.buildings < v_max then
    raise exception 'CITY_EVEN_BUILD';
  end if;

  v_return := v_space.build_cost / 2;
  update public.city_assets set buildings = buildings - 1 where id = v_asset.id;
  update public.city_match_players set cash = cash + v_return where id = v_me.id;
  perform public.city_try_settle_debt(p_match_id, v_me.seat);

  return jsonb_build_object('space', p_space_idx, 'buildings', v_asset.buildings - 1,
                            'returned', v_return);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Mortgage / lift (FR-14)
-- ---------------------------------------------------------------------------
create or replace function public.city_mortgage(p_match_id uuid, p_space_idx integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_me public.city_match_players;
  v_space public.city_board_spaces;
  v_asset public.city_assets;
  v_value integer;
begin
  perform public.city_rate_limit_check(
    (select room_code from public.city_matches where id = p_match_id), auth.uid()::text);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text);

  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;
  if v_asset.id is null or v_asset.owner_seat <> v_me.seat then
    raise exception 'CITY_NOT_YOURS';
  end if;
  if v_asset.is_mortgaged then
    raise exception 'CITY_ALREADY_MORTGAGED';
  end if;
  -- A city must be stripped of buildings before it can be mortgaged. The table
  -- CHECK enforces the same thing, but raising a named error here gives the UI
  -- something to say instead of a constraint violation.
  if v_asset.buildings > 0 then
    raise exception 'CITY_SELL_BUILDINGS_FIRST';
  end if;

  v_value := v_space.price / 2;
  update public.city_assets set is_mortgaged = true where id = v_asset.id;
  update public.city_match_players set cash = cash + v_value where id = v_me.id;
  perform public.city_try_settle_debt(p_match_id, v_me.seat);

  return jsonb_build_object('space', p_space_idx, 'raised', v_value);
end;
$$;

create or replace function public.city_unmortgage(p_match_id uuid, p_space_idx integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_me public.city_match_players;
  v_space public.city_board_spaces;
  v_asset public.city_assets;
  v_cost integer;
begin
  perform public.city_rate_limit_check(
    (select room_code from public.city_matches where id = p_match_id), auth.uid()::text);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text);

  if v_me.pending_debt > 0 then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;

  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;
  if v_asset.id is null or v_asset.owner_seat <> v_me.seat then
    raise exception 'CITY_NOT_YOURS';
  end if;
  if not v_asset.is_mortgaged then
    raise exception 'CITY_NOT_MORTGAGED';
  end if;

  -- mortgage value plus 10% interest (CONTENT.md §4)
  v_cost := ceil((v_space.price / 2) * 1.1)::integer;
  if v_me.cash < v_cost then
    raise exception 'CITY_INSUFFICIENT_FUNDS';
  end if;

  update public.city_assets set is_mortgaged = false where id = v_asset.id;
  update public.city_match_players set cash = cash - v_cost where id = v_me.id;

  return jsonb_build_object('space', p_space_idx, 'cost', v_cost);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Giving up, when the debt genuinely cannot be covered
-- ---------------------------------------------------------------------------
-- Only offered while a debt is outstanding. A player who can afford it is not
-- allowed to walk away instead of paying — that would be a way to deny a
-- creditor their rent.
create or replace function public.city_declare_bankruptcy(p_match_id uuid)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_me public.city_match_players;
begin
  perform public.city_rate_limit_check(
    (select room_code from public.city_matches where id = p_match_id), auth.uid()::text);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text);

  if v_me.pending_debt = 0 then
    raise exception 'CITY_NO_DEBT';
  end if;
  if v_me.cash >= v_me.pending_debt then
    raise exception 'CITY_CAN_PAY';
  end if;

  perform public.city_bankrupt_seat(p_match_id, v_me.seat, v_me.pending_creditor_seat);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Landing now offers the chance to raise funds
-- ---------------------------------------------------------------------------
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

  if v_space.kind = 'corner' then
    if v_space.name = 'Detained' then
      update public.city_match_players set position = 10
       where match_id = p_match_id and seat = p_seat;
      return jsonb_build_object('action', 'detained', 'to', 10);
    end if;
    return jsonb_build_object('action', 'none');
  end if;

  if v_space.kind = 'card' then
    return jsonb_build_object('action', 'card_pending', 'deck', v_space.deck);
  end if;

  if v_space.kind = 'tax' then
    v_owed := v_space.tax_amount;
    v_creditor := null;
  elsif v_asset.id is null then
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

  -- Short on cash. If selling and mortgaging everything could still cover it,
  -- that is the player's decision to make, not the engine's (§3.1D).
  if v_me.cash + public.city_max_liquidation(p_match_id, p_seat) >= v_owed then
    update public.city_match_players
       set pending_debt = v_owed, pending_creditor_seat = v_creditor
     where match_id = p_match_id and seat = p_seat;
    return jsonb_build_object('action', 'must_raise_funds',
      'owed', v_owed, 'to_seat', v_creditor, 'short_by', v_owed - v_me.cash);
  end if;

  -- Even selling everything falls short, so the ritual would be pointless.
  perform public.city_bankrupt_seat(p_match_id, p_seat, v_creditor);
  return jsonb_build_object('action', 'bankrupt', 'owed', v_owed, 'to_seat', v_creditor);
end;
$$;

-- A debt blocks the turn exactly the way a pending purchase does.
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
  if v_me.pending_debt > 0 then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
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

  if v_detained then
    v_landing := jsonb_build_object('action', 'detained', 'to', 10);
  else
    v_landing := public.city_resolve_landing(p_match_id, v_me.seat, v_to, v_dice[1] + v_dice[2]);
  end if;

  v_next_phase := case
    when v_landing->>'action' in ('may_buy', 'must_raise_funds') then 'required_decision'
    else 'optional_actions' end;

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
-- 9. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.city_assert_can_manage(uuid, text) from public, anon, authenticated;
revoke all on function public.city_try_settle_debt(uuid, integer) from public, anon, authenticated;

revoke all on function public.city_build(uuid, integer) from public;
revoke all on function public.city_sell_building(uuid, integer) from public;
revoke all on function public.city_mortgage(uuid, integer) from public;
revoke all on function public.city_unmortgage(uuid, integer) from public;
revoke all on function public.city_declare_bankruptcy(uuid) from public;
grant execute on function public.city_build(uuid, integer) to anon, authenticated;
grant execute on function public.city_sell_building(uuid, integer) to anon, authenticated;
grant execute on function public.city_mortgage(uuid, integer) to anon, authenticated;
grant execute on function public.city_unmortgage(uuid, integer) to anon, authenticated;
grant execute on function public.city_declare_bankruptcy(uuid) to anon, authenticated;
grant execute on function public.city_max_liquidation(uuid, integer) to anon, authenticated;
