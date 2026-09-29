-- Spintra City — audit C-10 (wave 2a, part 3): the activity feed's money
-- record had two gaps, and the fix for the first needs care about ordering.
--
-- 1. A debt that was paid after raising funds was never logged. When a rent,
--    card charge or Customs fee can't be paid from cash but can be covered by
--    selling or mortgaging, city_charge queues it as `pending_debt`; the
--    player raises the money; city_try_settle_debt (also fired by the
--    city_settle_debt_on_cash trigger on any cash rise) then pays it. That
--    payment wrote no event, so the feed showed the raising and then nothing.
--    It now logs `debt_paid` (payload: amount, to_seat; no to_seat means the
--    bank).
--
-- 2. The Customs fee was logged as `tax_paid`, so the feed said "paid 90 in
--    tax". city_leave_detention_core's two city_charge calls now pass the new
--    kind `fee_paid`.
--
-- Ordering. Settlement fires from the cash UPDATE itself, but the functions
-- that raise cash used to log their own event after it. With (1) alone the
-- feed would have read "paid off a debt ..." above the "mortgaged ..." that
-- paid for it (the same inversion class 0094 fixed for the roll). So the
-- three raise-funds paths the game offers, city_mortgage_core,
-- city_sell_building_core and city_accept_trade, now log before the cash
-- moves. One path is deliberately left as it was: city_bankrupt_seat credits
-- the creditor's cash before logging `bankrupt`, so a creditor who was
-- themselves in debt at that moment would show "paid off a debt" just before
-- "went bankrupt". That needs a bankruptcy landing on a player who is
-- simultaneously in debt; not worth re-issuing a core function for.
--
-- `city_match_events_kind_check` (0095) lists the accepted kinds, so it gains
-- the two new ones. Every function below is copied verbatim from its latest
-- definition (0102, 0094, 0093, 0093, 0103) with only the edits described
-- here. CREATE OR REPLACE keeps each function's existing privileges, so no
-- grant or revoke is repeated: the cores stay server-only and
-- city_accept_trade stays callable by players exactly as before.

alter table public.city_match_events
  drop constraint if exists city_match_events_kind_check;
alter table public.city_match_events
  add constraint city_match_events_kind_check
  check (kind = any (array[
    'rolled', 'bought', 'auction_started', 'auction_won', 'auction_unsold',
    'rent_paid', 'tax_paid', 'built', 'sold_building', 'mortgaged', 'unmortgaged',
    'trade_accepted', 'bankrupt', 'retired',
    'card_collected', 'card_visa_gained', 'card_sent_to_customs', 'card_charged',
    'debt_paid', 'fee_paid'
  ]));

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

  -- Audit C-10: the payment itself was never logged. A rent, card or fee that
  -- went through the raise-funds window showed in the feed as the raising
  -- (a mortgage, a sale) and then nothing, so the money left the debtor with
  -- no row saying where it went. The debt's original kind (rent, card, fee)
  -- isn't kept once it is queued, so this says only who was paid; no
  -- creditor means the bank.
  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'debt_paid', p_seat, jsonb_build_object(
    'amount', v_me.pending_debt, 'to_seat', v_me.pending_creditor_seat));

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
    v_charge := public.city_charge(p_match_id, v_me.seat, v_fee, null, 'fee_paid');
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
    v_charge := public.city_charge(p_match_id, v_me.seat, v_fee, null, 'fee_paid');
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

  -- Logged before the cash lands: adding the cash is what settles a debt it
  -- covers, and that settlement logs its own 'debt_paid' event (audit C-10),
  -- which must get the higher id so the feed reads the raising first and
  -- then "paid off a debt ...".
  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'mortgaged', p_seat, jsonb_build_object('space', p_space_idx, 'raised', v_value));

  update public.city_match_players set cash = cash + v_value
   where match_id = p_match_id and seat = p_seat;
  perform public.city_try_settle_debt(p_match_id, p_seat);

  return jsonb_build_object('space', p_space_idx, 'raised', v_value);
