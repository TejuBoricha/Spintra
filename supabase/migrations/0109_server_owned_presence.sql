-- 0109: the server decides who is online (audit wave 2a: R-14, R-1, R-2, R-3,
-- C-23, Q-1, Q-3, D-7).
--
-- Until now every browser wrote everyone's `room_participants.is_online`. A
-- tab that lost a peer from Realtime presence for 4 seconds wrote that peer
-- offline, and the returning tab only corrected its own row if the change
-- reached it while its presence was live. A refresh with a slow realtime
-- connection therefore left a present player "offline" for good (reproduced
-- in the City playtest audit), which handed host to someone else and made
-- Spintra City auto-play, then retire, a player who was still there.
--
-- Now:
--   * Each tab calls room_heartbeat() every 10 seconds. It records the beat in
--     room_presence (a private table outside the realtime publication, so a
--     beat never fans out to every player or trips the participant-update
--     rate limit), marks the caller online if they weren't, and gives the
--     room back to its creator when they return (the owner's decision on R-2).
--   * A closing tab calls room_presence_leave(), which lets its beat expire in
--     about 10 seconds; a refresh marks itself online (which refreshes the
--     beat) well before that.
--   * room_presence_sweep(), run by pg_cron every 5 seconds, marks players
--     whose last beat is older than 30 seconds offline and elects a host for
--     rooms whose host has been offline for 15 seconds or left.
--   * Nobody can write another player's row any more, and a room has at most
--     one host row (unique index).
--
-- Both the heartbeat and the sweep take the room's advisory lock (the same key
-- elect_room_host and city_create_match use), so a returning player's beat and
-- the sweep can never interleave and undo each other.

-- ---------------------------------------------------------------------------
-- 1. Heartbeats
-- ---------------------------------------------------------------------------

create table if not exists public.room_presence (
  room_code text not null references public.rooms (code) on delete cascade,
  user_id text not null,
  last_seen_at timestamptz not null default now(),
  primary key (room_code, user_id)
);
create index if not exists room_presence_last_seen_idx on public.room_presence (last_seen_at);

-- No policies: only the security-definer functions below read or write it.
alter table public.room_presence enable row level security;
revoke all on public.room_presence from public, anon, authenticated;

-- Any write that says a row is online (a join, or a page's own reconnect
-- write when it loads) starts a fresh beat, so the sweep can't mark a player
-- offline in the moments before that tab's first heartbeat, even while the
-- row still looked online from before a refresh.
create or replace function public.refresh_presence_on_online()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_online then
    insert into public.room_presence (room_code, user_id, last_seen_at)
    values (new.room_id, new.user_id, now())
    on conflict (room_code, user_id) do update set last_seen_at = excluded.last_seen_at;
  end if;
  return new;
end;
$$;
revoke all on function public.refresh_presence_on_online() from public, anon, authenticated;

drop trigger if exists trg_refresh_presence_on_online on public.room_participants;
create trigger trg_refresh_presence_on_online
  after insert or update of is_online on public.room_participants
  for each row execute function public.refresh_presence_on_online();

-- ---------------------------------------------------------------------------
-- 2. Host changes, in one place
-- ---------------------------------------------------------------------------

