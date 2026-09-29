-- Spintra City — audit C-8 (product decision, 2026-09-29): an auction could be
-- won for 10 by anyone who was watching when nobody else was.
--
-- The auction opened at a fixed floor of 10 with a 15-second first window, and
-- the player who declined to buy could bid in it like anyone else. Declining a
-- 420 property and bidding 10 wins it for 2% of its price if the other players
-- don't answer within 15 seconds (the panel sits below the fold on most
-- screens, see C-19). The cheapest property is 55, the average about 198.
--
-- Three changes, decided together:
--
-- 1. An opening bid of half the list price, rounded up to the bid step of 10:
--    `city_auctions.opening_bid`, set by the server when the auction opens and
--    read by the client, so the number lives in one place. Half the list price
--    is the mortgage value, so the bank never sells for less than it would
--    lend against the property. A property nobody wants at that price goes
--    unsold (as before) and can be bought on a later landing. The decliner may
--    still bid, as in the standard rules; the worst case is now a 50% discount
--    instead of 95%, and only if every other player stays silent.
-- 2. A 30-second first window (was 15), and each bid resets the clock to 15
--    seconds (was 10). The hard ceiling stays at 2 minutes.
-- 3. Auctions already running when this deploys keep the old floor: the column
--    defaults to 10, which is what they were opened with.
--
-- city_decline_purchase_core is copied from 0093 and city_place_bid from 0069
-- (its only definition) with only those edits. CREATE OR REPLACE keeps each
-- function's privileges, so nothing is granted or revoked here: city_place_bid
-- stays callable by players and the core stays server-only.

alter table public.city_auctions
  add column if not exists opening_bid integer not null default 10
    check (opening_bid >= 10 and opening_bid % 10 = 0);

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
  v_reserve integer;
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

  -- Audit C-8: half the list price (the mortgage value), rounded up to the
  -- bid step of 10 (price / 2 / 10 = price / 20).
  v_reserve := greatest(10, (ceil(v_space.price / 20.0) * 10)::integer);

  insert into public.city_auctions (match_id, space_idx, opening_bid, ends_at, hard_ends_at)
  values (p_match_id, v_me.position, v_reserve, now() + interval '30 seconds',
          now() + interval '2 minutes')
  returning id into v_auction_id;

  update public.city_matches
     set phase = 'auction'
   where id = p_match_id;

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'auction_started', p_seat, jsonb_build_object('space', v_me.position));

  return jsonb_build_object('auction', true, 'auction_id', v_auction_id, 'space', v_me.position);
end;
$fn$;

create or replace function public.city_place_bid(p_match_id uuid, p_amount integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_auction public.city_auctions;
  v_step constant integer := 10;
  v_min integer;
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

  select * into v_auction from public.city_auctions
   where match_id = p_match_id and status = 'running';
  if v_auction.id is null then
    raise exception 'CITY_NO_AUCTION';
  end if;
  if now() >= least(v_auction.ends_at, v_auction.hard_ends_at) then
    raise exception 'CITY_AUCTION_CLOSED';
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_me.id is null or v_me.status <> 'active' then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.pending_debt > 0 then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;

  -- opening bid is the auction's own (half the list price, audit C-8); after
  -- that it is the standing bid plus the step
  v_min := case when v_auction.high_seat is null then v_auction.opening_bid
                else v_auction.high_bid + v_step end;
  if p_amount < v_min then
    raise exception 'CITY_BID_TOO_LOW';
  end if;
  if p_amount % v_step <> 0 then
    raise exception 'CITY_BID_NOT_A_STEP';
  end if;
  -- §3.1E: no bidding on credit. Checked against live cash, not a stored value.
  if p_amount > v_me.cash then
    raise exception 'CITY_INSUFFICIENT_FUNDS';
  end if;

  update public.city_auctions
     set high_bid = p_amount,
         high_seat = v_me.seat,
         -- every bid resets the countdown to 15s, never past the hard ceiling
         ends_at = least(now() + interval '15 seconds', hard_ends_at),
         -- passing is not binding: bidding puts you back in
         passed_seats = array_remove(passed_seats, v_me.seat)
   where id = v_auction.id;

  return jsonb_build_object('high_bid', p_amount, 'high_seat', v_me.seat);
end;
$$;
