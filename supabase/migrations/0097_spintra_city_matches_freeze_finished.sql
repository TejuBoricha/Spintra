-- Spintra City — closes the finished-match-resurrection bug class
-- structurally, instead of one more hand-copied `and status = 'active'`
-- guard on whichever function a review pass happened to find next.
--
-- 0092 added the guard to city_advance_turn / city_run_autopilot_from_current.
-- 0096 (this same PR's resumed review) added it to city_roll_dice_core, and
-- its own header claimed a second, independent trigger path through
-- city_apply_card's collect_from_each was "confirmed" — it was not: 0096
-- never touched city_charge, and scripts/city-regression.sql's new assertion
-- only ever exercises the single-seat rent path, never collect_from_each's
-- multi-seat loop. A follow-up review pass on 0096 itself found the real gap
-- that overclaim was masking: two more live, unguarded instances of the exact
-- same bug, found by tracing every function that writes public.city_matches
-- downstream of a call chain that can reach city_bankrupt_seat /
-- city_finish_match:
--
--   1. city_grant_reroll (0090) has no guard at all. Reachable from
--      city_resolve_autopilot_turn's loop: an away seat's doubles roll grants
--      a reroll (doubles_count 0->1, match still active); if that reroll
--      lands on a collect_from_each card that bankrupts the last other
--      active player, city_finish_match runs, but city_finish_match never
--      resets doubles_count -- it's frozen at 1 on the now-finished row. The
--      autopilot loop's own liveness check only inspects the SEAT's status,
--      never the MATCH's, so its next iteration re-reads a finished match
--      with doubles_count still between 1 and 2 and calls city_grant_reroll,
--      which unconditionally sets phase back to 'awaiting_roll' and bumps
--      turn_number/turn_started_at on the finished row.
--
--   2. city_charge's `debt_started_at = now()` update (0094, the fresh-debt
--      branch of the must_raise_funds path) has no guard -- not even the
--      incidental current_seat check its own very next statement uses. This
--      IS 0096's claimed "second, independent trigger path": collect_from_each
--      charges several seats in one transaction: seat B partially covers via
--      liquidation, seat C can't cover at all and bankrupts (finishing the
--      match if C was second-to-last), seat D -- charged next, in the SAME
--      loop -- hits must_raise_funds and this unconditional UPDATE stamps a
--      fresh debt_started_at onto the already-finished match.
--
-- Every "guard" found on the other city_matches-writing functions surveyed
-- (city_charge's own phase update: `current_seat = p_seat`; city_try_settle_debt:
-- the same; city_settle_auction: `phase = 'auction'`) turned out to be
-- incidental, not deliberate -- each happens to also be false on a finished
-- row today only because city_finish_match nulls current_seat/phase, not
-- because anyone wrote "is this match still active?" A future change to
-- city_finish_match (e.g. keeping current_seat populated for a post-game
-- recap) would silently reactivate all of them at once.
--
-- Fix: a BEFORE UPDATE trigger that freezes a city_matches row entirely --
-- every column, not a maintained list of "the gameplay ones" -- the instant
-- OLD.status = 'finished'. No SQL search across the codebase confirmed
-- anything ever legitimately updates a finished match's row (a cleanup job,
-- an archival flag -- none exists), so the freeze has no legitimate case to
-- special-case. This closes every instance surveyed above, plus every future
-- one, at the schema layer -- not by raising (a raise inside a SECURITY
-- DEFINER call chain that other statements in the same transaction already
-- committed real, correct effects into -- e.g. seat B's legitimate charge and
-- seat C's legitimate bankruptcy in the collect_from_each scenario above --
-- would roll back that whole transaction, undoing real state changes to
-- "fix" a write that was always meant to be a no-op) but by silently
-- discarding just the late write, matching this codebase's own established
-- philosophy for a losing side of an expected race (city_settle_auction /
-- city_claim_timeout's "an early or duplicate call is simply refused").
--
-- Defense in depth, not a replacement for the trigger: also adds the same
-- `and status = 'active'` guard 0092/0096 already established to the two
-- specific functions found live above, so the intent is visible at each call
-- site too, not only enforced invisibly at the schema layer.

create or replace function public.city_matches_freeze_finished()
returns trigger
security definer
set search_path = public
language plpgsql as $fn$
begin
  if old.status = 'finished' then
    new := old;
  end if;
  return new;
end;
$fn$;

drop trigger if exists city_matches_freeze_finished_trg on public.city_matches;
create trigger city_matches_freeze_finished_trg
  before update on public.city_matches
  for each row execute function public.city_matches_freeze_finished();

create or replace function public.city_grant_reroll(p_match_id uuid)
returns void
security definer
set search_path = public
language plpgsql as $fn$
begin
  update public.city_matches
     set phase = 'awaiting_roll',
         turn_number = turn_number + 1,
         turn_started_at = now(),
         turn_clock_elapsed_ms = 0,
         turn_clock_paused_at = null,
         trade_pause_ms_used = trade_pause_ms_used + case
           when trade_pause_started_at is not null
             then round(extract(epoch from (now() - trade_pause_started_at)) * 1000)::integer
           else 0 end,
         trade_pause_started_at = null
   where id = p_match_id and status = 'active';
end;
$fn$;

revoke all on function public.city_grant_reroll(uuid) from public, anon, authenticated;

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
      -- freshly-created claim — not restarted by a later queued one. Guarded
      -- on status='active' now: a prior seat in the same collect_from_each
      -- loop may have already finished the match (see this migration's
      -- header) before this seat's own charge reaches this branch.
      update public.city_matches set debt_started_at = now()
       where id = p_match_id and status = 'active';
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
