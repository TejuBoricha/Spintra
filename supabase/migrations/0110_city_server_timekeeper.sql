-- 0110: the server keeps Spintra City's clocks (audit wave 2a: C-22, Q-4).
--
-- Every City deadline (a turn's pace, the 90s debt window, the 45s
-- trade-pause escape, an auction's close) only ever happened when a browser
-- asked for it: city_claim_timeout and city_settle_auction were called by a
-- player's tab once its own clock said the deadline had passed. A tab asked
-- once, and a refusal ("still running") was treated as a harmless race and
-- never retried. So a browser whose clock ran ahead of the server's (the
-- owner's PC is 43.7s fast) asked early, was refused, and the match froze
-- until something unrelated redrew the screen; the playtest's auction sat
-- 96 seconds past its deadline. And with nobody's tab open, nothing ever
-- asked at all: matches stayed "active" for days (Q-4).
--
-- Now city_tick(), run by pg_cron every 5 seconds, closes auctions past their
-- deadline and claims every expired turn, debt window and trade pause, using
-- the same rules the players' calls use (city_claim_timeout_core, split out
-- of city_claim_timeout unchanged). Claiming a turn for a seat that is away
-- runs the existing autopilot cascade, which pauses a match whose players
-- have all gone (FR-31). Browsers still ask as a speed-up; the server makes
-- sure it happens. server_now() lets the screen show clocks in server time.

-- ---------------------------------------------------------------------------
-- 1. The timeout rules, callable by the server
-- ---------------------------------------------------------------------------

-- The body of city_claim_timeout from 0090 after its caller checks (signed
-- in, rate limit, seated). Raises the same CITY_* codes when there is nothing
-- to claim. One fix, found in review: 0090 tried the detention roll whenever
-- the stalled seat was in detention, but that roll is only legal at the start
-- of the turn (awaiting_roll). A player sent to Customs during their own roll
-- is detained with the turn still running (optional_actions); every claim
-- was refused with CITY_WRONG_PHASE and the turn never ended. Now that turn
-- ends like any other.
create or replace function public.city_claim_timeout_core(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_stalled public.city_match_players;
  v_deadline timestamptz;
  v_next integer;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_match_id::text, 0));
  select * into v_match from public.city_matches where id = p_match_id;

  if v_match.id is null then
    raise exception 'CITY_MATCH_NOT_FOUND';
  end if;

  if v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
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

      if now() < v_match.turn_started_at + make_interval(secs => v_match.pace_seconds) then
        return jsonb_build_object('resolution', 'trade_pause_resumed', 'seat', v_match.current_seat);
      end if;
    else
      raise exception 'CITY_TURN_CLOCK_PAUSED';
    end if;
  end if;

  select * into v_stalled from public.city_match_players
   where match_id = p_match_id and seat = v_match.current_seat;

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
  elsif v_stalled.in_detention and v_match.phase = 'awaiting_roll' then
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
revoke all on function public.city_claim_timeout_core(uuid) from public, anon, authenticated;

-- The autopilot resolves an away seat's turn with the same order of checks,
-- and had the same detention bug: an away seat sent to Customs mid-turn made
-- the whole cascade raise CITY_WRONG_PHASE. The body is 0090's, with the
-- detention roll limited to the start of the turn.
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

    if v_me.in_detention and v_match.phase = 'awaiting_roll' then
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

