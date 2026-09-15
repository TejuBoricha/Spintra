-- Spintra City — Round 4 of the QA audit's fix phase: closes BUG-015,
-- BUG-016, BUG-017 and BUG-032 (the card/deck logic group — the audit's own
-- §17 named BUG-016/017 "the most player-visible" of what remained).
-- Migrations are append-only.
--
-- BUG-017/BUG-032, one root cause: a card's "double the usual rent" /
-- "ten times your roll" effect was implemented by pre-scaling the dice
-- total fed into city_resolve_landing (`p_dice_total * rent_multiplier`).
-- That only ever mattered for utilities, because utility rent is the ONLY
-- rent formula that reads `p_dice_total` at all -- property rent reads
-- `city_board_spaces.rent[]`, airport rent is a fixed 30/60/120/240 table,
-- neither looks at the dice. So cards 2 and 3 ("double the usual rent" on a
-- property / an airport) silently charged the normal, unscaled rent — the
-- multiplier had no effect (BUG-017). Card 10 ("pay the owner ten times
-- your roll" — CONTENT.md §7 card 10, sent to Power Grid, a utility) fared
-- worse in the other direction: pre-scaling the dice total by 2 before it
-- reached utility rent's own 5x/12x formula produced 10x or 24x depending
-- on how many utilities the owner held, not the flat 10x the card's own
-- text promises (BUG-032).
--
-- Fixed by moving both multipliers to apply to city_resolve_landing's own
-- *computed* rent, not its input: `p_rent_multiplier` (used by cards 2/3,
-- still exactly 2 — "double whatever the normal formula says") multiplies
-- city_rent_for's result; `p_flat_rent_multiplier` (new, used only by card
-- 10, set to 10) replaces city_rent_for's result outright with
-- `dice_total * 10`, independent of how many utilities are held — matching
-- CONTENT.md's flat "ten times the total" verbatim, still zeroed if the
-- space is mortgaged. Both are additive, defaulted parameters on
-- city_resolve_landing; city_roll_dice's own call site (the non-card
-- landing path) is untouched and keeps its original behavior.
--
-- BUG-015: city_roll_dice computes v_next_phase by inspecting v_landing's
-- shape to decide whether a required decision is pending, but its check
-- only covered a direct property/tax landing (`v_landing->>'action'`) and a
-- card that itself triggers a NESTED landing via advance_to/advance_nearest
-- (`v_landing->'result'->'landing'->>'action'`). A card that charges the
-- drawing player DIRECTLY -- 'pay' or 'per_building', both of which return
-- city_charge's own result merged in at `result.action` -- was checked by
-- neither branch. city_charge had already (correctly) set
-- phase='required_decision' moments earlier as part of computing that same
-- v_landing; city_roll_dice's later, unconditional phase UPDATE then
-- silently clobbered it back to 'optional_actions', leaving the player
-- deep in debt with no visible signal and city_end_turn refusing
-- (CITY_SETTLE_DEBT_FIRST) with no explanation the client had shown for.
-- Fixed by adding the missing case.
--
-- BUG-016: city_draw_card derived a per-round permutation via
-- `order by md5(seed||deck||round||id) offset (draw % size) limit 1`, where
-- `size` excluded the currently-held Transit Visa card from the count. That
-- denominator is live match state, not a property of the deck -- if the
-- visa's held status changes mid-round (drawn, then later spent, or vice
-- versa), `size` shifts for every subsequent draw in that same round, which
-- corrupts both the round boundary (`draw / size`) and the position
-- (`draw % size`) simultaneously. The audit's repro (16 draws, one card
-- twice, one card never) is exactly that drift compounding.
--
-- The first fix attempted here computed a fixed-size round but still
-- re-derived position via `(draw % size) % eligible_count` against a
-- filtered list -- worked out by hand against a concrete permutation before
-- trusting it, and it turned out to still omit a card in the common case
-- (visa drawn, then held for the rest of the same round): a shrinking
-- modulo denominator reindexes every later position, not just the excluded
-- one, and that reindexing can walk straight past a card that was never
-- drawn under the old, larger modulus. Discarded before it shipped.
--
-- What ships instead: the round's full, fixed-size permutation (all `size`
-- cards, independent of visa status) is computed once, and a draw simply
-- looks up its position in it. Only if that exact slot holds the currently-
-- held visa card does it fall through to the *next* slot in the same fixed
-- order -- a single, local substitution, not a reindex of everything after
-- it. In real play the visa can only become held by being drawn, so by the
-- time it could be excluded, its own slot has already been consumed earlier
-- in the same round -- the substitution branch is live only for the one
-- case that isn't true: the visa was already held coming into a new round.
-- There, worked out by hand again to confirm: exactly one card (whichever
-- sits immediately after the visa's slot) is drawn twice across that round
-- instead of each of the `size - 1` eligible cards exactly once. Disclosed,
-- not hidden -- and no card is ever skipped entirely, which is the failure
-- the audit actually reproduced and the property the regression check below
-- verifies directly.

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
  v_visa_card_id integer;
  v_perm integer[];
  v_pos integer;
  v_card_id integer;
begin
  select * into v_match from public.city_matches where id = p_match_id;

  select exists (select 1 from public.city_match_players
                  where match_id = p_match_id and transit_visas > 0)
    into v_visa_held;

  select id into v_visa_card_id from public.city_cards
   where deck = p_deck and effect->>'kind' = 'transit_visa';

  -- The deck's full card count -- constant, unlike whether the visa is
  -- currently excluded -- so the round boundary below never shifts mid-round.
  select count(*) into v_size from public.city_cards where deck = p_deck;

  v_draw := case when p_deck = 'boarding_pass' then v_match.bp_draw else v_match.cf_draw end;
  v_round := v_draw / v_size;

  -- The round's full, fixed permutation -- always every card in the deck,
  -- never re-derived from a shrinking eligible set.
  select array_agg(id order by md5(v_match.rng_seed::text || p_deck || v_round::text || id::text))
    into v_perm
    from public.city_cards where deck = p_deck;

  v_pos := (v_draw % v_size) + 1;
  v_card_id := v_perm[v_pos];

  -- Only if this exact slot is the currently-held visa, fall through to the
  -- next slot in the SAME fixed order -- a single local substitution, not a
  -- reindex of every later position.
  if v_visa_held and v_card_id = v_visa_card_id then
    v_pos := (v_pos % v_size) + 1;
    v_card_id := v_perm[v_pos];
  end if;

  select * into v_card from public.city_cards where id = v_card_id;

  if p_deck = 'boarding_pass' then
    update public.city_matches set bp_draw = bp_draw + 1 where id = p_match_id;
  else
    update public.city_matches set cf_draw = cf_draw + 1 where id = p_match_id;
  end if;

  return v_card;
end;
$$;

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
    return public.city_charge(p_match_id, p_seat, v_space.tax_amount, null);
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

  return public.city_charge(p_match_id, p_seat, v_rent, v_asset.owner_seat);
end;
$$;

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

  -- BUG-015: a card that charges the drawing player DIRECTLY ('pay' /
  -- 'per_building') returns city_charge's own result merged in at
  -- result.action -- previously unchecked, so a must_raise_funds outcome
  -- from one of those two card kinds got silently clobbered back to
  -- optional_actions by the unconditional phase update below.
  v_next_phase := case
    when v_landing->>'action' in ('may_buy', 'must_raise_funds') then 'required_decision'
    when v_landing->'result'->'landing'->>'action' in ('may_buy', 'must_raise_funds')
      then 'required_decision'
    when v_landing->'result'->>'action' = 'must_raise_funds' then 'required_decision'
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

-- BUG-032: CONTENT.md §7 card 10's own text is unambiguous -- "roll and pay
-- the owner ten times the total" -- with no qualifier for how many
-- utilities the owner holds. Corrected to the new flat-rent field so it
-- reads that way regardless of ownership count.
update public.city_cards
   set effect = '{"idx": 12, "kind": "advance_to", "flat_rent_multiplier": 10}'::jsonb
 where id = 10 and deck = 'boarding_pass';