end;
$fn$;

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

  -- Logged before the cash lands: adding the cash is what settles a debt it
  -- covers, and that settlement logs its own 'debt_paid' event (audit C-10),
  -- which must get the higher id so the feed reads the raising first and
  -- then "paid off a debt ...".
  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'sold_building', p_seat, jsonb_build_object(
    'space', p_space_idx, 'buildings', v_asset.buildings - 1, 'returned', v_return
  ));

  update public.city_match_players set cash = cash + v_return
   where match_id = p_match_id and seat = p_seat;
  perform public.city_try_settle_debt(p_match_id, p_seat);

  return jsonb_build_object('space', p_space_idx, 'buildings', v_asset.buildings - 1,
                            'returned', v_return);
end;
$fn$;

create or replace function public.city_accept_trade(p_offer_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
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

  select * into v_offer from public.city_trade_offers where id = p_offer_id;
  select * into v_match from public.city_matches where id = v_offer.match_id;

  if v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'CITY_OFFER_CLOSED';
  end if;
  if v_offer.queued then
    raise exception 'CITY_OFFER_QUEUED';
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

  if v_from.cash < v_offer.give_cash or v_to.cash < v_offer.get_cash then
    raise exception 'CITY_OFFER_STALE';
  end if;

  if v_to.pending_debt > 0
     and (v_to.cash + v_offer.give_cash - v_offer.get_cash) < v_to.pending_debt then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;

  -- Symmetric to the v_to check above: the proposer can have gone into debt
  -- after proposing but before the other side accepted. Distinct error code
  -- from the v_to case above -- only the accepting seat (v_to) can ever call
  -- this function, so "settle your own debt" would be both false and
  -- unactionable here: it's the proposer who owes, not the caller.
  if v_from.pending_debt > 0
     and (v_from.cash - v_offer.give_cash + v_offer.get_cash) < v_from.pending_debt then
    raise exception 'CITY_PROPOSER_SETTLE_DEBT_FIRST';
  end if;

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

  update public.city_assets set owner_seat = v_offer.to_seat
   where match_id = v_offer.match_id and space_idx = any(v_offer.give_spaces);
  update public.city_assets set owner_seat = v_offer.from_seat
   where match_id = v_offer.match_id and space_idx = any(v_offer.get_spaces);

  -- Logged before the cash lands: adding the cash is what settles a debt it
  -- covers, and that settlement logs its own 'debt_paid' event (audit C-10),
  -- which must get the higher id so the feed reads the raising first and
  -- then "paid off a debt ...".
  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (v_offer.match_id, 'trade_accepted', v_offer.to_seat, jsonb_build_object(
    'with_seat', v_offer.from_seat,
    'gave_spaces', v_offer.get_spaces, 'got_spaces', v_offer.give_spaces,
    'gave_cash', v_offer.get_cash, 'got_cash', v_offer.give_cash
  ));

  update public.city_match_players
     set cash = cash - v_offer.give_cash + v_offer.get_cash
   where match_id = v_offer.match_id and seat = v_offer.from_seat;
  update public.city_match_players
     set cash = cash + v_offer.give_cash - v_offer.get_cash
   where match_id = v_offer.match_id and seat = v_offer.to_seat;

  update public.city_trade_offers
     set status = 'accepted', resolved_at = now()
   where id = p_offer_id;

  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = v_offer.match_id and status = 'pending' and id <> p_offer_id
     and (give_spaces && (v_offer.give_spaces || v_offer.get_spaces)
       or get_spaces && (v_offer.give_spaces || v_offer.get_spaces));

  perform public.city_maybe_resume_trade_clock(v_offer.match_id);

  return jsonb_build_object(
    'accepted', true,
    'spaces_to_proposer', v_offer.get_spaces,
    'spaces_to_recipient', v_offer.give_spaces,
    'cash_to_recipient', v_offer.give_cash,
    'cash_to_proposer', v_offer.get_cash
  );
end;
$fn$;
