-- Migration 0040: chat_messages username snapshot
--
-- Session 45 audit finding: departed/kicked users' historical chat always
-- displays as "Guest" — use-room-chat.ts's loadMessages()/loadOlderMessages()
-- never fetched a username at all, hardcoding "Guest" for anyone who isn't
-- the current viewer. There was no username column on chat_messages to
-- fetch in the first place; the only source (room_participants) doesn't
-- have a row anymore for a kicked user (deleted) and isn't guaranteed to
-- still exist for anyone who simply left, so joining at read time can never
-- fully solve this — the username has to be captured at send time instead.
--
-- Bound matches room_participants.username's existing <=100 check
-- (migration 0034) for consistency; nullable so old rows (sent before this
-- column existed) don't need a synthetic value.
alter table public.chat_messages
  add column if not exists username text;

alter table public.chat_messages
  drop constraint if exists chat_messages_username_length;
alter table public.chat_messages
  add constraint chat_messages_username_length
  check (username is null or char_length(username) <= 100);

-- Best-effort backfill: for any existing message whose author is still a
-- participant in that room (even offline), recover their current username
-- retroactively. Can't help messages from users who already left/were
-- kicked (no room_participants row left to join against) — those keep
-- falling back to "Guest" client-side, same as before this migration.
update public.chat_messages cm
set username = rp.username
from public.room_participants rp
where cm.username is null
  and cm.user_id = rp.user_id
  and cm.room_id = rp.room_id
  and rp.username is not null;
