-- Spintra City — a third `/code-review high` round on PR #43 (2026-09-22,
-- diff now including 0099/0100) found the same resurrection bug class one
-- function deeper than 0098/0099 closed: city_charge itself.
--
-- city_charge writes to city_match_players (cash, pending_debt) in two
-- branches, neither guarded:
--   1. The full-pay branch (lines 127-138 of the current body, 0097):
--      debits the payer's cash and credits the creditor's, unconditionally.
--   2. The pending_debt branch (141-149): sets pending_debt/
--      pending_creditor_seat on the payer's own row, unconditionally --
--      only the SEPARATE debt_started_at write on city_matches right after
--      it got a status='active' guard in 0097, not this city_match_players
--      write itself.
--
-- Neither table write is covered by 0097's freeze trigger (that trigger is
-- on city_matches only). city_bankrupt_seat got exactly this guard in 0098
-- after the same failure mode was found there -- city_charge, the function
-- that CALLS city_bankrupt_seat in its own third branch, was never
-- re-audited for the identical gap one level up.
--
-- Failure scenario: city_apply_card's collect_from_each loop (0094/0100)
-- charges several seats in one transaction, in cursor order fixed before
-- the loop starts. If an earlier seat's charge bankrupts the last other
-- active player and finishes the match (city_bankrupt_seat ->
-- city_finish_match, which snapshots and pays every seat's score right
-- then), the loop continues to the next seat -- already selected into the
-- cursor before the match finished. If that seat can fully cover their
-- charge, city_charge's full-pay branch silently moves cash into/out of
-- already-snapshotted, already-scored city_match_players rows -- the exact
-- corruption 0098's header describes for city_bankrupt_seat, just via a
-- sibling branch of the function that calls it, never re-audited when 0098
-- landed.
--
-- Fix: the same guard already used in city_bankrupt_seat (0098) and
-- city_retire_seat (0099) -- read the match, return the same no-op sentinel
-- p_amount<=0 already returns (jsonb 'action':'none') if the match is no
-- longer active, before any of the three branches can write.

create or replace function public.city_charge(
  p_match_id uuid, p_seat integer, p_amount integer, p_creditor_seat integer, p_kind text
)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_me public.city_match_players;
  v_match public.city_matches;
begin
  if p_amount <= 0 then
    return jsonb_build_object('action', 'none');
  end if;

  select * into v_match from public.city_matches where id = p_match_id;
  if v_match.status <> 'active' then
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
