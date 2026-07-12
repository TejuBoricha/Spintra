-- Migration 0054: message_reports reporter_username snapshot
--
-- The Moderation Dashboard's Reports tab needs to render "X reported a
-- message from Y" without a join, but message_reports only ever stored
-- reporter_id/reported_user_id (raw ids, no display name). The reported
-- side is already solvable without a schema change — chat_messages.username
-- (migration 0040) is a permanent snapshot the dashboard's existing
-- chat_messages(content) embed can also select username from. The reporter
-- side has no equivalent existing snapshot anywhere, so it needs one here,
-- captured at report time exactly like chat_messages.username is captured
-- at send time (same rationale: a later join to room_participants can't be
-- relied on once someone leaves or is kicked).
--
-- Bound matches chat_messages.username / room_participants.username's
-- existing <=100 check for consistency; nullable so rows reported before
-- this column existed don't need a synthetic value.
alter table public.message_reports
  add column if not exists reporter_username text;

alter table public.message_reports
  drop constraint if exists message_reports_reporter_username_length;
alter table public.message_reports
  add constraint message_reports_reporter_username_length
  check (reporter_username is null or char_length(reporter_username) <= 100);

-- Best-effort backfill, same limitation as migration 0040: only recovers a
-- username for a reporter still present in room_participants at migration
-- time.
update public.message_reports mr
set reporter_username = rp.username
from public.room_participants rp
where mr.reporter_username is null
  and mr.reporter_id = rp.user_id
  and mr.room_id = rp.room_id
  and rp.username is not null;
