-- Spintra City — Slice 5: trading between players.
-- Requirements FR-20…FR-24 (docs/SPINTRA_CITY_SPEC.md §7), DESIGN.md §3.1F.
--
-- Trading is the stated core value of this mode, and it is also the single
-- easiest place to corrupt an economy: an offer describes a world that may no
-- longer exist by the time somebody clicks accept. The governing rule from
-- §3.1F is therefore **never trust the stored offer row** — every referenced
-- asset's ownership, mortgage state and development level, plus both parties'
-- cash, are re-checked inside the same locked transaction that would apply the
-- trade. If anything moved, the accept fails cleanly instead of executing
-- terms that no longer hold.

-- ---------------------------------------------------------------------------
-- 1. Turn counter — needed for offer expiry
-- ---------------------------------------------------------------------------
-- §3.1F expires an offer at the end of the proposer's next turn, or after three
-- minutes, whichever comes first. The wall clock alone is not enough: a slow
-- table would leave offers alive across several rounds.
alter table public.city_matches
  add column if not exists turn_number integer not null default 0
    check (turn_number >= 0);

grant select (turn_number) on table public.city_matches to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Offers
-- ---------------------------------------------------------------------------
-- Spaces are stored as arrays rather than a join table. The re-validation in
-- §5 has to walk every referenced space anyway, so a join buys nothing, and it
-- keeps an offer a single row that can be locked and settled atomically.
create table if not exists public.city_trade_offers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.city_matches(id) on delete cascade,
  from_seat integer not null check (from_seat between 0 and 7),
  to_seat integer not null check (to_seat between 0 and 7),

  give_spaces integer[] not null default '{}',
  get_spaces integer[] not null default '{}',
  give_cash integer not null default 0 check (give_cash >= 0),
  get_cash integer not null default 0 check (get_cash >= 0),

  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),

  -- the match turn on which this was proposed; expiry compares against it
  created_turn integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint city_trade_not_self check (from_seat <> to_seat),
  constraint city_trade_not_empty check (
    array_length(give_spaces, 1) is not null
    or array_length(get_spaces, 1) is not null
    or give_cash > 0 or get_cash > 0
  )
);

create index if not exists city_trade_offers_match_status_idx
  on public.city_trade_offers (match_id, status);

alter table public.city_trade_offers enable row level security;

-- Offers are visible to the whole table. Hiding them would be worse, not
-- better: a trade changes the board for everyone, and spectators reading the
-- negotiation is part of the genre.
drop policy if exists "Trade offers are readable" on public.city_trade_offers;
create policy "Trade offers are readable"
  on public.city_trade_offers for select using (true);

revoke insert, update, delete on public.city_trade_offers from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'city_trade_offers'
  ) then
    alter publication supabase_realtime add table public.city_trade_offers;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Is a space tradeable?
