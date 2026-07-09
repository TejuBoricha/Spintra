-- Migration 0037: message_reports Consistency Check
--
-- Migration 0012's insert policy only verified `reporter_id = auth.uid()::text`
-- — it never checked that the reporter is actually a member of the room being
-- reported in, nor that `message_id`/`room_id`/`reported_user_id` are
-- mutually consistent (migration 0016 only added an FK requiring the message
-- to exist, not that it matches). A crafted client could submit a
-- syntactically valid report for a real message but falsely attribute it to
-- an arbitrary `reported_user_id` — which then surfaces directly in the
-- host-facing MessageReportsPanel (migration 0018) as if legitimate, a
-- framing/moderation-integrity risk found in the Session 45 audit.
--
-- Fix: tighten the WITH CHECK to also require room membership and that the
-- referenced chat_messages row genuinely belongs to the same room and was
-- authored by the reported user.

drop policy if exists "message_reports_insert" on public.message_reports;
create policy "message_reports_insert" on public.message_reports
  for insert with check (
    reporter_id = auth.uid()::text
    and public.is_member_of_room(room_id, auth.uid()::text)
    and exists (
      select 1 from public.chat_messages
      where id = message_reports.message_id
        and room_id = message_reports.room_id
        and user_id = message_reports.reported_user_id
    )
  );
