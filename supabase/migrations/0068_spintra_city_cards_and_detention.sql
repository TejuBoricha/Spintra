-- Spintra City — Slice 6a: the two card decks and detention.
-- Requirements FR-15, FR-19 (docs/SPINTRA_CITY_SPEC.md §7).
-- Auctions (FR-17) are the other half of Slice 6 and land separately.
--
-- These two ship together because they are coupled: the Transit Visa is a card,
-- and it is the only way out of detention that costs nothing.

-- ---------------------------------------------------------------------------
-- 1. Card content
-- ---------------------------------------------------------------------------
-- Text and effect live in Postgres for the same reason prices do: a card that
-- pays 250 is money. `effect` is a small tagged union rather than a column per
-- parameter — most cards use one field and a wide table would be mostly nulls.
create table if not exists public.city_cards (
  id integer primary key,
  deck text not null check (deck in ('boarding_pass', 'city_fund')),
  text text not null,
  effect jsonb not null
);

comment on table public.city_cards is
  'Reference data: both card decks, seeded from docs/SPINTRA_CITY_CONTENT.md §6-7.';

insert into public.city_cards (id, deck, text, effect) values
  -- Boarding Pass (CONTENT.md §6)
  (1,  'boarding_pass', 'The gate opens early. Advance to Departure and collect 200 Spins.', '{"kind":"advance_to","idx":0}'),
  (2,  'boarding_pass', 'Every room in Dubai is booked but yours. Advance there — buy it if it''s unclaimed, or pay the owner double the usual rent.', '{"kind":"advance_to","idx":39,"rent_multiplier":2}'),
  (3,  'boarding_pass', 'Standby seat comes through. Advance to the nearest Airport and pay twice the standard fare; if nobody owns it, you may claim it.', '{"kind":"advance_nearest","of":"airport","rent_multiplier":2}'),
  (4,  'boarding_pass', 'The festival starts the day you land. Advance to Cape Town.', '{"kind":"advance_to","idx":16}'),
  (5,  'boarding_pass', 'Your passport is flagged at the desk. Go directly to Customs — no salary, no detour.', '{"kind":"go_to_customs"}'),
  (6,  'boarding_pass', 'You misread the platform number. Roll back three spaces.', '{"kind":"move_back","n":3}'),
  (7,  'boarding_pass', 'Peak season pricing works in your favour. Collect 150 Spins.', '{"kind":"collect","amount":150}'),
  (8,  'boarding_pass', 'Emergency baggage fees. Pay 75 Spins.', '{"kind":"pay","amount":75}'),
  (9,  'boarding_pass', 'Your grand reopening draws travellers from everywhere. Collect 100 Spins from every other player.', '{"kind":"collect_from_each","amount":100}'),
  (10, 'boarding_pass', 'A city-wide surge hits the grid. Advance to the Power Grid — claim it if unowned, otherwise pay the owner ten times your roll.', '{"kind":"advance_to","idx":12,"rent_multiplier":2}'),
  (11, 'boarding_pass', 'Every property you own is due a safety inspection.', '{"kind":"per_building","small":40,"large":150,"landmark":300}'),
  (12, 'boarding_pass', 'Transit Visa. Keep this card until you use it; it clears you through Customs once.', '{"kind":"transit_visa"}'),
  (13, 'boarding_pass', 'A gallery opening draws the whole city. Advance to Kraków.', '{"kind":"advance_to","idx":6}'),
  (14, 'boarding_pass', 'The exchange rate moves your way. Collect 60 Spins.', '{"kind":"collect","amount":60}'),
  (15, 'boarding_pass', 'A miscounted till goes against you. Pay 50 Spins.', '{"kind":"pay","amount":50}'),
  (16, 'boarding_pass', 'A free transfer is offered on the Gulf route. Advance to Dubai Intl.', '{"kind":"advance_to","idx":35}'),
  -- City Fund (CONTENT.md §7)
  (17, 'city_fund', 'Annual dividend from your travel fund. Collect 120 Spins.', '{"kind":"collect","amount":120}'),
  (18, 'city_fund', 'An overbooked flight is refunded. Collect 45 Spins.', '{"kind":"collect","amount":45}'),
  (19, 'city_fund', 'A minor mishap abroad lands you with medical bills. Pay 100 Spins.', '{"kind":"pay","amount":100}'),
  (20, 'city_fund', 'Second place in a street photography contest. Collect 40 Spins.', '{"kind":"collect","amount":40}'),
  (21, 'city_fund', 'The tourist levy comes due. Pay 60 Spins.', '{"kind":"pay","amount":60}'),
  (22, 'city_fund', 'A guesthouse you once stayed in is left to you. Collect 250 Spins.', '{"kind":"collect","amount":250}'),
  (23, 'city_fund', 'Transit Visa. Keep this card until you use it; it clears you through Customs once.', '{"kind":"transit_visa"}'),
  (24, 'city_fund', 'Caught letting rooms without a licence. Go directly to Customs — no salary, no detour.', '{"kind":"go_to_customs"}'),
  (25, 'city_fund', 'Everyone chips in for the group photo. Take 25 Spins from each of the other players.', '{"kind":"collect_from_each","amount":25}'),
  (26, 'city_fund', 'You sell a year of accumulated air miles. Collect 70 Spins.', '{"kind":"collect","amount":70}'),
  (27, 'city_fund', 'Staff training and language courses. Pay 80 Spins.', '{"kind":"pay","amount":80}'),
  (28, 'city_fund', 'City maintenance assessment.', '{"kind":"per_building","small":45,"large":130,"landmark":275}'),
  (29, 'city_fund', 'You are invited to a ribbon-cutting back home. Advance to Departure and collect 200 Spins.', '{"kind":"advance_to","idx":0}'),
  (30, 'city_fund', 'An old travel insurance claim finally settles. Collect 90 Spins.', '{"kind":"collect","amount":90}'),
  (31, 'city_fund', 'Contribute to a heritage restoration fund. Pay 55 Spins.', '{"kind":"pay","amount":55}'),
  (32, 'city_fund', 'A guest tips you generously on the way out. Collect 35 Spins.', '{"kind":"collect","amount":35}')
