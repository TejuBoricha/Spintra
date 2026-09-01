-- Spintra City — Slice 8a: authorization guards.
--
-- Closes the guard cluster from the 2026-08-30 QA audit: BUG-002, BUG-008,
-- BUG-009, BUG-010 and BUG-019, plus BUG-031's NULL room_code leak as a side
-- effect. Migrations are append-only, so each function below is recreated in
-- full rather than patched in place.
--
-- The audit's root-cause finding was that `city_join_seat` is the ONLY City
-- routine that checks room membership. Every other command authorizes on seat
-- occupancy alone, so removal from the room (kick, ban, leave) never revoked
-- match authority — a kicked AND banned player was observed still rolling,
-- building, mortgaging and ending turns.
--
-- Rather than rewrite nineteen RPC bodies, the check lands in the one function
-- all nineteen already call.

-- ---------------------------------------------------------------------------
-- 1. Membership is re-verified on every command (BUG-002)
-- ---------------------------------------------------------------------------
-- `city_rate_limit_check` is called by all 19 command RPCs before they act, so
-- it is the single chokepoint where membership can be asserted once and cover
-- every one of them. Its throttling behaviour is unchanged.
--
-- The NULL room_code branch also fixes BUG-031: six routines pass a room code
-- looked up from a match that may not exist, which previously surfaced a raw
-- NOT NULL violation — dumping the failing row — instead of a CITY_* code.
create or replace function public.city_rate_limit_check(p_room_code text, p_user_id text)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_recent integer;
begin
  -- Callers look the room code up from the match; a NULL means the match id was
  -- bogus. Fail with the honest error rather than a NOT NULL violation.
  if p_room_code is null then
    raise exception 'CITY_MATCH_NOT_FOUND';
  end if;

  -- Membership is checked on every command, not only at seat time. A player
  -- kicked or banned mid-match keeps their city_match_players row until the
  -- seat is settled, so seat occupancy alone is not authorization.
  if not public.is_member_of_room(p_room_code, p_user_id) then
    raise exception 'CITY_NOT_A_MEMBER';
  end if;

  select count(*) into v_recent
  from public.city_command_attempts
  where user_id = p_user_id
    and room_code = p_room_code
    and created_at > now() - interval '60 seconds';

  if v_recent >= 60 then
    raise exception 'CITY_RATE_LIMIT: too many actions, slow down';
  end if;

  insert into public.city_command_attempts (user_id, room_code)
  values (p_user_id, p_room_code);
end;
$fn$;

