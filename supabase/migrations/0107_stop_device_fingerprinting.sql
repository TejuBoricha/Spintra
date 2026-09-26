-- Stop collecting device fingerprints (audit D-6).
--
-- Before: room_participants.fingerprint_hash was readable by anyone who
-- could read participant rows, which for a public room is anyone at all,
-- and the hash survives anonymous session changes, so a device could be
-- followed across rooms. room_bans carried the same hash to the host and,
-- through postgres_changes, to the moderation dashboard. The privacy
-- policy didn't mention it.
--
-- It also never did the job it was collected for (0047). The ban check
-- looked for the hash on the joining row, but the client joins first and
-- only sends the hash in an update afterwards, so bans have only ever
-- applied by player identity. And it can't be made to work safely: the
-- hash is built from screen size, colour depth, time zone, language,
-- platform, CPU cores and memory, which are identical across a class set of
-- the same school laptop, so enforcing it would ban every classmate along
-- with one student.
--
-- So the hashes are deleted and no longer collected (the client stops
-- computing them). Bans stay identity-only, as they effectively always
-- were. If device matching is wanted later, it needs a design that can't
-- catch innocent classmates (e.g. suggesting a match to the host).

alter table public.room_participants drop column if exists fingerprint_hash;

drop trigger if exists trg_copy_fingerprint_to_ban on public.room_bans;
drop function if exists public.copy_fingerprint_to_ban();
alter table public.room_bans drop column if exists fingerprint_hash;

-- Identity-only, and logs the attempt again: 0032 recorded rejoin attempts
-- with log_moderation_event (a RAISE LOG, which survives the rollback), and
-- 0047 dropped that line by accident when it added the fingerprint branch.
create or replace function public.check_room_ban_before_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.room_bans
    where room_id = new.room_id and user_id = new.user_id
  ) then
    perform public.log_moderation_event('banned_user_rejoin_attempt', new.user_id, new.room_id, null);
    raise exception 'You have been banned from this room by the host.';
  end if;
  return new;
end;
$$;

-- Same as 0055's, without the fingerprint.
create or replace function public.moderation_kick_ban(p_room_code text, p_target_user_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := (select auth.uid())::text;
  v_username text;
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

  select username into v_username
    from public.room_participants
   where room_id = p_room_code and user_id = p_target_user_id;

  delete from public.room_participants
   where room_id = p_room_code and user_id = p_target_user_id;

  insert into public.room_bans (room_id, user_id, banned_by, username)
  values (p_room_code, p_target_user_id, v_caller, v_username)
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
