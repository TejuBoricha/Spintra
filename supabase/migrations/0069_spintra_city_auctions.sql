-- Spintra City — Slice 6b: auctions.
-- Requirement FR-17, DESIGN.md §3.1E. Closes the gap Slice 3 opened knowingly:
-- declining a property left it unowned because auctions had not been built.
--
-- Timing without a scheduler. An auction has a deadline, and any client that
-- sees it pass may call `city_settle_auction` — which re-derives whether the
-- deadline has actually passed rather than trusting the caller. That is the
-- same shape the turn clock is specified with (DESIGN.md §3): no cron job, no
-- background worker, and a lying client is simply refused.

-- ---------------------------------------------------------------------------
-- 1. The auction
-- ---------------------------------------------------------------------------
create table if not exists public.city_auctions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.city_matches(id) on delete cascade,
  space_idx integer not null references public.city_board_spaces(idx),

  high_bid integer not null default 0 check (high_bid >= 0),
  high_seat integer check (high_seat is null or high_seat between 0 and 7),

  -- Passing is not binding, so this is a live set rather than an audit trail:
  -- a later bid removes the bidder from it (§3.1E).
  passed_seats integer[] not null default '{}',

  status text not null default 'running'
    check (status in ('running', 'settled')),

  -- rolling anti-snipe deadline, and the hard 2-minute ceiling
  ends_at timestamptz not null,
  hard_ends_at timestamptz not null,

  created_at timestamptz not null default now(),
  settled_at timestamptz
);

-- One live auction per match. A second would mean two claims on the same turn.
create unique index if not exists city_auctions_one_running_per_match
  on public.city_auctions (match_id) where status = 'running';

alter table public.city_auctions enable row level security;
drop policy if exists "Auctions are readable" on public.city_auctions;
create policy "Auctions are readable" on public.city_auctions for select using (true);
revoke insert, update, delete on public.city_auctions from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'city_auctions'
  ) then
    alter publication supabase_realtime add table public.city_auctions;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Declining now opens the auction (FR-11's second half)
-- ---------------------------------------------------------------------------
-- Was `returns void` in 0065; it now reports whether an auction opened, and
-- CREATE OR REPLACE cannot change a return type.
drop function if exists public.city_decline_purchase(uuid);
create or replace function public.city_decline_purchase(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_space public.city_board_spaces;
  v_auction_id uuid;
  v_bidders integer;
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

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_me.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.seat <> v_match.current_seat then
    raise exception 'CITY_NOT_YOUR_TURN';
  end if;
  if v_match.phase <> 'required_decision' then
    raise exception 'CITY_NOTHING_TO_DECLINE';
  end if;

  select * into v_space from public.city_board_spaces where idx = v_me.position;
  if v_space.price is null then
    raise exception 'CITY_NOT_FOR_SALE';
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
$$;

-- ---------------------------------------------------------------------------
-- 3. Bidding (§3.1E)
-- ---------------------------------------------------------------------------
create or replace function public.city_place_bid(p_match_id uuid, p_amount integer)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_auction public.city_auctions;
  v_floor constant integer := 10;
  v_step constant integer := 10;
  v_min integer;
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

  select * into v_auction from public.city_auctions
   where match_id = p_match_id and status = 'running';
  if v_auction.id is null then
    raise exception 'CITY_NO_AUCTION';
  end if;
  if now() >= least(v_auction.ends_at, v_auction.hard_ends_at) then
    raise exception 'CITY_AUCTION_CLOSED';
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_me.id is null or v_me.status <> 'active' then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.pending_debt > 0 then
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;

  -- opening bid is the floor; after that it is the standing bid plus the step
  v_min := case when v_auction.high_seat is null then v_floor
                else v_auction.high_bid + v_step end;
  if p_amount < v_min then
    raise exception 'CITY_BID_TOO_LOW';
  end if;
  if p_amount % v_step <> 0 then
    raise exception 'CITY_BID_NOT_A_STEP';
  end if;
  -- §3.1E: no bidding on credit. Checked against live cash, not a stored value.
  if p_amount > v_me.cash then
    raise exception 'CITY_INSUFFICIENT_FUNDS';
  end if;

  update public.city_auctions
     set high_bid = p_amount,
         high_seat = v_me.seat,
         -- every bid resets the countdown to 10s, never past the hard ceiling
         ends_at = least(now() + interval '10 seconds', hard_ends_at),
         -- passing is not binding: bidding puts you back in
         passed_seats = array_remove(passed_seats, v_me.seat)
   where id = v_auction.id;

  return jsonb_build_object('high_bid', p_amount, 'high_seat', v_me.seat);
end;
$$;

create or replace function public.city_pass_auction(p_match_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
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

  -- Everyone out means there is nothing left to wait for (§3.1E's fast path).
  -- The standing high bidder is not counted: they are not waiting on anything.
  select count(*) into v_eligible from public.city_match_players
   where match_id = p_match_id and status = 'active'
     and (v_auction.high_seat is null or seat <> v_auction.high_seat);
  select count(*) into v_passed
    from unnest(v_auction.passed_seats) s
   where v_auction.high_seat is null or s <> v_auction.high_seat;

  if v_passed >= v_eligible then
    return public.city_settle_auction(p_match_id, true);
  end if;

  return jsonb_build_object('passed', true, 'waiting_on', v_eligible - v_passed);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Settling
-- ---------------------------------------------------------------------------
-- Callable by anyone, because whoever notices the clock has run out should be
-- able to move the match on. `p_force` is only ever passed by the engine's own
-- all-passed path; a client-supplied call re-derives the deadline instead.
create or replace function public.city_settle_auction(
  p_match_id uuid, p_force boolean default false
)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
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
$$;

-- ---------------------------------------------------------------------------
-- 5. An auction blocks the turn
-- ---------------------------------------------------------------------------
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
-- 6. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.city_place_bid(uuid, integer) from public;
revoke all on function public.city_pass_auction(uuid) from public;
revoke all on function public.city_settle_auction(uuid, boolean) from public;
grant execute on function public.city_place_bid(uuid, integer) to anon, authenticated;
grant execute on function public.city_pass_auction(uuid) to anon, authenticated;
grant execute on function public.city_settle_auction(uuid, boolean) to anon, authenticated;