on conflict (id) do nothing;

alter table public.city_cards enable row level security;
drop policy if exists "Cards are public reference data" on public.city_cards;
create policy "Cards are public reference data" on public.city_cards for select using (true);
revoke insert, update, delete on public.city_cards from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Detention and deck state
-- ---------------------------------------------------------------------------
alter table public.city_match_players
  add column if not exists in_detention boolean not null default false,
  -- how many turns already spent trying to leave; the third failure must pay
  add column if not exists detention_turns integer not null default 0
    check (detention_turns between 0 and 3),
  add column if not exists transit_visas integer not null default 0
    check (transit_visas between 0 and 2);

grant select (in_detention, detention_turns, transit_visas)
  on table public.city_match_players to anon, authenticated;

-- Draw counters. A deck is a permutation, not a bag: `draw` walks the shuffled
-- order and `round` reshuffles when it wraps, which is FR-19's reshuffle.
alter table public.city_matches
  add column if not exists bp_draw integer not null default 0 check (bp_draw >= 0),
  add column if not exists cf_draw integer not null default 0 check (cf_draw >= 0);

grant select (bp_draw, cf_draw) on table public.city_matches to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Drawing
-- ---------------------------------------------------------------------------
-- The shuffle is derived from the match seed rather than stored, exactly like
-- the dice: one seed reproduces an entire match. Ordering by a hash of
-- (seed, deck, round, card) is a permutation that changes each round.
create or replace function public.city_draw_card(p_match_id uuid, p_deck text)
returns public.city_cards
security definer
set search_path = public
language plpgsql as $$
declare
  v_match public.city_matches;
  v_draw integer;
  v_round integer;
  v_size integer;
  v_card public.city_cards;
  v_visa_held boolean;
begin
  select * into v_match from public.city_matches where id = p_match_id;

  -- A Transit Visa sits out of the deck while somebody holds it (FR-19).
  -- Simplification, stated plainly: the two decks share one "is a visa held"
  -- flag rather than tracking which deck each held visa came from.
  select exists (select 1 from public.city_match_players
                  where match_id = p_match_id and transit_visas > 0)
    into v_visa_held;

  select count(*) into v_size from public.city_cards
   where deck = p_deck and (not v_visa_held or effect->>'kind' <> 'transit_visa');

  v_draw := case when p_deck = 'boarding_pass' then v_match.bp_draw else v_match.cf_draw end;
  v_round := v_draw / v_size;

  select * into v_card from public.city_cards
   where deck = p_deck and (not v_visa_held or effect->>'kind' <> 'transit_visa')
   order by md5(v_match.rng_seed::text || p_deck || v_round::text || id::text)
   offset (v_draw % v_size) limit 1;

  if p_deck = 'boarding_pass' then
    update public.city_matches set bp_draw = bp_draw + 1 where id = p_match_id;
  else
    update public.city_matches set cf_draw = cf_draw + 1 where id = p_match_id;
  end if;

  return v_card;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Applying a card
