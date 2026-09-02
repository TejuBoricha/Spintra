-- Spintra City — BUG-007 round H: hardening, after a user-requested
-- adversarial re-audit of the already-"closed" 7-round BUG-007 arc found real
-- gaps a behavior-only test suite (47 SQL assertions + 10 live specs) never
-- caught, because every one of them is either a UI-only omission or a corner
-- of the state machine no test happened to visit. Four independent
-- fresh-context audits ran in parallel (FR coverage, regression-harness
-- genuineness, client completeness, cross-round regression); this migration
-- fixes every real server-side bug they found, plus one more (the doubles
-- skip below) found while implementing the others — read firsthand, not
-- from the audit summaries, since two of this session's worst bugs already
-- came from trusting a paraphrase over the actual function body.
--
-- Six real bugs fixed here:
--
--   1. Forced liquidation shared the ordinary per-turn pace clock instead of
--      FR-33/FR-42's own fixed 90s window. A player on the "Blitz" (25s)
--      preset got 25s to save themselves from bankruptcy, not 90 — and not
--      even a fresh 25s from when the debt appeared, since the deadline was
--      turn_started_at + pace_seconds, not debt_started_at + pace_seconds.
--
--   2. A doubles re-roll while the active player had an outgoing trade
--      pause active (city_end_turn_core's v_again branch, and its autopilot
--      mirror in city_resolve_autopilot_turn) cleared turn_clock_paused_at
--      but never accounted for the elapsed pause or cleared
--      trade_pause_started_at — corrupting the running 90s/turn budget and
--      shifting turn_started_at by a stale, wrong amount whenever a second
--      trade later closed against the orphaned timestamp.
--
--   3. Found while fixing #2, by re-reading city_claim_timeout's own
--      fallback branch instead of assuming it mirrored city_end_turn_core:
--      it doesn't. Its "else" branch calls city_advance_turn unconditionally
--      — with no doubles_count check at all — so a stalled AWAY player who
--      earned a re-roll had it silently discarded (advanced past instead of
--      granted) the instant anyone else's client noticed their clock expire.
--      A human ending their own turn in time was never affected (city_end_
--      turn/city_end_turn_core always checked this correctly); only the
--      claim_timeout fallback path, which duplicated the logic instead of
--      sharing it, was wrong — exactly the class of drift that motivated
--      extracting city_advance_turn in round C in the first place. Fixed the
--      same way: a new shared city_grant_reroll(), used by all three sites
--      that need "same seat, fresh awaiting_roll, correctly-closed trade
--      pause" instead of three independently-maintained copies.
--
--   4. A retired or bankrupted seat kept showing "Away"/"auto×N" in the
--      client forever — disconnected_at/consecutive_autopilot_turns were
--      never cleared on either exit path. Cleared here for data hygiene;
--      the client fix (gating the badge on seat status) is the actual
--      user-visible half of this fix.
--
--   5. If every seat with standing in an auction — including the one whose
--      autopiloted decline opened it — disconnected simultaneously,
--      city_settle_auction handed the turn back without ever re-checking
--      whether anyone was left to hand it TO, so the match could sit
--      'active' with an away current_seat until an unrelated reconnect
--      happened to remount the auction UI. Fixed by re-invoking the
--      autopilot cascade at the end of every settle, exactly like every
--      other place in this plan that transfers turn control.
--
--   6. exit_reason: not a bug, but the client audit's other finding — a
--      forced retire, a kick, and a voluntary retire were all indistinguishable
--      to a watching player. Each of the three callers of city_retire_seat
--      now stamps why, immediately after the shared function returns.
--
--   7. Found only by live two-browser testing, not any of the four audits
--      or the SQL suite — a pre-existing bug in round F itself (0088), not
--      introduced here. The 45s trade-pause escape hatch resumes the clock
--      by shifting turn_started_at forward by however much real turn-clock
--      time was left when the pause began (city_maybe_resume_trade_clock's
--      own math) — for a trade proposed early in a turn, that's most of
--      pace_seconds, so the ordinary deadline immediately afterward almost
--      always has NOT also passed yet. The old code fell through into that
--      deadline check regardless and raised CITY_TURN_CLOCK_STILL_RUNNING —
--      which, being an uncaught exception, rolled back the ENTIRE
--      transaction, undoing the resume the same call had just made. The
--      escape hatch worked in the SQL suite's own test only because that
--      test happened to backdate turn_started_at far enough that the
--      resumed deadline had ALSO already passed — a real client proposing a
--      trade near the start of a turn hit the rollback on every attempt.
--      Fixed: return a graceful 'trade_pause_resumed' result once the
--      pause itself is cleared, instead of falling through to a check that
--      can undo it.
--
-- See C:\Users\tejas\.claude\plans\cozy-gliding-moore.md for the original
-- design this hardens, and QA_PROGRESS.md for the full audit trail.

