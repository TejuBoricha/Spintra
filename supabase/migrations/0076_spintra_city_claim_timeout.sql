-- Spintra City — Slice 8e: a stalled turn can be resolved by any seated player.
--
-- Closes BUG-003 from the 2026-08-30 QA audit. Migrations are append-only.
--
-- This is NOT the turn-clock/autopilot/reconnect-grace slice (FR-25 through
-- FR-51) in full — that is a genuinely multi-day feature (per-phase autopilot
-- intelligence, a reconnect grace period distinct from a stalled clock, bounded
-- sub-clocks for every paused context, host-selected pace presets) and is not
-- something to build honestly in one sitting. What ships here is the escape
-- hatch the audit's finding was actually about: "no client-callable routine
-- can resolve a stalled turn." A departed player is already handled — 0074's
-- kick/leave trigger retires their seat. This handles the other case: a
-- player still in the room, but silent.
--
-- FR-41 names three valid neutral defaults for a clock expiry: "auto-roll,
-- decline-to-auction, end-turn." This ships exactly one of them, uniformly,
-- for every phase: **end-turn**. It deliberately does not auto-roll on the
-- stalled player's behalf (deriving dice and resolving landing/cards/rent
-- under someone else's identity is materially riskier and bigger than this
-- fix), and it does not force-open an auction for a lapsed purchase decision
-- (the property simply stays unowned, exactly as if nobody had landed there
-- yet — the next visitor gets the normal buy-or-decline choice). Both are
-- honest, disclosed scope reductions, not oversights.
--
-- The one case "just end the turn" cannot honestly cover is an unresolved
-- debt: city_end_turn already refuses to end a turn while pending_debt > 0,
-- and there is no existing "skip a debt" mechanism to invent one of here.
-- The existing, precedent-consistent answer for a debt nobody resolves is
-- bankruptcy (city_declare_bankruptcy's own path, mechanically identical).

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

  -- Any SEATED player may claim a genuinely expired clock — not just the
  -- table's other survivor, and not a spectator. Matches every other command
  -- RPC's authorization shape; there is no reason to make this one narrower.
  select * into v_caller from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_caller.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;

  if v_match.current_seat is null then
    raise exception 'CITY_NO_ACTIVE_TURN';
  end if;

  -- Auctions run their own independent clock (ends_at / hard_ends_at) and
  -- their own settle path; the match turn clock is correctly paused for one
  -- (0069's city_decline_purchase sets turn_clock_paused_at, city_settle_auction
  -- clears it). Never trust turn_clock_paused_at's absence to mean "running" —
  -- check the phase too, defensively, in case a future path pauses without it.
  if v_match.phase = 'auction' or v_match.turn_clock_paused_at is not null then
    raise exception 'CITY_TURN_CLOCK_PAUSED';
  end if;

  -- FR-45: the expiry is re-derived server-side, never trusted from the
  -- caller. turn_clock_elapsed_ms is not consulted here — nothing in the
  -- engine has ever accumulated it across a pause/resume cycle (it is only
  -- ever reset to 0 alongside turn_started_at), so treating it as always-zero
  -- is not a simplification, it is simply what the stored data means today.
  v_deadline := v_match.turn_started_at + make_interval(secs => v_match.pace_seconds);
  if now() < v_deadline then
    raise exception 'CITY_TURN_CLOCK_STILL_RUNNING';
  end if;

  select * into v_stalled from public.city_match_players
   where match_id = p_match_id and seat = v_match.current_seat;

  if v_stalled.pending_debt > 0 then
    -- No "skip a debt" mechanism exists anywhere in the engine to invent one
    -- here. An unresolved debt nobody will settle is, by the existing rules,
    -- indistinguishable from an unpayable one.
    perform public.city_bankrupt_seat(p_match_id, v_stalled.seat, v_stalled.pending_creditor_seat);
    v_result := jsonb_build_object('resolution', 'bankrupt', 'seat', v_stalled.seat);
  else
    -- End-turn, uniformly, regardless of which phase the stall happened in.
    -- A lapsed buy-or-decline simply leaves the space unowned for the next
    -- visitor; nothing else needs undoing since no command actually ran.
    select seat into v_next
      from public.city_match_players
     where match_id = p_match_id
       and status not in ('bankrupt', 'retired')
       and seat > v_stalled.seat
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
           turn_started_at = now(),
           turn_clock_elapsed_ms = 0,
           turn_clock_paused_at = null
     where id = p_match_id;

    v_result := jsonb_build_object('resolution', 'end_turn', 'seat', v_stalled.seat, 'next_seat', v_next);
  end if;

  return v_result;
end;
$fn$;

grant execute on function public.city_claim_timeout(uuid) to anon, authenticated;
