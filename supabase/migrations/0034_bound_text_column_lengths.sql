-- Migration 0034: Bound previously-unbounded text columns
--
-- Found in the Session 43 audit re-derivation: rooms.name and
-- room_participants.username/avatar_url (migration 0001), plus
-- message_reports.reason (migration 0012), had no char_length() CHECK,
-- unlike chat_messages.content (capped at 500 since migration 0001). A
-- client could insert a multi-MB string per row — a storage-bloat nuisance
-- given rate-limited writes elsewhere, not a DoS vector, but worth closing.
-- Caps are set generously above the client's own input limits (room name
-- maxLength=60, username maxLength=15) so no legitimate existing value is
-- affected; NULL values pass a char_length() CHECK unchanged (evaluates to
-- NULL, not FALSE), so nullable columns need no extra "or is null" clause.

alter table public.rooms
  add constraint rooms_name_length check (char_length(name) <= 200);

alter table public.room_participants
  add constraint room_participants_username_length check (char_length(username) <= 100),
  add constraint room_participants_avatar_url_length check (char_length(avatar_url) <= 2048);

alter table public.message_reports
  add constraint message_reports_reason_length check (char_length(reason) <= 500);