-- ---------------------------------------------------------------------------
-- Movement effects deliberately fall through to city_resolve_landing rather
-- than reimplementing rent and purchase: a card that sends you to Dubai should
-- behave exactly as if the dice had.
create or replace function public.city_apply_card(
  p_match_id uuid, p_seat integer, p_card public.city_cards, p_dice_total integer
)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_e jsonb := p_card.effect;
  v_kind text := v_e->>'kind';
  v_me public.city_match_players;
  v_to integer;
  v_amount integer;
  v_total integer := 0;
  v_landing jsonb;
  v_passed boolean := false;
begin
  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  if v_kind = 'collect' then
    update public.city_match_players set cash = cash + (v_e->>'amount')::integer
     where id = v_me.id;
    return jsonb_build_object('kind', v_kind, 'amount', (v_e->>'amount')::integer);

  elsif v_kind = 'pay' then
    v_amount := (v_e->>'amount')::integer;
    -- the kind is merged in so the payload is self-describing: the UI needs to
    -- know a charge came from a card that already states the amount
    return public.city_charge(p_match_id, p_seat, v_amount, null)
           || jsonb_build_object('kind', v_kind);

  elsif v_kind = 'collect_from_each' then
    v_amount := (v_e->>'amount')::integer;
    -- Each payer is charged through the same path as rent, so a player who
    -- cannot afford it enters raise-funds rather than going quietly negative.
    for v_to in
      select seat from public.city_match_players
       where match_id = p_match_id and seat <> p_seat and status = 'active'
    loop
      perform public.city_charge(p_match_id, v_to, v_amount, p_seat);
      v_total := v_total + v_amount;
    end loop;
    return jsonb_build_object('kind', v_kind, 'amount', v_amount, 'total', v_total);

  elsif v_kind = 'per_building' then
    select coalesce(sum(case
             when a.buildings = 5 then (v_e->>'landmark')::integer
             when a.buildings >= 3 then (v_e->>'large')::integer
             when a.buildings > 0 then (v_e->>'small')::integer
             else 0 end), 0)
      into v_total
      from public.city_assets a
     where a.match_id = p_match_id and a.owner_seat = p_seat;
    if v_total = 0 then
      return jsonb_build_object('kind', v_kind, 'amount', 0);
    end if;
    return public.city_charge(p_match_id, p_seat, v_total, null)
           || jsonb_build_object('kind', v_kind);

  elsif v_kind = 'transit_visa' then
    update public.city_match_players set transit_visas = least(transit_visas + 1, 2)
     where id = v_me.id;
    return jsonb_build_object('kind', v_kind);

  elsif v_kind = 'go_to_customs' then
    update public.city_match_players
       set position = 10, in_detention = true, detention_turns = 0
     where id = v_me.id;
    return jsonb_build_object('kind', v_kind, 'to', 10);

  elsif v_kind in ('advance_to', 'advance_nearest', 'move_back') then
    if v_kind = 'advance_to' then
      v_to := (v_e->>'idx')::integer;
      v_passed := v_to <= v_me.position;
    elsif v_kind = 'advance_nearest' then
      select idx into v_to from public.city_board_spaces
       where kind = v_e->>'of'
       order by case when idx > v_me.position then idx - v_me.position
                     else idx + 40 - v_me.position end
       limit 1;
      v_passed := v_to <= v_me.position;
    else
      v_to := (v_me.position - (v_e->>'n')::integer + 40) % 40;
      -- moving backwards never pays a salary, even across Departure
      v_passed := false;
    end if;

    update public.city_match_players
       set position = v_to, cash = cash + case when v_passed then 200 else 0 end
     where id = v_me.id;

    v_landing := public.city_resolve_landing(
      p_match_id, p_seat, v_to,
      p_dice_total * coalesce((v_e->>'rent_multiplier')::integer, 1));

    return jsonb_build_object('kind', v_kind, 'to', v_to,
      'salary', case when v_passed then 200 else 0 end, 'landing', v_landing);
  end if;

  return jsonb_build_object('kind', coalesce(v_kind, 'unknown'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. One charging path
-- ---------------------------------------------------------------------------
-- Rent, tax and card penalties all take money from a player who may not have
-- it, and all three must offer the raise-funds window rather than silently
-- overdrawing. Extracted here so there is one implementation of that rule.
create or replace function public.city_charge(
  p_match_id uuid, p_seat integer, p_amount integer, p_creditor_seat integer
)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
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
    return jsonb_build_object('action',
      case when p_creditor_seat is null then 'paid_tax' else 'paid_rent' end,
      'amount', p_amount, 'to_seat', p_creditor_seat);
  end if;

  if v_me.cash + public.city_max_liquidation(p_match_id, p_seat) >= p_amount then
    update public.city_match_players
       set pending_debt = p_amount, pending_creditor_seat = p_creditor_seat
     where id = v_me.id;
    update public.city_matches set phase = 'required_decision'
     where id = p_match_id and current_seat = p_seat;
    return jsonb_build_object('action', 'must_raise_funds', 'owed', p_amount,
      'to_seat', p_creditor_seat, 'short_by', p_amount - v_me.cash);
  end if;

  perform public.city_bankrupt_seat(p_match_id, p_seat, p_creditor_seat);
  return jsonb_build_object('action', 'bankrupt', 'owed', p_amount, 'to_seat', p_creditor_seat);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Landing on a card space now draws one
-- ---------------------------------------------------------------------------
create or replace function public.city_resolve_landing(
  p_match_id uuid, p_seat integer, p_space_idx integer, p_dice_total integer
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
  v_card public.city_cards;
begin
  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;
  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;

  if v_space.kind = 'corner' then
    if v_space.name = 'Detained' then
      update public.city_match_players
         set position = 10, in_detention = true, detention_turns = 0
       where match_id = p_match_id and seat = p_seat;
      return jsonb_build_object('action', 'detained', 'to', 10);
    end if;
    return jsonb_build_object('action', 'none');
  end if;

  if v_space.kind = 'card' then
    v_card := public.city_draw_card(p_match_id, v_space.deck);
    return jsonb_build_object('action', 'card', 'deck', v_space.deck,
      'text', v_card.text,
      'result', public.city_apply_card(p_match_id, p_seat, v_card, p_dice_total));
  end if;

  if v_space.kind = 'tax' then
    return public.city_charge(p_match_id, p_seat, v_space.tax_amount, null);
  end if;

  if v_asset.id is null then
    return jsonb_build_object('action', 'may_buy', 'price', v_space.price, 'space', p_space_idx);
  end if;
  if v_asset.owner_seat = p_seat then
    return jsonb_build_object('action', 'own_space');
  end if;

  v_rent := public.city_rent_for(p_match_id, p_space_idx, p_dice_total);
  if v_rent = 0 then
    return jsonb_build_object('action',
      case when v_asset.is_mortgaged then 'mortgaged_no_rent' else 'no_rent' end);
  end if;

  return public.city_charge(p_match_id, p_seat, v_rent, v_asset.owner_seat);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Detention (FR-15)
-- ---------------------------------------------------------------------------
-- Three ways out, per CONTENT.md §5: pay the 90 fee, spend a Transit Visa, or
-- roll doubles. The third failed attempt must pay, which is the deliberate
-- exception to "a timeout never auto-spends" recorded in DESIGN.md §3.1A —
-- by then no free option remains.
create or replace function public.city_leave_detention(p_match_id uuid, p_method text)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_dice integer[];
  v_fee constant integer := 90;
  v_charge jsonb;
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
$$;

-- A detained player cannot simply roll and move.
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
-- 8. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.city_draw_card(uuid, text) from public, anon, authenticated;
revoke all on function public.city_apply_card(uuid, integer, public.city_cards, integer) from public, anon, authenticated;
revoke all on function public.city_charge(uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.city_leave_detention(uuid, text) from public;
grant execute on function public.city_leave_detention(uuid, text) to anon, authenticated;
