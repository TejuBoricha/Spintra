-- Spintra City — code review of migration 0093 (the activity feed), 10
-- parallel finder agents against the two commits that added it. Closes the
-- confirmed correctness findings from that review; the client-side race
-- (fetchNewEvents duplicating/dropping rows) and the two board contrast
-- regressions were fixed separately, in use-city-match.ts and
-- city-board.tsx, not here.
--
--   1. Event-ordering inversion: city_roll_dice_core and city_settle_auction
--      each called another already-instrumented function mid-body (landing
--      resolution / the autopilot cascade) BEFORE inserting their own event,
--      so a cascaded effect could get a lower id than the event that caused
--      it — e.g. a bot's autopiloted roll showing up in the feed before the
--      auction win that triggered it. city_bankrupt_seat (0093) already got
--      this right, inserting before its own cascading calls — proof this
--      was an inconsistency, not a deliberate choice, in the other two.
--   2. Mislabeling: a card that charges every other player (collect_from_each)
--      routed through city_charge exactly like real property rent, and
--      city_charge had no way to tell the two apart — every card-driven mass
--      charge was logged and rendered as "X paid rent to Y", which never
--      happened. city_charge gains a required p_kind parameter so its caller
--      states the true kind explicitly; city_resolve_landing's real rent/tax
--      calls pass 'rent_paid'/'tax_paid' unchanged, city_apply_card's and
--      city_leave_detention_core's calls now say what they actually are.
--   3. Completeness: city_apply_card's collect/transit_visa/go_to_customs
--      branches mutate real state (cash, a visa, a forced move) and logged
--      nothing at all, despite this feature's whole premise being "who has
--      done what."
--
-- p_kind is a required (not defaulted) new parameter, not a defaulted one —
-- 0080's own lesson (`CREATE OR REPLACE` with a different parameter list
-- creates a new overload rather than replacing the old one) means a
-- defaulted trailing parameter here would leave the 4-arg city_charge(...)
-- exactly as ambiguity-prone as the city_settle_auction bug 0091 fixed. A
-- required 5th parameter with every call site updated avoids that shape of
-- bug entirely; the now-dead 4-arg overload is dropped outright rather than
-- left behind, matching 0080's own cleanup.

-- ---------------------------------------------------------------------------
-- 1. city_roll_dice_core — insert its own 'rolled' event before resolving
--    the landing, not after. Everything else byte-identical to 0093.
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

  -- Logged here — before city_resolve_landing runs below — so a rent/tax/
  -- bankruptcy/card chain that landing triggers (each logging its own event)
  -- always gets a higher id than the roll that caused it, not a lower one.
  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (p_match_id, 'rolled', v_me.seat, jsonb_build_object(
    'dice', v_dice, 'to', v_to, 'passed_departure', v_passed,
    'doubles', v_is_doubles, 'detained', v_detained
  ));

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

-- ---------------------------------------------------------------------------
-- 2. city_charge — gains a required p_kind, used for the persisted event's
--    kind. The RETURNED 'action' field (paid_tax/paid_rent) is untouched —
--    that's consumed by the client's own roll-narration text, a separate,
--    already-correct mechanism this migration isn't changing.
-- ---------------------------------------------------------------------------
drop function if exists public.city_charge(uuid, integer, integer, integer);

