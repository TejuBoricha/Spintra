-- Spintra City — Slice 8b: debt settlement, liquidation and bankruptcy.
--
-- Closes BUG-004, BUG-024, BUG-014 and BUG-045 from the 2026-08-30 QA audit.
-- Migrations are append-only, so each function is recreated in full.
--
-- BUG-044 (a second charge overwriting the first creditor's claim) is
-- deliberately NOT fixed here — see the note at the end. It needs a data model
-- that can hold more than one creditor, which is its own change.

-- ---------------------------------------------------------------------------
-- 1. Liquidation stops collapsing to zero (BUG-045)
-- ---------------------------------------------------------------------------
-- `build_cost` is NULL for airports and utilities, so `buildings * (build_cost
-- / 2)` evaluated to `0 * NULL` = NULL for every one of those rows. NULL then
-- poisoned the whole row's sum, the row was skipped, and a seat holding only
-- such spaces reported `coalesce(sum(NULL), 0)` = **0** — losing the mortgage
-- value of the space itself as well as the (correctly zero) development value.
--
-- This is not cosmetic. `city_max_liquidation` is what the insolvency ladder
-- consults to decide whether a player can survive a charge, so an under-report
-- declares players bankrupt who could actually have paid. A seat holding one
-- unmortgaged 190 airport reported 0 instead of 95.
--
-- `city_net_worth` (0070) already guards this with `coalesce(s.build_cost, 0)`;
-- this brings liquidation in line with it.
create or replace function public.city_max_liquidation(p_match_id uuid, p_seat integer)
returns integer
security definer
set search_path = public
language sql
stable
as $fn$
  select coalesce(sum(
    a.buildings * (coalesce(s.build_cost, 0) / 2)
    + case when a.is_mortgaged then 0 else s.price / 2 end
  ), 0)::integer
  from public.city_assets a
  join public.city_board_spaces s on s.idx = a.space_idx
  where a.match_id = p_match_id and a.owner_seat = p_seat;
$fn$;

revoke all on function public.city_max_liquidation(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. A debt settles the moment the player can pay it (BUG-004, BUG-024)
-- ---------------------------------------------------------------------------
-- `city_try_settle_debt` was already correct, but it was only ever *called*
-- from `city_mortgage` and `city_sell_building`. A player who raised the money
-- any other way — selling their last property in a trade, collecting from a
-- card, receiving rent — kept the debt with nothing left to mortgage, and then
-- every exit closed at once:
--
--   end_turn / roll_dice / build / unmortgage -> CITY_SETTLE_DEBT_FIRST
--   declare_bankruptcy                        -> CITY_CAN_PAY
--   mortgage / sell_building                  -> CITY_NOT_YOURS
--   buy / decline                             -> CITY_NOT_FOR_SALE
--
-- The audit reproduced a player holding 510 cash against a 35 debt with no
-- legal move in the game.
--
-- Six different routines raise CITY_SETTLE_DEBT_FIRST. Rather than recreate all
-- six, settlement moves to where the money actually arrives: any increase in
-- cash that covers an outstanding debt discharges it immediately. That is the
-- rule 0066 already implemented for mortgage and sale — this generalises it to
-- every inflow instead of two, so none of the six ever sees a payable debt.
create or replace function public.city_settle_debt_on_cash()
returns trigger
security definer
set search_path = public
language plpgsql as $fn$
begin
  perform public.city_try_settle_debt(new.match_id, new.seat);
  return null;
end;
$fn$;

drop trigger if exists city_settle_debt_on_cash on public.city_match_players;

-- Top-level writes only: city_try_settle_debt itself updates cash on both the
-- debtor and the creditor, and those writes must not re-enter. A creditor who
-- is also in debt settles on their own next inflow rather than cascading here,
-- which keeps this bounded and predictable.
--
-- The depth test is `= 0`, not `= 1`: a WHEN clause is evaluated BEFORE the
-- trigger is entered, so it observes the depth of the statement that fired it.
-- Inside the function body the depth is 1. Verified empirically — `= 1` here
-- silently never fires, which is exactly the kind of guard that looks correct
-- and does nothing.
create trigger city_settle_debt_on_cash
after update of cash on public.city_match_players
for each row
when (
  new.pending_debt > 0
  and new.cash >= new.pending_debt
  and pg_trigger_depth() = 0
)
execute function public.city_settle_debt_on_cash();

-- ---------------------------------------------------------------------------
-- 3. Bankruptcy sells developments to the bank before handing over (BUG-014)
-- ---------------------------------------------------------------------------
-- DESIGN.md §3.1D, verbatim: "Owed to another player: all developments are sold
-- to the bank first (half build cost), and the resulting cash plus all
-- remaining cash goes to the creditor. All properties transfer to the creditor,
-- keeping their mortgaged status."
--
-- The creditor branch never touched `buildings`, so a debtor holding a full set
-- with three houses on each handed the creditor six developed tiers for nothing
-- instead of 150 Spins and bare deeds — a swing of roughly 300 in the
-- creditor's favour. It also let a creditor hold a developed country they never
-- completed, which quietly breaks the even-build invariant.
--
-- The bank branch was already correct: it deletes the assets outright, which
-- discards developments and returns the spaces unowned.
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
-- 4. Deliberately not fixed here: BUG-044
-- ---------------------------------------------------------------------------
-- `city_charge` overwrites `pending_debt` and `pending_creditor_seat` rather
-- than accumulating, so a second charge landing before the first is settled
-- erases the first creditor's claim outright (50 owed to seat 1 replaced by 40
-- owed to seat 2, and seat 1 is simply never paid).
--
-- There is no honest minimal patch: the two columns can only describe one
-- creditor, so any in-place fix has to pick a loser. The correct shape is a
-- `city_debts` row per creditor with `pending_debt` derived from their sum,
-- which is a schema change and belongs in its own migration rather than being
-- bolted onto this one.
--
-- The auto-settlement above narrows the window considerably — a debt now clears
-- the instant the player can cover it, so debts stack far less often — but it
-- does not close the hole. BUG-044 stays open and tracked.
