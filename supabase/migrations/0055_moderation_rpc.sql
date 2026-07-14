-- Migration 0055: transactional moderation RPCs — one function per moderation verb
--
-- Context: every moderation action was a multi-step script run from the
-- browser (kick & ban alone: snapshot participant → delete participant →
-- upsert ban → close reports → insert history), with the host-only rule
-- re-implemented in three places (button visibility, client handlers,
-- per-table RLS). That produced three real bugs in one week: the room_bans
-- upsert rejected by RLS (no UPDATE policy exists — by design), reports
-- surviving a kick and resurfacing under a later host, and a promoted host
-- able to kick & ban *themself* from a stale report about them.
--
-- These functions make each verb a single atomic transaction with the
-- host-verification and self-targeting rules enforced inside the database,
-- so no client path — present or future — can produce half-applied
-- moderation state or bypass the rules. SECURITY DEFINER is required
-- (the steps intentionally exceed what any one RLS policy allows, e.g.
-- room_bans has no UPDATE policy and message_reports updates are
-- host-scoped); each function re-verifies the caller against
-- rooms.host_id itself, exactly like the RLS policies it supersedes.
--
-- The existing table RLS policies are left untouched: the old direct-write
-- client paths keep working during rollout, and every non-verb access
-- (report submission, ban self-check, dashboard reads, realtime) still
-- goes through them.

-- ── Kick & ban ─────────────────────────────────────────────────────────
-- Atomically: snapshot the target's username/fingerprint, delete their
-- participant row, record the ban (no-op if one already exists — bans are
-- insert-once/delete-to-unban, see 0012/0043), close every open report
-- about them in the room, and append the audit-log row.
create or replace function public.moderation_kick_ban(
  p_room_code text,
  p_target_user_id text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := (select auth.uid())::text;
  v_username text;
  v_fingerprint text;
begin
  if v_caller is null then
    raise exception 'moderation_kick_ban: not authenticated';
  end if;
  if not exists (
    select 1 from public.rooms where code = p_room_code and host_id = v_caller
  ) then
    raise exception 'moderation_kick_ban: only the room host may moderate';
  end if;
  if p_target_user_id = v_caller then
    raise exception 'moderation_kick_ban: the host cannot kick or ban themself';
  end if;

  select username, fingerprint_hash
    into v_username, v_fingerprint
    from public.room_participants
   where room_id = p_room_code and user_id = p_target_user_id;

  delete from public.room_participants
   where room_id = p_room_code and user_id = p_target_user_id;

  insert into public.room_bans (room_id, user_id, banned_by, username, fingerprint_hash)
  values (p_room_code, p_target_user_id, v_caller, v_username, v_fingerprint)
  on conflict (room_id, user_id) do nothing;

  -- Re-kick of an already-banned, already-absent user: fall back to the
  -- existing ban row's username snapshot so the audit log stays named.
  if v_username is null then
    select username into v_username
      from public.room_bans
     where room_id = p_room_code and user_id = p_target_user_id;
  end if;

  update public.message_reports
     set reviewed = true
   where room_id = p_room_code
     and reported_user_id = p_target_user_id
     and reviewed = false;

  insert into public.moderation_actions
    (room_id, actor_id, action_kind, target_user_id, target_username)
  values
    (p_room_code, v_caller, 'kick_ban', p_target_user_id, v_username);

  return v_username;
end;
$$;

-- ── Unban ──────────────────────────────────────────────────────────────
create or replace function public.moderation_unban(
  p_room_code text,
  p_ban_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := (select auth.uid())::text;
  v_target_user_id text;
  v_username text;
begin
  if v_caller is null then
    raise exception 'moderation_unban: not authenticated';
  end if;
  if not exists (
    select 1 from public.rooms where code = p_room_code and host_id = v_caller
  ) then
    raise exception 'moderation_unban: only the room host may moderate';
  end if;

  delete from public.room_bans
   where id = p_ban_id and room_id = p_room_code
  returning user_id, username into v_target_user_id, v_username;

  if v_target_user_id is null then
    raise exception 'moderation_unban: ban not found in this room';
  end if;

  insert into public.moderation_actions
    (room_id, actor_id, action_kind, target_user_id, target_username)
  values
    (p_room_code, v_caller, 'unban', v_target_user_id, v_username);

  return v_username;
end;
$$;

-- ── Dismiss a report ───────────────────────────────────────────────────
create or replace function public.moderation_dismiss_report(
  p_room_code text,
  p_report_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := (select auth.uid())::text;
  v_target_user_id text;
  v_reason text;
begin
  if v_caller is null then
    raise exception 'moderation_dismiss_report: not authenticated';
  end if;
  if not exists (
    select 1 from public.rooms where code = p_room_code and host_id = v_caller
  ) then
    raise exception 'moderation_dismiss_report: only the room host may moderate';
  end if;

  update public.message_reports
     set reviewed = true
   where id = p_report_id and room_id = p_room_code and reviewed = false
  returning reported_user_id, reason into v_target_user_id, v_reason;

  -- Already reviewed (or not found): idempotent no-op, no duplicate log row.
  if v_target_user_id is null then
    return;
  end if;

  insert into public.moderation_actions
    (room_id, actor_id, action_kind, target_user_id, target_username, detail)
  values
    (p_room_code, v_caller, 'dismiss_report', v_target_user_id, null, v_reason);
end;
$$;

-- Functions default to EXECUTE for PUBLIC — restrict to signed-in sessions
-- (Supabase anonymous auth also runs as the authenticated role).
revoke all on function public.moderation_kick_ban(text, text) from public, anon;
grant execute on function public.moderation_kick_ban(text, text) to authenticated;
revoke all on function public.moderation_unban(text, uuid) from public, anon;
grant execute on function public.moderation_unban(text, uuid) to authenticated;
revoke all on function public.moderation_dismiss_report(text, uuid) from public, anon;
grant execute on function public.moderation_dismiss_report(text, uuid) to authenticated;
