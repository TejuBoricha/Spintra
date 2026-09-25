-- Spintra City — two lower-severity findings from the 2026-09-22 review
-- rounds, deferred at the time and fixed now on request.
--
-- 1. city_create_match locked a room via hashtextextended(p_room_code, 0)
--    (a 64-bit hash) while elect_room_host (0061, pre-existing) locks the
--    SAME room via hashtext(p_room_code) (32-bit) -- two different lock IDs
--    for what 0063's own header calls "0029's convention": serializing on
--    the room. They never actually exclude each other. Concretely: a host
--    election committing while a concurrent city_create_match call is
--    mid-flight (having already read the old host_id before the election's
--    UPDATE commits) could let a just-demoted host still create a match in
--    a narrow race window. The partial unique index on city_matches is
--    still the hard backstop against a double-create either way (per this
--    function's own comment) -- this fixes the softer, intended
--    serialization against host changes specifically. Fix: use the same
--    hashtext(p_room_code) every other room-code lock in this codebase
--    already uses, restoring real mutual exclusion.
--
-- 2. city_accept_trade's new proposer-side debt check (0100) raised the
--    same CITY_SETTLE_DEBT_FIRST code the pre-existing accepting-side check
--    uses. Only the accepting seat can ever call city_accept_trade, so the
--    client's error text ("Settle what you owe first") is correct for the
--    v_to branch (their own debt) but misleading for the v_from branch --
--    it's the PROPOSER who owes, not the acceptor calling this function,
--    and the acceptor has no way to make the proposer pay down their debt.
--    Fix: a distinct CITY_PROPOSER_SETTLE_DEBT_FIRST code with its own
--    client-side message naming whose debt is actually blocking the trade.

create or replace function public.city_create_match(
  p_room_code text,
  p_mode text default 'classic',
  p_time_limit_minutes integer default null,
  p_seed bigint default null,
  p_pace_seconds integer default 40
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_room record;
  v_match_id uuid;
  v_seed bigint;
begin
  if v_user_id is null then
    raise exception 'CITY_UNAUTHENTICATED';
  end if;

  perform public.city_rate_limit_check(p_room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtext(p_room_code));

  select code, host_id, type into v_room
  from public.rooms where code = p_room_code;

  if v_room.code is null then
    raise exception 'CITY_ROOM_NOT_FOUND';
  end if;
  if v_room.type <> 'city' then
    raise exception 'CITY_WRONG_ROOM_TYPE';
  end if;
  if v_room.host_id <> v_user_id then
    raise exception 'CITY_NOT_HOST';
  end if;
  if p_mode not in ('classic', 'timed') then
    raise exception 'CITY_INVALID_MODE';
  end if;
  if p_pace_seconds not in (25, 40, 60) then
    raise exception 'CITY_INVALID_PACE';
  end if;

  -- Test seam (DESIGN.md §3.2A): an explicit seed makes a match exactly
  -- reproducible, which automated tests need. Restricted to service_role so a
  -- browser client can never pick a seed whose outcomes it has precomputed --
  -- the service key is never shipped to the browser.
  if p_seed is not null then
    if auth.role() <> 'service_role' then
      raise exception 'CITY_SEED_NOT_PERMITTED';
    end if;
    v_seed := p_seed;
  else
    -- CSPRNG-derived (pgcrypto/OpenSSL), not Postgres's plain random().
    v_seed := ('x' || encode(extensions.gen_random_bytes(8), 'hex'))::bit(64)::bigint;
  end if;

  -- The advisory lock above serializes callers for this room, but the partial
  -- unique index is still the real guarantee (it also covers a caller that
  -- somehow bypasses this function). Translate its raw constraint violation
  -- into the same CITY_* vocabulary every other failure here uses, so the
  -- client can map it to friendly copy instead of falling through to a
  -- generic "something went wrong".
  begin
    insert into public.city_matches (
      room_code, mode, time_limit_minutes, rng_seed, created_by, pace_seconds
    )
    values (
      p_room_code,
      p_mode,
      case when p_mode = 'timed' then coalesce(p_time_limit_minutes, 60) else null end,
      v_seed,
      v_user_id,
      p_pace_seconds
    )
    returning id into v_match_id;
  exception when unique_violation then
    raise exception 'CITY_MATCH_ALREADY_EXISTS';
  end;

  return v_match_id;
end;
$$;

-- No grant/revoke statement here: CREATE OR REPLACE on an unchanged
-- signature preserves the existing `grant execute ... to anon,
-- authenticated` on this genuinely client-facing RPC.

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
  -- after proposing but before the other side accepted. Distinct error code
  -- from the v_to case above -- only the accepting seat (v_to) can ever call
  -- this function, so "settle your own debt" would be both false and
  -- unactionable here: it's the proposer who owes, not the caller.
  if v_from.pending_debt > 0
     and (v_from.cash - v_offer.give_cash + v_offer.get_cash) < v_from.pending_debt then
    raise exception 'CITY_PROPOSER_SETTLE_DEBT_FIRST';
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
