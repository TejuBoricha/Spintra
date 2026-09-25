-- Spintra City — Round 5 of the QA audit's fix phase: closes BUG-035.
-- Migrations are append-only.
--
-- The active player's roll narration ("Rolled 6 and 1, moved to City Fund…
-- Collect 250 Spins.") lived entirely in client-only React state
-- (`lastRoll`, set directly from `city_roll_dice`'s own RPC return value).
-- It was never persisted, never broadcast, and never read from
-- `city_matches.last_roll` (which only ever stored the bare two-die array,
-- not the landing outcome) -- so nobody except the roller's own original
-- browser tab, in the same session, before their next refresh, ever saw it.
-- Every other player's screen said only "Waiting for X"; cash badges changed
-- with no explanation of why, in a game whose whole tension is money moving
-- between players.
--
-- Fixed by persisting the exact same jsonb object city_roll_dice already
-- builds for its RPC return, plus the turn_number it happened on. Every
-- client's normal refetch (already triggered for everyone by the existing
-- city_matches realtime subscription -- no new channel or broadcast needed)
-- now carries it, and the client derives "is this roll still current" by
-- comparing `last_roll_turn` to the match's own `turn_number` -- the same
-- staleness pattern city_trade_offers' `created_turn` already uses. No
-- explicit clearing needed: turn_number increments on every turn-advancing
-- path (city_end_turn, city_retire_seat, city_claim_timeout), which makes a
-- previous turn's roll naturally stale without a second write.
--
-- city_matches has been column-grant-restricted since migration 0063 (an
-- allowlist, not a blanket table grant, so rng_seed/rng_counter stay
-- unreachable via PostgREST) -- a new column added here is invisible to
-- anon/authenticated until it's explicitly added to that allowlist too.
-- Caught live: a fresh browser run against this exact migration returned
-- 42501 "permission denied for table city_matches" the moment the client's
-- select list included last_roll_result, since PostgREST denies the whole
-- query if even one requested column lacks a grant.

alter table public.city_matches
  add column if not exists last_roll_result jsonb,
  add column if not exists last_roll_turn integer;

grant select (last_roll_result, last_roll_turn) on public.city_matches to anon, authenticated;

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
  v_result jsonb;
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
$$;
