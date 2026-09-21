-- Spintra City — three more findings from the same 2026-09-21 review round
-- that found migration 0099's deadlock, each verified by reading the
-- current live code directly before fixing.
--
-- 1. city_accept_trade (0093) checks the ACCEPTING seat's pending_debt
--    (BUG-011, the "a debtor cannot strip assets via a non-clearing trade"
--    invariant) but never the PROPOSING seat's. Failure scenario: seat A
--    proposes trading valuable property + a token cash amount to seat B
--    while solvent. Before B accepts, A lands on a tax/card space and gets
--    pending_debt set. B then accepts the still-pending offer -- nothing
--    re-checks A's now-outstanding debt, so the trade executes, shrinking
--    A's own liquidation headroom and potentially forcing an otherwise-
--    avoidable bankruptcy -- the exact asset-stripping BUG-011 was written
--    to stop, just reachable from the other side of the same trade. Fix:
--    the same style of check already applied to v_to, applied to v_from.
--
-- 2. city_run_autopilot_from_current (0090) treats an autopilot-opened
--    auction ('auction_pending') as unconditional proof someone is present,
--    even when every seat including the auction's own opener is actually
--    disconnected. Failure scenario: the away current seat's autopilot
--    auto-declines a purchase and opens an auction while every other seat
--    is also disconnected at that same moment -- the loop exits believing
--    someone's present, so the "mark match paused" fallback never fires.
--    Settling an expired auction is driven only by a connected client's own
--    timer (city-auction.tsx after hard_ends_at); there is no server-side
--    cron. The match sits status='active' indefinitely with an unreachable
--    auction until an unrelated reconnect happens to remount the auction
--    UI. Fix: only treat auction_pending as "found present" when at least
--    one non-bankrupt/non-retired seat is actually online (same 60s-away
--    threshold the rest of this loop already uses) -- otherwise fall
--    through to the existing pause logic, same as any other away-current-
--    seat outcome. This doesn't change what happens once someone DOES
--    reconnect: 0098/0099's resume path already re-invokes this function,
--    and the reconnecting client's own auction UI settles the auction
--    normally once it renders.
--
-- 3. city_apply_card's collect_from_each branch (0094) sums the nominal
--    charge amount for every opponent into v_total regardless of what
--    city_charge actually collected. Failure scenario: a card charges 3
--    opponents $200 each; one can only cover $50 via city_bankrupt_seat's
--    partial salvage, another goes to the deferred pending_debt path
--    (city_charge's must_raise_funds branch, which transfers $0 to the
--    creditor immediately -- it's a future claim, not a payment). The old
--    code still added +200 per iteration regardless, so the returned/
--    logged total could overstate real cash flow by the full charge amount
--    per non-paying opponent, not just a partial-bankruptcy shortfall --
--    a wrong number surfaced directly in the activity feed / card result.
--    Fix: measure the drawer's own cash before and after the loop instead
--    of summing the nominal amount -- this is exact regardless of which of
--    city_charge's three internal paths each payer took (full payment,
--    deferred debt, or partial bankruptcy salvage), without needing to
--    change city_charge/city_bankrupt_seat's return shape at all.

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

  -- Symmetric to the v_to check above: the proposer can have gone into debt
  -- after proposing but before the other side accepted. Without this, the
  -- trade could strip the proposer's own assets/cash right out from under
  -- the creditor chasing them.
  if v_from.pending_debt > 0
     and (v_from.cash - v_offer.give_cash + v_offer.get_cash) < v_from.pending_debt then
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

  insert into public.city_match_events (match_id, kind, actor_seat, payload)
  values (v_offer.match_id, 'trade_accepted', v_offer.to_seat, jsonb_build_object(
    'with_seat', v_offer.from_seat,
    'gave_spaces', v_offer.get_spaces, 'got_spaces', v_offer.give_spaces,
    'gave_cash', v_offer.get_cash, 'got_cash', v_offer.give_cash
  ));

  return jsonb_build_object(
    'accepted', true,
    'spaces_to_proposer', v_offer.get_spaces,
    'spaces_to_recipient', v_offer.give_spaces,
    'cash_to_recipient', v_offer.give_cash,
    'cash_to_proposer', v_offer.get_cash
  );
end;
$fn$;

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
  v_anyone_online boolean;
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
      -- Opening an auction isn't itself proof anyone can act on it -- the
      -- seat that just opened it (via autopilot decline) can be just as
      -- disconnected as everyone else. Check the whole match for a genuinely
      -- online seat before treating this as a reason to stay active; a
      -- reconnect later re-enters this same loop (0098/0099's resume path)
      -- and the reconnecting client's own auction UI settles it normally.
      select exists(
        select 1 from public.city_match_players
         where match_id = p_match_id
           and status not in ('bankrupt', 'retired')
           and (disconnected_at is null or now() - disconnected_at < interval '60 seconds')
      ) into v_anyone_online;
      v_found_present := v_anyone_online;
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
  v_collect_before integer;
  v_collect_after integer;
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
    select cash into v_collect_before from public.city_match_players where id = v_me.id;
    for v_to in
      select seat from public.city_match_players
       where match_id = p_match_id and seat <> p_seat and status = 'active'
    loop
      perform public.city_charge(p_match_id, v_to, v_amount, p_seat, 'card_charged');
    end loop;
    -- The real total actually received, not the nominal charge amount: a
    -- payer who couldn't fully cover it may have gone through city_charge's
    -- deferred must_raise_funds path (which pays nothing immediately -- a
    -- future claim, not cash in hand) or its partial-bankruptcy-salvage
    -- path, neither of which is the full v_amount. Measuring the drawer's
    -- own cash before/after is exact regardless of which path each payer
    -- took, without needing city_charge to report it back.
    select cash into v_collect_after from public.city_match_players where id = v_me.id;
    v_total := v_collect_after - v_collect_before;
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
