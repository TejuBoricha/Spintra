-- Spintra City — Round 2 of the QA audit's fix phase: closes BUG-005,
-- BUG-011, BUG-023 and BUG-029. Migrations are append-only.
--
-- BUG-005: a player charged off-turn (a "collect from every player" card,
-- for example) gets `pending_debt` set correctly regardless of whose turn
-- it is, but every action that could actually raise the funds --
-- city_sell_building, city_mortgage, city_declare_bankruptcy -- goes
-- through city_assert_can_manage, which unconditionally requires the
-- caller to be the *current* seat. An off-turn debtor was locked out of
-- every one of the three raise-funds paths DESIGN.md's own §3.1D
-- describes ("sell developments... mortgage properties... or trade"),
-- stalled until their own turn arrives (up to N-1 turns at a full table).
--
-- BUG-029: city_assert_can_manage never looks at match phase at all, so
-- the current seat can build/sell/mortgage/unmortgage/declare-bankruptcy
-- *during an active auction* -- a phase where the only legal actions are
-- meant to be city_bid and city_settle_auction (DESIGN §3.1E: "auction is
-- a global match phase").
--
-- Both are fixed in one place: city_assert_can_manage gains two defaulted
-- parameters (additive -- no DROP FUNCTION needed).
--   * p_allow_off_turn_debt: lets a seat other than current_seat through
--     when *that seat itself* has pending_debt > 0. Only passed `true` by
--     the three raise-funds/give-up actions; city_build and
--     city_unmortgage keep the strict default (building and unmortgaging
--     are not raise-funds actions -- both already independently refuse a
--     debtor via their own `CITY_SETTLE_DEBT_FIRST` checks).
--   * p_block_required_decision: refuses the call while phase =
--     'required_decision', passed `true` only by city_build (you should
--     not be able to build while a mandatory decision -- buy/decline,
--     raise-funds, detention-exit -- is still pending). The three
--     raise-funds actions must stay usable during required_decision --
--     that phase *is* how a debtor resolves the debt -- so they leave it
--     at the permissive default.
-- The auction check applies unconditionally, before either flag, to every
-- caller: no management action is legal while an auction is running.
create or replace function public.city_assert_can_manage(
  p_match_id uuid,
  p_user_id text,
  p_allow_off_turn_debt boolean default false,
  p_block_required_decision boolean default false
)
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
  if v_match.phase = 'auction' then
    raise exception 'CITY_AUCTION_IN_PROGRESS';
  end if;
  if p_block_required_decision and v_match.phase = 'required_decision' then
    raise exception 'CITY_DECISION_PENDING';
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
    if not (p_allow_off_turn_debt and v_me.pending_debt > 0) then
      raise exception 'CITY_NOT_YOUR_TURN';
    end if;
  end if;
  return v_me;
end;
$$;

-- Unaffected calls (city_unmortgage, and city_assert_can_manage's own
-- revoke from 0066) carry over untouched -- CREATE OR REPLACE keeps the
-- function's existing grants when only trailing defaulted parameters are
-- added.

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
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text,
    p_allow_off_turn_debt => false, p_block_required_decision => true);

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
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text,
    p_allow_off_turn_debt => true);

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
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text,
    p_allow_off_turn_debt => true);

  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;
  if v_asset.id is null or v_asset.owner_seat <> v_me.seat then
    raise exception 'CITY_NOT_YOURS';
  end if;
  if v_asset.is_mortgaged then
    raise exception 'CITY_ALREADY_MORTGAGED';
  end if;
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
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text,
    p_allow_off_turn_debt => true);

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
-- BUG-011: a debtor could strip every liquidatable asset to an accomplice
-- for a token cash amount by *accepting* a trade, evading the creditor
-- entirely -- city_propose_trade already refuses a proposer in debt, but
-- city_accept_trade never checked the accepting side at all.
--
-- DESIGN §3.1D lists trade as a legitimate raise-funds path alongside sell
-- and mortgage, so the fix is not "refuse every trade while in debt" --
-- that would contradict the design and re-introduce BUG-005's stall for
-- the one path meant to relieve it. Instead: a debtor may only accept a
-- trade that actually clears the debt. Selling/mortgaging have no such
-- gate because the cash they raise stays with the debtor either way
-- (city_try_settle_debt picks up any partial progress); a trade instead
-- moves both cash *and property equity* to an unrelated third party, so a
-- partial trade would let that equity permanently escape the creditor's
-- eventual bankruptcy claim. Requiring the trade to fully cover
-- pending_debt closes exactly that gap while leaving genuine
-- debt-clearing trades untouched.
--
-- BUG-023: city_accept_trade tried to mark a lapsed offer 'expired' and
-- then raise CITY_OFFER_EXPIRED in the same statement -- the raise rolls
-- back the whole invocation, undoing the very update meant to persist the
-- expiry, so the offer reads 'pending' forever even though every code
-- path that matters (this same expiry re-check, and city_end_turn's
-- match-wide sweep on `expires_at <= now()`) already treats it as dead.
-- The update never actually persisted a single time; removing it deletes
-- dead code, not a working mechanism. The one thing that mattered --
-- accept correctly and unconditionally refusing to execute a lapsed
-- offer -- was never affected either way.
create or replace function public.city_accept_trade(p_offer_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_offer public.city_trade_offers;
  v_match public.city_matches;
  v_from public.city_match_players;
  v_to public.city_match_players;
  v_idx integer;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;

  select * into v_offer from public.city_trade_offers where id = p_offer_id;
  if v_offer.id is null then
    raise exception 'CITY_OFFER_NOT_FOUND';
  end if;

  select * into v_match from public.city_matches where id = v_offer.match_id;
  perform public.city_rate_limit_check(v_match.room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(v_offer.match_id::text, 0));

  -- re-read under the lock; a concurrent accept or withdraw may have landed
  select * into v_offer from public.city_trade_offers where id = p_offer_id;
  select * into v_match from public.city_matches where id = v_offer.match_id;

  if v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'CITY_OFFER_CLOSED';
  end if;
  if v_offer.expires_at <= now() then
    raise exception 'CITY_OFFER_EXPIRED';
  end if;

  select * into v_to from public.city_match_players
   where match_id = v_offer.match_id and seat = v_offer.to_seat;
  select * into v_from from public.city_match_players
   where match_id = v_offer.match_id and seat = v_offer.from_seat;

  if v_to.user_id <> v_user_id then
    raise exception 'CITY_NOT_YOUR_OFFER';
  end if;
  if v_from.status <> 'active' or v_to.status <> 'active' then
    raise exception 'CITY_OFFER_STALE';
  end if;

  -- cash, re-checked against live balances
  if v_from.cash < v_offer.give_cash or v_to.cash < v_offer.get_cash then
    raise exception 'CITY_OFFER_STALE';
  end if;

  -- a debtor accepting must actually clear the debt with this trade, or
  -- the trade is asset-stripping, not raising funds (BUG-011)
  if v_to.pending_debt > 0
     and (v_to.cash + v_offer.give_cash - v_offer.get_cash) < v_to.pending_debt then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;

  -- ownership and development, re-checked space by space
  foreach v_idx in array v_offer.give_spaces loop
    if not exists (select 1 from public.city_assets
                    where match_id = v_offer.match_id and space_idx = v_idx
                      and owner_seat = v_offer.from_seat) then
      raise exception 'CITY_OFFER_STALE';
    end if;
    if not public.city_space_is_tradeable(v_offer.match_id, v_idx) then
      raise exception 'CITY_OFFER_STALE';
    end if;
  end loop;
  foreach v_idx in array v_offer.get_spaces loop
    if not exists (select 1 from public.city_assets
                    where match_id = v_offer.match_id and space_idx = v_idx
                      and owner_seat = v_offer.to_seat) then
      raise exception 'CITY_OFFER_STALE';
    end if;
    if not public.city_space_is_tradeable(v_offer.match_id, v_idx) then
      raise exception 'CITY_OFFER_STALE';
    end if;
  end loop;

  -- Apply. Every statement below is in this one transaction, so FR-22's
  -- "both sides transfer or neither does" is a property of the database
  -- rather than something this function has to be careful about.
  update public.city_assets set owner_seat = v_offer.to_seat
   where match_id = v_offer.match_id and space_idx = any(v_offer.give_spaces);
  update public.city_assets set owner_seat = v_offer.from_seat
   where match_id = v_offer.match_id and space_idx = any(v_offer.get_spaces);

  update public.city_match_players
     set cash = cash - v_offer.give_cash + v_offer.get_cash
   where match_id = v_offer.match_id and seat = v_offer.from_seat;
  update public.city_match_players
     set cash = cash + v_offer.give_cash - v_offer.get_cash
   where match_id = v_offer.match_id and seat = v_offer.to_seat;

  update public.city_trade_offers
     set status = 'accepted', resolved_at = now()
   where id = p_offer_id;

  -- Any other pending offer naming a space that just moved is now describing a
  -- world that no longer exists. Closing them is §3.1F's "superseded" marking:
  -- cosmetic for correctness (accept re-validates regardless), but it stops the
  -- UI showing offers that are guaranteed to fail.
  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = v_offer.match_id and status = 'pending' and id <> p_offer_id
     and (give_spaces && (v_offer.give_spaces || v_offer.get_spaces)
       or get_spaces && (v_offer.give_spaces || v_offer.get_spaces));

  return jsonb_build_object(
    'accepted', true,
    'spaces_to_proposer', v_offer.get_spaces,
    'spaces_to_recipient', v_offer.give_spaces,
    'cash_to_recipient', v_offer.give_cash,
    'cash_to_proposer', v_offer.get_cash
  );
end;
$$;
