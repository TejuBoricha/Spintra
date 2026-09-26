-- Tests for 0109 (server-owned presence). Runs in one transaction and rolls
-- back. Signed-in players are simulated the way PostgREST does it: role
-- authenticated plus request.jwt.claims. Any failed check raises.
--   docker exec -i supabase_db_Spintra-1 psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/0109_server_owned_presence.test.sql

begin;

create or replace function pg_temp.as_user(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- Setup (as postgres): a party room hosted by its creator A, member B, outsider C.
insert into public.rooms (code, name, type, host_id, created_by, is_public, max_participants)
values ('ZZ0109', 'presence test', 'party', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', false, 10),
       ('ZZC109', 'classroom test', 'classroom', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', false, 10);
insert into public.room_participants (room_id, user_id, role, is_online, username)
values ('ZZ0109', 'aaaaaaaa-0000-0000-0000-000000000001', 'host', true, 'A'),
       ('ZZ0109', 'bbbbbbbb-0000-0000-0000-000000000002', 'participant', true, 'B'),
       ('ZZC109', 'aaaaaaaa-0000-0000-0000-000000000001', 'host', true, 'A'),
       ('ZZC109', 'bbbbbbbb-0000-0000-0000-000000000002', 'participant', true, 'B');

do $$ begin
  if (select count(*) from public.room_presence where room_code = 'ZZ0109') <> 2 then
    raise exception 'FAIL join: a new online row should start with a fresh beat';
  end if;
  raise notice 'PASS join starts a fresh beat';
end $$;

-- 1. B cannot mark A offline any more (the write that raced a returning player).
set local role authenticated;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  begin
    update public.room_participants set is_online = false
    where room_id = 'ZZ0109' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'FAIL 1: B changed A''s row';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  raise notice 'PASS 1 a player cannot write another player''s row';
end $$;

-- 2. Heartbeat: members yes, outsiders no.
do $$ begin
  if not (public.room_heartbeat('ZZ0109') ->> 'ok')::boolean then raise exception 'FAIL 2a: member beat refused'; end if;
  perform pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
  if (public.room_heartbeat('ZZ0109') ->> 'ok')::boolean then raise exception 'FAIL 2b: outsider beat accepted'; end if;
  begin
    perform 1 from public.room_presence limit 1;
    raise exception 'FAIL 2c: players can read room_presence';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.room_presence where user_id = 'cccccccc-0000-0000-0000-000000000003') then
    raise exception 'FAIL 2d: outsider got a presence row';
  end if;
  raise notice 'PASS 2 only room members can beat, and nobody can read the beats table';
end $$;
set local role authenticated;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');

-- 3. Clients can no longer run host election.
do $$ begin
  begin
    perform public.elect_room_host('ZZ0109', 'bbbbbbbb-0000-0000-0000-000000000002');
    raise exception 'FAIL 3: elect_room_host still callable by players';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.room_presence_sweep();
    raise exception 'FAIL 3b: players can run the sweep';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 3 election and sweep are server-only';
end $$;
reset role;

-- 4. A stops beating: offline after the 30s window, host kept for 15s, then B.
update public.room_presence set last_seen_at = now() - interval '40 seconds'
where room_code in ('ZZ0109', 'ZZC109') and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.room_presence_sweep();
do $$ begin
  if (select is_online from public.room_participants where room_id = 'ZZ0109' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'FAIL 4a: expired player still online';
  end if;
  if (select host_id from public.rooms where code = 'ZZ0109') <> 'aaaaaaaa-0000-0000-0000-000000000001' then
    raise exception 'FAIL 4b: host moved inside the 15s grace';
  end if;
  raise notice 'PASS 4a expired player marked offline, host kept during grace';
end $$;

-- offline_since is kept by a trigger, and now() doesn't move inside one
-- transaction (each real sweep is its own), so move it back past the grace
-- with that trigger switched off (rolled back with everything else).
alter table public.room_participants disable trigger trg_aa_track_offline_since;
set local app.bypass_participant_restriction = 'true';
update public.room_participants set offline_since = now() - interval '20 seconds'
where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and room_id in ('ZZ0109', 'ZZC109');
set local app.bypass_participant_restriction = 'false';
alter table public.room_participants enable trigger trg_aa_track_offline_since;
select public.room_presence_sweep();
do $$ begin
  if (select host_id from public.rooms where code = 'ZZ0109') <> 'bbbbbbbb-0000-0000-0000-000000000002' then
    raise exception 'FAIL 4c: no election after the grace';
  end if;
  if (select count(*) from public.room_participants where room_id = 'ZZ0109' and role = 'host') <> 1
     or (select role from public.room_participants where room_id = 'ZZ0109' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002') <> 'host' then
    raise exception 'FAIL 4d: host rows inconsistent';
  end if;
  raise notice 'PASS 4b host elected after 15s offline, exactly one host row';
  -- 9. A Classroom room is only hosted by its teacher.
  if (select host_id from public.rooms where code = 'ZZC109') <> 'aaaaaaaa-0000-0000-0000-000000000001' then
    raise exception 'FAIL 9: a student became host of a Classroom room';
  end if;
  raise notice 'PASS 9 Classroom room keeps its teacher as host';
end $$;

-- 5. The creator comes back: online again and host again. Their page's own
--    "online" write lands first (refreshing the beat), then the heartbeat,
--    which must still hand the room back rather than take the 2s shortcut.
set local role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update public.room_participants set is_online = true
where room_id = 'ZZ0109' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$
declare r jsonb;
begin
  r := public.room_heartbeat('ZZ0109');
  if not (r ->> 'reclaimed')::boolean then raise exception 'FAIL 5a: creator did not reclaim (%)', r; end if;
end $$;
reset role;
do $$ begin
  if not (select is_online from public.room_participants where room_id = 'ZZ0109' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
     or (select host_id from public.rooms where code = 'ZZ0109') <> 'aaaaaaaa-0000-0000-0000-000000000001'
     or (select role from public.room_participants where room_id = 'ZZ0109' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002') <> 'participant'
     or (select count(*) from public.room_participants where room_id = 'ZZ0109' and role = 'host') <> 1 then
    raise exception 'FAIL 5b: reclaim left the room inconsistent';
  end if;
  raise notice 'PASS 5 returning creator is online and host again';
end $$;

-- 6. Leaving: 5 seconds left in the window, then offline.
set local role authenticated;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.room_presence_leave('ZZ0109');
reset role;
select public.room_presence_sweep();
do $$ begin
  if not (select is_online from public.room_participants where room_id = 'ZZ0109' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002') then
    raise exception 'FAIL 6a: leave took effect immediately (a refresh would flicker)';
  end if;
  update public.room_presence set last_seen_at = now() - interval '31 seconds'
  where room_code = 'ZZ0109' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  perform public.room_presence_sweep();
  if (select is_online from public.room_participants where room_id = 'ZZ0109' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002') then
    raise exception 'FAIL 6b: left player still online after the window';
  end if;
  raise notice 'PASS 6 leave expires after a short grace, not instantly';
end $$;

-- 7. A player can still change their own row.
set local role authenticated;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
update public.room_participants set username = 'B2' where room_id = 'ZZ0109' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
do $$ begin
  if (public.room_heartbeat('ZZ0109') ->> 'ok')::boolean is not true then raise exception 'FAIL 7: beat after rename refused'; end if;
  raise notice 'PASS 7 own-row updates and beats still work';
end $$;
reset role;

-- 7b. A reloading page's own "I'm online" write restarts the beat, even though
--     the row still looked online (the review's slow-refresh case).
update public.room_presence set last_seen_at = now() - interval '25 seconds'
where room_code = 'ZZ0109' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
set local role authenticated;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
update public.room_participants set is_online = true where room_id = 'ZZ0109' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
-- 7c. A second beat straight after the first is answered without work.
do $$ begin
  if (public.room_heartbeat('ZZ0109') ->> 'ok')::boolean is not true then raise exception 'FAIL 7c: rapid repeat beat refused'; end if;
end $$;
reset role;
do $$ begin
  if (select last_seen_at from public.room_presence where room_code = 'ZZ0109' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002') < now() - interval '1 second' then
    raise exception 'FAIL 7b: own online write did not restart the beat';
  end if;
  raise notice 'PASS 7b/7c own online write restarts the beat; rapid repeat beats are cheap';
end $$;

-- 8. Anonymous (no session) callers get nothing.
set local role anon;
do $$ begin
  begin
    perform public.room_heartbeat('ZZ0109');
    raise exception 'FAIL 8: anon can call room_heartbeat';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 8 anon cannot call presence functions';
end $$;
reset role;

-- 10. A second host row is impossible, even while the first host is offline
--     (the older online-host trigger only covers an online host).
do $$ begin
  set local app.bypass_participant_restriction = 'true';
  set local app.bypass_participant_rate_limit = 'true';
  update public.room_participants set is_online = false where room_id = 'ZZ0109' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  begin
    update public.room_participants set role = 'host' where room_id = 'ZZ0109' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
    raise exception 'FAIL 10: two host rows allowed';
  exception when unique_violation then null;
  end;
  raise notice 'PASS 10 one host row per room';
end $$;

rollback;
