-- Spintra City — code review of PR #43, resumed pass. Closes one confirmed
-- correctness finding:
--
--   Finished-match resurrection, instance 2: city_roll_dice_core's own
--   trailing UPDATE had no `status = 'active'` guard. 0092 already fixed
--   this exact bug class in city_advance_turn and
--   city_run_autopilot_from_current (see 0092's header), but
--   city_roll_dice_core carries the identical shape and was never brought
--   in line — 0093/0094 touched this function's event-insert ordering, not
--   its trailing state UPDATE.
--
--   Failure scenario: a roll lands on a property whose rent/tax the roller
--   can't cover even after city_max_liquidation. city_resolve_landing ->
--   city_charge -> city_bankrupt_seat runs; if the roller was the
--   second-to-last active player, city_bankrupt_seat calls
--   city_finish_match (status='finished', phase=null, current_seat=null)
--   inside the same call chain. Control returns to city_roll_dice_core,
--   which then unconditionally overwrites the just-finished row's phase,
--   turn clock, and rng_counter. A card that charges every other player
--   (collect_from_each, city_apply_card) can trigger the identical
--   resurrection mid-loop, independent of the roll path.
--
-- Fix: add the same `and status = 'active'` guard 0092 already uses on
-- city_advance_turn's trailing UPDATE. Everything else in this function is
-- byte-identical to 0094.

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

  -- Guarded: city_resolve_landing above may have cascaded into
  -- city_bankrupt_seat -> city_finish_match, which already set
  -- status='finished', phase=null, current_seat=null on this row. Without
  -- this guard the UPDATE below would unconditionally overwrite that
  -- finished state with a live-looking phase and turn clock.
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
   where id = p_match_id and status = 'active';

  return v_result;
end;
$fn$;
