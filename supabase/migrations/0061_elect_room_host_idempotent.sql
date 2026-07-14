-- Migration 0061: elect_room_host is serialized and idempotent
--
-- Found via a live repro with two real participants: the promoted client
-- saw "You are now the host." toast three times stacked on screen, AND —
-- more seriously — the other client's screen showed a *different* user as
-- host. Two distinct bugs, both in this function.
--
-- Bug 1 — no idempotency guard. Client-side, electHostIfNeeded() is called
-- from 5 separate event handlers (presence sync, postgres_changes on
-- rooms/room_participants, and a reconnect timeout) — see
-- src/app/room/[code]/hooks/use-room-subscription.ts. Several can fire in
-- the same tick, each reading a stale (pre-promotion) local participants
-- snapshot, so each independently calls this RPC. elect_room_host (0046,
-- demotion added in 0056) only checked for an online host who ISN'T the
-- caller (`user_id <> p_user_id`) — once the caller was already promoted,
-- that check found no "other" host, so the function fell through, re-ran
-- the now-no-op updates, and returned true again every time. The client
-- only skips its toast/notification/broadcast when the RPC returns false,
-- so every redundant call re-fired the full promotion UX.
--
-- Bug 2 — no concurrency control (the more serious one). This function did
-- all of its reads and writes with no locking. Two clients calling it for
-- the same room at nearly the same moment (e.g. both reconnecting after a
-- dropped connection, both hitting "no online host" in the same window) can
-- interleave: both transactions read "no online host" before either
-- commits, both proceed to promote themselves, and neither's demote step
-- touches the other (each only demotes rows that were ALREADY role='host'
-- at that transaction's read time — not each other, since neither has
-- committed yet). Result: two room_participants rows end up role='host'
-- simultaneously — a genuine split-brain, matching the exact symptom
-- already flagged in a use-room-subscription.ts comment ("observed live:
-- two participants both ending up with role='host' for the same room").
-- rooms.host_id ends up as whichever transaction committed last, so
-- different clients can disagree about who the host even is.
--
-- Fix for both: acquire a transaction-scoped advisory lock keyed by the
-- room code before doing anything else. This fully serializes concurrent
-- election attempts for the same room — a second concurrent caller blocks
-- until the first transaction commits, then re-reads fresh state and
-- correctly no-ops via the new idempotency check (bug 1's fix) instead of
-- racing past it. Every other line is unchanged from 0056.

create or replace function public.elect_room_host(p_room_code text, p_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_exists boolean;
  v_current_host_id text;
  v_has_online_host boolean;
begin
  -- 0. Serialize concurrent election attempts for this room. Transaction-
  --    scoped: automatically released on commit or rollback, so a second
  --    concurrent caller simply blocks here until the first finishes, then
  --    proceeds with fresh (post-commit) data — no split-brain possible.
  perform pg_advisory_xact_lock(hashtext(p_room_code));

  -- 1. Verify the room exists, and grab its current host in the same read.
  select host_id into v_current_host_id
  from public.rooms
  where code = p_room_code;

  v_room_exists := found;
  if not v_room_exists then
    return false;
  end if;

  -- 1b. Caller is already the host — nothing to do. Prevents redundant
  --     re-election (and the resulting duplicate toasts/broadcasts) when
  --     multiple client-side triggers race to call this RPC after the
  --     caller has already been promoted.
  if v_current_host_id = p_user_id then
    return false;
  end if;

  -- 2. Verify there is no other online host currently in the room
  select exists(
    select 1 from public.room_participants
    where room_id = p_room_code
      and role = 'host'
      and is_online = true
      and user_id <> p_user_id
  ) into v_has_online_host;

  if v_has_online_host then
    return false;
  end if;

  -- 3. Demote the previous host's stale row(s) — transaction-local flag lets
  --    this one cross-row role change through trg_restrict_host_participant_update.
  perform set_config('app.electing_room_host', 'true', true);
  update public.room_participants
  set role = 'participant'
  where room_id = p_room_code and role = 'host' and user_id <> p_user_id;

  -- 4. Update the participant's role to host
  update public.room_participants
  set role = 'host'
  where room_id = p_room_code and user_id = p_user_id;

  -- 5. Update the room's host reference
  update public.rooms
  set host_id = p_user_id
  where code = p_room_code;

  return true;
end;
$$;
