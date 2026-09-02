-- Spintra City — BUG-007 round F: trade-pause budget and queued offers
-- (FR-33, FR-43).
--
-- Two independent mechanisms, both keyed on whether either side of a trade
-- is the CURRENT active seat (a trade between two off-turn players touches
-- neither and proceeds exactly as it already does today):
--   - proposer = active seat -> their own clock pauses while they wait,
--     bounded by a 90s-per-turn total budget (DESIGN.md's sub-clock table).
--   - recipient = active seat -> the offer is queued: created, but hidden
--     and inactionable until their turn ends, so it can neither consume nor
--     freeze their turn clock (FR-43).
--
-- A gap the plan didn't fully spell out, found while designing this round:
-- a paused-for-trade clock needs its OWN escape hatch, or an active player
-- whose trade partner simply never responds stays paused forever --
-- city_claim_timeout already refuses outright while turn_clock_paused_at is
-- set, which is correct for an auction (settled independently) but wrong
-- for a trade with nobody enforcing its own end. DESIGN.md's "Trade
-- exchange: 45s" sub-clock is exactly this bound, added to claim_timeout
-- below: past 45s of no response, any seated player may force-withdraw the
-- active seat's own stale outgoing offers and resume their clock, then the
-- normal deadline check proceeds against the (now-running-again) clock.

alter table public.city_matches
  add column if not exists trade_pause_ms_used integer not null default 0,
  add column if not exists trade_pause_started_at timestamptz;

grant select (trade_pause_ms_used, trade_pause_started_at)
  on public.city_matches to anon, authenticated;

alter table public.city_trade_offers
  add column if not exists queued boolean not null default false;

-- ---------------------------------------------------------------------------
-- 1. Resume helper -- called after any pending-offer closure (accept,
--    decline/withdraw, or the stale-pause escape hatch below). A no-op
--    unless the active seat has no other outstanding outgoing offers left,
--    so proposing several trades at once doesn't resume the clock the
--    instant the first of them closes while the others are still pending.
--
--    Known, disclosed simplification: the 90s budget check at propose time
--    (below) reads trade_pause_ms_used, which only reflects *closed* pauses
--    -- an already-*running* pause from an earlier still-open proposal
--    isn't counted until it closes. Exact accounting across genuinely
--    overlapping simultaneous proposals would need a bigger restructure
--    than this round's scope; the common, expected case (one proposal
--    outstanding at a time) is unaffected.
-- ---------------------------------------------------------------------------
create or replace function public.city_maybe_resume_trade_clock(p_match_id uuid)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_still_pending boolean;
begin
  select * into v_match from public.city_matches where id = p_match_id;
  if v_match.trade_pause_started_at is null then
    return;
  end if;

  select exists(
    select 1 from public.city_trade_offers
     where match_id = p_match_id and status = 'pending'
       and from_seat = v_match.current_seat
  ) into v_still_pending;

  if v_still_pending then
    return;
  end if;

  update public.city_matches
     set trade_pause_ms_used = trade_pause_ms_used
           + round(extract(epoch from (now() - trade_pause_started_at)) * 1000)::integer,
         turn_started_at = turn_started_at + (now() - trade_pause_started_at),
         turn_clock_paused_at = null,
         trade_pause_started_at = null
   where id = p_match_id;
end;
$fn$;

