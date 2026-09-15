-- Spintra City — fix a genuinely ambiguous overload on city_settle_auction,
-- found not by any of this session's 55 SQL assertions or 14 live specs,
-- but by a user-requested visual/UX review agent that happened to let a
-- real auction's own clock expire naturally instead of force-settling it
-- or having every seat explicitly Pass.
--
-- Lineage: 0069 originally defined city_settle_auction(p_match_id uuid,
-- p_force boolean default false) as the ONLY signature -- fine on its own.
-- 0071 (the original 8-round fix phase's authorization-guards round, long
-- before BUG-007) then added a genuinely separate 1-arg public shell,
-- city_settle_auction(p_match_id uuid) -- CREATE OR REPLACE with a
-- DIFFERENT parameter list creates a new overload rather than replacing
-- the old one (the same overload trap this session has hit and guarded
-- against before, via META-OVERLOAD-GRANTS -- but that check only looks
-- for a grant-hygiene mismatch between overloads, not for this: two
-- overloads whose CALL SIGNATURES collide because of a default parameter).
-- 0071's shell does everything right -- authenticates, checks room
-- membership, then delegates to the 2-arg version with force=false
-- explicit -- and correctly revokes the 2-arg version from every client
-- role, leaving the 1-arg shell as the sole public entry point. What it
-- never did, because the 2-arg version's default predates it, is remove
-- that default -- so the 2-arg version stayed independently callable with
-- just p_match_id too. Every later redefinition (0085, 0090) kept the
-- default without anyone noticing, since neither round ever needed to
-- touch this specific parameter.
--
-- The result: any call supplying only p_match_id -- which is exactly what
-- the real client does (use-city-match.ts's settleAuction():
-- `supabase.rpc("city_settle_auction", { p_match_id: id })`) -- has been
-- genuinely ambiguous between the two overloads since 0071 first shipped,
-- for every role including `authenticated` (confirmed directly, not just
-- as postgres): `ERROR: function city_settle_auction(uuid) is not
-- unique`. Postgres resolves function overloads before checking
-- privileges, so the 2-arg version being revoked from anon/authenticated
-- never mattered -- the ambiguity error fires regardless of who calls it.
--
-- Client impact, confirmed by reading the exact call site: settleAuction()
-- destructures the RPC error and does nothing with it on failure --
-- `if (!e) await refetch();` -- no toast, no console log, no retry. Every
-- real auction that resolves via its own natural clock (the per-bid 10s
-- reset or the 2-minute hard cap) rather than every seat explicitly
-- clicking Pass (which settles through a different, unambiguous internal
-- 2-arg call inside city_pass_auction) has been silently hanging on
-- "closing…" forever, for every match ever played against migrations
-- 0071 and later -- local only; this was never in production, since these
-- migrations were never deployed there. Not caught in 55 SQL assertions or
-- 14 live Playwright specs across two audit passes because every one of
-- them either force-settled directly with two explicit arguments, or had
-- every seat explicitly Pass -- neither path ever exercises the real
-- 1-arg client call this bug lives in.
--
-- Fix: drop the default from the 2-arg version. 0071's shell already
-- passes force explicitly; city_pass_auction (0069/0089) already passes it
-- explicitly too. No caller anywhere in this codebase relies on the
-- default. Once removed, a 1-arg call can only ever resolve to 0071's
-- shell -- the ambiguity cannot recur. Postgres refuses to drop a
-- parameter default via CREATE OR REPLACE (`cannot remove parameter
-- defaults from existing function`) -- an explicit DROP first is required;
-- safe here since the very next statement recreates the identical
-- overload identity (same name, same two parameter types) with the same
-- body, so nothing that depends on this signature existing is left
-- without it even transiently within the migration.
drop function if exists public.city_settle_auction(uuid, boolean);

create or replace function public.city_settle_auction(
  p_match_id uuid, p_force boolean
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

revoke all on function public.city_settle_auction(uuid, boolean) from public, anon, authenticated;
