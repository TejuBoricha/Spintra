-- Spintra City — release-blocker regression suite.
--
-- One assertion per release-blocking bug from the 2026-08-30 QA audit
-- (QA_REPORT.md §4/§5). Each check asserts the CORRECT behaviour, so this
-- suite is expected to be RED until the corresponding fix lands, and must
-- stay green afterwards.
--
-- Self-contained and idempotent: builds its own rooms in the CITYRG*
-- namespace, tears them down at the end, and never touches other data.
-- Run via: node scripts/city-regression.mjs

\set ON_ERROR_STOP off
set client_min_messages to warning;

create temp table rg(seq serial, bug text, name text, expected text, actual text, status text);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function pg_temp.rg_match(p_room text, p_seed bigint)
returns uuid language plpgsql as $fn$
declare v_m uuid; i int; v_host text; v_u text[] := array[
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'];
begin
  -- `check_room_creation_rate_limit` allows 8 rooms per host per 10 minutes, and
  -- this suite creates eight. Giving each room its own throwaway host keeps the
  -- suite re-runnable; without it the last block silently drops its assertion.
  v_host := '99999999-0000-4000-8000-' || lpad((abs(hashtext(p_room)) % 1000000000000)::text, 12, '0');

  perform set_config('app.force_close_room','true',true);
  delete from public.rooms where code = p_room;
  perform set_config('app.force_close_room','false',true);
  insert into public.rooms (code,name,type,host_id,is_public,max_participants)
  values (p_room,'rg','city',v_host,false,8);
  insert into public.room_participants (room_id,user_id,username,is_online)
  values (p_room,v_host,'host',true);
  for i in 1..3 loop
    insert into public.room_participants (room_id,user_id,username,is_online)
    values (p_room,v_u[i],'P'||i,true);
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub',v_host,'role','service_role')::text,true);
  v_m := public.city_create_match(p_room,'classic',null,p_seed);
  for i in 1..3 loop
    perform set_config('request.jwt.claims', json_build_object('sub',v_u[i],'role','authenticated')::text,true);
    perform public.city_join_seat(v_m,'P'||i);
    perform public.city_set_ready(v_m,true);
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub',v_host,'role','authenticated')::text,true);
  perform public.city_start_match(v_m);
  return v_m;
end $fn$;

-- Each room gets its own host (see rg_match). Moderation is host-only, so a
-- block that kicks needs to act as that room's host, not as a seated player.
create or replace function pg_temp.rg_host(p_room text) returns text language sql as $fn$
  select '99999999-0000-4000-8000-' || lpad((abs(hashtext(p_room)) % 1000000000000)::text, 12, '0');
$fn$;

create or replace function pg_temp.rg_as_host(p_room text) returns void language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.rg_host(p_room), 'role','authenticated')::text, true);
end $fn$;