alter table public.city_matches
  add column if not exists debt_started_at timestamptz;

grant select (debt_started_at) on public.city_matches to anon, authenticated;

alter table public.city_match_players
  add column if not exists exit_reason text;

-- ---------------------------------------------------------------------------
-- 1. city_charge / city_try_settle_debt / city_bankrupt_seat — stamp and
--    clear the fixed liquidation deadline. Only the FRESH-debt branch stamps
--    it; a second claim queuing behind an already-active one does not reset
--    the clock the first claim is already running against.
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

revoke all on function public.city_charge(uuid, integer, integer, integer) from public, anon, authenticated;

create or replace function public.city_try_settle_debt(p_match_id uuid, p_seat integer)
returns boolean
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_me public.city_match_players;
  v_next public.city_debt_queue;
begin
  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  if v_me.pending_debt = 0 then
    return true;
  end if;
  if v_me.cash < v_me.pending_debt then
    return false;
  end if;

  update public.city_match_players
     set cash = cash - v_me.pending_debt, pending_debt = 0, pending_creditor_seat = null
   where id = v_me.id;

  if v_me.pending_creditor_seat is not null then
    update public.city_match_players
       set cash = cash + v_me.pending_debt
     where match_id = p_match_id and seat = v_me.pending_creditor_seat;
  end if;

  select * into v_next from public.city_debt_queue
   where match_id = p_match_id and debtor_seat = p_seat
   order by queued_at asc limit 1;

  if v_next.id is not null then
    update public.city_match_players
       set pending_debt = v_next.amount, pending_creditor_seat = v_next.creditor_seat
     where id = v_me.id;
    update public.city_matches set phase = 'required_decision',
      -- The promoted claim becomes the new "current" decision — it gets its
      -- own fresh fixed window, not the remainder of the one that just cleared.
      debt_started_at = now()
     where id = p_match_id and current_seat = p_seat;
    delete from public.city_debt_queue where id = v_next.id;
  else
    update public.city_matches set phase = 'optional_actions', debt_started_at = null
     where id = p_match_id and phase = 'required_decision';
  end if;

  return true;
end;
$fn$;

revoke all on function public.city_try_settle_debt(uuid, integer) from public, anon, authenticated;

create or replace function public.city_bankrupt_seat(
  p_match_id uuid, p_seat integer, p_creditor_seat integer
)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_cash integer;
  v_left integer;
  v_developments integer;
begin
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
    select coalesce(sum(a.buildings * (coalesce(s.build_cost, 0) / 2)), 0)
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
     -- Round H: a bankrupted seat's stale presence/autopilot state no longer
     -- lingers forever in the client (finding 4).
     set status = 'bankrupt', cash = 0, final_net_worth = 0,
         pending_debt = 0, pending_creditor_seat = null,
         disconnected_at = null, consecutive_autopilot_turns = 0
   where match_id = p_match_id and seat = p_seat;

  update public.city_matches set debt_started_at = null
   where id = p_match_id and current_seat = p_seat;

  select count(*) into v_left
    from public.city_match_players
   where match_id = p_match_id and status not in ('bankrupt', 'retired');

  if v_left <= 1 then
    perform public.city_finish_match(p_match_id, 'last_player_standing');
  end if;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. city_grant_reroll — the shared "same seat, fresh awaiting_roll" reset
--    for a doubles re-roll, now used by all three places that need it,
--    instead of three independently-maintained copies (see finding 3: the
--    claim_timeout copy that never existed is exactly why this drifted).
--    Correctly closes any active trade pause first (accumulates the elapsed
--    time into the running per-turn budget rather than losing or corrupting
--    it) — the re-roll itself is the closing event for pause-accounting
--    purposes, independent of whether the same offer is still outstanding.
-- ---------------------------------------------------------------------------
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
   where id = p_match_id;