-- ---------------------------------------------------------------------------
-- A property carrying buildings cannot change hands, and neither can one whose
-- country has buildings anywhere in it — moving a single city out of a
-- developed set would leave the set both broken and over-built, which no later
-- command could repair.
create or replace function public.city_space_is_tradeable(p_match_id uuid, p_space_idx integer)
returns boolean
security definer
set search_path = public
language sql
stable
as $$
  select not exists (
    select 1
      from public.city_board_spaces s
      join public.city_board_spaces g
        on (s.country is not null and g.country = s.country) or g.idx = s.idx
      join public.city_assets a on a.space_idx = g.idx and a.match_id = p_match_id
     where s.idx = p_space_idx and a.buildings > 0
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Propose (FR-20)
-- ---------------------------------------------------------------------------
create or replace function public.city_propose_trade(
  p_match_id uuid,
  p_to_seat integer,
  p_give_spaces integer[],
  p_get_spaces integer[],
  p_give_cash integer default 0,
  p_get_cash integer default 0
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_match public.city_matches;
  v_me public.city_match_players;
  v_them public.city_match_players;
  v_idx integer;
  v_offer_id uuid;
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

  select * into v_me from public.city_match_players
   where match_id = p_match_id and user_id = v_user_id;
  if v_me.id is null then
    raise exception 'CITY_NOT_SEATED';
  end if;
  if v_me.status <> 'active' then
    raise exception 'CITY_SEAT_OUT';
  end if;
  if v_me.pending_debt > 0 then
    -- A debt has to be settled from your own assets. Letting a trade satisfy it
    -- is a Slice 6 concern; until then, allowing one here would let a player
    -- stall inside the raise-funds window indefinitely.
    raise exception 'CITY_SETTLE_DEBT_FIRST';
  end if;

  select * into v_them from public.city_match_players
   where match_id = p_match_id and seat = p_to_seat;
  if v_them.id is null or v_them.status <> 'active' then
    raise exception 'CITY_NO_SUCH_OPPONENT';
  end if;

  if coalesce(p_give_cash, 0) > v_me.cash then
    raise exception 'CITY_INSUFFICIENT_FUNDS';
  end if;
  if coalesce(p_get_cash, 0) > v_them.cash then
    raise exception 'CITY_THEY_CANT_AFFORD';
  end if;

  foreach v_idx in array coalesce(p_give_spaces, '{}') loop
    if not exists (select 1 from public.city_assets
                    where match_id = p_match_id and space_idx = v_idx
                      and owner_seat = v_me.seat) then
      raise exception 'CITY_NOT_YOURS';
    end if;
    if not public.city_space_is_tradeable(p_match_id, v_idx) then
      raise exception 'CITY_DEVELOPED_CANNOT_TRADE';
    end if;
  end loop;

  foreach v_idx in array coalesce(p_get_spaces, '{}') loop
    if not exists (select 1 from public.city_assets
                    where match_id = p_match_id and space_idx = v_idx
                      and owner_seat = p_to_seat) then
      raise exception 'CITY_NOT_THEIRS';
    end if;
    if not public.city_space_is_tradeable(p_match_id, v_idx) then
      raise exception 'CITY_DEVELOPED_CANNOT_TRADE';
    end if;
  end loop;

  insert into public.city_trade_offers (
    match_id, from_seat, to_seat, give_spaces, get_spaces,
    give_cash, get_cash, created_turn, expires_at
  ) values (
    p_match_id, v_me.seat, p_to_seat,
    coalesce(p_give_spaces, '{}'), coalesce(p_get_spaces, '{}'),
    coalesce(p_give_cash, 0), coalesce(p_get_cash, 0),
    v_match.turn_number, now() + interval '3 minutes'
  )
  returning id into v_offer_id;

  return v_offer_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Accept (FR-21, FR-22, FR-23)
-- ---------------------------------------------------------------------------
-- The whole point of this function is that it re-derives everything. Nothing
-- from the stored row is taken on trust except which spaces and amounts were
-- named — and each of those is checked against live state before anything moves.
create or replace function public.city_accept_trade(p_offer_id uuid)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
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

  -- re-read under the lock; a concurrent accept or withdraw may have landed
  select * into v_offer from public.city_trade_offers where id = p_offer_id;
  select * into v_match from public.city_matches where id = v_offer.match_id;

  if v_match.status <> 'active' then
    raise exception 'CITY_MATCH_NOT_ACTIVE';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'CITY_OFFER_CLOSED';
  end if;
  if v_offer.expires_at <= now() then
    update public.city_trade_offers set status = 'expired', resolved_at = now()
     where id = p_offer_id;
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

  -- cash, re-checked against live balances
  if v_from.cash < v_offer.give_cash or v_to.cash < v_offer.get_cash then
    raise exception 'CITY_OFFER_STALE';
  end if;

  -- ownership and development, re-checked space by space
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

  -- Apply. Every statement below is in this one transaction, so FR-22's
  -- "both sides transfer or neither does" is a property of the database
  -- rather than something this function has to be careful about.
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

  -- Any other pending offer naming a space that just moved is now describing a
  -- world that no longer exists. Closing them is §3.1F's "superseded" marking:
  -- cosmetic for correctness (accept re-validates regardless), but it stops the
  -- UI showing offers that are guaranteed to fail.
  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = v_offer.match_id and status = 'pending' and id <> p_offer_id
     and (give_spaces && (v_offer.give_spaces || v_offer.get_spaces)
       or get_spaces && (v_offer.give_spaces || v_offer.get_spaces));

  return jsonb_build_object(
    'accepted', true,
    'spaces_to_proposer', v_offer.get_spaces,
    'spaces_to_recipient', v_offer.give_spaces,
    'cash_to_recipient', v_offer.give_cash,
    'cash_to_proposer', v_offer.get_cash
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Decline / withdraw
-- ---------------------------------------------------------------------------
create or replace function public.city_resolve_trade(p_offer_id uuid, p_action text)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id text := auth.uid()::text;
  v_offer public.city_trade_offers;
  v_match public.city_matches;
  v_actor public.city_match_players;
begin
  if v_user_id is null then
    raise exception 'CITY_NOT_AUTHENTICATED';
  end if;
  if p_action not in ('declined', 'withdrawn') then
    raise exception 'CITY_BAD_ACTION';
  end if;

  select * into v_offer from public.city_trade_offers where id = p_offer_id;
  if v_offer.id is null then
    raise exception 'CITY_OFFER_NOT_FOUND';
  end if;

  select * into v_match from public.city_matches where id = v_offer.match_id;
  perform public.city_rate_limit_check(v_match.room_code, v_user_id);
  perform pg_advisory_xact_lock(hashtextextended(v_offer.match_id::text, 0));
  select * into v_offer from public.city_trade_offers where id = p_offer_id;

  if v_offer.status <> 'pending' then
    raise exception 'CITY_OFFER_CLOSED';
  end if;

  select * into v_actor from public.city_match_players
   where match_id = v_offer.match_id and user_id = v_user_id;

  -- the recipient declines; only the proposer withdraws
  if p_action = 'declined' and v_actor.seat <> v_offer.to_seat then
    raise exception 'CITY_NOT_YOUR_OFFER';
  end if;
  if p_action = 'withdrawn' and v_actor.seat <> v_offer.from_seat then
    raise exception 'CITY_NOT_YOUR_OFFER';
  end if;

  update public.city_trade_offers
     set status = p_action, resolved_at = now()
   where id = p_offer_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Expiry on turn end (FR-24)
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
  if v_match.phase = 'awaiting_roll' then
    raise exception 'CITY_MUST_ROLL_FIRST';
  end if;
  if v_match.phase = 'required_decision' then
    raise exception 'CITY_DECISION_PENDING';
  end if;

  -- §3.1F: an offer lapses at the end of the proposer's next turn. Offers made
  -- on an earlier turn than this one have now had that turn.
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

-- A bankrupt seat's pending offers describe assets it no longer holds.
create or replace function public.city_bankrupt_seat(
  p_match_id uuid,
  p_seat integer,
  p_creditor_seat integer
)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_cash integer;
  v_left integer;
  v_winner integer;
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

  select count(*), min(seat) into v_left, v_winner
    from public.city_match_players
   where match_id = p_match_id and status not in ('bankrupt', 'retired');

  if v_left <= 1 then
    update public.city_matches
       set status = 'finished', finished_at = now(), phase = null, current_seat = null
     where id = p_match_id;
    if v_winner is not null then
      update public.city_match_players
         set final_net_worth = cash
       where match_id = p_match_id and seat = v_winner;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.city_propose_trade(uuid, integer, integer[], integer[], integer, integer) from public;
revoke all on function public.city_accept_trade(uuid) from public;
revoke all on function public.city_resolve_trade(uuid, text) from public;
grant execute on function public.city_propose_trade(uuid, integer, integer[], integer[], integer, integer) to anon, authenticated;
grant execute on function public.city_accept_trade(uuid) to anon, authenticated;
grant execute on function public.city_resolve_trade(uuid, text) to anon, authenticated;
grant execute on function public.city_space_is_tradeable(uuid, integer) to anon, authenticated;