revoke all on function public.city_maybe_resume_trade_clock(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Propose: queue when the recipient is the active seat; pause the
--    active seat's own clock (budget permitting) when THEY are the
--    proposer. Every original check kept in its original order; only the
--    insert and a new pre-insert pause step change.
-- ---------------------------------------------------------------------------
create or replace function public.city_propose_trade(
  p_match_id uuid,
  p_to_seat integer,
  p_give_spaces integer[],
  p_get_spaces integer[],
  p_give_cash integer default 0,
  p_get_cash integer default 0
)
returns uuid
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_them public.city_match_players;
  v_idx integer;
  v_offer_id uuid;
  v_queued boolean;
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
  if v_me.status <> 'active' then
    raise exception 'CITY_SEAT_OUT';
  end if;
  if v_me.pending_debt > 0 then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;

  select * into v_them from public.city_match_players
   where match_id = p_match_id and seat = p_to_seat;
  if v_them.id is null or v_them.status <> 'active' then
    raise exception 'CITY_NO_SUCH_OPPONENT';
  end if;

  if coalesce(p_give_cash, 0) > v_me.cash then
    raise exception 'CITY_INSUFFICIENT_FUNDS';
  end if;
  if coalesce(p_get_cash, 0) > v_them.cash then
    raise exception 'CITY_THEY_CANT_AFFORD';
  end if;

  foreach v_idx in array coalesce(p_give_spaces, '{}') loop
    if not exists (select 1 from public.city_assets
                    where match_id = p_match_id and space_idx = v_idx
                      and owner_seat = v_me.seat) then
      raise exception 'CITY_NOT_YOURS';
    end if;
    if not public.city_space_is_tradeable(p_match_id, v_idx) then
      raise exception 'CITY_DEVELOPED_CANNOT_TRADE';
    end if;
  end loop;

  foreach v_idx in array coalesce(p_get_spaces, '{}') loop
    if not exists (select 1 from public.city_assets
                    where match_id = p_match_id and space_idx = v_idx
                      and owner_seat = p_to_seat) then
      raise exception 'CITY_NOT_THEIRS';
    end if;
    if not public.city_space_is_tradeable(p_match_id, v_idx) then
      raise exception 'CITY_DEVELOPED_CANNOT_TRADE';
    end if;
  end loop;

  -- FR-43: queued while the recipient is the one on the clock, so it can
  -- neither consume nor freeze their turn.
  v_queued := (p_to_seat = v_match.current_seat);

  -- The not-self constraint means proposer = active seat implies the
  -- recipient can't also be -- pausing is unconditionally eligible here,
  -- budget permitting.
  if v_me.seat = v_match.current_seat and v_match.trade_pause_ms_used < 90000 then
    update public.city_matches
       set turn_clock_paused_at = coalesce(turn_clock_paused_at, now()),
           trade_pause_started_at = coalesce(trade_pause_started_at, now())
     where id = p_match_id;
  end if;

  insert into public.city_trade_offers (
    match_id, from_seat, to_seat, give_spaces, get_spaces,
    give_cash, get_cash, created_turn, expires_at, queued
  ) values (
    p_match_id, v_me.seat, p_to_seat,
    coalesce(p_give_spaces, '{}'), coalesce(p_get_spaces, '{}'),
    coalesce(p_give_cash, 0), coalesce(p_get_cash, 0),
    v_match.turn_number, now() + interval '3 minutes', v_queued
  )
  returning id into v_offer_id;

  return v_offer_id;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Accept: refuse while queued (FR-43 -- inactionable, not just hidden),
--    resume the proposer's clock afterward if they have nothing else
--    outstanding. Every original check kept in its original order.
-- ---------------------------------------------------------------------------
create or replace function public.city_accept_trade(p_offer_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_offer public.city_trade_offers;
  v_match public.city_matches;
  v_from public.city_match_players;
  v_to public.city_match_players;
  v_idx integer;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;

  select * into v_offer from public.city_trade_offers where id = p_offer_id;
  if v_offer.id is null then
    raise exception 'CITY_OFFER_NOT_FOUND';
  end if;

  select * into v_match from public.city_matches where id = v_offer.match_id;
  perform public.city_rate_limit_check(v_match.room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(v_offer.match_id::text, 0));

  select * into v_offer from public.city_trade_offers where id = p_offer_id;
  select * into v_match from public.city_matches where id = v_offer.match_id;

  if v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'CITY_OFFER_CLOSED';
  end if;
  if v_offer.queued then
    raise exception 'CITY_OFFER_QUEUED';
  end if;
  if v_offer.expires_at <= now() then
    raise exception 'CITY_OFFER_EXPIRED';
  end if;

  select * into v_to from public.city_match_players
   where match_id = v_offer.match_id and seat = v_offer.to_seat;
  select * into v_from from public.city_match_players
   where match_id = v_offer.match_id and seat = v_offer.from_seat;

  if v_to.user_id <> v_user_id then
    raise exception 'CITY_NOT_YOUR_OFFER';
  end if;
  if v_from.status <> 'active' or v_to.status <> 'active' then
    raise exception 'CITY_OFFER_STALE';
  end if;

  if v_from.cash < v_offer.give_cash or v_to.cash < v_offer.get_cash then
    raise exception 'CITY_OFFER_STALE';
  end if;

  if v_to.pending_debt > 0
     and (v_to.cash + v_offer.give_cash - v_offer.get_cash) < v_to.pending_debt then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;

  foreach v_idx in array v_offer.give_spaces loop
    if not exists (select 1 from public.city_assets
                    where match_id = v_offer.match_id and space_idx = v_idx
                      and owner_seat = v_offer.from_seat) then
      raise exception 'CITY_OFFER_STALE';
    end if;
    if not public.city_space_is_tradeable(v_offer.match_id, v_idx) then
      raise exception 'CITY_OFFER_STALE';
    end if;
  end loop;
  foreach v_idx in array v_offer.get_spaces loop
    if not exists (select 1 from public.city_assets
                    where match_id = v_offer.match_id and space_idx = v_idx
                      and owner_seat = v_offer.to_seat) then
      raise exception 'CITY_OFFER_STALE';
    end if;
    if not public.city_space_is_tradeable(v_offer.match_id, v_idx) then
      raise exception 'CITY_OFFER_STALE';
    end if;
  end loop;

  update public.city_assets set owner_seat = v_offer.to_seat
   where match_id = v_offer.match_id and space_idx = any(v_offer.give_spaces);
  update public.city_assets set owner_seat = v_offer.from_seat
   where match_id = v_offer.match_id and space_idx = any(v_offer.get_spaces);

  update public.city_match_players
     set cash = cash - v_offer.give_cash + v_offer.get_cash
   where match_id = v_offer.match_id and seat = v_offer.from_seat;
  update public.city_match_players
     set cash = cash + v_offer.give_cash - v_offer.get_cash
   where match_id = v_offer.match_id and seat = v_offer.to_seat;

  update public.city_trade_offers
     set status = 'accepted', resolved_at = now()
   where id = p_offer_id;

  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = v_offer.match_id and status = 'pending' and id <> p_offer_id
     and (give_spaces && (v_offer.give_spaces || v_offer.get_spaces)
       or get_spaces && (v_offer.give_spaces || v_offer.get_spaces));

  perform public.city_maybe_resume_trade_clock(v_offer.match_id);

  return jsonb_build_object(
    'accepted', true,
    'spaces_to_proposer', v_offer.get_spaces,
    'spaces_to_recipient', v_offer.give_spaces,
    'cash_to_recipient', v_offer.give_cash,
    'cash_to_proposer', v_offer.get_cash
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Decline/withdraw: refuse declining while queued (withdrawing your own
--    still-queued offer is fine -- only the recipient's hands are tied by
--    the queue). Resumes the proposer's clock afterward, same as accept.
-- ---------------------------------------------------------------------------
create or replace function public.city_resolve_trade(p_offer_id uuid, p_action text)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_offer public.city_trade_offers;
  v_match public.city_matches;
  v_actor public.city_match_players;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;
  if p_action not in ('declined', 'withdrawn') then
    raise exception 'CITY_BAD_ACTION';
  end if;

  select * into v_offer from public.city_trade_offers where id = p_offer_id;
  if v_offer.id is null then
    raise exception 'CITY_OFFER_NOT_FOUND';
  end if;

  select * into v_match from public.city_matches where id = v_offer.match_id;
  perform public.city_rate_limit_check(v_match.room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(v_offer.match_id::text, 0));
  select * into v_offer from public.city_trade_offers where id = p_offer_id;

  if v_offer.status <> 'pending' then
    raise exception 'CITY_OFFER_CLOSED';
  end if;
  if p_action = 'declined' and v_offer.queued then
    raise exception 'CITY_OFFER_QUEUED';
  end if;

  select * into v_actor from public.city_match_players
   where match_id = v_offer.match_id and user_id = v_user_id;

  if p_action = 'declined' and v_actor.seat <> v_offer.to_seat then
    raise exception 'CITY_NOT_YOUR_OFFER';
  end if;
  if p_action = 'withdrawn' and v_actor.seat <> v_offer.from_seat then
    raise exception 'CITY_NOT_YOUR_OFFER';
  end if;

  update public.city_trade_offers
     set status = p_action, resolved_at = now()
   where id = p_offer_id;

  perform public.city_maybe_resume_trade_clock(v_offer.match_id);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. city_advance_turn: reset the trade-pause budget on a genuine new turn
--    (not on a doubles re-roll, which never calls this -- the budget is
--    per turn, not per roll-segment, DESIGN.md's own exhaustive scenario
--    table), and surface the outgoing seat's own queued incoming offers now
--    that their turn has ended (FR-43).
-- ---------------------------------------------------------------------------
create or replace function public.city_advance_turn(p_match_id uuid)
returns integer
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_current integer;
  v_next integer;
begin
  select current_seat into v_current from public.city_matches where id = p_match_id;

  update public.city_trade_offers
     set queued = false
   where match_id = p_match_id and to_seat = v_current and queued = true and status = 'pending';

  select seat into v_next
    from public.city_match_players
   where match_id = p_match_id
     and status not in ('bankrupt', 'retired')
     and seat > v_current
   order by seat limit 1;

  if v_next is null then
    select seat into v_next
      from public.city_match_players
     where match_id = p_match_id
       and status not in ('bankrupt', 'retired')
     order by seat limit 1;
  end if;

  update public.city_matches
     set current_seat = v_next,
         phase = case when v_next is not null then 'awaiting_roll' else phase end,
         turn_number = turn_number + 1,
         doubles_count = 0,
         trade_pause_ms_used = 0,
         trade_pause_started_at = null,
         turn_started_at = now(),
         turn_clock_elapsed_ms = 0,
         turn_clock_paused_at = null
   where id = p_match_id;

  return v_next;
end;
$fn$;

revoke all on function public.city_advance_turn(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. claim_timeout's stale-trade-pause escape hatch. Every check above the
--    pause guard is unchanged; only that one guard grows a bounded
--    exception for a trade pause specifically (an auction pause, which
--    carries no trade_pause_started_at, still refuses outright exactly as
--    before -- it has its own independent settle path).
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
      -- Stale trade response: force-withdraw the active seat's own
      -- outstanding offers and resume their clock, then fall through to
      -- the normal deadline check below against the now-running clock.
      update public.city_trade_offers
         set status = 'withdrawn', resolved_at = now()
       where match_id = p_match_id and status = 'pending' and from_seat = v_match.current_seat;
      perform public.city_maybe_resume_trade_clock(p_match_id);
      select * into v_match from public.city_matches where id = p_match_id;
    else
      raise exception 'CITY_TURN_CLOCK_PAUSED';
    end if;
  end if;

  v_deadline := v_match.turn_started_at + make_interval(secs => v_match.pace_seconds);
  if now() < v_deadline then
    raise exception 'CITY_TURN_CLOCK_STILL_RUNNING';
  end if;

  select * into v_stalled from public.city_match_players
   where match_id = p_match_id and seat = v_match.current_seat;

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
  else
    v_next := public.city_advance_turn(p_match_id);
    perform public.city_run_autopilot_from_current(p_match_id);
    v_result := jsonb_build_object('resolution', 'end_turn', 'seat', v_stalled.seat, 'next_seat', v_next);
  end if;

  return v_result;
end;
$fn$;

grant execute on function public.city_claim_timeout(uuid) to anon, authenticated;