end;
$fn$;

revoke all on function public.city_grant_reroll(uuid) from public, anon, authenticated;

create or replace function public.city_end_turn_core(p_match_id uuid, p_seat integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_me public.city_match_players;
  v_next integer;
begin
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
  if v_me.pending_debt > 0 then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;
  if v_match.phase = 'auction' then
    raise exception 'CITY_AUCTION_RUNNING';
  end if;
  if v_match.phase = 'awaiting_roll' then
    raise exception 'CITY_MUST_ROLL_FIRST';
  end if;
  if v_match.phase = 'required_decision' then
    raise exception 'CITY_DECISION_PENDING';
  end if;

  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = p_match_id and status = 'pending'
     and (from_seat = p_seat and created_turn < v_match.turn_number
          or expires_at <= now());

  if v_match.doubles_count between 1 and 2 and v_me.status = 'active' then
    perform public.city_grant_reroll(p_match_id);
    return jsonb_build_object('next_seat', p_seat, 'roll_again', true);
  end if;

  select seat into v_next
    from public.city_match_players
   where match_id = p_match_id
     and status not in ('bankrupt', 'retired')
     and seat > p_seat
   order by seat limit 1;
  if v_next is null then
    select seat into v_next
      from public.city_match_players
     where match_id = p_match_id
       and status not in ('bankrupt', 'retired')
     order by seat limit 1;
  end if;

  if v_match.mode = 'timed'
     and v_match.time_limit_minutes is not null
     and now() >= v_match.started_at + make_interval(mins => v_match.time_limit_minutes)
     and v_next <= p_seat then
    return public.city_finish_match(p_match_id, 'time_limit')
           || jsonb_build_object('next_seat', null, 'roll_again', false);
  end if;

  v_next := public.city_advance_turn(p_match_id);
  perform public.city_run_autopilot_from_current(p_match_id);

  return jsonb_build_object('next_seat', v_next, 'roll_again', false);
end;
$fn$;

revoke all on function public.city_end_turn_core(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. city_resolve_autopilot_turn — same city_grant_reroll reuse for its
--    mirrored doubles branch, plus city_liquidate_for_debt is now called
--    while debt_started_at governs claim_timeout's own gate (unaffected
--    here: autopilot always resolves immediately regardless of that clock,
--    per FR-27 — only a PRESENT stalled player gets the fixed 90s window).
-- ---------------------------------------------------------------------------
create or replace function public.city_resolve_autopilot_turn(p_match_id uuid, p_seat integer)
returns text
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_me public.city_match_players;
  i integer := 0;
begin
  loop
    i := i + 1;
    exit when i > 12;

    select * into v_match from public.city_matches where id = p_match_id;
    select * into v_me from public.city_match_players
     where match_id = p_match_id and seat = p_seat;

    if v_me.id is null or v_me.status in ('bankrupt', 'retired') then
      return 'bankrupt';
    end if;

    if v_me.pending_debt > 0 then
      perform public.city_liquidate_for_debt(p_match_id, p_seat);
      continue;
    end if;

    if v_me.in_detention then
      perform public.city_leave_detention_core(p_match_id, p_seat, 'roll');
      return 'concluded';
    end if;

    if v_match.phase = 'awaiting_roll' then
      perform public.city_roll_dice_core(p_match_id, p_seat);
      continue;
    end if;

    if v_match.phase = 'required_decision' then
      perform public.city_decline_purchase_core(p_match_id, p_seat);
      if (select phase from public.city_matches where id = p_match_id) = 'auction' then
        return 'auction_pending';
      end if;
      continue;
    end if;

    if v_match.doubles_count between 1 and 2 then
      perform public.city_grant_reroll(p_match_id);
      continue;
    end if;

    return 'concluded';
  end loop;

  return 'concluded';
end;
$fn$;

revoke all on function public.city_resolve_autopilot_turn(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. city_run_autopilot_from_current — stamps exit_reason on a forced
--    retire (finding 6). Loop/pause logic itself is unchanged from round D.
-- ---------------------------------------------------------------------------
create or replace function public.city_run_autopilot_from_current(p_match_id uuid)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_current integer;
  v_seat public.city_match_players;
  v_away boolean;
  v_result text;
  v_streak integer;
  v_seat_count integer;
  v_found_present boolean := false;
  i integer := 0;
begin
  select count(*) into v_seat_count from public.city_match_players
   where match_id = p_match_id and status not in ('bankrupt', 'retired');

  loop
    i := i + 1;
    exit when i > v_seat_count;

    select current_seat into v_current from public.city_matches where id = p_match_id;
    exit when v_current is null;

    select * into v_seat from public.city_match_players
     where match_id = p_match_id and seat = v_current;

    v_away := v_seat.disconnected_at is not null
      and now() - v_seat.disconnected_at >= interval '60 seconds';

    if not v_away then
      v_found_present := true;
      exit;
    end if;

    v_result := public.city_resolve_autopilot_turn(p_match_id, v_current);

    if v_result = 'auction_pending' then
      v_found_present := true;
      exit;
    end if;

    if v_result = 'bankrupt' then
      perform public.city_advance_turn(p_match_id);
      continue;
    end if;

    update public.city_match_players
       set consecutive_autopilot_turns = consecutive_autopilot_turns + 1
     where match_id = p_match_id and seat = v_current
    returning consecutive_autopilot_turns into v_streak;

    if v_streak >= 2 then
      update public.city_match_players set exit_reason = 'autopilot_forced'
       where match_id = p_match_id and seat = v_current;
      perform public.city_retire_seat(p_match_id, v_current);
    else
      perform public.city_advance_turn(p_match_id);
    end if;
  end loop;

  if not v_found_present then
    update public.city_matches set status = 'paused', paused_at = now()
     where id = p_match_id and status = 'active';
  end if;
end;
$fn$;

revoke all on function public.city_run_autopilot_from_current(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. city_retire_seat — clears the same two stale presence/autopilot fields
--    on a retire that city_bankrupt_seat now clears on bankruptcy (finding
--    4). Signature unchanged deliberately (avoids a new overload needing
--    its own grant hygiene) — exit_reason is stamped by each of the three
--    callers below instead, right after this returns.
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

create or replace function public.city_retire_self(p_match_id uuid)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
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
  if v_me.status in ('bankrupt', 'retired') then
    raise exception 'CITY_SEAT_OUT';
  end if;

  perform public.city_retire_seat(p_match_id, v_me.seat);
  update public.city_match_players set exit_reason = 'voluntary'
   where match_id = p_match_id and seat = v_me.seat;
end;
$fn$;

grant execute on function public.city_retire_self(uuid) to anon, authenticated;

create or replace function public.city_retire_seat_on_departure()
returns trigger
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match_id uuid;
  v_seat integer;
begin
  select m.id, p.seat into v_match_id, v_seat
    from public.city_matches m
    join public.city_match_players p on p.match_id = m.id
   where m.room_code = old.room_id
     and m.status = 'active'
     and p.user_id = old.user_id;

  if v_match_id is not null then
    perform public.city_retire_seat(v_match_id, v_seat);
    update public.city_match_players set exit_reason = 'departed'
     where match_id = v_match_id and seat = v_seat;
    perform public.city_run_autopilot_from_current(v_match_id);
  end if;

  return old;
end;
$fn$;

revoke all on function public.city_retire_seat_on_departure() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. city_claim_timeout — two changes: the debt branch's deadline now comes
--    from debt_started_at (fixed 90s, finding 1), computed once up front
--    alongside the ordinary one so both share the existing "still running"
--    guard; and the end-turn fallback now checks doubles_count before
--    calling city_advance_turn, using the shared city_grant_reroll (finding
--    3) instead of silently discarding an away player's earned re-roll.
-- ---------------------------------------------------------------------------
create or replace function public.city_claim_timeout(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_caller public.city_match_players;
  v_stalled public.city_match_players;
  v_deadline timestamptz;
  v_next integer;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
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

  select * into v_caller from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_caller.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;

  if v_match.current_seat is null then
    raise exception 'CITY_NO_ACTIVE_TURN';
  end if;

  if v_match.phase = 'auction' then
    raise exception 'CITY_TURN_CLOCK_PAUSED';
  end if;

  if v_match.turn_clock_paused_at is not null then
    if v_match.trade_pause_started_at is not null
       and now() >= v_match.trade_pause_started_at + interval '45 seconds' then
      update public.city_trade_offers
         set status = 'withdrawn', resolved_at = now()
       where match_id = p_match_id and status = 'pending' and from_seat = v_match.current_seat;
      perform public.city_maybe_resume_trade_clock(p_match_id);
      select * into v_match from public.city_matches where id = p_match_id;

      -- Round H: found via live browser testing, not the SQL suite (whose
      -- own version of this scenario happened to backdate turn_started_at
      -- far enough that this branch was never reached) -- resuming shifts
      -- turn_started_at forward by however much real turn-clock time was
      -- left when the pause began (city_maybe_resume_trade_clock's own
      -- math), which for a trade proposed early in a turn is most of
      -- pace_seconds. That means the ordinary deadline below has usually
      -- NOT also passed yet immediately after a resume -- and that is
      -- success, not failure: the escape hatch's only job is to unstick the
      -- PAUSE. Falling through into the generic "still running" raise
      -- below would roll back the ENTIRE transaction, including the
      -- resume this same call just made (Postgres aborts the whole
      -- function on an uncaught exception) -- silently undoing the fix on
      -- every single call in the common case. Return here instead.
      if now() < v_match.turn_started_at + make_interval(secs => v_match.pace_seconds) then
        return jsonb_build_object('resolution', 'trade_pause_resumed', 'seat', v_match.current_seat);
      end if;
    else
      raise exception 'CITY_TURN_CLOCK_PAUSED';
    end if;
  end if;

  select * into v_stalled from public.city_match_players
   where match_id = p_match_id and seat = v_match.current_seat;

  -- FR-33/FR-42: forced liquidation runs on its own fixed 90s window,
  -- independent of the host's pace preset — never the ordinary
  -- turn_started_at + pace_seconds deadline every other branch uses.
  if v_stalled.pending_debt > 0 then
    v_deadline := coalesce(v_match.debt_started_at, v_match.turn_started_at) + interval '90 seconds';
  else
    v_deadline := v_match.turn_started_at + make_interval(secs => v_match.pace_seconds);
  end if;
  if now() < v_deadline then
    raise exception 'CITY_TURN_CLOCK_STILL_RUNNING';
  end if;

  if v_stalled.pending_debt > 0 then
    v_result := jsonb_build_object(
      'resolution', case when public.city_liquidate_for_debt(p_match_id, v_stalled.seat)
        then 'liquidated' else 'bankrupt' end,
      'seat', v_stalled.seat);
  elsif v_stalled.in_detention then
    v_result := public.city_leave_detention_core(p_match_id, v_stalled.seat, 'roll')
      || jsonb_build_object('resolution', 'detention_roll', 'seat', v_stalled.seat);
  elsif v_match.phase = 'awaiting_roll' then
    v_result := public.city_roll_dice_core(p_match_id, v_stalled.seat)
      || jsonb_build_object('resolution', 'auto_roll', 'seat', v_stalled.seat);
  elsif v_match.phase = 'required_decision' then
    v_result := public.city_decline_purchase_core(p_match_id, v_stalled.seat)
      || jsonb_build_object('resolution', 'auto_decline', 'seat', v_stalled.seat);
  elsif v_match.doubles_count between 1 and 2 then
    perform public.city_grant_reroll(p_match_id);
    v_result := jsonb_build_object('resolution', 'roll_again', 'seat', v_stalled.seat);
  else
    v_next := public.city_advance_turn(p_match_id);
    perform public.city_run_autopilot_from_current(p_match_id);
    v_result := jsonb_build_object('resolution', 'end_turn', 'seat', v_stalled.seat, 'next_seat', v_next);
  end if;

  return v_result;
end;
$fn$;

grant execute on function public.city_claim_timeout(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. city_settle_auction — re-invokes the autopilot cascade after handing
--    the turn back (finding 5), so an all-disconnected-mid-auction table
--    correctly reaches status='paused' the next time anyone (a reconnect,
--    most likely) causes a settle, instead of never re-checking at all.
-- ---------------------------------------------------------------------------
create or replace function public.city_settle_auction(
  p_match_id uuid, p_force boolean default false
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

  -- Whoever regains control of the clock here might already be away (or
  -- have been the whole time) — re-check immediately rather than waiting on
  -- a future clock expiry, same as every other turn-control handoff.
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
