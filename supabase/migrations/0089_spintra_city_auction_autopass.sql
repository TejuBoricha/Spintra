-- Spintra City — BUG-007 round G: auction auto-pass for away seats (FR-49).
--
-- FR-50 (timed mode is wall-clock, only ends at a round boundary) needed no
-- code this round -- it was already fully correct in city_end_turn (0070's
-- own v_expired check) and locked in with a regression assertion back in
-- round B (BUG-007-B-timed).
--
-- city_pass_auction (0069, untouched until now) already implements the
-- all-pass fast path and already excludes the standing high bidder from the
-- eligibility count -- an away seat is a small, precise addition to that
-- same exclusion, not new machinery: treat a seat that's been disconnected
-- past the 60s grace period as already-passed for the purposes of deciding
-- whether every remaining eligible bidder has given up, exactly the way a
-- disconnected player already can't be waited on for anything else in this
-- plan. An away seat that reconnects and wants back in still can -- passing
-- was never binding, and nothing here revokes that; it only stops an
-- auction waiting out its full cap on someone who's gone, per FR-49 itself.
create or replace function public.city_pass_auction(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_auction public.city_auctions;
  v_eligible integer;
  v_passed integer;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;

  select * into v_match from public.city_matches where id = p_match_id;
  perform public.city_rate_limit_check(v_match.room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));

  select * into v_auction from public.city_auctions
   where match_id = p_match_id and status = 'running';
  if v_auction.id is null then
    raise exception 'CITY_NO_AUCTION';
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_me.id is null or v_me.status <> 'active' then
    raise exception 'CITY_NOT_SEATED';
  end if;

  if not (v_me.seat = any(v_auction.passed_seats)) then
    update public.city_auctions
       set passed_seats = passed_seats || v_me.seat
     where id = v_auction.id
    returning * into v_auction;
  end if;

  -- Everyone still eligible passed, or is away and couldn't click Pass even
  -- if they wanted to (§3.1E's fast path, extended to FR-49). The standing
  -- high bidder is excluded either way: they aren't waiting on anything.
  select count(*) into v_eligible from public.city_match_players
   where match_id = p_match_id and status = 'active'
     and (v_auction.high_seat is null or seat <> v_auction.high_seat)
     and not (
       disconnected_at is not null
       and now() - disconnected_at >= interval '60 seconds'
     );
  select count(*) into v_passed
    from unnest(v_auction.passed_seats) s
   where v_auction.high_seat is null or s <> v_auction.high_seat;

  if v_passed >= v_eligible then
    return public.city_settle_auction(p_match_id, true);
  end if;

  return jsonb_build_object('passed', true, 'waiting_on', v_eligible - v_passed);
end;
$fn$;