-- Caller must hold the room's advisory lock. Moves the host role and
-- rooms.host_id to p_user_id; the flags let the participant triggers accept a
-- server-side change to other players' rows.
create or replace function public._room_set_host(p_room_code text, p_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.electing_room_host', 'true', true);
  perform set_config('app.bypass_participant_restriction', 'true', true);
  perform set_config('app.bypass_participant_rate_limit', 'true', true);

  update public.room_participants
  set role = 'participant'
  where room_id = p_room_code and role = 'host' and user_id <> p_user_id;

  update public.room_participants
  set role = 'host'
  where room_id = p_room_code and user_id = p_user_id and role is distinct from 'host';

  update public.rooms
  set host_id = p_user_id
  where code = p_room_code and host_id is distinct from p_user_id;

  perform set_config('app.electing_room_host', 'false', true);
  perform set_config('app.bypass_participant_restriction', 'false', true);
  perform set_config('app.bypass_participant_rate_limit', 'false', true);
end;
$$;
revoke all on function public._room_set_host(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The client-facing calls
-- ---------------------------------------------------------------------------

create or replace function public.room_heartbeat(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_part public.room_participants;
  v_room public.rooms;
  v_reclaimed boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false);
  end if;

  -- A tab beats every 10 seconds. Anything much faster (a loop in devtools)
  -- is answered without taking the room lock, so it can't hold up others.
  -- Never for a returning creator who isn't host yet: their page's own
  -- "online" write refreshes the beat just before its first heartbeat, and
  -- that heartbeat must still hand the room back.
  if exists (
    select 1 from public.room_presence rp
    join public.room_participants p on p.room_id = rp.room_code and p.user_id = rp.user_id
    join public.rooms r on r.code = rp.room_code
    where rp.room_code = p_room_code and rp.user_id = v_uid
      and rp.last_seen_at > now() - interval '2 seconds' and p.is_online
      and not (r.created_by = v_uid and r.host_id is distinct from v_uid)
  ) then
    return jsonb_build_object('ok', true, 'reclaimed', false);
  end if;

  perform pg_advisory_xact_lock(hashtext(p_room_code));

  select * into v_part from public.room_participants
  where room_id = p_room_code and user_id = v_uid;
  if not found then
    -- Not in the room (never joined, left, or was removed): no beat.
    return jsonb_build_object('ok', false);
  end if;

  insert into public.room_presence (room_code, user_id, last_seen_at)
  values (p_room_code, v_uid, now())
  on conflict (room_code, user_id) do update set last_seen_at = excluded.last_seen_at;

  if not v_part.is_online then
    perform set_config('app.bypass_participant_rate_limit', 'true', true);
    update public.room_participants set is_online = true where id = v_part.id;
    perform set_config('app.bypass_participant_rate_limit', 'false', true);
  end if;

  -- The room's creator gets it back whenever they return (audit R-2).
  select * into v_room from public.rooms where code = p_room_code;
  if v_room.created_by = v_uid and v_room.host_id is distinct from v_uid then
    perform public._room_set_host(p_room_code, v_uid);
    v_reclaimed := true;
  end if;

  return jsonb_build_object('ok', true, 'reclaimed', v_reclaimed);
end;
$$;
revoke all on function public.room_heartbeat(text) from public, anon;
grant execute on function public.room_heartbeat(text) to authenticated;

-- Called from a closing tab (pagehide) or when leaving the room page. Leaves
-- 10 seconds of the 30-second window, so a refresh, whose page marks itself
-- online as it loads, never shows the player leaving.
create or replace function public.room_presence_leave(p_room_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.room_presence
  set last_seen_at = least(last_seen_at, now() - interval '20 seconds')
  where room_code = p_room_code and user_id = auth.uid()::text;
end;
$$;
revoke all on function public.room_presence_leave(text) from public, anon;
grant execute on function public.room_presence_leave(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The sweep (pg_cron, every 5 seconds)
-- ---------------------------------------------------------------------------

create or replace function public.room_presence_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room record;
  v_candidate text;
begin
  -- a) Mark expired players offline, one room at a time under its lock.
  --    Each room runs in its own subtransaction: an error in one room (a
  --    City trigger, a lock timeout) skips that room this round instead of
  --    rolling back the sweep for every room.
  for v_room in
    select distinct p.room_id
    from public.room_participants p
    where p.is_online
      and not exists (
        select 1 from public.room_presence rp
        where rp.room_code = p.room_id and rp.user_id = p.user_id
          and rp.last_seen_at > now() - interval '30 seconds'
      )
  loop
    begin
      perform pg_advisory_xact_lock(hashtext(v_room.room_id));
      perform set_config('app.bypass_participant_restriction', 'true', true);
      perform set_config('app.bypass_participant_rate_limit', 'true', true);
      update public.room_participants p
      set is_online = false
      where p.room_id = v_room.room_id
        and p.is_online
        and not exists (
          select 1 from public.room_presence rp
          where rp.room_code = p.room_id and rp.user_id = p.user_id
            and rp.last_seen_at > now() - interval '30 seconds'
        );
      perform set_config('app.bypass_participant_restriction', 'false', true);
      perform set_config('app.bypass_participant_rate_limit', 'false', true);
    exception when others then
      raise warning 'room_presence_sweep: marking offline in % failed: %', v_room.room_id, sqlerrm;
    end;
  end loop;

  -- b) Elect a host where the host left, or has been offline for 15 seconds,
  --    and someone who could host is online. The creator is preferred; a
  --    Classroom room can only be hosted by its creator (0108). Checked again
  --    under the room lock, because the host may have come back between the
  --    first look and taking the lock.
  for v_room in
    select r.code
    from public.rooms r
    where not exists (
        select 1 from public.room_participants h
        where h.room_id = r.code and h.user_id = r.host_id
          and (h.is_online or h.offline_since > now() - interval '15 seconds')
      )
      and exists (
        select 1 from public.room_participants o
        where o.room_id = r.code and o.is_online
          and (r.type <> 'classroom' or o.user_id = r.created_by)
      )
  loop
    begin
      perform pg_advisory_xact_lock(hashtext(v_room.code));
      v_candidate := null;
      select o.user_id into v_candidate
      from public.rooms r
      join public.room_participants o on o.room_id = r.code
      where r.code = v_room.code
        and o.is_online
        and (r.type <> 'classroom' or o.user_id = r.created_by)
        and not exists (
          select 1 from public.room_participants h
          where h.room_id = r.code and h.user_id = r.host_id
            and (h.is_online or h.offline_since > clock_timestamp() - interval '15 seconds')
        )
      order by (o.user_id = r.created_by) desc, o.joined_at asc
      limit 1;
      if v_candidate is not null then
        perform public._room_set_host(v_room.code, v_candidate);
      end if;
    exception when others then
      raise warning 'room_presence_sweep: electing a host in % failed: %', v_room.code, sqlerrm;
    end;
  end loop;

  -- c) Forget beats from players who are no longer in the room.
  delete from public.room_presence rp
  where rp.last_seen_at < now() - interval '1 hour';
end;
$$;
revoke all on function public.room_presence_sweep() from public, anon, authenticated;

-- Clients no longer elect; the sweep does (with the same rules plus the
-- creator preference). Kept for reference, callable only by the server.
revoke execute on function public.elect_room_host(text, text) from authenticated;

-- ---------------------------------------------------------------------------
-- 5. Nobody writes another player's row
-- ---------------------------------------------------------------------------

-- Same as 0106 for a player's own row. The two branches that let the host,
-- or any participant, mark someone else offline are gone: that was the write
-- that raced a returning player. Server functions set the bypass flags.
create or replace function public.restrict_host_participant_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bypass_participant_restriction', true) = 'true' then
    return new;
  end if;

  if current_setting('app.electing_room_host', true) = 'true' then
    return new;
  end if;

  if old.user_id = auth.uid()::text then
    if new.xp is distinct from old.xp
      or new.rank is distinct from old.rank
      or new.room_id is distinct from old.room_id
      or new.user_id is distinct from old.user_id
      or new.joined_at is distinct from old.joined_at
    then
      raise exception 'Scores and identity are set by the server, not by the player.';
    end if;
    if new.role = 'host' and old.role is distinct from 'host' and not exists (
      select 1 from public.rooms
      where code = old.room_id and host_id = auth.uid()::text
    ) then
      raise exception 'Only the room host can hold the host role.';
    end if;
    return new;
  end if;

  raise exception 'Players can only change their own row; who is online is decided by the server.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. One host per room (Q-3)
-- ---------------------------------------------------------------------------

do $$
begin
  perform set_config('app.bypass_participant_restriction', 'true', true);
  perform set_config('app.bypass_participant_rate_limit', 'true', true);
  update public.room_participants p
  set role = 'participant'
  from public.rooms r
  where r.code = p.room_id and p.role = 'host' and p.user_id is distinct from r.host_id;
  perform set_config('app.bypass_participant_restriction', 'false', true);
  perform set_config('app.bypass_participant_rate_limit', 'false', true);
end $$;

create unique index if not exists room_participants_one_host
  on public.room_participants (room_id) where role = 'host';

-- ---------------------------------------------------------------------------
-- 7. Schedule the sweep
-- ---------------------------------------------------------------------------

-- Everyone online at deploy time starts with a fresh beat. Open tabs still
-- running the previous page then have 30 seconds before they count as gone;
-- a refresh loads the heartbeat.
insert into public.room_presence (room_code, user_id, last_seen_at)
select room_id, user_id, now() from public.room_participants where is_online
on conflict (room_code, user_id) do update set last_seen_at = excluded.last_seen_at;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'room-presence-sweep') then
    perform cron.unschedule('room-presence-sweep');
  end if;
end $$;

select cron.schedule('room-presence-sweep', '5 seconds', 'select public.room_presence_sweep()');

-- pg_cron records every run in cron.job_run_details; at one run every 5
-- seconds that's about 17,000 rows a day. Keep a day of history.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-cron-history') then
    perform cron.unschedule('purge-cron-history');
  end if;
end $$;

select cron.schedule('purge-cron-history', '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '1 day'$$);