create or replace function public.city_charge(
  p_match_id uuid, p_seat integer, p_amount integer, p_creditor_seat integer, p_kind text
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
    values (p_match_id, p_kind,
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

revoke all on function public.city_charge(uuid, integer, integer, integer, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. city_resolve_landing — its two city_charge calls now pass the real
--    kind explicitly. No other change; still byte-identical otherwise.
-- ---------------------------------------------------------------------------
create or replace function public.city_resolve_landing(
  p_match_id uuid, p_seat integer, p_space_idx integer, p_dice_total integer,
  p_rent_multiplier integer default 1,
  p_flat_rent_multiplier integer default null
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
    return public.city_charge(p_match_id, p_seat, v_space.tax_amount, null, 'tax_paid');
  end if;

  if v_asset.id is null then
    return jsonb_build_object('action', 'may_buy', 'price', v_space.price, 'space', p_space_idx);
  end if;
  if v_asset.owner_seat = p_seat then
    return jsonb_build_object('action', 'own_space');
  end if;

  if p_flat_rent_multiplier is not null then
    -- A flat/surge rent still charges nothing against a mortgaged space --
    -- the same guard city_rent_for applies internally, re-checked here
    -- since a flat rent bypasses that function entirely.
    v_rent := case when v_asset.is_mortgaged then 0 else p_dice_total * p_flat_rent_multiplier end;
  else
    v_rent := public.city_rent_for(p_match_id, p_space_idx, p_dice_total) * p_rent_multiplier;
  end if;

  if v_rent = 0 then
    return jsonb_build_object('action',
      case when v_asset.is_mortgaged then 'mortgaged_no_rent' else 'no_rent' end);
  end if;

  return public.city_charge(p_match_id, p_seat, v_rent, v_asset.owner_seat, 'rent_paid');
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. city_apply_card — collect/transit_visa/go_to_customs now log their own
--    event (previously silent); pay/per_building pass 'tax_paid' explicitly
--    (unchanged label, now required by city_charge's new signature);
--    collect_from_each passes 'card_charged' instead of falling through to
--    city_charge's old auto-derived 'rent_paid' — this is the actual
--    mislabeling fix, since a mass card charge is not property rent.
-- ---------------------------------------------------------------------------
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
    insert into public.city_match_events (match_id, kind, actor_seat, payload)
    values (p_match_id, 'card_collected', p_seat,
      jsonb_build_object('amount', (v_e->>'amount')::integer));
    return jsonb_build_object('kind', v_kind, 'amount', (v_e->>'amount')::integer);

  elsif v_kind = 'pay' then
    v_amount := (v_e->>'amount')::integer;
    -- the kind is merged in so the payload is self-describing: the UI needs to
    -- know a charge came from a card that already states the amount
    return public.city_charge(p_match_id, p_seat, v_amount, null, 'tax_paid')
           || jsonb_build_object('kind', v_kind);

  elsif v_kind = 'collect_from_each' then
    v_amount := (v_e->>'amount')::integer;
    -- Each payer is charged through the same path as rent, so a player who
    -- cannot afford it enters raise-funds rather than going quietly negative.
    -- 'card_charged', not 'rent_paid' -- this is a card effect between two
    -- players, not property rent, and city_charge can't tell the difference
    -- on its own.
    for v_to in
      select seat from public.city_match_players
       where match_id = p_match_id and seat <> p_seat and status = 'active'
    loop
      perform public.city_charge(p_match_id, v_to, v_amount, p_seat, 'card_charged');
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
    return public.city_charge(p_match_id, p_seat, v_total, null, 'tax_paid')
           || jsonb_build_object('kind', v_kind);

  elsif v_kind = 'transit_visa' then
    update public.city_match_players set transit_visas = least(transit_visas + 1, 2)
     where id = v_me.id;
    insert into public.city_match_events (match_id, kind, actor_seat, payload)
    values (p_match_id, 'card_visa_gained', p_seat, '{}'::jsonb);
    return jsonb_build_object('kind', v_kind);

  elsif v_kind = 'go_to_customs' then
    update public.city_match_players
       set position = 10, in_detention = true, detention_turns = 0
     where id = v_me.id;
    insert into public.city_match_events (match_id, kind, actor_seat, payload)
    values (p_match_id, 'card_sent_to_customs', p_seat, '{}'::jsonb);
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

    -- BUG-017/032: both multipliers now apply to city_resolve_landing's own
    -- computed rent (via its new p_rent_multiplier / p_flat_rent_multiplier
    -- params), not to the dice total fed into it -- pre-scaling the dice
    -- total only ever affected utilities, since that's the only rent
    -- formula that reads it at all.
    v_landing := public.city_resolve_landing(
      p_match_id, p_seat, v_to, p_dice_total,
      p_rent_multiplier => coalesce((v_e->>'rent_multiplier')::integer, 1),
      p_flat_rent_multiplier => nullif(v_e->>'flat_rent_multiplier', '')::integer);

    return jsonb_build_object('kind', v_kind, 'to', v_to,
      'salary', case when v_passed then 200 else 0 end, 'landing', v_landing);
  end if;

  return jsonb_build_object('kind', coalesce(v_kind, 'unknown'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. city_leave_detention_core — its two city_charge calls (the 90-Spins
--    Customs fee) pass 'tax_paid' explicitly. Unchanged label/behavior,
--    required only because city_charge's signature grew a parameter.
-- ---------------------------------------------------------------------------
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
    v_charge := public.city_charge(p_match_id, v_me.seat, v_fee, null, 'tax_paid');
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
    v_charge := public.city_charge(p_match_id, v_me.seat, v_fee, null, 'tax_paid');
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

-- ---------------------------------------------------------------------------
-- 6. city_settle_auction — insert its own event before running the
--    autopilot cascade, not after. Everything else byte-identical to 0093.
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

  -- Logged here — before the autopilot cascade below, which can itself
  -- insert events (an away seat's autopiloted roll/decline/retire) — so
  -- this auction's own outcome always gets a lower id than anything it
  -- causes, not a higher one.
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