-- The players' call: the same caller checks as 0090, in the same order, then
-- the shared rules. Grants are unchanged (anon, authenticated, from 0076).
create or replace function public.city_claim_timeout(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_caller public.city_match_players;
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

  return public.city_claim_timeout_core(p_match_id);
end;
$fn$;
grant execute on function public.city_claim_timeout(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The tick (pg_cron, every 5 seconds)
-- ---------------------------------------------------------------------------

-- A match the tick can't move (an error, or a refusal other than losing a race
-- to a player's own call) is recorded here instead of disappearing into the
-- logs: one warning when it starts, a count, the latest message, and the row
-- is removed once the match moves again. "select * from city_tick_errors"
-- finds a stuck match. city_tick retries such a match once a minute rather
-- than every run, so stuck matches can't fill every run and starve the rest.
create table if not exists public.city_tick_errors (
  match_id uuid primary key references public.city_matches (id) on delete cascade,
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  failures integer not null default 1,
  last_message text not null
);
alter table public.city_tick_errors enable row level security;
revoke all on public.city_tick_errors from public, anon, authenticated;

create or replace function public._city_tick_note(p_match_id uuid, p_what text, p_message text)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_failures integer;
begin
  insert into public.city_tick_errors (match_id, last_message)
  values (p_match_id, p_what || ': ' || p_message)
  on conflict (match_id) do update
    set last_failed_at = now(),
        failures = city_tick_errors.failures + 1,
        last_message = excluded.last_message
  returning failures into v_failures;
  if v_failures = 1 then
    raise warning 'city_tick: % in match % failed: %', p_what, p_match_id, p_message;
  end if;
end;
$fn$;
revoke all on function public._city_tick_note(uuid, text, text) from public, anon, authenticated;

-- One match's due work: settle an auction past its deadline, then claim the
-- turn if its clock has run out. The pre-check mirrors
-- city_claim_timeout_core's deadline (the 90s debt window when the current
-- seat owes money, the pace otherwise, the 45s escape while a trade has the
-- clock paused), so a match isn't locked every 5 seconds for nothing; the
-- core still decides for real under the match lock.
create or replace function public.city_tick_match(p_match_id uuid)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_auction_due boolean;
  v_turn_due boolean;
  v_failed boolean := false;
begin
  select exists (
    select 1 from public.city_auctions a
    where a.match_id = p_match_id and a.status = 'running'
      and now() >= least(a.ends_at, a.hard_ends_at)
  ) into v_auction_due;

  if v_auction_due then
    begin
      perform public.city_settle_auction(p_match_id, false);
    exception when others then
      -- Losing a race (a player's call settled it first) isn't a failure.
      if sqlerrm not in ('CITY_NO_AUCTION', 'CITY_AUCTION_STILL_RUNNING') then
        perform public._city_tick_note(p_match_id, 'settling the auction', sqlerrm);
        v_failed := true;
      end if;
    end;
  end if;

  -- Only the turn half of the due check is left after the auction step
  -- (a settled auction is no longer due).
  v_turn_due := public._city_match_due(p_match_id);

  if v_turn_due then
    begin
      perform public.city_claim_timeout_core(p_match_id);
    exception when others then
      -- These mean a player's call got there first. Any other refusal of a
      -- turn the pre-check says is due means the match is stuck.
      if sqlerrm not in ('CITY_TURN_CLOCK_STILL_RUNNING', 'CITY_TURN_CLOCK_PAUSED',
                         'CITY_MATCH_NOT_ACTIVE', 'CITY_NO_ACTIVE_TURN') then
        perform public._city_tick_note(p_match_id, 'claiming the turn', sqlerrm);
        v_failed := true;
      end if;
    end;
  end if;

  if not v_failed then
    delete from public.city_tick_errors where match_id = p_match_id;
  end if;
end;
$fn$;
revoke all on function public.city_tick_match(uuid) from public, anon, authenticated;

-- The due matches, oldest deadline first, at most 25 per run. pg_cron runs
-- the whole tick in one transaction (a procedure can't commit per match
-- there), and now() is fixed for that transaction, so the run is kept to the
-- matches that actually need work: a turn clock started by the tick is then
-- at most a few milliseconds early, and each match's lock is held only that
-- long. Anything past the first 25 is picked up 5 seconds later; a match
-- that failed within the last minute waits (see city_tick_errors).
-- Whether a match has work for the tick: an auction past its deadline, or a
-- turn, debt window or trade pause that has run out. Mirrors
-- city_claim_timeout_core's deadline rules.
create or replace function public._city_match_due(p_match_id uuid)
returns boolean
security definer
set search_path = public
language sql stable as $fn$
  select coalesce((
    select m.status = 'active' and (
      exists (
        select 1 from public.city_auctions a
        where a.match_id = m.id and a.status = 'running'
          and now() >= least(a.ends_at, a.hard_ends_at)
      )
      or (m.phase is distinct from 'auction' and m.current_seat is not null and (
        case
          when m.turn_clock_paused_at is not null then
            m.trade_pause_started_at is not null
            and now() >= m.trade_pause_started_at + interval '45 seconds'
          when coalesce(p.pending_debt, 0) > 0 then
            now() >= coalesce(m.debt_started_at, m.turn_started_at) + interval '90 seconds'
          else
            m.turn_started_at is not null
            and now() >= m.turn_started_at + make_interval(secs => m.pace_seconds)
        end)))
    from public.city_matches m
    left join public.city_match_players p on p.match_id = m.id and p.seat = m.current_seat
    where m.id = p_match_id
  ), false);
$fn$;
revoke all on function public._city_match_due(uuid) from public, anon, authenticated;

-- The due matches, oldest first, skipping one that failed in the last minute.
create or replace function public._city_tick_due(p_limit integer)
returns setof uuid
security definer
set search_path = public
language sql stable as $fn$
  select m.id
  from public.city_matches m
  where m.status = 'active'
    and not exists (
      select 1 from public.city_tick_errors e
      where e.match_id = m.id and e.last_failed_at > now() - interval '1 minute'
    )
    and public._city_match_due(m.id)
  order by coalesce(m.turn_started_at, m.started_at)
  limit p_limit;
$fn$;
revoke all on function public._city_tick_due(integer) from public, anon, authenticated;

create or replace function public.city_tick()
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match_id uuid;
begin
  -- A match recorded as failing that has since moved on some other way (a
  -- player acted, it finished or paused) is no longer stuck: forget it, so
  -- the list stays accurate and a later stall warns again.
  delete from public.city_tick_errors e
  where not public._city_match_due(e.match_id);

  for v_match_id in select * from public._city_tick_due(25) loop
    perform public.city_tick_match(v_match_id);
  end loop;
end;
$fn$;
revoke all on function public.city_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'city-tick') then
    perform cron.unschedule('city-tick');
  end if;
end $$;

select cron.schedule('city-tick', '5 seconds', 'select public.city_tick()');

-- ---------------------------------------------------------------------------
-- 3. Server time for the screen's clocks
-- ---------------------------------------------------------------------------

-- The City screen measures the gap between the browser's clock and this, and
-- shows every countdown in server time, so a fast or slow computer clock
-- no longer shows 0:00 at the start of a turn.
create or replace function public.server_now()
returns timestamptz
language sql
volatile
as $$ select clock_timestamp() $$;
revoke all on function public.server_now() from public;
grant execute on function public.server_now() to anon, authenticated;
