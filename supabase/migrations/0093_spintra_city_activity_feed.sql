-- Spintra City — persistent activity feed (user feedback 2026-09-03: "who has
-- acquired what live feed is missing" plus a follow-up naming richup.io's
-- running action log by name). The purchase toast added in the previous pass
-- was ephemeral, per-tab, and purchase-only; this replaces it with a real
-- append-only history every client can load on join and append to live.
--
-- No existing table could be repurposed: city_command_attempts (0063) is a
-- bare rate-limit ledger (user_id, room_code, created_at — no action/type
-- column at all), and every other city_* table is current-state, mutated in
-- place, not appended to.
--
-- Schema and RLS are copied verbatim from the established pattern (0078's
-- fix for city_assets/city_auctions/city_trade_offers: readable by anyone
-- who is a member of the room the match belongs to, via city_matches ->
-- is_member_of_room). Payloads carry space indexes, not names — every client
-- already holds the static city_board_spaces set and can resolve a name
-- locally, so rows stay small and there is nothing to keep in sync.
--
-- Every function below is CREATE OR REPLACE with its exact existing body —
-- one insert statement added after that function's own state mutations and
-- before its return, never before an early-exit guard (so a call that raises
-- or returns early logs nothing, same as it mutates nothing). No existing
-- behavior changes.
--
-- Deliberately out of v1 (a smaller, well-justified slice, not an oversight):
-- turn-change (high-frequency, zero narrative value — already shown via seat
-- highlight), trade proposed/declined/withdrawn, and detention exits. Logged
-- in TASKS.md as a v2 candidate.

-- ---------------------------------------------------------------------------
-- 0. Schema
-- ---------------------------------------------------------------------------
create table if not exists public.city_match_events (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.city_matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null,
  actor_seat integer check (actor_seat between 0 and 7),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists city_match_events_match_id_idx
  on public.city_match_events (match_id, id);

alter table public.city_match_events enable row level security;

drop policy if exists "Match events are readable" on public.city_match_events;
create policy "Match events are readable" on public.city_match_events
  for select using (
    exists (
      select 1 from public.city_matches m
      where m.id = city_match_events.match_id
        and public.is_member_of_room(m.room_code, auth.uid()::text)
    )
  );

revoke insert, update, delete on public.city_match_events from anon, authenticated;

-- Every other realtime-subscribed City table was added to supabase_realtime
-- in its own migration (0063 city_matches/city_match_players, 0064
-- city_assets, 0067 city_trade_offers, 0069 city_auctions) — a table not in
-- this publication never fires a postgres_changes event no matter how a
-- client subscribes, so this is not optional. Guarded the same idempotent
-- way 0063 established, for painless local re-application.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'city_match_events'
  ) then
    alter publication supabase_realtime add table public.city_match_events;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. city_roll_dice_core — 'rolled'
-- ---------------------------------------------------------------------------
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

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'rolled', v_me.seat, jsonb_build_object(
    'dice', v_dice, 'to', v_to, 'passed_departure', v_passed,
    'doubles', v_is_doubles, 'detained', v_detained
  ));

  return v_result;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. city_charge (internal) — 'rent_paid' / 'tax_paid', full-pay branch only
--    (a must_raise_funds or bankrupt outcome hasn't actually moved money yet;
--    bankrupt gets its own event from city_bankrupt_seat below).
-- ---------------------------------------------------------------------------
create or replace function public.city_charge(
  p_match_id uuid, p_seat integer, p_amount integer, p_creditor_seat integer
)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_me public.city_match_players;
begin
  if p_amount <= 0 then
    return jsonb_build_object('action', 'none');
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  if v_me.cash >= p_amount then
    update public.city_match_players set cash = cash - p_amount where id = v_me.id;
    if p_creditor_seat is not null then
      update public.city_match_players set cash = cash + p_amount
       where match_id = p_match_id and seat = p_creditor_seat;
    end if;
    insert into public.city_match_events (match_id, kind, actor_seat, payload)
    values (p_match_id, case when p_creditor_seat is null then 'tax_paid' else 'rent_paid' end,
      p_seat, jsonb_build_object('amount', p_amount, 'to_seat', p_creditor_seat));
    return jsonb_build_object('action',
      case when p_creditor_seat is null then 'paid_tax' else 'paid_rent' end,
      'amount', p_amount, 'to_seat', p_creditor_seat);
  end if;

  if v_me.cash + public.city_max_liquidation(p_match_id, p_seat) >= p_amount then
    if v_me.pending_debt > 0 then
      -- A claim is already outstanding — queue this one rather than erasing it.
      insert into public.city_debt_queue (match_id, debtor_seat, creditor_seat, amount)
      values (p_match_id, p_seat, p_creditor_seat, p_amount);
    else
      update public.city_match_players
         set pending_debt = p_amount, pending_creditor_seat = p_creditor_seat
       where id = v_me.id;
      -- FR-33/FR-42: the fixed 90s liquidation window starts now, for this
      -- freshly-created claim — not restarted by a later queued one.
      update public.city_matches set debt_started_at = now() where id = p_match_id;
    end if;
    update public.city_matches set phase = 'required_decision'
     where id = p_match_id and current_seat = p_seat;
    return jsonb_build_object('action', 'must_raise_funds', 'owed', p_amount,
      'to_seat', p_creditor_seat, 'short_by', p_amount - v_me.cash);
  end if;

  perform public.city_bankrupt_seat(p_match_id, p_seat, p_creditor_seat);
  return jsonb_build_object('action', 'bankrupt', 'owed', p_amount, 'to_seat', p_creditor_seat);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. city_build — 'built'
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

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'built', v_me.seat, jsonb_build_object(
    'space', p_space_idx, 'buildings', v_asset.buildings + 1, 'cost', v_space.build_cost
  ));

  return jsonb_build_object('space', p_space_idx, 'buildings', v_asset.buildings + 1,
                            'cost', v_space.build_cost);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. city_sell_building_core — 'sold_building'
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

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'sold_building', p_seat, jsonb_build_object(
    'space', p_space_idx, 'buildings', v_asset.buildings - 1, 'returned', v_return
  ));

  return jsonb_build_object('space', p_space_idx, 'buildings', v_asset.buildings - 1,
                            'returned', v_return);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. city_mortgage_core — 'mortgaged'
