-- Spintra City — Round 7 of the QA audit's fix phase: closes BUG-022,
-- BUG-030 and the pace_seconds half of BUG-033. Migrations are append-only.
--
-- Note on BUG-028, deliberately NOT touched here: re-checked against
-- DESIGN.md §3.2B before writing anything, and found "Decision: unlimited
-- buildings in v1" stated explicitly and deliberately — the nullable
-- `building_supply_limit` column is disclosed there as schema-only
-- groundwork for a *future*, deliberate scarcity decision ("needs a
-- deliberate call, not a default"), not something meant to be enforced now.
-- There is also no path anywhere in this codebase — client or RPC — that
-- ever sets it away from its default of NULL. The audit's repro required
-- manually writing a non-null value directly into the database, a state no
-- real game ever reaches. This is the same shape of finding the
-- independent re-verification pass (§1a) already corrected for BUG-018/020/
-- 027: a real behavior, but not a defect relative to the actual documented
-- design. Recorded as a report correction, not a code change.
--
-- BUG-030: `city_mortgage` computed `v_space.price / 2` as integer division
-- (Porto 55 -> 27, discarding the .5), and `city_unmortgage`'s own `ceil(
-- (v_space.price / 2) * 1.1)` had the identical truncation baked into its
-- *input*, before its own rounding ever ran (Porto: ceil(27 * 1.1) = 30,
-- not the mathematically correct ceil(27.5 * 1.1) = 31 -- a second,
-- compounding instance of the same bug the audit didn't separately name).
-- Both now divide as `numeric` (`/ 2.0`) before rounding: `round()` for the
-- mortgage payout (no stated rounding direction in CONTENT.md's "50% of
-- listed price", so nearest is the least biased choice) and the existing
-- `ceil()` left as the outer, final step for the unmortgage cost, now
-- operating on the correct fractional intermediate value.
--
-- BUG-022 / FR-38: `check_room_limit_before_join` counts every online
-- `room_participants` row against `rooms.max_participants` with no
-- exception, but FR-38 (MUST, and SPEC.md's own R-10 finding predates this
-- audit) requires spectators not be silently capped by room size — an
-- 8-seat match in the default 10-capacity room admits only 2 spectators
-- before the room reads "full" to everyone else, including people who only
-- want to watch. A first draft tried counting only already-*seated*
-- existing participants against the cap -- wrong, worked out by hand
-- before applying it: the trigger fires at room-join time, before anyone
-- has taken a city seat (seating is a separate later RPC), so it can only
-- ever see *existing* members' seated status, never the incoming joiner's
-- own future intent -- a room already at "2 seated players" would still
-- reject a 3rd, purely-spectating joiner exactly as before, since the
-- existing two still count. FR-38 says spectators need to bypass the
-- capacity check, not be counted more narrowly, so the actual fix is
-- simpler: `type = 'city'` rooms skip this trigger's capacity enforcement
-- entirely. Match seats already carry their own independent, unrelated
-- 8-seat cap (`city_join_seat`), so this cannot let more than 8 players in
-- regardless; it only stops room size from also gating spectators, which
-- is exactly what FR-38 asks for. Every other room type's capacity check
-- is byte-for-byte unchanged.
--
-- BUG-033 (pace_seconds half; FR-42, SHOULD): `pace_seconds` had no
-- client-reachable path at all -- every match was created at the column
-- default (40) with zero host control. Adds an optional, defaulted
-- `p_pace_seconds` parameter to `city_create_match`, validated against the
-- same `{25, 40, 60}` set the column's own CHECK constraint already
-- enforces (so an invalid value fails with a named CITY_* code instead of a
-- raw constraint violation). FR-42 also requires it to be chosen "in the
-- City match lobby at match creation... not in RoomSettingsPanel" and to
-- lock at match start alongside the roster -- both already true structurally:
-- there is no RoomSettingsPanel involvement here at all, and pace_seconds is
-- only ever written by this one INSERT, never touched again after a match
-- exists. The spectator-conversion half of BUG-033 (FR-36) is a client-only
-- fix, in the same round's other migration-free changes.

create or replace function public.city_mortgage(p_match_id uuid, p_space_idx integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_me public.city_match_players;
  v_space public.city_board_spaces;
  v_asset public.city_assets;
  v_value integer;
begin
  perform public.city_rate_limit_check(
    (select room_code from public.city_matches where id = p_match_id), auth.uid()::text);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text,
    p_allow_off_turn_debt => true);

  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;
  if v_asset.id is null or v_asset.owner_seat <> v_me.seat then
    raise exception 'CITY_NOT_YOURS';
  end if;
  if v_asset.is_mortgaged then
    raise exception 'CITY_ALREADY_MORTGAGED';
  end if;
  if v_asset.buildings > 0 then
    raise exception 'CITY_SELL_BUILDINGS_FIRST';
  end if;

  v_value := round(v_space.price / 2.0)::integer;
  update public.city_assets set is_mortgaged = true where id = v_asset.id;
  update public.city_match_players set cash = cash + v_value where id = v_me.id;
  perform public.city_try_settle_debt(p_match_id, v_me.seat);

  return jsonb_build_object('space', p_space_idx, 'raised', v_value);
end;
$$;

create or replace function public.city_unmortgage(p_match_id uuid, p_space_idx integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_me public.city_match_players;
  v_space public.city_board_spaces;
  v_asset public.city_assets;
  v_cost integer;
begin
  perform public.city_rate_limit_check(
    (select room_code from public.city_matches where id = p_match_id), auth.uid()::text);
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  v_me := public.city_assert_can_manage(p_match_id, auth.uid()::text);

  if v_me.pending_debt > 0 then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;

  select * into v_space from public.city_board_spaces where idx = p_space_idx;
  select * into v_asset from public.city_assets
   where match_id = p_match_id and space_idx = p_space_idx;
  if v_asset.id is null or v_asset.owner_seat <> v_me.seat then
    raise exception 'CITY_NOT_YOURS';
  end if;
  if not v_asset.is_mortgaged then
    raise exception 'CITY_NOT_MORTGAGED';
  end if;

  -- mortgage value plus 10% interest (CONTENT.md §4) -- divides as numeric
  -- now, so the 10% is computed on the true half-price, not an
  -- already-truncated integer.
  v_cost := ceil((v_space.price / 2.0) * 1.1)::integer;
  if v_me.cash < v_cost then
    raise exception 'CITY_INSUFFICIENT_FUNDS';
  end if;

  update public.city_assets set is_mortgaged = false where id = v_asset.id;
  update public.city_match_players set cash = cash - v_cost where id = v_me.id;

  return jsonb_build_object('space', p_space_idx, 'cost', v_cost);
end;
$$;

create or replace function public.check_room_limit_before_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  max_limit integer;
  room_type text;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.room_id, 0));

  select max_participants, type into max_limit, room_type
    from public.rooms where code = new.room_id;

  if max_limit is null then
    return new;
  end if;

  -- FR-38: a City room's capacity has no remaining job to do -- match
  -- seats already carry their own independent, unrelated 8-seat cap
  -- (city_join_seat) -- so it must not also gate spectators.
  if room_type = 'city' then
    return new;
  end if;

  select count(*) into current_count
    from public.room_participants
   where room_id = new.room_id and is_online = true and user_id <> new.user_id;

  if current_count >= max_limit then
    raise exception 'This room has reached its maximum participant limit of %', max_limit;
  end if;

  return new;
end;
$$;

drop function if exists public.city_create_match(text, text, integer, bigint);

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
  perform pg_advisory_xact_lock(hashtextextended(p_room_code, 0));

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

grant execute on function public.city_create_match(text, text, integer, bigint, integer)
  to anon, authenticated;
