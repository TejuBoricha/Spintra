-- Migration 0013: Let a client check its own ban status
--
-- Found during the pre-launch product audit: room_bans had no select policy
-- at all, so the client could never proactively check "am I banned from this
-- room?" before attempting to join. Banned users only found out via the
-- before-insert trigger's error message after the room UI had already
-- mounted and attempted to register them as a participant (a confusing
-- flash-then-kick instead of an upfront message). This adds a self-scoped
-- select policy: a user can see whether THEIR OWN id has a room_bans row for
-- a given room, and nothing else (not other users' bans, not who banned them).

drop policy if exists "room_bans_select_self" on public.room_bans;
create policy "room_bans_select_self" on public.room_bans
  for select using (user_id = auth.uid()::text);