revoke all on function public.city_rate_limit_check(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The auction force-settle path leaves the client surface (BUG-008)
-- ---------------------------------------------------------------------------
-- `p_force` skips BOTH the advisory lock and the deadline re-derivation. It is
-- only ever meant to be passed by the engine's own all-passed path, but it
-- carried a DEFAULT and an EXECUTE grant, so any caller could pass it — with no
-- authentication check at all. The audit settled a live auction five minutes
-- early holding nothing but the public anon key, and six concurrent forced
-- settles charged the winner six times over (1600 -> 400), destroying 1,000
-- Spins with no counterparty.
--
-- The body below is byte-identical to 0069's. Two things change around it: the
-- DEFAULT is dropped so a one-argument call can no longer resolve here, and the
-- grant is revoked. `city_pass_auction` passes both arguments explicitly and,
-- running SECURITY DEFINER as the owner, is unaffected by the revoke.
--
-- Residual, deliberately left for the auction cluster: when the winner is still
-- solvent the `on conflict do nothing` insert may transfer nothing while the
-- cash deduction still runs. BUG-009's fix below removes the only known route
-- to that state, but the settle path itself is not yet defensive about it.

-- Postgres refuses to drop a parameter default via CREATE OR REPLACE
-- ("cannot remove parameter defaults from existing function"), so the old
-- two-argument form is dropped explicitly first. plpgsql resolves callees at
-- runtime, so city_pass_auction is unaffected by the drop-and-recreate.
drop function if exists public.city_settle_auction(uuid, boolean);

create function public.city_settle_auction(p_match_id uuid, p_force boolean)
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

  -- The deadline is re-derived, never taken from the caller.
  if not p_force and now() < least(v_auction.ends_at, v_auction.hard_ends_at) then
    raise exception 'CITY_AUCTION_STILL_RUNNING';
  end if;

  select * into v_space from public.city_board_spaces where idx = v_auction.space_idx;

  if v_auction.high_seat is not null then
    select * into v_winner from public.city_match_players
     where match_id = p_match_id and seat = v_auction.high_seat;

    -- Re-checked at settle time: the winner may have spent the money on a debt
    -- while the auction ran. Falling back to "nobody wins" is the honest
    -- outcome — it is exactly §3.1E's no-bids case.
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

  -- Hand the turn back to whoever it belonged to, and resume their clock.
  update public.city_matches
     set phase = 'optional_actions', turn_clock_paused_at = null
   where id = p_match_id and phase = 'auction';

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

-- The only settle path a client may reach: never forced, and the caller must be
-- a member of the room. Clients already call this with p_match_id alone.
create or replace function public.city_settle_auction(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_room text;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;

  select room_code into v_room from public.city_matches where id = p_match_id;
  if v_room is null then
    raise exception 'CITY_MATCH_NOT_FOUND';
  end if;
  if not public.is_member_of_room(v_room, v_user_id) then
    raise exception 'CITY_NOT_A_MEMBER';
  end if;

  return public.city_settle_auction(p_match_id, false);
end;
$fn$;

grant execute on function public.city_settle_auction(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Declining is guarded on match status and on the space being unowned
-- ---------------------------------------------------------------------------
-- Two defects, both here.
--
-- BUG-010: this was the only command with no `status <> 'active'` check, and
-- `city_finish_match` sets phase and current_seat to NULL. `NULL <> 'x'` is
-- NULL rather than TRUE, so the two remaining guards silently passed and a
-- FINISHED match could still be mutated — property transferred and cash
-- deducted after final_net_worth and room_scores had been written. The
-- comparisons below are null-safe so a NULL can never wave a command through.
--
-- BUG-009: the routine only checked that the space had a price, never that it
-- was unowned. `city_charge` also sets phase = 'required_decision' for its
-- raise-funds window, so a player who landed on an OWNED property and could not
-- pay was able to "decline" it into an auction. The winner was then charged
-- while the `on conflict do nothing` insert transferred nothing — money
-- destroyed, and the auction row reporting a winner for a space it never moved.
create or replace function public.city_decline_purchase(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_space public.city_board_spaces;
  v_auction_id uuid;
  v_bidders integer;
  v_owned integer;
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

  -- BUG-010: every other command carries this check; this one did not.
  if v_match.status is distinct from 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_me.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;
  -- Null-safe: current_seat and phase are both NULL on a finished match.
  if v_me.seat is distinct from v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;
  if v_match.phase is distinct from 'required_decision' then
    raise exception 'CITY_NOTHING_TO_DECLINE';
  end if;

  select * into v_space from public.city_board_spaces where idx = v_me.position;
  if v_space.price is null then
    raise exception 'CITY_NOT_FOR_SALE';
  end if;

  -- BUG-009: an owned space is never up for auction. Reaching here with one
  -- means the required_decision phase belongs to a raise-funds window, not a
  -- purchase offer.
  select count(*) into v_owned from public.city_assets
   where match_id = p_match_id and space_idx = v_me.position;
  if v_owned > 0 then
    raise exception 'CITY_ALREADY_OWNED';
  end if;

  -- A one-player auction is not an auction. With nobody else able to bid the
  -- property simply stays unowned, which is also §3.1E's no-bids outcome.
  select count(*) into v_bidders from public.city_match_players
   where match_id = p_match_id and status = 'active' and pending_debt = 0;

  if v_bidders < 2 then
    update public.city_matches set phase = 'optional_actions' where id = p_match_id;
    return jsonb_build_object('auction', false, 'space', v_me.position);
  end if;

  insert into public.city_auctions (match_id, space_idx, ends_at, hard_ends_at)
  values (p_match_id, v_me.position, now() + interval '15 seconds',
          now() + interval '2 minutes')
  returning id into v_auction_id;

  -- The auction is a global phase: the active player's turn clock pauses for
  -- it, because every player needs time to think and none of it is their fault.
  update public.city_matches
     set phase = 'auction', turn_clock_paused_at = now()
   where id = p_match_id;

  return jsonb_build_object('auction', true, 'auction_id', v_auction_id,
    'space', v_me.position, 'price', v_space.price);
end;
$fn$;

grant execute on function public.city_decline_purchase(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Net worth and liquidation stop leaking cash to outsiders (BUG-019)
-- ---------------------------------------------------------------------------
-- Both are SECURITY DEFINER with no membership check, so a caller in no room at
-- all could read cash that RLS otherwise hides. Because `city_assets` is
-- world-readable, an outsider computes the asset term themselves and inverts
-- city_net_worth exactly to recover a seat's hidden cash.
--
-- Neither is invoked by the client (verified against src/ — only the generated
-- database.types.ts mentions them), and both are used internally by SECURITY
-- DEFINER routines that run as the owner, so revoking the client grant costs
-- nothing.
revoke all on function public.city_net_worth(uuid, integer) from public, anon, authenticated;
revoke all on function public.city_max_liquidation(uuid, integer) from public, anon, authenticated;
