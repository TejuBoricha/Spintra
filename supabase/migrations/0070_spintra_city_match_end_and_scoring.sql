-- Spintra City — Slice 7: timed mode, match end, and scoring.
-- Requirements FR-07, FR-08, FR-09, FR-39 (docs/SPINTRA_CITY_SPEC.md §7).

-- ---------------------------------------------------------------------------
-- 1. Two separate hazards on the scoring path
-- ---------------------------------------------------------------------------
-- FR-39 flagged that `award_score` (0052) ends in an `else return false`, so a
-- call with 'city' awards nothing, raises nothing, and looks healthy. Reading
-- the table turned up a *second* problem it did not predict: room_scores'
-- own CHECK allows only trivia/rps/bingo, so an insert would have thrown
-- outright rather than no-op'd.
--
-- Both are addressed by not going through `award_score` at all. Its whole
-- purpose is to re-verify a claim a client made ("I won"), and Spintra City
-- has no such claim to check — the engine decides the winner itself, so the
-- award is made from inside the engine and the client is never consulted.
alter table public.room_scores
  drop constraint if exists room_scores_activity_type_check;
alter table public.room_scores
  add constraint room_scores_activity_type_check
  check (activity_type in ('trivia', 'rps', 'bingo', 'city'));

-- ---------------------------------------------------------------------------
-- 2. Net worth (DESIGN.md §3.1H)
-- ---------------------------------------------------------------------------
-- cash + unmortgaged at full price + mortgaged at 45% + developments at full
-- build cost. Computed, never stored, except the one immutable snapshot taken
-- when a match ends (§3.1G).
create or replace function public.city_net_worth(p_match_id uuid, p_seat integer)
returns integer
security definer
set search_path = public
language sql
stable
as $$
  select (
    coalesce((select cash from public.city_match_players
               where match_id = p_match_id and seat = p_seat), 0)
    + coalesce((
        select sum(
          case when a.is_mortgaged then round(s.price * 0.45) else s.price end
          + a.buildings * coalesce(s.build_cost, 0)
        )
        from public.city_assets a
        join public.city_board_spaces s on s.idx = a.space_idx
       where a.match_id = p_match_id and a.owner_seat = p_seat), 0)
  )::integer;
$$;

-- ---------------------------------------------------------------------------
-- 3. Finishing a match
-- ---------------------------------------------------------------------------
-- One place a match can end, whatever ended it. Snapshots every seat's net
-- worth, then awards — inside the same transaction, so a finished match always
-- has its scores recorded and there is no window where one exists without the
-- other.
create or replace function public.city_finish_match(p_match_id uuid, p_reason text)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_match public.city_matches;
  v_winner integer;
  v_row record;
  -- A City match runs far longer than a Bingo round (3/15), so it is worth
  -- more — but kept in the same order of magnitude so one game cannot
  -- dominate a room's scoreboard.
  v_win_points constant integer := 10;
  v_win_xp constant integer := 50;
  v_play_points constant integer := 3;
  v_play_xp constant integer := 15;
  v_standings jsonb := '[]'::jsonb;
begin
  select * into v_match from public.city_matches where id = p_match_id;
  if v_match.id is null or v_match.status = 'finished' then
    return jsonb_build_object('finished', false);
  end if;

  -- snapshot first: awarding must not change what the recap reports
  update public.city_match_players p
     set final_net_worth = case
           when p.status in ('bankrupt', 'retired') then 0
           else public.city_net_worth(p_match_id, p.seat) end
   where p.match_id = p_match_id;

  select seat into v_winner
    from public.city_match_players
   where match_id = p_match_id
   order by (status in ('bankrupt', 'retired')), final_net_worth desc, seat
   limit 1;

  update public.city_matches
     set status = 'finished', finished_at = now(),
         phase = null, current_seat = null
   where id = p_match_id;

  -- `_record_award` writes room_participants.xp, and `restrict_host_participant_update`
  -- refuses one participant editing another's row — so awarding XP to everyone
  -- else fails from whichever client happened to end the turn. `award_score`
  -- sets the same two flags for the same reason (0052). Transaction-local, so
  -- the bypass cannot leak past this statement.
  perform set_config('app.bypass_participant_rate_limit', 'true', true);
  perform set_config('app.bypass_participant_restriction', 'true', true);

  -- Awarded straight from engine state. `_record_award` is idempotent on its
  -- unique key, so a retry cannot double-pay.
  for v_row in
    select seat, user_id, final_net_worth, status
      from public.city_match_players where match_id = p_match_id order by seat
  loop
    perform public._record_award(
      v_match.room_code, v_row.user_id, 'city',
      case when v_row.seat = v_winner then 'win' else 'participation' end,
      p_match_id::text,
      case when v_row.seat = v_winner then v_win_points else v_play_points end,
      case when v_row.seat = v_winner then v_win_xp else v_play_xp end);

    v_standings := v_standings || jsonb_build_object(
      'seat', v_row.seat, 'net_worth', v_row.final_net_worth,
      'status', v_row.status, 'won', v_row.seat = v_winner);
  end loop;

  return jsonb_build_object('finished', true, 'reason', p_reason,
    'winner_seat', v_winner, 'standings', v_standings);