-- ---------------------------------------------------------------------------
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

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'mortgaged', p_seat, jsonb_build_object('space', p_space_idx, 'raised', v_value));

  return jsonb_build_object('space', p_space_idx, 'raised', v_value);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 6. city_unmortgage — 'unmortgaged'
-- ---------------------------------------------------------------------------
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

  -- mortgage value plus 10% interest (CONTENT.md §4) -- divides as numeric
  -- now, so the 10% is computed on the true half-price, not an
  -- already-truncated integer.
  v_cost := ceil((v_space.price / 2.0) * 1.1)::integer;
  if v_me.cash < v_cost then
    raise exception 'CITY_INSUFFICIENT_FUNDS';
  end if;

  update public.city_assets set is_mortgaged = false where id = v_asset.id;
  update public.city_match_players set cash = cash - v_cost where id = v_me.id;

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'unmortgaged', v_me.seat, jsonb_build_object('space', p_space_idx, 'cost', v_cost));

  return jsonb_build_object('space', p_space_idx, 'cost', v_cost);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. city_buy_property — 'bought'
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

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'bought', v_me.seat, jsonb_build_object('space', v_me.position, 'price', v_space.price));

  return jsonb_build_object('bought', v_space.name, 'price', v_space.price);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. city_decline_purchase_core — 'auction_started' (the auction branch only;
--    the no-bidders branch just returns to optional_actions, nothing to log)
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

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'auction_started', p_seat, jsonb_build_object('space', v_me.position));

  return jsonb_build_object('auction', true, 'auction_id', v_auction_id, 'space', v_me.position);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 9. city_settle_auction (2-arg engine) — 'auction_won' / 'auction_unsold'
-- ---------------------------------------------------------------------------
create or replace function public.city_settle_auction(
  p_match_id uuid, p_force boolean
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

  update public.city_matches
     set phase = 'optional_actions',
         turn_started_at = case when turn_clock_paused_at is not null
           then turn_started_at + (now() - turn_clock_paused_at)
           else turn_started_at end,
         turn_clock_paused_at = null
   where id = p_match_id and phase = 'auction';

  perform public.city_run_autopilot_from_current(p_match_id);

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id,
    case when v_auction.high_seat is null then 'auction_unsold' else 'auction_won' end,
    v_auction.high_seat,
    jsonb_build_object('space', v_auction.space_idx,
      'price', case when v_auction.high_seat is null then 0 else v_auction.high_bid end));

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

-- ---------------------------------------------------------------------------
-- 10. city_accept_trade — 'trade_accepted'
-- ---------------------------------------------------------------------------
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

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (v_offer.match_id, 'trade_accepted', v_offer.to_seat, jsonb_build_object(
    'with_seat', v_offer.from_seat,
    'gave_spaces', v_offer.get_spaces, 'got_spaces', v_offer.give_spaces,
    'gave_cash', v_offer.get_cash, 'got_cash', v_offer.give_cash
  ));

  return jsonb_build_object(
    'accepted', true,
    'spaces_to_proposer', v_offer.get_spaces,
    'spaces_to_recipient', v_offer.give_spaces,
    'cash_to_recipient', v_offer.give_cash,
    'cash_to_proposer', v_offer.get_cash
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 11. city_bankrupt_seat — 'bankrupt'
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

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'bankrupt', p_seat, jsonb_build_object('to_seat', p_creditor_seat));

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
-- 12. city_retire_seat — 'retired'
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

revoke all on function public.city_retire_seat(uuid, integer) from public, anon, authenticated;
