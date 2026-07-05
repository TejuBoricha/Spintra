-- Migration 0024: Fix "infinite recursion detected in policy for relation room_participants"
--
-- Found live while functionally verifying the Session 41 production-
-- readiness audit fixes: migration 0019's `participants_update` policy
-- directly self-references `room_participants` in its own USING/WITH CHECK
-- clause:
--
--   exists (select 1 from public.room_participants rp
--           where rp.room_id = room_participants.room_id
--             and rp.user_id = auth.uid()::text)
--
-- Postgres does not allow a policy on table X to query table X directly
-- within its own definition — it rejects every UPDATE on room_participants
-- with "infinite recursion detected in policy for relation
-- room_participants" (a real, currently-live 500 error, not a hypothetical).
-- This breaks reconnects, presence sync, and host election — anything that
-- updates a room_participants row. Migration 0009 already solved this exact
-- problem correctly with `is_member_of_room()`, a SECURITY DEFINER function
-- that bypasses RLS on its internal query instead of inlining a raw
-- self-referencing subquery — 0019 just didn't reuse it. This migration
-- swaps in that same safe helper with identical semantics.

drop policy if exists "participants_update" on public.room_participants;
create policy "participants_update" on public.room_participants
  for update using (
    user_id = auth.uid()::text
    or exists (
      select 1 from public.rooms
      where code = room_id and host_id = auth.uid()::text
    )
    or public.is_member_of_room(room_id, auth.uid()::text)
  ) with check (
    user_id = auth.uid()::text
    or exists (
      select 1 from public.rooms
      where code = room_id and host_id = auth.uid()::text
    )
    or public.is_member_of_room(room_id, auth.uid()::text)
  );