end;
$$;

-- Bankruptcy's own end-of-match path now routes through the same function, so
-- a classic win is scored exactly like a timed one.
create or replace function public.city_bankrupt_seat(
  p_match_id uuid, p_seat integer, p_creditor_seat integer
)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_cash integer;
  v_left integer;
begin
  select cash into v_cash from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = p_match_id and status = 'pending'
     and (from_seat = p_seat or to_seat = p_seat);

  if p_creditor_seat is null then
    delete from public.city_assets where match_id = p_match_id and owner_seat = p_seat;
  else
    update public.city_match_players
       set cash = cash + greatest(v_cash, 0)
     where match_id = p_match_id and seat = p_creditor_seat;
    update public.city_assets
       set owner_seat = p_creditor_seat
     where match_id = p_match_id and owner_seat = p_seat;
  end if;

  update public.city_match_players
     set status = 'bankrupt', cash = 0, final_net_worth = 0,
         pending_debt = 0, pending_creditor_seat = null
   where match_id = p_match_id and seat = p_seat;

  select count(*) into v_left
    from public.city_match_players
   where match_id = p_match_id and status not in ('bankrupt', 'retired');

  if v_left <= 1 then
    perform public.city_finish_match(p_match_id, 'last_player_standing');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Timed mode (FR-07)
-- ---------------------------------------------------------------------------
-- The match clock is wall-clock and never pauses for turn-clock pauses
-- (DESIGN.md §3's coverage table). On expiry the current ROUND completes, so
-- every player has had the same number of turns — ending mid-round would hand
-- an advantage to whoever happened to be early in the seat order.
create or replace function public.city_end_turn(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_next integer;
  v_again boolean := false;
  v_expired boolean := false;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;

  select * into v_match from public.city_matches where id = p_match_id;
  if not found then
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
  if not found then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.seat <> v_match.current_seat then
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
     and (from_seat = v_me.seat and created_turn < v_match.turn_number
          or expires_at <= now());

  if v_match.doubles_count between 1 and 2 and v_me.status = 'active' then
    v_again := true;
    v_next := v_me.seat;
  else
    select seat into v_next
      from public.city_match_players
     where match_id = p_match_id
       and status not in ('bankrupt', 'retired')
       and seat > v_me.seat
     order by seat limit 1;

    if v_next is null then
      select seat into v_next
        from public.city_match_players
       where match_id = p_match_id
         and status not in ('bankrupt', 'retired')
       order by seat limit 1;
    end if;
  end if;

  -- Round boundary: the seat order wrapped back to or below the seat that just
  -- played. Only then may a timed match end.
  v_expired := v_match.mode = 'timed'
    and v_match.time_limit_minutes is not null
    and now() >= v_match.started_at + make_interval(mins => v_match.time_limit_minutes)
    and not v_again
    and v_next <= v_me.seat;

  if v_expired then
    return public.city_finish_match(p_match_id, 'time_limit')
           || jsonb_build_object('next_seat', null, 'roll_again', false);
  end if;

  update public.city_matches
     set current_seat = v_next,
         phase = 'awaiting_roll',
         turn_number = turn_number + 1,
         doubles_count = case when v_again then doubles_count else 0 end,
         turn_started_at = now(),
         turn_clock_elapsed_ms = 0,
         turn_clock_paused_at = null
   where id = p_match_id;

  return jsonb_build_object('next_seat', v_next, 'roll_again', v_again);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Post-match flow (FR-09)
-- ---------------------------------------------------------------------------
-- Opening another match already works: the partial unique index only covers
-- lobby/active/paused, so a finished match does not block a new one. What did
-- not work is reading the finished one — every client query filters to those
-- same three statuses, so the recap would vanish the instant it was produced.
-- This view is the read path for a completed match.
create or replace view public.city_match_results as
  select m.id as match_id, m.room_code, m.mode, m.finished_at,
         p.seat, p.username, p.status, p.final_net_worth,
         rank() over (partition by m.id
                      order by (p.status in ('bankrupt','retired')),
                               p.final_net_worth desc, p.seat) as place
    from public.city_matches m
    join public.city_match_players p on p.match_id = m.id
   where m.status = 'finished';

grant select on public.city_match_results to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
-- city_finish_match is internal: a match ends because the rules say so, never
-- because a client asked.
revoke all on function public.city_finish_match(uuid, text) from public, anon, authenticated;
grant execute on function public.city_net_worth(uuid, integer) to anon, authenticated;
