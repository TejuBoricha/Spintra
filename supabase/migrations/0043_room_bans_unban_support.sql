-- Migration 0043: Unban UI — host-scoped select/delete + username snapshot
--
-- Session 47: closes the gap the Session 45 audit explicitly deferred ("kick
-- has zero confirmation and no unban path... host-facing unban list
-- intentionally left out of this pass" — docs/TASKS.md). A host could ban a
-- participant (kick, migration 0012) but had no way to view or reverse it.
-- Three gaps closed here:
--
-- 1. No select policy let a host see the room's OWN ban list at all —
--    migration 0013 only lets a user check whether *they themselves* are
--    banned (`user_id = auth.uid()`), never the room's list of who's
--    banned. Adds a host-scoped select policy alongside (not replacing)
--    0013's self-select policy.
-- 2. No delete policy existed on room_bans at all — reversing a ban was
--    impossible from the client no matter who was asking.
-- 3. No username on room_bans — a banned user's room_participants row is
--    deleted at kick time (see handleKickParticipant /
--    confirmKickReportedUser), so there was no way to show "who is this
--    ban for" by name in a list. Nullable username column, captured
--    client-side at insert time (both call sites already have the banned
--    user's username in scope), best-effort backfilled for existing rows
--    via the same room_participants join migration 0040 used for the
--    identical chat_messages problem — only recovers a username if that
--    user_id still happens to have some room_participants row elsewhere;
--    the client falls back to "Unknown user" when null.
-- 4. room_bans was never added to the supabase_realtime publication (unlike
--    message_reports, migration 0018) — found live while manually testing
--    the new unban panel: the RLS policies above and the REST API both
--    confirmed correct (a direct authenticated REST call returned the row
--    fine), but the panel's postgres_changes subscription never fired a
--    single event for a fresh ban, silently leaving its list stale. Tables
--    not in this publication never stream postgres_changes at all — no
--    error, just no delivery — which is exactly why this stayed invisible
--    until something actually needed live updates on this table.

alter table public.room_bans
  add column if not exists username text;

alter table public.room_bans
  drop constraint if exists room_bans_username_length;
alter table public.room_bans
  add constraint room_bans_username_length
  check (username is null or char_length(username) <= 100);

update public.room_bans rb
set username = rp.username
from public.room_participants rp
where rb.username is null
  and rb.user_id = rp.user_id
  and rp.username is not null;

-- Host-scoped select: lets a host list every ban recorded for their own
-- room. Coexists with 0013's room_bans_select_self (Postgres RLS policies
-- of the same command type are OR'd together).
drop policy if exists "room_bans_select_host" on public.room_bans;
create policy "room_bans_select_host" on public.room_bans
  for select using (
    exists (
      select 1 from public.rooms
      where code = room_id and host_id = (select auth.uid())::text
    )
  );

-- Host-scoped delete: reversing a ban. Same host-verification shape as
-- 0012's insert policy — only the room's actual current host may delete.
drop policy if exists "room_bans_delete_host_only" on public.room_bans;
create policy "room_bans_delete_host_only" on public.room_bans
  for delete using (
    exists (
      select 1 from public.rooms
      where code = room_id and host_id = (select auth.uid())::text
    )
  );

alter publication supabase_realtime add table public.room_bans;
