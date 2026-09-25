-- Spintra City — Slice 8c: a departed player's seat is retired, not stranded.
--
-- Closes BUG-001 from the 2026-08-30 QA audit. Migrations are append-only.
--
-- Root cause: nothing ever reacted to a room_participants row disappearing.
-- Kicking a player mid-match (via the pre-existing, game-agnostic
-- `moderation_kick_ban`) deleted their room membership but left their
-- `city_match_players` row `status = 'active'`, and if it was their turn,
-- `current_seat` kept pointing at them. Every other seated player then got
-- `CITY_NOT_YOUR_TURN` on every command, because BUG-002's fix (0071) now
-- correctly requires room membership to act — nobody could act on the departed
-- seat's behalf either. No client-callable routine could recover the match: a
-- new match refused with `CITY_MATCH_ALREADY_EXISTS`, deleting the room refused
-- with `ROOM_HAS_LIVE_MATCH`. The room was unusable for 24 hours, until
-- `cleanup_inactive_rooms` force-deleted it.
--
-- This intentionally does NOT build the turn-clock / autopilot / reconnect
-- grace period slice (FR-25 through FR-33, FR-41 through FR-51 — BUG-003,
-- BUG-006, BUG-007). Those handle a player going quiet while still a room
-- member. This handles the narrower, already-decided case: the player is
-- GONE from the room, by their own choice or the host's, so there is nothing
-- to wait for — retiring immediately is correct, not merely expedient.

-- ---------------------------------------------------------------------------
-- 1. Retiring a seat: same liquidation as bankruptcy-to-the-bank, different
--    status, plus handing the turn onward if it was theirs.
-- ---------------------------------------------------------------------------
-- Internal only — never a client command. It fires from the trigger below,
-- which is the sole caller, so there is no auth check of its own: whoever
-- deleted the room_participants row already went through the room's own
-- authorization (moderation_kick_ban is host-only; a self-delete is the
-- player's own row).
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
  -- Only an active match has a turn to hand off or a table to keep upright.
  if v_match.id is null or v_match.status <> 'active' then
    return;
  end if;

  select * into v_me from public.city_match_players
   where match_id = p_match_id and seat = p_seat;
  -- Already terminal (bankrupt, or retired by an earlier call) — nothing to do.
  -- Guards against a kick racing a bankruptcy on the same seat.
  if v_me.id is null or v_me.status not in ('seated', 'active') then
    return;
  end if;

  update public.city_trade_offers
     set status = 'expired', resolved_at = now()
   where match_id = p_match_id and status = 'pending'
     and (from_seat = p_seat or to_seat = p_seat);

  -- Assets return to the bank outright, exactly as city_bankrupt_seat's
  -- bank branch already does — there is no creditor for a voluntary or
  -- moderator-driven departure, only a debt the game forgives by removing
  -- the player from it entirely.
  delete from public.city_assets where match_id = p_match_id and owner_seat = p_seat;

  update public.city_match_players
     set status = 'retired', cash = 0, final_net_worth = 0,
         pending_debt = 0, pending_creditor_seat = null
   where match_id = p_match_id and seat = p_seat;

  -- If the turn was theirs, hand it onward using city_end_turn's own
  -- next-seat search — wrap to the lowest remaining active seat past the end.
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

-- ---------------------------------------------------------------------------
-- 2. Fire it the moment a room_participants row disappears.
-- ---------------------------------------------------------------------------
-- A trigger on the table, not a change inside moderation_kick_ban: this way it
-- covers every departure path — a kick, a ban, and any future "leave room"
-- flow — without City-specific knowledge leaking into the game-agnostic
-- moderation routine. `room_participants.room_id` is in fact the room CODE,
-- matching `city_matches.room_code` (see moderation_kick_ban's own usage).
--
-- Room deletion is not a concern here: `prevent_room_delete_with_live_match`
-- (0063) already refuses to delete a room with a live City match, so this
-- trigger never races a cascading delete of the match it is about to look up.
create or replace function public.city_retire_seat_on_departure()
returns trigger
security definer
set search_path = public
language plpgsql as $fn$
declare
  v_match_id uuid;
  v_seat integer;
begin
  select m.id, p.seat into v_match_id, v_seat
    from public.city_matches m
    join public.city_match_players p on p.match_id = m.id
   where m.room_code = old.room_id
     and m.status = 'active'
     and p.user_id = old.user_id;

  if v_match_id is not null then
    perform public.city_retire_seat(v_match_id, v_seat);
  end if;

  return old;
end;
$fn$;

-- Postgres refuses to invoke a trigger function outside trigger context
-- ("trigger functions can only be called as triggers"), so this grant is not
-- independently exploitable — but it is unearned all the same: new functions
-- get PUBLIC execute by default, and this one only exists to be fired by the
-- trigger below, never called directly.
revoke all on function public.city_retire_seat_on_departure() from public, anon, authenticated;

drop trigger if exists city_retire_seat_on_departure on public.room_participants;

create trigger city_retire_seat_on_departure
after delete on public.room_participants
for each row
execute function public.city_retire_seat_on_departure();
