-- Two Spintra City roll bugs from the product audit, both in city_roll_dice_core
-- (last defined in 0096). Redefined here whole, with only these changes.
--
-- C-1: a roll of doubles that ended in Customs still counted as doubles, so ending
--      the turn granted a re-roll from inside detention (extra escape attempts).
--      The doubles count now resets whenever the move ends in Customs, whatever
--      sent the player there.
-- C-2: a player who went bankrupt on their own roll (with other players still in
--      the match) had the turn handed on by city_bankrupt_seat, and then the roll's
--      own final UPDATE wrote its "optional_actions" phase over the next player's
--      "awaiting_roll", so the next player never got to roll. The phase, doubles
--      and clock writes now apply only while the turn is still the roller's.

CREATE OR REPLACE FUNCTION public.city_roll_dice_core(p_match_id uuid, p_seat integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_now_detained boolean := false;
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

  -- The landing may have sent the roller to Customs (the Detained corner, or a card).
  -- A roll that ends there ends the doubles streak too, so End turn cannot grant a
  -- re-roll from inside detention (audit C-1).
  select in_detention into v_now_detained from public.city_match_players where id = v_me.id;

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

  -- Guarded twice. Status: city_resolve_landing above may have cascaded into
  -- city_bankrupt_seat -> city_finish_match, which already set status='finished',
  -- phase=null, current_seat=null on this row; without the status guard the UPDATE
  -- would overwrite that finished state with a live-looking phase and turn clock.
  -- Seat: when the roller went bankrupt and other players remain, city_bankrupt_seat
  -- has already handed the turn to the next seat (phase awaiting_roll, fresh clock).
  -- The phase, doubles and clock writes must leave that alone, or the next player's
  -- roll is skipped (audit C-2). The dice bookkeeping always applies, so the same
  -- roll can never be derived twice.
  update public.city_matches
     set rng_counter = rng_counter + 1,
         last_roll = v_dice,
         last_roll_result = v_result,
         last_roll_turn = turn_number,
         doubles_count = case
           when current_seat is distinct from v_me.seat then doubles_count
           when v_detained or v_now_detained then 0
           when v_is_doubles then doubles_count + 1
           else 0 end,
         phase = case when current_seat is distinct from v_me.seat then phase else v_next_phase end,
         turn_started_at = case when current_seat is distinct from v_me.seat then turn_started_at else now() end,
         turn_clock_elapsed_ms = case when current_seat is distinct from v_me.seat then turn_clock_elapsed_ms else 0 end,
         turn_clock_paused_at = case when current_seat is distinct from v_me.seat then turn_clock_paused_at else null end
   where id = p_match_id and status = 'active';

  return v_result;
end;
$function$;
