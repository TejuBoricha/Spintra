-- Spintra City — Slice 8d: a second creditor's claim is queued, not erased.
--
-- Closes BUG-044 from the 2026-08-30 QA audit. Migrations are append-only.
--
-- `city_charge` unconditionally overwrote `pending_debt` / `pending_creditor_seat`:
--
--   update public.city_match_players
--      set pending_debt = p_amount, pending_creditor_seat = p_creditor_seat
--    where id = v_me.id;
--
-- so a second charge landing before the first was settled replaced the first
-- creditor's claim outright — 50 owed to seat 1 silently became 40 owed to
-- seat 2, and seat 1 was simply never paid.
--
-- Deliberately NOT a rewrite of `pending_debt` into a full multi-row ledger.
-- That column is read and written in 15+ places across eight migrations —
-- every `CITY_SETTLE_DEBT_FIRST` guard, the client's holdings panel, 0072's
-- auto-settle-on-cash trigger, the bankruptcy ladder. Replacing it outright
-- would mean recreating essentially all of that surface in one migration,
-- which is exactly the unreviewable-migration risk this whole fix pass has
-- avoided (see 0071's header on the same tradeoff for city_join_seat).
--
-- Instead: `pending_debt` keeps meaning exactly what it always meant — the
-- ONE claim currently due — for the overwhelmingly common case of a single
-- outstanding debt, so every existing guard and the UI keep working
-- unmodified. A second charge arriving before the first clears is queued in
-- a new table instead of overwriting, and `city_try_settle_debt` promotes the
-- oldest queued claim into `pending_debt` the moment the current one clears.
-- Debts stacked three or more deep resolve one settlement event at a time,
-- serially — not instantly in one sweep — which is a narrower guarantee than
-- a full ledger but is sufficient to fix the actual defect: no claim is ever
-- silently lost.

-- ---------------------------------------------------------------------------
-- 1. The queue itself — server-internal, no client surface.
-- ---------------------------------------------------------------------------
-- Same shape as `city_command_attempts`: RLS on, zero policies, zero grants.
-- No client code reads this; if the UI later wants to show "2 debts pending"
-- that is a follow-up migration granting exactly what it needs, not a reason
-- to open this table now.
create table if not exists public.city_debt_queue (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.city_matches(id) on delete cascade,
  debtor_seat integer not null check (debtor_seat >= 0 and debtor_seat <= 7),
  creditor_seat integer check (creditor_seat is null or (creditor_seat >= 0 and creditor_seat <= 7)),
  amount integer not null check (amount > 0),
  queued_at timestamptz not null default now()
);

create index if not exists city_debt_queue_debtor_idx
  on public.city_debt_queue (match_id, debtor_seat, queued_at);

alter table public.city_debt_queue enable row level security;

-- ---------------------------------------------------------------------------
-- 2. A second charge queues instead of overwriting.
-- ---------------------------------------------------------------------------
-- Only the must-raise-funds branch changes. The immediate-payment branch
-- (cash already covers it) never touches pending_debt and is untouched; the
-- bankruptcy branch is untouched here too — city_bankrupt_seat (below) is
-- where a terminal seat's queued claims get cleared.
create or replace function public.city_charge(
  p_match_id uuid, p_seat integer, p_amount integer, p_creditor_seat integer
)
returns jsonb
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_me public.city_match_players;
begin
  if p_amount <= 0 then
    return jsonb_build_object('action', 'none');
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  if v_me.cash >= p_amount then
    update public.city_match_players set cash = cash - p_amount where id = v_me.id;
    if p_creditor_seat is not null then
      update public.city_match_players set cash = cash + p_amount
       where match_id = p_match_id and seat = p_creditor_seat;
    end if;
    return jsonb_build_object('action',
      case when p_creditor_seat is null then 'paid_tax' else 'paid_rent' end,
      'amount', p_amount, 'to_seat', p_creditor_seat);
  end if;

  if v_me.cash + public.city_max_liquidation(p_match_id, p_seat) >= p_amount then
    if v_me.pending_debt > 0 then
      -- A claim is already outstanding — queue this one rather than erasing it.
      insert into public.city_debt_queue (match_id, debtor_seat, creditor_seat, amount)
      values (p_match_id, p_seat, p_creditor_seat, p_amount);
    else
      update public.city_match_players
         set pending_debt = p_amount, pending_creditor_seat = p_creditor_seat
       where id = v_me.id;
    end if;
    update public.city_matches set phase = 'required_decision'
     where id = p_match_id and current_seat = p_seat;
    return jsonb_build_object('action', 'must_raise_funds', 'owed', p_amount,
      'to_seat', p_creditor_seat, 'short_by', p_amount - v_me.cash);
  end if;

  perform public.city_bankrupt_seat(p_match_id, p_seat, p_creditor_seat);
  return jsonb_build_object('action', 'bankrupt', 'owed', p_amount, 'to_seat', p_creditor_seat);
end;
$fn$;

revoke all on function public.city_charge(uuid, integer, integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Clearing the current debt promotes the next queued one.
-- ---------------------------------------------------------------------------
-- The phase update mirrors city_charge's own rule exactly: force
-- required_decision only if it is currently this seat's turn. A debt settled
-- off-turn (via 0072's auto-settle-on-cash trigger, most often) still leaves
-- the promoted debt blocking this seat's own commands via the existing
-- `pending_debt > 0` guards — it just does not interrupt whoever's turn it
-- actually is.
create or replace function public.city_try_settle_debt(p_match_id uuid, p_seat integer)
returns boolean
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_me public.city_match_players;
  v_next public.city_debt_queue;
begin
  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  if v_me.pending_debt = 0 then
    return true;
  end if;
  if v_me.cash < v_me.pending_debt then
    return false;
  end if;

  update public.city_match_players
     set cash = cash - v_me.pending_debt, pending_debt = 0, pending_creditor_seat = null
   where id = v_me.id;

  if v_me.pending_creditor_seat is not null then
    update public.city_match_players
       set cash = cash + v_me.pending_debt
     where match_id = p_match_id and seat = v_me.pending_creditor_seat;
  end if;

  select * into v_next from public.city_debt_queue
   where match_id = p_match_id and debtor_seat = p_seat
   order by queued_at asc limit 1;

  if v_next.id is not null then
    update public.city_match_players
       set pending_debt = v_next.amount, pending_creditor_seat = v_next.creditor_seat
     where id = v_me.id;
    update public.city_matches set phase = 'required_decision'
     where id = p_match_id and current_seat = p_seat;
    delete from public.city_debt_queue where id = v_next.id;
  else
    update public.city_matches set phase = 'optional_actions'
     where id = p_match_id and phase = 'required_decision';
  end if;

  return true;
end;
$fn$;

revoke all on function public.city_try_settle_debt(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. A terminal seat's queued claims are forgiven, same as its current one.
-- ---------------------------------------------------------------------------
-- city_bankrupt_seat already zeroes pending_debt for the seat going bankrupt
-- ("the game forgives it by removing the player from it entirely" — 0072's
-- header). Queued claims get the same treatment, for the same reason: there
-- is nothing left to collect from a bankrupt seat regardless of how many
-- claims were stacked up against them.
--
-- Not handled here, matching a pre-existing gap this migration does not
-- expand scope to fix: a claim where this seat was the CREDITOR (not the
-- debtor) is left as-is if that seat goes bankrupt — city_try_settle_debt's
-- own credit step already has the same gap for pending_creditor_seat.
create or replace function public.city_bankrupt_seat(
  p_match_id uuid, p_seat integer, p_creditor_seat integer
)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_cash integer;
  v_left integer;
  v_developments integer;
begin
  select cash into v_cash from public.city_match_players
   where match_id = p_match_id and seat = p_seat;

  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = p_match_id and status = 'pending'
     and (from_seat = p_seat or to_seat = p_seat);

  delete from public.city_debt_queue where match_id = p_match_id and debtor_seat = p_seat;

  if p_creditor_seat is null then
    delete from public.city_assets where match_id = p_match_id and owner_seat = p_seat;
  else
    -- Sold to the bank first, at half build cost, exactly as §3.1D requires.
    select coalesce(sum(a.buildings * (coalesce(s.build_cost, 0) / 2)), 0)
      into v_developments
      from public.city_assets a
      join public.city_board_spaces s on s.idx = a.space_idx
     where a.match_id = p_match_id and a.owner_seat = p_seat;

    update public.city_assets
       set buildings = 0
     where match_id = p_match_id and owner_seat = p_seat;

    -- The proceeds travel with the cash, and the deeds transfer bare.
    update public.city_match_players
       set cash = cash + greatest(v_cash, 0) + v_developments
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
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Same forgiveness for a seat retired by 0074's kick/leave trigger.
-- ---------------------------------------------------------------------------
create or replace function public.city_retire_seat(p_match_id uuid, p_seat integer)
returns void
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match public.city_matches;
  v_me public.city_match_players;
  v_next integer;
  v_left integer;
begin
  select * into v_match from public.city_matches where id = p_match_id;
  if v_match.id is null or v_match.status <> 'active' then
    return;
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;
  if v_me.id is null or v_me.status not in ('seated', 'active') then
    return;
  end if;

  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = p_match_id and status = 'pending'
     and (from_seat = p_seat or to_seat = p_seat);

  delete from public.city_debt_queue where match_id = p_match_id and debtor_seat = p_seat;

  delete from public.city_assets where match_id = p_match_id and owner_seat = p_seat;

  update public.city_match_players
     set status = 'retired', cash = 0, final_net_worth = 0,
         pending_debt = 0, pending_creditor_seat = null
   where match_id = p_match_id and seat = p_seat;

  if v_match.current_seat = p_seat then
    select seat into v_next
      from public.city_match_players
     where match_id = p_match_id
       and status not in ('bankrupt', 'retired')
       and seat > p_seat
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
  end if;

  select count(*) into v_left
    from public.city_match_players
   where match_id = p_match_id and status not in ('bankrupt', 'retired');

  if v_left <= 1 then
    perform public.city_finish_match(p_match_id, 'last_player_standing');
  end if;
end;
$fn$;

revoke all on function public.city_retire_seat(uuid, integer) from public, anon, authenticated;
