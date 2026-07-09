-- Migration 0053: moderation_actions — the Moderation Dashboard's action history (ADR-010)
--
-- Context: log_moderation_event() (migration 0032) writes only to Postgres
-- server logs via RAISE LOG — never a queryable table, so no action history
-- exists today in any form the client can read. Of the two tables that ARE
-- queryable, message_reports.reviewed=true rows persist (dismissal is a
-- flag flip), but room_bans rows are hard-deleted on unban — the fact "this
-- person was unbanned" is erased the instant it happens and cannot be
-- recovered from existing data at all. A derived-only history would
-- silently omit every unban, which is worse than no history (it reads as
-- broken, not incomplete, the first time a host notices).
--
-- This is architecturally simpler than ADR-008's award_score: a host's own
-- moderation action doesn't need adversarial server-side re-verification
-- the way a participant's self-reported game win does (the host already
-- has unilateral kick/ban/dismiss authority) — a plain host-scoped INSERT
-- policy, matching the exact pattern message_reports_select_host (0018)
-- and room_bans_select_host (0043) already use for SELECT, is sufficient.
--
-- Applying this session's own repeated lesson (found live, twice: room_bans
-- missing from the realtime publication in 0043; the participant-
-- restriction regression in 0050/0051): the publication entry is added
-- in this same migration, not assumed or deferred.

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(code) on delete cascade,
  actor_id text not null,
  action_kind text not null check (action_kind in ('dismiss_report', 'kick_ban', 'unban')),
  target_user_id text not null,
  -- Snapshot, not a live join — the target's room_participants row may
  -- already be gone (kick_ban deletes it) or never resolve to a username
  -- at read time. Same pattern as room_bans.username (migration 0043).
  target_username text,
  -- Free-text context: the report's reason for dismiss_report, null for
  -- kick_ban/unban. Bounded to match message_reports.reason's existing cap.
  detail text,
  created_at timestamptz not null default now()
);

alter table public.moderation_actions
  add constraint moderation_actions_target_username_length
  check (target_username is null or char_length(target_username) <= 100);

alter table public.moderation_actions
  add constraint moderation_actions_detail_length
  check (detail is null or char_length(detail) <= 500);

alter table public.moderation_actions enable row level security;

create index if not exists moderation_actions_room_id_created_at_idx
  on public.moderation_actions (room_id, created_at desc);

-- Host-scoped SELECT — matches message_reports_select_host (0018) and
-- room_bans_select_host (0043) exactly. History is host-facing only, same
-- visibility model as everything it's a history OF.
drop policy if exists "moderation_actions_select_host" on public.moderation_actions;
create policy "moderation_actions_select_host" on public.moderation_actions
  for select using (
    exists (
      select 1 from public.rooms
      where code = room_id and host_id = (select auth.uid())::text
    )
  );

-- Host-scoped INSERT — the room's actual host may log an action, and only
-- attributed to themselves (actor_id must equal the caller), so a host
-- can't backdate or misattribute an entry to someone else.
drop policy if exists "moderation_actions_insert_host" on public.moderation_actions;
create policy "moderation_actions_insert_host" on public.moderation_actions
  for insert with check (
    actor_id = (select auth.uid())::text
    and exists (
      select 1 from public.rooms
      where code = room_id and host_id = (select auth.uid())::text
    )
  );

-- No UPDATE/DELETE policy at all — an append-only audit log; a host who
-- makes an error takes a new action (e.g. unban), which itself becomes a
-- new row, rather than editing history.

alter publication supabase_realtime add table public.moderation_actions;