create or replace function pg_temp.rg_as(p_seat int) returns void language plpgsql as $fn$
declare v_u text[] := array[
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'];
begin
  perform set_config('request.jwt.claims', json_build_object('sub',v_u[p_seat+1],'role','authenticated')::text,true);
end $fn$;

-- ===========================================================================
-- BUG-002 — a kicked and banned player must not be able to act
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := false; act text;
begin
  m := pg_temp.rg_match('CITYRG02', 5002);
  update public.city_matches set current_seat=1, phase='awaiting_roll' where id=m;
  perform pg_temp.rg_as_host('CITYRG02');
  perform public.moderation_kick_ban('CITYRG02','22222222-2222-4222-8222-222222222222');
  perform pg_temp.rg_as(1);
  begin
    perform public.city_roll_dice(m);
    act := 'roll SUCCEEDED after kick+ban';
  exception when others then
    ok := true; act := 'refused: '||SQLERRM;
  end;
  insert into rg values (default,'BUG-002','kicked and banned player cannot act',
    'the RPC refuses a player removed from the room', act,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-001 — a kick must not strand the match on the departed seat
-- ===========================================================================
do $blk$
declare m uuid; stuck boolean; cs int;
begin
  select id into m from public.city_matches where room_code='CITYRG02' and status='active';
  select current_seat into cs from public.city_matches where id=m;
  select not exists(
    select 1 from public.room_participants rp
      join public.city_match_players p on p.user_id = rp.user_id
     where rp.room_id='CITYRG02' and p.match_id=m and p.seat=cs)
  into stuck;
  insert into rg values (default,'BUG-001','kick does not strand the match',
    'current_seat belongs to a player still in the room',
    case when stuck then 'match is waiting on seat '||cs||' whose player has left'
         else 'current_seat belongs to a present player' end,
    case when stuck then 'FAIL' else 'PASS' end);
end $blk$;

-- ===========================================================================
-- BUG-003 — some client-callable route must resolve a stalled turn
-- ===========================================================================
do $blk$
declare n int;
begin
  -- A trigger function can never be "client-callable" no matter what its
  -- grants say -- Postgres refuses to invoke one outside trigger context. An
  -- internal function named e.g. city_retire_seat (fired only by a trigger,
  -- and correctly revoked from clients) matched this regex and produced a
  -- false PASS until this exclusion was added -- caught by cross-checking
  -- has_function_privilege against an actual invocation attempt.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='public' and p.proname like 'city%'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('authenticated', p.oid, 'execute')
     and (p.proname ~* 'timeout|retire|abandon|forfeit|skip_turn');
  insert into rg values (default,'BUG-003','a stalled turn can be resolved',
    'at least one client-callable timeout / retire / abandon routine',
    n||' such routines exist', case when n > 0 then 'PASS' else 'FAIL' end);
end $blk$;

-- Behavioral proof, not just a grant check: the single most safety-critical
-- property of a timeout-claim route is that it can NEVER fire early — a bug
-- there lets any player force-skip someone else's turn on demand, which is a
-- real fairness exploit, not a stalled-match inconvenience. This also proves
-- a genuinely expired, debt-free claim actually resolves the turn, not just
-- that the function exists and is granted.
do $blk$
declare m uuid; ok boolean := true; act text := ''; cs int; ph text;
begin
  m := pg_temp.rg_match('CITYRG03B', 5003);
  update public.city_matches set current_seat=1, phase='awaiting_roll',
    pace_seconds=40, turn_started_at=now(), turn_clock_paused_at=null where id=m;

  perform pg_temp.rg_as(0);
  begin
    perform public.city_claim_timeout(m);
    ok := false; act := act || 'claimed a clock that had not expired; ';
  exception when others then
    if SQLERRM not like '%STILL_RUNNING%' then
      ok := false; act := act || 'wrong refusal for a live clock: '||SQLERRM||'; ';
    end if;
  end;

  update public.city_matches set turn_started_at = now() - interval '41 seconds' where id=m;
  perform pg_temp.rg_as(0);
  begin
    perform public.city_claim_timeout(m);
  exception when others then
    ok := false; act := act || 'a genuinely expired claim was refused: '||SQLERRM||'; ';
  end;

  select current_seat, phase into cs, ph from public.city_matches where id=m;
  if cs <> 2 or ph <> 'awaiting_roll' then
    ok := false; act := act || format('turn did not advance correctly, got seat=%s phase=%s; ', cs, ph);
  end if;

  insert into rg values (default,'BUG-003b','claim_timeout never fires early, and resolves a genuine expiry',
    'refused before the deadline; resolves cleanly (seat 2, awaiting_roll) once it genuinely passes',
    case when ok then 'refused early claim; resolved correctly once expired' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-010 — a finished match must reject commands
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := false; act text;
begin
  m := pg_temp.rg_match('CITYRG10', 5010);
  -- seat 0 must stand on a purchasable, unowned space, otherwise the routine
  -- bails on CITY_NOT_FOR_SALE before it ever reaches the status guard and the
  -- test passes for the wrong reason.
  delete from public.city_assets where match_id=m and space_idx=21;
  update public.city_match_players set position=21 where match_id=m and seat=0;
  update public.city_matches set status='finished', phase=null, current_seat=null, finished_at=now()
   where id=m;
  perform pg_temp.rg_as(0);
  begin
    perform public.city_decline_purchase(m);
    act := 'decline SUCCEEDED on a finished match';
  exception when others then
    -- only a status/lifecycle refusal counts; CITY_NOT_FOR_SALE would mean the
    -- scenario never reached the guard under test.
    if SQLERRM like '%NOT_FOR_SALE%' then
      act := 'inconclusive - never reached the guard ('||SQLERRM||')';
    else ok := true; act := 'refused: '||SQLERRM; end if;
  end;
  insert into rg values (default,'BUG-010','finished match rejects commands',
    'commands refused once status = finished', act,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-008 — the auction force-settle path must not be client-reachable
-- ===========================================================================
do $blk$
declare granted boolean;
begin
  select has_function_privilege('authenticated', p.oid, 'execute') into granted
    from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='public' and p.proname='city_settle_auction'
     and pg_get_function_identity_arguments(p.oid) like '%boolean%'
   limit 1;
  insert into rg values (default,'BUG-008','force-settle is not client-reachable',
    'no client-callable overload exposing p_force',
    coalesce(case when granted then 'authenticated CAN execute the (uuid, boolean) overload'
                  else 'not client-callable' end, 'overload absent'),
    case when coalesce(granted,false) then 'FAIL' else 'PASS' end);
end $blk$;

-- ===========================================================================
-- BUG-009 — declining must not auction an already-owned space
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := false; act text; n int;
begin
  m := pg_temp.rg_match('CITYRG09', 5009);
  insert into public.city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged)
  values (m,39,2,0,false) on conflict do nothing;
  update public.city_match_players set position=39, cash=10 where match_id=m and seat=0;
  update public.city_matches set current_seat=0, phase='required_decision' where id=m;
  perform pg_temp.rg_as(0);
  begin
    perform public.city_decline_purchase(m);
    select count(*) into n from public.city_auctions
     where match_id=m and space_idx=39 and status='running';
    if n = 0 then ok := true; act := 'no auction opened';
    else act := 'opened an auction for a space owned by seat 2'; end if;
  exception when others then ok := true; act := 'refused: '||SQLERRM;
  end;
  insert into rg values (default,'BUG-009','decline never auctions an owned space',
    'no auction is created for a space that already has an owner', act,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-044 — a second charge must not erase the first creditor's claim
-- ===========================================================================
-- Proves the full loop, not just that a number is written somewhere: both
-- creditors must eventually be PAID, not merely "acknowledged". A weaker
-- check (e.g. pending_debt + queued sums to 90) would pass even if the
-- second claim sat in the queue forever and never actually reached seat 2.
do $blk$
declare m uuid; d int; c int; ann0 int; bo0 int; cy0 int; bo1 int; cy1 int; cy2 int;
  ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRG44', 5044);
  delete from public.city_assets where match_id=m;
  -- a developable property, so max_liquidation is non-zero and the charge opens
  -- a raise-funds window rather than an immediate bankruptcy.
  insert into public.city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged)
  values (m,1,0,0,false),(m,3,0,0,false);
  update public.city_match_players set cash=10 where match_id=m and seat=0;
  update public.city_matches set current_seat=1 where id=m;

  select cash into bo0 from public.city_match_players where match_id=m and seat=1;
  select cash into cy0 from public.city_match_players where match_id=m and seat=2;

  perform public.city_charge(m, 0, 50, 1);  -- seat 0 now owes seat 1: 50
  perform public.city_charge(m, 0, 40, 2);  -- a second charge lands before the first clears

  select pending_debt, pending_creditor_seat into d, c
    from public.city_match_players where match_id=m and seat=0;
  if d <> 50 or c <> 1 then
    ok := false; act := act || format('current claim should still be 50/seat1, got %s/%s; ', d, c);
  end if;
  if (select count(*) from public.city_debt_queue where match_id=m and debtor_seat=0) <> 1 then
    ok := false; act := act || 'second claim was not queued; ';
  end if;

  -- Cash arrives from elsewhere (0072's trigger fires on any inflow, matching
  -- BUG-004/024's real-world scenario) — enough to clear the current debt.
  update public.city_match_players set cash=200 where match_id=m and seat=0;
  select cash into bo1 from public.city_match_players where match_id=m and seat=1;
  select pending_debt, pending_creditor_seat into d, c
    from public.city_match_players where match_id=m and seat=0;
  if bo1 <> bo0 + 50 then
    ok := false; act := act || format('seat 1 was not paid its 50 (cash %s -> %s); ', bo0, bo1);
  end if;
  if d <> 40 or c <> 2 then
    ok := false; act := act || format('second claim did not promote to 40/seat2, got %s/%s; ', d, c);
  end if;

  -- A further inflow should now pay the promoted (second) debt in full too.
  update public.city_match_players set cash=cash+100 where match_id=m and seat=0;
  select cash into cy2 from public.city_match_players where match_id=m and seat=2;
  select pending_debt into d from public.city_match_players where match_id=m and seat=0;
  if cy2 <> cy0 + 40 then
    ok := false; act := act || format('seat 2 was never paid its 40 (cash %s -> %s); ', cy0, cy2);
  end if;
  if d <> 0 then
    ok := false; act := act || format('debt should be fully cleared, still shows %s; ', d);
  end if;
  if (select count(*) from public.city_debt_queue where match_id=m and debtor_seat=0) <> 0 then
    ok := false; act := act || 'queue should be empty once both claims are paid; ';
  end if;

  insert into rg values (default,'BUG-044','both creditors are eventually paid in full, not just acknowledged',
    'seat1 +50, seat2 +40, both claims clear to pending_debt=0 with an empty queue',
    case when ok then 'both creditors paid in full, queue drained cleanly' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-045 — max liquidation must not collapse to 0 for a station holder
-- ===========================================================================
do $blk$
declare m uuid; v int;
begin
  m := pg_temp.rg_match('CITYRG45', 5045);
  delete from public.city_assets where match_id=m;
  insert into public.city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged)
  values (m,5,0,0,false);
  update public.city_match_players set cash=0 where match_id=m and seat=0;
  v := public.city_max_liquidation(m, 0);
  insert into rg values (default,'BUG-045','max liquidation counts a station',
    'mortgage value of a 190 station is 95', 'returned '||v,
    case when v = 95 then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-014 — bankruptcy to a player sells developments to the bank first
-- ===========================================================================
do $blk$
declare m uuid; cred_cash int; blds int;
begin
  m := pg_temp.rg_match('CITYRG14', 5014);
  delete from public.city_assets where match_id=m;
  insert into public.city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged)
  values (m,1,0,3,false),(m,3,0,3,false);
  update public.city_match_players set cash=0 where match_id=m and seat=0;
  update public.city_match_players set cash=1000 where match_id=m and seat=2;
  perform public.city_bankrupt_seat(m, 0, 2);
  select cash into cred_cash from public.city_match_players where match_id=m and seat=2;
  select coalesce(sum(buildings),0) into blds from public.city_assets where match_id=m and owner_seat=2;
  insert into rg values (default,'BUG-014','bankruptcy sells developments first',
    'creditor gains 150 cash (6 tiers x 50/2) and receives bare deeds',
    'creditor cash='||cred_cash||' (was 1000), buildings transferred='||blds,
    case when cred_cash >= 1150 and blds = 0 then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-004 / BUG-024 — cash from any source must be able to clear a debt
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := false; act text; d int;
begin
  m := pg_temp.rg_match('CITYRG04', 5004);
  delete from public.city_assets where match_id=m;
  -- A debt that genuinely cannot be paid yet: 10 cash against 35 owed.
  update public.city_match_players set cash=10, pending_debt=35, pending_creditor_seat=1
   where match_id=m and seat=0;
  update public.city_matches set current_seat=0, phase='required_decision' where id=m;
  -- Money now arrives from somewhere that is NOT mortgage or sell-building —
  -- a trade, a card, rent received. This is the path BUG-024 showed was dead.
  update public.city_match_players set cash=500 where match_id=m and seat=0;
  perform pg_temp.rg_as(0);
  begin
    perform public.city_end_turn(m);
    ok := true; act := 'turn ended, debt resolved';
  exception when others then
    select pending_debt into d from public.city_match_players where match_id=m and seat=0;
    act := 'stuck holding 500 cash against a debt of '||d||': '||SQLERRM;
  end;
  insert into rg values (default,'BUG-004','a solvent debtor is never deadlocked',
    'a player holding 500 cash can settle a 35 debt and continue', act,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-012 — a player must not be able to inflate their own xp
-- ===========================================================================
do $blk$
declare ok boolean := false; act text; v int;
begin
  perform set_config('app.force_close_room','true',true);
  delete from public.rooms where code='CITYRG12';
  perform set_config('app.force_close_room','false',true);
  insert into public.rooms (code,name,type,host_id,is_public,max_participants)
  values ('CITYRG12','rg','city','11111111-1111-4111-8111-111111111111',false,8);
  insert into public.room_participants (room_id,user_id,username,is_online,xp)
  values ('CITYRG12','11111111-1111-4111-8111-111111111111','P1',true,0);
  perform pg_temp.rg_as(0);
  begin
    perform set_config('role','authenticated',true);
    update public.room_participants set xp = 999999
     where room_id='CITYRG12' and user_id='11111111-1111-4111-8111-111111111111';
    perform set_config('role','postgres',true);
  exception when others then
    perform set_config('role','postgres',true);
    ok := true; act := 'refused: '||SQLERRM;
  end;
  select xp into v from public.room_participants
   where room_id='CITYRG12' and user_id='11111111-1111-4111-8111-111111111111';
  if v = 0 then ok := true; end if;
  insert into rg values (default,'BUG-012','a player cannot inflate their own xp',
    'a self-update of xp is rejected or ignored',
    coalesce(act,'update accepted')||'; xp is now '||v,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ---------------------------------------------------------------------------
-- teardown + report
-- ---------------------------------------------------------------------------
select set_config('app.force_close_room','true',false);
delete from public.rooms where code like 'CITYRG%';
select set_config('app.force_close_room','false',false);

\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on
select 'RESULT|'||bug||'|'||status||'|'||name||'|'||expected||'|'||actual from rg order by seq;
select 'TOTALS|'||count(*) filter (where status='PASS')||'|'||count(*) filter (where status='FAIL')||'|'||count(*) from rg;
