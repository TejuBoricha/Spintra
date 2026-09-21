-- Spintra City — two more instances of the finished-match-resurrection bug
-- class, found by a fresh 8-agent review round on PR #43, both verified by
-- reading the current live code directly (not just the finder agents' claims):
--
-- 1. city_bankrupt_seat (0093) has no status='active' guard and was never
--    touched by 0092/0096/0097's leaf-by-leaf fixes to sibling functions.
--    city_apply_card's collect_from_each branch (0094) charges several seats
--    in one transaction with no re-check between iterations: seat C bankrupts
--    and finishes the match (city_finish_match snapshots + pays every seat's
--    final_net_worth right then, per its own "snapshot first" invariant), the
--    loop continues to seat D (already selected into the cursor before C's
--    bankruptcy), D can't cover the charge either and also bankrupts —
--    unconditionally overwriting D's final_net_worth to 0 *after* it was
--    already scored and paid. city_finish_match's own re-entry guard means
--    there is no second snapshot to correct this. Fix: match the freeze
--    trigger's philosophy (silently refuse the late write, don't raise —
--    raising here would roll back real, legitimate effects earlier in the
--    same transaction, e.g. seat B's legitimate charge) by returning early
--    once the match is no longer active, before any of the corrupting writes.
--
-- 2. city_track_disconnect's durable-pause resume branch (0087, written
--    before debt_started_at existed in 0090 and never revisited) resets the
--    ordinary turn_started_at clock on resume but leaves debt_started_at at
--    its stale pre-pause value. Verified end to end: the client watchdog
--    (city-match-shell.tsx) computes deadline = debt_started_at + 90_000 and
--    calls claimTimeout() immediately when that's already in the past; the
--    server (city_claim_timeout, 0090) computes the same stale deadline and
--    force-liquidates the seat with no "still running" check to stop it. A
--    player reconnecting mid required_decision after a durable pause gets
--    force-liquidated before they can see their own screen — defeating the
--    entire point of the fixed 90s window 0090 built. The same resume branch
--    also drops trade-pause budget accounting (trade_pause_started_at is
--    left stamped, trade_pause_ms_used never credited) — the identical bug
--    class 0090 already fixed in city_grant_reroll for the doubles-reroll
--    resume path, just not for this older, separate resume path. Fix both by
--    reusing the reset-on-resume treatment already given to turn_started_at
--    (debt_started_at) and the credit-then-clear treatment already
--    established in city_grant_reroll (trade_pause_ms_used/trade_pause_started_at).

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

  -- A prior seat charged earlier in the same transaction (e.g. an earlier
  -- iteration of collect_from_each) may have already finished the match.
  -- Nothing past this point should mutate state that city_finish_match has
  -- already snapshotted and paid out — silently refuse, matching this
  -- codebase's established philosophy for a losing side of an expected race.
  if v_match.status <> 'active' then
    return;
  end if;

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

create or replace function public.city_track_disconnect()
returns trigger
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match_id uuid;
  v_seat integer;
  v_was_paused_at timestamptz;
begin
  select m.id, p.seat into v_match_id, v_seat
    from public.city_matches m
    join public.city_match_players p on p.match_id = m.id
   where m.room_code = new.room_id
     and m.status = 'active'
     and p.user_id = new.user_id
     and p.status in ('seated', 'active');

  if v_match_id is not null then
    if new.is_online then
      update public.city_match_players
         set disconnected_at = null,
             consecutive_autopilot_turns = 0
       where match_id = v_match_id and seat = v_seat;
    else
      update public.city_match_players
         set disconnected_at = now()
       where match_id = v_match_id and seat = v_seat and disconnected_at is null;
    end if;
    return new;
  end if;

  -- The match wasn't 'active' above -- the one case still worth checking is
  -- a 'paused' match this reconnecting user is actually seated in, which the
  -- query above deliberately excludes (it only matches active matches).
  if new.is_online then
    select m.id, m.paused_at, p.seat into v_match_id, v_was_paused_at, v_seat
      from public.city_matches m
      join public.city_match_players p on p.match_id = m.id
     where m.room_code = new.room_id
       and m.status = 'paused'
       and p.user_id = new.user_id
       and p.status in ('seated', 'active');

    if v_match_id is not null then
      update public.city_match_players
         set disconnected_at = null,
             consecutive_autopilot_turns = 0
       where match_id = v_match_id and seat = v_seat;

      update public.city_matches
         set status = 'active',
             paused_at = null,
             started_at = case when v_was_paused_at is not null
               then started_at + (now() - v_was_paused_at)
               else started_at end,
             turn_started_at = now(),
             turn_clock_elapsed_ms = 0,
             turn_clock_paused_at = null,
             -- FR-33/FR-42: the fixed 90s liquidation window is stale after a
             -- durable pause (real wall-clock time passed while nothing could
             -- extend it) -- give it the same fresh-start treatment as the
             -- ordinary turn clock above, not the credit-elapsed-time model,
             -- since a paused match had CITY_MATCH_NOT_ACTIVE blocking any
             -- claim the whole time, unlike an ordinary in-turn trade pause.
             debt_started_at = case when debt_started_at is not null then now() else null end,
             -- Same bug class 0090 already fixed in city_grant_reroll for the
             -- doubles-reroll resume path: credit the elapsed pause into the
             -- running trade budget instead of leaving trade_pause_started_at
             -- stamped at its stale pre-pause value.
             trade_pause_ms_used = trade_pause_ms_used + case
               when trade_pause_started_at is not null
                 then round(extract(epoch from (now() - trade_pause_started_at)) * 1000)::integer
               else 0 end,
             trade_pause_started_at = null
       where id = v_match_id;

      -- The reconnecting player may not even be current_seat -- if whoever
      -- is still away, resolve immediately rather than waiting on a future
      -- clock expiry, same as every other resume/advance path in this plan.
      perform public.city_run_autopilot_from_current(v_match_id);
    end if;
  end if;

  return new;
end;
$fn$;

revoke all on function public.city_track_disconnect() from public, anon, authenticated;
