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

  -- `check_room_join_rate_limit` allows 20 joins per user per 10 minutes,
  -- counted globally across rooms, not per room -- and v_u below is the same
  -- 3 fixed UUIDs every rg_match call in this suite reuses (rg_as's identity
  -- switching depends on that fixed identity, so making these per-room-unique
  -- like v_host would mean plumbing a room param through every rg_as(seat)
  -- call site across the file, a much larger and riskier change for the same
  -- result). Earlier rooms' rows for these 3 users are still sitting around
  -- from earlier blocks in this same run -- the suite's teardown only runs
  -- once, at the very end -- so by the time the 21st rg_match call in one run
  -- was added, the count for each of these 3 users legitimately passed 20 and
  -- tripped the limiter mid-suite. Deleting their own prior join history
  -- globally (not just for p_room, which the delete below already covers)
  -- keeps each rg_match call starting from zero, the same guarantee v_host
  -- already has via its own per-room identity instead.
  delete from public.room_participants where user_id = any(v_u);

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
-- BUG-007-B (round B) narrowed what "resolves" means here: since a stall in
-- awaiting_roll now gets FR-41's real auto-roll default (not a blanket
-- end-turn), current_seat correctly stays put -- rolling doesn't end a turn,
-- only a subsequent optional_actions stall would. Checked via the RPC's own
-- 'resolution' field rather than inferred from the post-roll phase, which
-- depends on wherever this seed's roll happens to land.
do $blk$
declare m uuid; ok boolean := true; act text := ''; cs int; res jsonb;
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
    select public.city_claim_timeout(m) into res;
  exception when others then
    ok := false; act := act || 'a genuinely expired claim was refused: '||SQLERRM||'; ';
  end;

  select current_seat into cs from public.city_matches where id=m;
  if res->>'resolution' <> 'auto_roll' or (res->>'seat')::int <> 1 then
    ok := false; act := act || format('expected an auto_roll resolution for seat 1, got %s; ', res);
  end if;
  if cs <> 1 then
    ok := false; act := act || format('current_seat moved to %s -- an auto-roll must not end the turn; ', cs);
  end if;

  insert into rg values (default,'BUG-003b','claim_timeout never fires early, and resolves a genuine expiry',
    'refused before the deadline; once it genuinely passes, an awaiting_roll stall auto-rolls for the stalled seat without ending their turn',
    case when ok then 'refused early claim; resolved to auto_roll for seat 1, current_seat unchanged' else act end,
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

  perform public.city_charge(m, 0, 50, 1, 'rent_paid');  -- seat 0 now owes seat 1: 50
  perform public.city_charge(m, 0, 40, 2, 'rent_paid');  -- a second charge lands before the first clears

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

-- ===========================================================================
-- BUG-005 — an off-turn debtor must still be able to raise funds (but not
-- build, which is not a raise-funds action and stays gated to current_seat)
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := true; act text := ''; after_debt int; creditor_cash int;
begin
  m := pg_temp.rg_match('CITYRG05', 5005);
  delete from public.city_assets where match_id=m;
  insert into public.city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged)
  values (m,1,0,0,false);
  -- price(1)=55, so mortgage raises 27 -- cash 10+27=37 covers the 35 owed,
  -- so the existing settle-on-cash trigger (0072) should immediately clear
  -- it: this proves the off-turn raise-funds path and the auto-settle path
  -- compose correctly, not just that the RPC call itself is unblocked.
  update public.city_match_players set cash=10, pending_debt=35, pending_creditor_seat=1
   where match_id=m and seat=0;
  update public.city_match_players set cash=0 where match_id=m and seat=1;
  update public.city_matches set current_seat=1, phase='optional_actions' where id=m;
  perform pg_temp.rg_as(0);

  begin
    perform public.city_mortgage(m, 1);
    select pending_debt into after_debt from public.city_match_players where match_id=m and seat=0;
    select cash into creditor_cash from public.city_match_players where match_id=m and seat=1;
    if after_debt <> 0 or creditor_cash <> 35 then
      ok := false; act := act || format(
        'mortgage ran but debt did not fully clear (pending_debt=%s, creditor cash=%s, want 0/35); ',
        after_debt, creditor_cash);
    end if;
  exception when others then
    ok := false; act := act || 'off-turn mortgage was wrongly refused: '||SQLERRM||'; ';
  end;

  begin
    perform public.city_build(m, 1);
    ok := false; act := act || 'city_build wrongly succeeded off-turn for a debtor; ';
  exception when others then
    null; -- expected to refuse, for any reason (not the property under test)
  end;

  insert into rg values (default,'BUG-005','an off-turn debtor can still raise funds (but not build)',
    'city_mortgage succeeds off-turn for a debtor and the raised cash clears the debt (creditor +35); city_build stays refused',
    case when ok then 'off-turn mortgage raised the debt to 0 and paid the creditor 35; city_build correctly refused'
         else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-011 — a debtor accepting a trade must not be able to strip assets to
-- an accomplice for less than the debt they owe; a trade that genuinely
-- clears the debt must still work (trade is a legitimate raise-funds path)
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := true; act text := '';
  bad_offer uuid; good_offer uuid; owner int; d int;
begin
  m := pg_temp.rg_match('CITYRG11', 5011);
  delete from public.city_assets where match_id=m;
  insert into public.city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged)
  values (m,1,0,0,false);
  update public.city_match_players set cash=5, pending_debt=50, pending_creditor_seat=2
   where match_id=m and seat=0;
  update public.city_matches set current_seat=1, phase='optional_actions' where id=m;

  -- seat 1 (not in debt) offers seat 0 a token 10 cash for the property --
  -- nowhere near the 50 owed. Proposing is fine; accepting must not be.
  perform pg_temp.rg_as(1);
  bad_offer := public.city_propose_trade(m, 0, '{}', array[1], 10, 0);

  perform pg_temp.rg_as(0);
  begin
    perform public.city_accept_trade(bad_offer);
    ok := false; act := act || 'debtor accepted a trade that left the debt uncovered; ';
  exception when others then
    if SQLERRM not like '%SETTLE_DEBT_FIRST%' then
      ok := false; act := act || 'wrong refusal reason: '||SQLERRM||'; ';
    end if;
  end;
  select owner_seat into owner from public.city_assets where match_id=m and space_idx=1;
  if owner <> 0 then
    ok := false; act := act || 'property moved despite the accept being refused; ';
  end if;

  -- a trade that DOES clear the debt must still go through.
  perform pg_temp.rg_as(1);
  good_offer := public.city_propose_trade(m, 0, '{}', array[1], 100, 0);
  perform pg_temp.rg_as(0);
  begin
    perform public.city_accept_trade(good_offer);
  exception when others then
    ok := false; act := act || 'a debt-clearing trade was wrongly refused: '||SQLERRM||'; ';
  end;
  select owner_seat into owner from public.city_assets where match_id=m and space_idx=1;
  select pending_debt into d from public.city_match_players where match_id=m and seat=0;
  if owner <> 1 then
    ok := false; act := act || 'debt-clearing trade did not transfer the property; ';
  end if;
  if d <> 0 then
    ok := false; act := act || format('debt should auto-clear via the cash trigger, still shows %s; ', d);
  end if;

  insert into rg values (default,'BUG-011','a debtor cannot strip assets via a non-clearing trade',
    'a sub-debt trade is refused (property stays put); a debt-clearing trade succeeds and auto-settles',
    case when ok then 'token trade refused, property untouched; full trade succeeded and cleared the debt'
         else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-029 — management actions (build/sell/mortgage/unmortgage/bankruptcy)
-- must respect match phase: none of them are legal during an active
-- auction, and city_build specifically must not run ahead of a still-
-- pending required decision
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRG29', 5029);
  delete from public.city_assets where match_id=m;
  insert into public.city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged)
  values (m,1,0,0,false),(m,3,0,0,false);
  update public.city_match_players set cash=1000, pending_debt=0 where match_id=m and seat=0;
  update public.city_matches set current_seat=0, phase='auction' where id=m;
  perform pg_temp.rg_as(0);

  begin
    perform public.city_mortgage(m, 1);
    ok := false; act := act || 'city_mortgage wrongly succeeded during an active auction; ';
  exception when others then
    if SQLERRM not like '%AUCTION_IN_PROGRESS%' then
      ok := false; act := act || 'wrong refusal during auction: '||SQLERRM||'; ';
    end if;
  end;

  update public.city_matches set phase='required_decision' where id=m;
  begin
    perform public.city_build(m, 1);
    ok := false; act := act || 'city_build wrongly succeeded during required_decision; ';
  exception when others then
    if SQLERRM not like '%DECISION_PENDING%' then
      ok := false; act := act || 'wrong refusal during required_decision: '||SQLERRM||'; ';
    end if;
  end;

  insert into rg values (default,'BUG-029','management actions respect match phase',
    'blocked during auction (CITY_AUCTION_IN_PROGRESS); city_build also blocked during required_decision (CITY_DECISION_PENDING)',
    case when ok then 'both correctly refused with the expected error codes' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-025 / BUG-021 — an outsider (member of no room) must not be able to
-- read city_assets, city_auctions, city_trade_offers or city_match_results
-- for a match in a room they never joined; a genuine room member still can
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := true; act text := '';
  outsider text := '00000000-0000-4000-8000-000000000099';
  n_assets int; n_auctions int; n_offers int; n_results int;
  n_assets_member int;
begin
  m := pg_temp.rg_match('CITYRG25', 5025);
  -- an owned asset, a running auction and a pending trade offer, inserted
  -- directly (as postgres) so every table has a real row to hide -- a fresh
  -- match owns nothing yet, so city_assets would otherwise be empty and the
  -- member positive-control would trivially "pass" for the wrong reason.
  insert into public.city_assets(match_id, space_idx, owner_seat, buildings, is_mortgaged)
  values (m, 3, 0, 0, false);
  insert into public.city_auctions(match_id, space_idx, ends_at, hard_ends_at)
  values (m, 1, now() + interval '15 seconds', now() + interval '2 minutes');
  insert into public.city_trade_offers(match_id, from_seat, to_seat, give_cash, created_turn, expires_at)
  values (m, 0, 1, 10, 0, now() + interval '3 minutes');
  update public.city_matches set status='finished', phase=null, current_seat=null, finished_at=now()
   where id=m;

  perform set_config('request.jwt.claims', json_build_object('sub',outsider,'role','authenticated')::text, true);
  perform set_config('role','authenticated',true);
  select count(*) into n_assets from public.city_assets where match_id=m;
  select count(*) into n_auctions from public.city_auctions where match_id=m;
  select count(*) into n_offers from public.city_trade_offers where match_id=m;
  select count(*) into n_results from public.city_match_results where match_id=m;
  perform pg_temp.rg_as(0);  -- seat 0, a genuine member, as a positive control
  select count(*) into n_assets_member from public.city_assets where match_id=m;
  perform set_config('role','postgres',true);

  if n_assets <> 0 then ok := false; act := act || format('outsider read %s city_assets rows; ', n_assets); end if;
  if n_auctions <> 0 then ok := false; act := act || format('outsider read %s city_auctions rows; ', n_auctions); end if;
  if n_offers <> 0 then ok := false; act := act || format('outsider read %s city_trade_offers rows; ', n_offers); end if;
  if n_assets_member = 0 then ok := false; act := act || 'a genuine room member was also blocked (over-tightened); '; end if;

  insert into rg values (default,'BUG-025','an outsider cannot read another room''s match state',
    'city_assets/city_auctions/city_trade_offers all return 0 rows to an outsider; a genuine member still sees them',
    case when ok then format('outsider: 0/0/0 rows; member: %s city_assets rows', n_assets_member) else act end,
    case when ok then 'PASS' else 'FAIL' end);

  insert into rg values (default,'BUG-021','city_match_results respects the caller''s own RLS, not the view owner''s',
    'a finished match''s results row returns 0 rows to an outsider',
    case when n_results = 0 then 'outsider read 0 rows' else format('outsider read %s rows', n_results) end,
    case when n_results = 0 then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-026 — city_matches and city_match_players must refuse a raw client
-- write at the grant level, not merely via an absent RLS policy
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRG26', 5026);
  perform pg_temp.rg_as(0);
  perform set_config('role','authenticated',true);

  begin
    update public.city_matches set current_seat = 7 where id = m;
    ok := false; act := act || 'authenticated UPDATE on city_matches was NOT refused; ';
  exception when insufficient_privilege then
    null; -- expected
  when others then
    ok := false; act := act || 'wrong error on city_matches UPDATE: '||SQLERRM||'; ';
  end;

  begin
    update public.city_match_players set cash = 999999 where match_id = m and seat = 0;
    ok := false; act := act || 'authenticated UPDATE on city_match_players was NOT refused; ';
  exception when insufficient_privilege then
    null; -- expected
  when others then
    ok := false; act := act || 'wrong error on city_match_players UPDATE: '||SQLERRM||'; ';
  end;

  perform set_config('role','postgres',true);
  insert into rg values (default,'BUG-026','city_matches/city_match_players refuse raw client writes',
    'a permission-denied error (42501) at the grant level, not merely an RLS policy gap',
    case when ok then 'both UPDATEs refused with insufficient_privilege' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-027 — a fresh match seed must come from a CSPRNG, not Postgres's
-- plain (non-cryptographic) random()
-- ===========================================================================
do $blk$
declare src text; ok boolean;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'city_create_match';
  ok := src like '%gen_random_bytes%' and src not like '%:= (random()%';
  insert into rg values (default,'BUG-027','a fresh match seed is CSPRNG-derived',
    'city_create_match sources its seed from gen_random_bytes, not random()',
    case when ok then 'gen_random_bytes present, no bare random() seed assignment'
         else 'still derives the seed from random(), or gen_random_bytes is missing' end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-015 — a card that charges the drawing player directly must set
-- required_decision when it can't be paid outright, not get silently
-- clobbered back to optional_actions
-- ===========================================================================
-- Seed 5015 is chosen so that, with a fresh match's bp_draw=0..15 sequence,
-- setting bp_draw=12 makes city_draw_card('boarding_pass') return card id 8
-- ("pay 75") -- confirmed directly against the live derivation before
-- writing this. Seat 0's position (18) plus the seed's dice roll at
-- rng_counter=0 ({3,1}, total 4) lands exactly on space 22, a boarding_pass
-- card space -- chosen specifically so the landing does NOT also cross
-- Departure: an earlier draft used position 38 (wrapping through Departure
-- to reach space 2), which pays a 200 salary as part of the same roll
-- *before* the card resolves and silently made the 75 charge affordable,
-- producing a false pass for the wrong reason. Caught by actually reading
-- city_roll_dice's return payload instead of trusting the phase check alone.
do $blk$
declare m uuid; ok boolean; ph text; pd int;
begin
  m := pg_temp.rg_match('CITYRG15', 5015);
  delete from public.city_assets where match_id=m;
  insert into public.city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged)
  values (m,26,0,0,false);  -- liquidation headroom: 255/2=127, comfortably covers 75
  update public.city_match_players set cash=10, position=18, pending_debt=0 where match_id=m and seat=0;
  update public.city_matches set current_seat=0, phase='awaiting_roll', rng_counter=0, bp_draw=12 where id=m;

  perform pg_temp.rg_as(0);
  perform public.city_roll_dice(m);

  select phase into ph from public.city_matches where id=m;
  select pending_debt into pd from public.city_match_players where match_id=m and seat=0;
  ok := ph = 'required_decision';

  insert into rg values (default,'BUG-015','an unaffordable direct card charge sets required_decision',
    'landing on a "pay 75" card with only 10 cash leaves phase=required_decision, not optional_actions',
    format('phase=%s, pending_debt=%s', ph, pd),
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-016 — no card may be skipped entirely across a round when the
-- Transit Visa is picked up mid-round
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := true; act text := '';
  drawn integer[] := '{}'; card_row public.city_cards; i int; missing integer[];
begin
  m := pg_temp.rg_match('CITYRG16', 5016);
  update public.city_matches set cf_draw = 0 where id = m;

  for i in 1..8 loop
    card_row := public.city_draw_card(m, 'city_fund');
    drawn := drawn || card_row.id;
  end loop;

  -- the visa is picked up mid-round -- exactly the live-state change that
  -- corrupted the old size-based round/position math
  update public.city_match_players set transit_visas = 1 where match_id = m and seat = 1;

  for i in 1..8 loop
    card_row := public.city_draw_card(m, 'city_fund');
    drawn := drawn || card_row.id;
  end loop;

  select array_agg(id) into missing
    from public.city_cards
   where deck = 'city_fund' and id <> 23 and id <> all(drawn);

  if missing is not null then
    ok := false; act := format('never drawn across 16 draws: %s', missing);
  end if;

  insert into rg values (default,'BUG-016','no card is skipped entirely when the visa is picked up mid-round',
    'all 15 non-visa city_fund cards appear at least once across 16 draws',
    case when ok then 'all 15 non-visa cards appeared' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-017 — "double the usual rent" must actually double what the space's
-- own rent formula computes, not silently do nothing
-- ===========================================================================
do $blk$
declare m uuid; card_row public.city_cards; cash0 int; cash1 int; charged int;
begin
  m := pg_temp.rg_match('CITYRG17', 5017);
  delete from public.city_assets where match_id=m;
  -- idx 26: base rent 23, a 3-property group, seat 1 owns only this one --
  -- not a complete set, so the "double for a complete set" rule inside
  -- city_rent_for itself can't also be in play and confound the expected value.
  insert into public.city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged)
  values (m,26,1,0,false);
  update public.city_match_players set cash=1000 where match_id=m and seat=0;
  select cash into cash0 from public.city_match_players where match_id=m and seat=1;

  card_row.id := -1; card_row.deck := 'boarding_pass'; card_row.text := 'regression test card';
  card_row.effect := '{"idx":26,"kind":"advance_to","rent_multiplier":2}'::jsonb;
  perform public.city_apply_card(m, 0, card_row, 6);

  select cash into cash1 from public.city_match_players where match_id=m and seat=1;
  charged := cash1 - cash0;

  insert into rg values (default,'BUG-017','a rent-multiplier card doubles the actual rent',
    'seat 1 receives 46 (base rent 23 x 2), not the unscaled 23',
    format('seat 1 received %s (cash %s -> %s)', charged, cash0, cash1),
    case when charged = 46 then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-032 — card 10 charges a flat 10x the roll, not 24x when both
-- utilities are held
-- ===========================================================================
do $blk$
declare m uuid; card_row public.city_cards; cash0 int; cash1 int; charged int;
begin
  m := pg_temp.rg_match('CITYRG32', 5032);
  delete from public.city_assets where match_id=m;
  insert into public.city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged)
  values (m,12,1,0,false),(m,28,1,0,false);  -- seat 1 holds both utilities
  update public.city_match_players set cash=1000 where match_id=m and seat=0;
  select cash into cash0 from public.city_match_players where match_id=m and seat=1;

  select * into card_row from public.city_cards where id = 10;
  perform public.city_apply_card(m, 0, card_row, 6);  -- roll of 6 -> expect 60, not 144 or 72

  select cash into cash1 from public.city_match_players where match_id=m and seat=1;
  charged := cash1 - cash0;

  insert into rg values (default,'BUG-032','card 10 charges a flat ten times the roll',
    'a roll of 6 against an owner holding both utilities charges exactly 60, matching CONTENT.md''s own text',
    format('charged %s (cash %s -> %s)', charged, cash0, cash1),
    case when charged = 60 then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-030 — mortgage and unmortgage must round the true fractional
-- half-price, not a value already truncated by integer division
-- ===========================================================================
do $blk$
declare m uuid; r jsonb; raised int; cost int; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRG30', 5030);
  delete from public.city_assets where match_id=m;
  insert into public.city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged)
  values (m,1,0,0,false);  -- Porto, price 55
  perform pg_temp.rg_as(0);

  r := public.city_mortgage(m, 1);
  raised := (r->>'raised')::int;
  if raised <> 28 then
    ok := false; act := act || format('mortgage raised %s, expected 28 (round(55/2.0)); ', raised);
  end if;

  r := public.city_unmortgage(m, 1);
  cost := (r->>'cost')::int;
  if cost <> 31 then
    ok := false; act := act || format('unmortgage cost %s, expected 31 (ceil(55/2.0*1.1)); ', cost);
  end if;

  insert into rg values (default,'BUG-030','mortgage/unmortgage round the true fractional half-price',
    'Porto (price 55): mortgage raises 28, unmortgage costs 31 -- not 27/30, integer division''s truncated values',
    case when ok then format('raised %s, unmortgage cost %s', raised, cost) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-022 — a City room's capacity must not silently cap spectators
-- ===========================================================================
do $blk$
declare ok boolean := true; act text := '';
  v_host text := '99999999-0000-4000-8000-000000000222';
  v_p2 text := '11111111-1111-4111-8111-111199999999';
  v_p3 text := '22222222-2222-4222-8222-222299999999';
begin
  perform set_config('app.force_close_room','true',true);
  delete from public.rooms where code in ('CITYRG22','CITYRG22B');
  perform set_config('app.force_close_room','false',true);

  -- a 2-capacity CITY room: fill it to its stated capacity, then a 3rd,
  -- purely-spectating join must still succeed.
  insert into public.rooms (code,name,type,host_id,is_public,max_participants)
  values ('CITYRG22','rg','city',v_host,false,2);
  insert into public.room_participants (room_id,user_id,username,is_online) values ('CITYRG22',v_host,'host',true);
  insert into public.room_participants (room_id,user_id,username,is_online) values ('CITYRG22',v_p2,'P2',true);
  begin
    insert into public.room_participants (room_id,user_id,username,is_online) values ('CITYRG22',v_p3,'Spectator',true);
  exception when others then
    ok := false; act := act || 'a 3rd, purely-spectating join to a 2-capacity city room was refused: '||SQLERRM||'; ';
  end;

  -- negative control: a same-capacity NON-city room must still enforce it,
  -- proving the fix is scoped to city rooms, not a blanket capacity bypass.
  insert into public.rooms (code,name,type,host_id,is_public,max_participants)
  values ('CITYRG22B','rg','trivia',v_host,false,2);
  insert into public.room_participants (room_id,user_id,username,is_online) values ('CITYRG22B',v_host,'host',true);
  insert into public.room_participants (room_id,user_id,username,is_online) values ('CITYRG22B',v_p2,'P2',true);
  begin
    insert into public.room_participants (room_id,user_id,username,is_online) values ('CITYRG22B',v_p3,'P3',true);
    ok := false; act := act || 'a non-city room let a 3rd participant bypass its own 2-participant capacity too; ';
  exception when others then
    null; -- expected: still enforced for non-city rooms
  end;

  insert into rg values (default,'BUG-022','a city room''s capacity does not cap spectators',
    'a 3rd, non-seated joiner succeeds in a full 2-capacity city room; the same scenario for a non-city room still refuses',
    case when ok then 'city room admitted the spectator; non-city room still enforced its own cap' else act end,
    case when ok then 'PASS' else 'FAIL' end);

  delete from public.rooms where code in ('CITYRG22','CITYRG22B');
end $blk$;

-- ===========================================================================
-- BUG-033 (pace_seconds half) — the host can set the match pace at creation
-- ===========================================================================
do $blk$
declare mid uuid; actual_pace int; ok boolean := true; act text := '';
  v_host text := '99999999-0000-4000-8000-000000000233';
begin
  perform set_config('app.force_close_room','true',true);
  delete from public.rooms where code='CITYRG33';
  perform set_config('app.force_close_room','false',true);
  insert into public.rooms (code,name,type,host_id,is_public,max_participants)
  values ('CITYRG33','rg','city',v_host,false,8);
  insert into public.room_participants (room_id,user_id,username,is_online) values ('CITYRG33',v_host,'host',true);
  perform set_config('request.jwt.claims', json_build_object('sub',v_host,'role','service_role')::text,true);

  begin
    perform public.city_create_match('CITYRG33','classic',null,null,99);
    ok := false; act := act || 'an invalid pace_seconds (99) was accepted; ';
  exception when others then
    if SQLERRM not like '%CITY_INVALID_PACE%' then
      ok := false; act := act || 'wrong error for an invalid pace: '||SQLERRM||'; ';
    end if;
  end;

  mid := public.city_create_match('CITYRG33','classic',null,null,60);
  select pace_seconds into actual_pace from public.city_matches where id=mid;
  if actual_pace <> 60 then
    ok := false; act := act || format('pace_seconds is %s, expected 60; ', actual_pace);
  end if;

  insert into rg values (default,'BUG-033','the host can set the match pace at creation',
    'an invalid pace (99) is refused with CITY_INVALID_PACE; a valid pace (60) persists to the match row',
    case when ok then format('invalid pace refused correctly; pace_seconds=%s', actual_pace) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-E (FR-29) — a seated player can voluntarily retire, and it hands
-- off the turn exactly like a kick when it was theirs.
-- ===========================================================================
do $blk$
declare m uuid; st1 text; st0 text; cs int; mstatus text; winner int; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGE1', 71);

  -- Off-turn retire (seat 1, current_seat is 0): status flips, turn untouched.
  perform pg_temp.rg_as(1);
  perform public.city_retire_self(m);
  select status into st1 from public.city_match_players where match_id=m and seat=1;
  select current_seat into cs from public.city_matches where id=m;
  if st1 <> 'retired' then
    ok := false; act := act || format('seat 1 status is %L after retiring off-turn, expected retired; ', st1);
  end if;
  if cs <> 0 then
    ok := false; act := act || format('current_seat moved to %s after an OFF-turn retire; ', cs);
  end if;

  -- The two negative cases have to run here, with the match still active and
  -- two of three seats still live -- one seat away from last-player-standing
  -- legitimately finishing the match (checked further down), which would
  -- otherwise make CITY_MATCH_NOT_ACTIVE mask the specific error each of
  -- these is actually testing for.
  begin
    perform pg_temp.rg_as(1);
    perform public.city_retire_self(m);
    ok := false; act := act || 'an already-retired seat was allowed to retire again; ';
  exception when others then
    if SQLERRM not like '%CITY_SEAT_OUT%' then
      ok := false; act := act || 'wrong error for an already-retired seat: '||SQLERRM||'; ';
    end if;
  end;

  begin
    perform pg_temp.rg_as_host('CITYRGE1');
    perform public.city_retire_self(m);
    ok := false; act := act || 'a never-seated caller was allowed to retire; ';
  exception when others then
    if SQLERRM not like '%CITY_NOT_SEATED%' then
      ok := false; act := act || 'wrong error for a never-seated caller: '||SQLERRM||'; ';
    end if;
  end;

  -- On-turn retire (seat 0 IS current_seat): hands off to the next live seat.
  -- Seat 1 is already retired, so the only remaining seat is 2 -- which also
  -- makes this the last-player-standing case (DESIGN.md §3.1D), finishing
  -- the match the same way city_bankrupt_seat's own trigger does.
  perform pg_temp.rg_as(0);
  perform public.city_retire_self(m);
  select status into st0 from public.city_match_players where match_id=m and seat=0;
  select status, current_seat into mstatus, cs from public.city_matches where id=m;
  if st0 <> 'retired' then
    ok := false; act := act || format('seat 0 status is %L after retiring, expected retired; ', st0);
  end if;
  if mstatus <> 'finished' then
    ok := false; act := act || format('match status is %L after only seat 2 remained, expected finished; ', mstatus);
  end if;

  insert into rg values (default,'BUG-007-E','a seated player can voluntarily retire (FR-29)',
    'off-turn retire flips status without touching current_seat; retiring twice or retiring unseated are both refused; retiring down to the last player finishes the match',
    case when ok then 'retire-self behaves correctly in all four scenarios' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-A (FR-25) — a disconnect is tracked without any client heartbeat,
-- bridged from the site-wide room_participants.is_online presence system.
-- ===========================================================================
do $blk$
declare m uuid; d1 timestamptz; d1_after_reconnect timestamptz; autopilot_after int;
  ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGA1', 72);

  -- Disconnect (seat 1): disconnected_at is stamped.
  update public.room_participants set is_online = false
   where room_id = 'CITYRGA1' and user_id = (
     select user_id from public.city_match_players where match_id=m and seat=1);
  select disconnected_at into d1 from public.city_match_players where match_id=m and seat=1;
  if d1 is null then
    ok := false; act := act || 'disconnected_at was not stamped after is_online flipped false; ';
  end if;

  -- Seed a nonzero autopilot streak by hand, to prove reconnect genuinely
  -- resets it rather than it coincidentally already reading 0.
  update public.city_match_players set consecutive_autopilot_turns = 2
   where match_id=m and seat=1;

  -- Reconnect: disconnected_at clears, the autopilot streak resets.
  update public.room_participants set is_online = true
   where room_id = 'CITYRGA1' and user_id = (
     select user_id from public.city_match_players where match_id=m and seat=1);
  select disconnected_at, consecutive_autopilot_turns
    into d1_after_reconnect, autopilot_after
    from public.city_match_players where match_id=m and seat=1;
  if d1_after_reconnect is not null then
    ok := false; act := act || 'disconnected_at was not cleared on reconnect; ';
  end if;
  if autopilot_after <> 0 then
    ok := false; act := act || format('consecutive_autopilot_turns is %s after reconnect, expected reset to 0; ', autopilot_after);
  end if;

  -- A terminal seat (bankrupt) must not be tracked -- there is no clock or
  -- autopilot left to protect for a seat already out of the match.
  update public.city_match_players set status = 'bankrupt' where match_id=m and seat=2;
  update public.room_participants set is_online = false
   where room_id = 'CITYRGA1' and user_id = (
     select user_id from public.city_match_players where match_id=m and seat=2);
  perform 1 from public.city_match_players where match_id=m and seat=2 and disconnected_at is not null;
  if found then
    ok := false; act := act || 'a bankrupt seat''s disconnected_at was stamped; ';
  end if;

  insert into rg values (default,'BUG-007-A','a disconnect is tracked from the existing presence system (FR-25)',
    'is_online flipping false stamps disconnected_at; flipping back true clears it and resets consecutive_autopilot_turns; a terminal (bankrupt) seat is never tracked',
    case when ok then 'disconnect/reconnect tracking behaves correctly in all three scenarios' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-B (FR-41) — every claim_timeout resolution branch: auto-roll,
-- auto-decline, a detention attempt, end-turn, and bankrupt (the last two
-- already existed and must stay exactly as they were).
-- ===========================================================================
do $blk$
declare m uuid; res jsonb; cs int; prop_idx int; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGB1', 73);
  select min(idx) into prop_idx from public.city_board_spaces where price is not null;

  -- (a) awaiting_roll -> auto-roll. Already re-verified in BUG-003b above
  -- with its own dedicated setup; not repeated here.

  -- (b) required_decision (may_buy, no debt -- the only way this phase is
  -- reached once the debt branch above has already been ruled out) ->
  -- decline. 3 active debt-free seats means this also opens a real auction
  -- as a side effect, exactly like a human declining would.
  update public.city_match_players set position = prop_idx where match_id=m and seat=0;
  update public.city_matches set current_seat=0, phase='required_decision',
    turn_clock_paused_at=null,
    turn_started_at = now() - interval '41 seconds' where id=m;
  update public.city_match_players set in_detention=false, pending_debt=0, pending_creditor_seat=null
   where match_id=m and seat=0;
  perform pg_temp.rg_as(1);
  select public.city_claim_timeout(m) into res;
  if res->>'resolution' <> 'auto_decline' or (res->>'seat')::int <> 0 then
    ok := false; act := act || format('expected auto_decline for seat 0, got %s; ', res);
  end if;
  select current_seat into cs from public.city_matches where id=m;
  if cs <> 0 then
    ok := false; act := act || format('current_seat moved to %s -- a decline must not end the turn; ', cs);
  end if;

  -- (c) detention -> attempt doubles. city_leave_detention_core's own
  -- 'roll' method requires phase='awaiting_roll' (matching a real detained
  -- player, who can never advance past it) -- not phase-branched on by
  -- claim_timeout itself, which checks in_detention before phase at all.
  update public.city_matches set current_seat=0, phase='awaiting_roll',
    turn_clock_paused_at=null, turn_started_at = now() - interval '41 seconds' where id=m;
  update public.city_match_players set in_detention=true, detention_turns=0,
    pending_debt=0, pending_creditor_seat=null where match_id=m and seat=0;
  perform pg_temp.rg_as(1);
  select public.city_claim_timeout(m) into res;
  if res->>'resolution' <> 'detention_roll' or (res->>'seat')::int <> 0 then
    ok := false; act := act || format('expected detention_roll for seat 0, got %s; ', res);
  end if;
  select current_seat into cs from public.city_matches where id=m;
  if cs <> 0 then
    ok := false; act := act || format('current_seat moved to %s -- a detention attempt must not end the turn; ', cs);
  end if;

  -- (d) optional_actions -> end-turn, unchanged from 0076.
  update public.city_match_players set in_detention=false where match_id=m and seat=0;
  update public.city_matches set current_seat=0, phase='optional_actions',
    turn_clock_paused_at=null, turn_started_at = now() - interval '41 seconds' where id=m;
  perform pg_temp.rg_as(1);
  select public.city_claim_timeout(m) into res;
  if res->>'resolution' <> 'end_turn' or (res->>'seat')::int <> 0 then
    ok := false; act := act || format('expected end_turn for seat 0, got %s; ', res);
  end if;
  select current_seat into cs from public.city_matches where id=m;
  if cs = 0 then
    ok := false; act := act || 'current_seat did not advance on an end_turn resolution; ';
  end if;

  -- (e) pending_debt -> bankrupt. Reset current_seat back to 0 explicitly,
  -- since (d) just moved it on. Round H: the debt branch now runs on its
  -- own fixed 90s window (debt_started_at), not the generic pace-based
  -- deadline every other branch uses -- left null here (this raw UPDATE
  -- bypasses city_charge, which is what actually stamps it), so
  -- coalesce() falls back to turn_started_at, meaning this backdate must
  -- clear 90s, not merely the old 41s pace-based threshold.
  update public.city_matches set current_seat=0, phase='required_decision',
    turn_clock_paused_at=null, turn_started_at = now() - interval '95 seconds' where id=m;
  update public.city_match_players set pending_debt=9999, pending_creditor_seat=null
   where match_id=m and seat=0;
  perform pg_temp.rg_as(1);
  select public.city_claim_timeout(m) into res;
  if res->>'resolution' <> 'bankrupt' or (res->>'seat')::int <> 0 then
    ok := false; act := act || format('expected bankrupt for seat 0, got %s; ', res);
  end if;
  perform 1 from public.city_match_players where match_id=m and seat=0 and status='bankrupt';
  if not found then
    ok := false; act := act || 'seat 0 was not actually marked bankrupt; ';
  end if;

  insert into rg values (default,'BUG-007-B','every claim_timeout resolution branch behaves correctly (FR-41)',
    'required_decision defaults to decline, detention defaults to a doubles attempt, optional_actions still ends the turn, and pending_debt still bankrupts -- none of the turn-preserving defaults advance current_seat',
    case when ok then 'all five resolution branches behave correctly' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-B (auction clock shift) — settling an auction must preserve the
-- active player's true remaining time, not silently expire or reset it.
-- ===========================================================================
do $blk$
declare m uuid; before_deadline timestamptz; after_deadline timestamptz;
  remaining_before numeric; remaining_after numeric; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGB2', 74);

  -- 5 seconds into a 40s turn, an auction opens (mirrors city_decline_purchase
  -- opening one) and runs for a simulated 90 seconds -- longer than the
  -- entire base turn clock, the exact scenario the bug allowed to silently
  -- expire the player's clock.
  update public.city_matches
     set current_seat=0, phase='auction', pace_seconds=40,
         turn_started_at = now() - interval '5 seconds',
         turn_clock_paused_at = now() - interval '90 seconds'
   where id=m;
  before_deadline := (select turn_started_at + make_interval(secs => pace_seconds) from public.city_matches where id=m);
  remaining_before := extract(epoch from (before_deadline - (now() - interval '90 seconds')));

  insert into public.city_auctions (match_id, space_idx, ends_at, hard_ends_at, status)
  values (m, (select min(idx) from public.city_board_spaces where price is not null),
    now() - interval '80 seconds', now() - interval '80 seconds', 'running');

  perform public.city_settle_auction(m, true);

  select turn_started_at + make_interval(secs => pace_seconds) into after_deadline
    from public.city_matches where id=m;
  remaining_after := extract(epoch from (after_deadline - now()));

  -- The true remaining time at the moment the auction opened (35s: 40s base
  -- minus the 5s already spent) must survive the settle, within a couple of
  -- seconds of wall-clock slop for the test itself running.
  if abs(remaining_after - remaining_before) > 2 then
    ok := false; act := act || format(
      'remaining time drifted across settle: %s before opening the auction vs %s after settling, expected them to match; ',
      round(remaining_before::numeric, 1), round(remaining_after::numeric, 1));
  end if;

  insert into rg values (default,'BUG-007-B-auction','settling an auction shifts the deadline forward by the pause duration',
    'the true remaining turn-clock time at the moment the auction opened survives the settle, not silently docked by however long the auction ran',
    case when ok then format('remaining time preserved (%s before, %s after)',
      round(remaining_before::numeric, 1), round(remaining_after::numeric, 1)) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-B (FR-44) — the turn clock resets on every doubles re-roll, not
-- just a genuine new turn. Already correct behavior (city_end_turn sets
-- turn_started_at unconditionally, even on the re-roll branch) -- this locks
-- it in with a real assertion, since nothing tested it before this round.
-- ===========================================================================
do $blk$
declare m uuid; before_ts timestamptz; after_ts timestamptz; cs int;
  ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGB3', 75);
  update public.city_matches set current_seat=0, phase='optional_actions',
    doubles_count=1, turn_started_at = now() - interval '30 seconds' where id=m;
  select turn_started_at into before_ts from public.city_matches where id=m;

  perform pg_temp.rg_as(0);
  perform public.city_end_turn(m);

  select current_seat, turn_started_at into cs, after_ts from public.city_matches where id=m;
  if cs <> 0 then
    ok := false; act := act || format('a doubles re-roll changed current_seat to %s, expected it to stay 0; ', cs);
  end if;
  if after_ts <= before_ts then
    ok := false; act := act || 'turn_started_at was not reset on a doubles re-roll; ';
  end if;

  insert into rg values (default,'BUG-007-B-doubles','the turn clock resets on a doubles re-roll (FR-44)',
    'current_seat stays the same seat, but turn_started_at is reset to a fresh value',
    case when ok then 'doubles re-roll kept current_seat and reset the clock' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-B (FR-50) — timed mode is pure wall-clock and only ends the match
-- at a round boundary. Already correct behavior (city_end_turn's own
-- v_expired check) -- locked in with a real assertion for the first time.
-- ===========================================================================
do $blk$
declare m uuid; st text; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGB4', 76);
  -- Already past its own (minimum allowed, 10-minute) limit -- proves
  -- expiry is wall-clock (started_at-based), not dependent on the per-turn
  -- clock at all.
  update public.city_matches set mode='timed', time_limit_minutes=10,
    started_at = now() - interval '15 minutes', current_seat=0,
    phase='optional_actions' where id=m;

  -- Seat 0 -> seat 1: not a round boundary (1 > 0), so the match must stay
  -- active even though the time limit has already passed.
  perform pg_temp.rg_as(0);
  perform public.city_end_turn(m);
  select status into st from public.city_matches where id=m;
  if st <> 'active' then
    ok := false; act := act || format('match ended mid-round (seat 0->1) with status %L, expected still active; ', st);
  end if;

  update public.city_matches set phase='optional_actions' where id=m;
  perform pg_temp.rg_as(1);
  perform public.city_end_turn(m);
  select status into st from public.city_matches where id=m;
  if st <> 'active' then
    ok := false; act := act || format('match ended mid-round (seat 1->2) with status %L, expected still active; ', st);
  end if;

  -- Seat 2 -> seat 0: wraps around, a genuine round boundary. Now it may end.
  update public.city_matches set phase='optional_actions' where id=m;
  perform pg_temp.rg_as(2);
  perform public.city_end_turn(m);
  select status into st from public.city_matches where id=m;
  if st <> 'finished' then
    ok := false; act := act || format('match did not end at the round boundary (seat 2->0), status is %L; ', st);
  end if;

  insert into rg values (default,'BUG-007-B-timed','timed mode is wall-clock and only ends at a round boundary (FR-50)',
    'an expired time limit does not end the match mid-round, only once every seat has had an equal turn',
    case when ok then 'match stayed active mid-round and correctly finished at the round boundary' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-C (FR-33/DESIGN.md §3.1D) — auto-liquidation actually liquidates
-- when possible, and still falls back to bankruptcy when it genuinely can't.
-- ===========================================================================
do $blk$
declare m uuid; prop_idx int; prop_price int; expected_raise int;
  cleared boolean; debt int; mortgaged boolean; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGC1', 77);
  select idx, price into prop_idx, prop_price from public.city_board_spaces
   where price is not null order by idx limit 1;

  -- Seat 0 owns one unmortgaged, undeveloped property and owes just what
  -- mortgaging it alone raises -- liquidation must succeed without
  -- bankrupting them.
  insert into public.city_assets (match_id, space_idx, owner_seat) values (m, prop_idx, 0);
  expected_raise := round(prop_price / 2.0)::integer;
  update public.city_match_players set pending_debt = expected_raise, pending_creditor_seat = null
   where match_id=m and seat=0;

  select public.city_liquidate_for_debt(m, 0) into cleared;
  select pending_debt into debt from public.city_match_players where match_id=m and seat=0;
  select is_mortgaged into mortgaged from public.city_assets where match_id=m and space_idx=prop_idx;

  if not cleared or debt <> 0 or not mortgaged then
    ok := false; act := act || format(
      'expected liquidation to succeed via mortgage: cleared=%s debt=%s mortgaged=%s; ',
      cleared, debt, mortgaged);
  end if;
  perform 1 from public.city_match_players where match_id=m and seat=0 and status='bankrupt';
  if found then
    ok := false; act := act || 'seat 0 was bankrupted despite having enough to liquidate; ';
  end if;

  -- Seat 1 owns nothing at all -- liquidation has nothing to sell, so it
  -- must fall back to bankruptcy rather than leaving the debt stuck.
  update public.city_match_players set pending_debt = 500, pending_creditor_seat = null
   where match_id=m and seat=1;
  select public.city_liquidate_for_debt(m, 1) into cleared;
  perform 1 from public.city_match_players where match_id=m and seat=1 and status='bankrupt';
  if cleared or not found then
    ok := false; act := act || 'seat 1 (owns nothing) was not bankrupted as the safety-net fallback; ';
  end if;

  insert into rg values (default,'BUG-007-C','auto-liquidation sells/mortgages before bankruptcy (DESIGN.md §3.1D)',
    'a debtor who owns enough to cover it is liquidated, not bankrupted; a debtor with nothing to sell still falls back to bankruptcy',
    case when ok then 'liquidation succeeded when possible and fell back to bankruptcy when not' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-C (FR-26/FR-27) — a fully away seat's entire turn resolves
-- automatically the instant it's handed to them, with no client involved.
-- ===========================================================================
do $blk$
declare m uuid; cs int; streak int; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGC2', 78);

  -- Seat 1 has been disconnected well past the 60s grace period. Parked 5
  -- spaces short of Customs (idx 10, a plain corner -- seed 78's very first
  -- roll is a deterministic {1,4}) so the autopiloted roll lands somewhere
  -- with no card draw, tax, or purchase decision to complicate this
  -- specific assertion -- required_decision/auction paths are already
  -- covered by their own dedicated tests above.
  update public.city_match_players set disconnected_at = now() - interval '90 seconds',
    position = 5
   where match_id=m and seat=1;

  -- Seat 0 (present) ends an ordinary turn.
  update public.city_matches set current_seat=0, phase='optional_actions' where id=m;
  perform pg_temp.rg_as(0);
  perform public.city_end_turn(m);

  select current_seat into cs from public.city_matches where id=m;
  if cs <> 2 then
    ok := false; act := act || format(
      'current_seat is %s -- expected the cascade to skip straight past away seat 1 to seat 2; ', cs);
  end if;

  select consecutive_autopilot_turns into streak from public.city_match_players
   where match_id=m and seat=1;
  if streak <> 1 then
    ok := false; act := act || format('seat 1''s autopilot streak is %s, expected 1; ', streak);
  end if;

  -- The away seat's own status must stay a normal, still-in-the-match seat
  -- -- autopilot is not itself a penalty.
  perform 1 from public.city_match_players where match_id=m and seat=1 and status='active';
  if not found then
    ok := false; act := act || 'seat 1''s status changed after a single autopiloted turn; ';
  end if;

  insert into rg values (default,'BUG-007-C-cascade','an away seat''s turn resolves fully automatically (FR-26/FR-27)',
    'ending seat 0''s turn skips straight past away seat 1 (streak=1, still active) to present seat 2, with no client action for seat 1',
    case when ok then 'cascade correctly skipped the away seat and landed on the next present one' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-C (FR-27, doubles) — a free doubles re-roll is taken automatically
-- within one autopiloted pass, not left owed forever.
-- ===========================================================================
do $blk$
declare m uuid; pos_before int; pos_after int; result text; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGC3', 79);
  update public.city_match_players set position = 0 where match_id=m and seat=0;
  select position into pos_before from public.city_match_players where match_id=m and seat=0;

  -- A bonus roll is owed (as if the seat had just rolled doubles once) and
  -- nothing else is pending.
  update public.city_matches set current_seat=0, phase='optional_actions', doubles_count=1 where id=m;
  update public.city_match_players set pending_debt=0, in_detention=false where match_id=m and seat=0;

  select public.city_resolve_autopilot_turn(m, 0) into result;
  select position into pos_after from public.city_match_players where match_id=m and seat=0;

  -- The seat must have actually moved -- proof the bonus roll was taken,
  -- not silently discarded (landing on position 0 again is a 1-in-40 fluke
  -- for any single die-pair sum on a 40-space board, negligible here).
  if pos_after = pos_before then
    ok := false; act := act || 'position 0 -> 0 after resolution -- the owed re-roll does not appear to have been taken; ';
  end if;
  if result not in ('concluded', 'auction_pending') then
    ok := false; act := act || format('resolution ended in unexpected state %L; ', result);
  end if;

  insert into rg values (default,'BUG-007-C-doubles','autopilot takes an owed doubles re-roll instead of ending the turn early',
    'a seat with doubles_count=1 and nothing else pending actually rolls again (position changes) before the turn concludes',
    case when ok then format('position moved %s -> %s, resolution=%s', pos_before, pos_after, result) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-C (FR-28) — two consecutive fully-autopiloted turns forces retire.
-- ===========================================================================
do $blk$
declare m uuid; st text; cs int; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGC4', 80);

  -- Same deterministic-landing setup as BUG-007-C-cascade above (seed 80's
  -- first roll is {2,3}, parked 5 short of the plain Customs corner).
  update public.city_match_players set disconnected_at = now() - interval '90 seconds',
    consecutive_autopilot_turns = 1, position = 5
   where match_id=m and seat=1;

  update public.city_matches set current_seat=0, phase='optional_actions' where id=m;
  perform pg_temp.rg_as(0);
  perform public.city_end_turn(m);

  select status into st from public.city_match_players where match_id=m and seat=1;
  if st <> 'retired' then
    ok := false; act := act || format('seat 1''s status is %L after a 2nd consecutive autopiloted turn, expected retired; ', st);
  end if;

  select current_seat into cs from public.city_matches where id=m;
  if cs = 1 then
    ok := false; act := act || 'current_seat is still the now-retired seat 1; ';
  end if;

  insert into rg values (default,'BUG-007-C-forfeit','2 consecutive autopiloted turns forces retire (FR-28)',
    'a seat entering its 2nd straight autopiloted turn is retired, not merely autopiloted a 2nd time',
    case when ok then format('seat 1 retired; current_seat moved on to %s', cs) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-C (FR-27, kick edge case) — a kick handing the turn directly to an
-- already-away seat triggers autopilot immediately, not just on the next
-- clock expiry.
-- ===========================================================================
do $blk$
declare m uuid; cs int; ts_fresh boolean; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGC5', 81);

  -- Seat 1, who will inherit the turn the instant seat 0 is kicked, is
  -- already well past the grace period. Parked 7 short of the plain
  -- Customs corner -- seed 81's first roll is a deterministic {1,6}.
  update public.city_match_players set disconnected_at = now() - interval '90 seconds',
    position = 3
   where match_id=m and seat=1;
  -- FR-47: seeded deliberately stale, so a handoff that ever forgot to
  -- reset it would leave this exactly as far in the past.
  update public.city_matches set current_seat=0, phase='optional_actions',
    turn_started_at = now() - interval '5000 seconds' where id=m;

  perform pg_temp.rg_as_host('CITYRGC5');
  perform public.moderation_kick_ban('CITYRGC5', '11111111-1111-4111-8111-111111111111');

  select current_seat into cs from public.city_matches where id=m;
  select turn_started_at > now() - interval '5 seconds' into ts_fresh from public.city_matches where id=m;
  if cs <> 2 then
    ok := false; act := act || format(
      'current_seat is %s immediately after the kick -- expected the departure trigger''s own autopilot check to have already skipped past away seat 1 to seat 2; ', cs);
  end if;
  if not ts_fresh then
    ok := false; act := act || 'turn_started_at was not reset to a fresh clock (FR-47) -- still reads the stale pre-kick value; ';
  end if;

  insert into rg values (default,'BUG-007-C-kick','a kick landing on an already-away seat autopilots immediately, with a fresh clock (FR-27/FR-47)',
    'the departure trigger both hands off the kicked seat''s turn AND resolves the next seat''s turn if it too is away, without waiting for a future clock expiry, and the surviving seat gets a genuinely fresh turn_started_at rather than an inherited stale one',
    case when ok then format('current_seat landed on present seat %s immediately, turn_started_at fresh, no client action needed', cs) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-D (FR-31) — a match with nobody present anywhere pauses durably
-- instead of the cascade spinning or silently doing nothing forever.
-- ===========================================================================
do $blk$
declare m uuid; st text; paused_ts timestamptz; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGD1', 82);

  -- Only seat 0 stays a real contender -- seats 1/2 marked terminal directly
  -- so the cascade's own seat-count (active/seated only) is 1, and its bound
  -- is exactly that count (one resolution per distinct seat, see the fix
  -- note in 0087 itself for why). Start position 31 lands seed 82's real
  -- first roll ({3,6}, sum 9) exactly on Departure (idx 0, a plain corner)
  -- -- no purchase decision or auction, so the single resolution this bound
  -- allows resolves cleanly and the loop exits having found no one present.
  update public.city_match_players set status='retired' where match_id=m and seat in (1,2);
  update public.city_match_players set disconnected_at = now() - interval '90 seconds',
    position = 31
   where match_id=m and seat=0;
  update public.city_matches set current_seat=0, phase='awaiting_roll' where id=m;

  perform public.city_run_autopilot_from_current(m);

  select status, paused_at into st, paused_ts from public.city_matches where id=m;
  if st <> 'paused' then
    ok := false; act := act || format('match status is %L, expected paused; ', st);
  end if;
  if paused_ts is null then
    ok := false; act := act || 'paused_at was not stamped; ';
  end if;

  insert into rg values (default,'BUG-007-D-pause','a match with nobody present pauses durably (FR-31)',
    'status becomes paused and paused_at is stamped once the cascade cycles through every active seat and finds no one present',
    case when ok then format('status=%L, paused_at stamped', st) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-D (FR-48) — resuming a paused match grants a fresh full turn
-- clock, not the stored remainder, and shifts the timed-mode wall clock
-- forward by the exact pause duration so a long pause doesn't eat into it.
-- ===========================================================================
do $blk$
declare m uuid; st text; ts_before timestamptz; ts_after timestamptz;
  started_before timestamptz; started_after timestamptz; pause_len numeric; shift numeric;
  ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGD2', 83);

  -- Simulate an already-paused match (skip straight to it rather than
  -- re-deriving pause via another multi-roll chain -- that mechanism is
  -- BUG-007-D-pause's own job above).
  update public.city_matches set mode='timed', time_limit_minutes=10,
    status='paused', paused_at = now() - interval '5 minutes',
    started_at = now() - interval '20 minutes',
    current_seat=0, turn_started_at = now() - interval '20 minutes'
   where id=m;
  update public.city_match_players set disconnected_at = now() - interval '5 minutes'
   where match_id=m and seat=0;
  select started_at into started_before from public.city_matches where id=m;

  -- Genuinely flip false -> true, not true -> true -- the trigger's own
  -- WHEN clause only fires on a real transition, and rg_match already
  -- leaves every participant at is_online=true from the join.
  update public.room_participants set is_online = false
   where room_id = 'CITYRGD2' and user_id = (
     select user_id from public.city_match_players where match_id=m and seat=0);

  -- Reconnect seat 0 -- the same is_online flip round A's trigger already
  -- watches, now also carrying the resume branch this round adds.
  update public.room_participants set is_online = true
   where room_id = 'CITYRGD2' and user_id = (
     select user_id from public.city_match_players where match_id=m and seat=0);

  select status, turn_started_at, started_at into st, ts_after, started_after
    from public.city_matches where id=m;

  if st <> 'active' then
    ok := false; act := act || format('status is %L after reconnect, expected active; ', st);
  end if;
  -- Fresh clock: turn_started_at must be very recent (within the last few
  -- seconds), not anywhere near the 20-minutes-ago value it held pre-pause.
  if extract(epoch from (now() - ts_after)) > 5 then
    ok := false; act := act || 'turn_started_at was not reset to a fresh value on resume; ';
  end if;
  -- The timed-mode wall clock shifts forward by (roughly) the pause
  -- duration, not left untouched and not reset to now().
  pause_len := extract(epoch from (now() - (now() - interval '5 minutes')));
  shift := extract(epoch from (started_after - started_before));
  if abs(shift - pause_len) > 3 then
    ok := false; act := act || format(
      'started_at shifted by %ss, expected roughly the %ss pause duration; ', round(shift::numeric,1), round(pause_len::numeric,1));
  end if;

  insert into rg values (default,'BUG-007-D-resume','resuming a paused match grants a fresh clock and shifts the timed-mode limit (FR-48)',
    'status returns to active, turn_started_at is reset fresh (not the stale remainder), and started_at shifts forward by the pause duration',
    case when ok then format('status=active, fresh turn_started_at, started_at shifted ~%ss', round(shift::numeric,1)) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-F (FR-33) — proposing a trade as the active seat pauses their own
-- clock; the response resumes it and accumulates the true elapsed pause.
-- ===========================================================================
do $blk$
declare m uuid; offer_id uuid; paused_at1 timestamptz; trade_paused_at1 timestamptz;
  ms_used int; ts_before timestamptz; ts_after timestamptz; paused_after timestamptz;
  ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGF1', 84);
  update public.city_matches set current_seat=0, phase='optional_actions' where id=m;

  perform pg_temp.rg_as(0);
  offer_id := public.city_propose_trade(m, 1, '{}', '{}', 10, 0);

  select turn_clock_paused_at, trade_pause_started_at into paused_at1, trade_paused_at1
    from public.city_matches where id=m;
  if paused_at1 is null or trade_paused_at1 is null then
    ok := false; act := act || 'proposing as the active seat did not pause the clock; ';
  end if;

  -- Backdate the pause start to simulate real elapsed waiting time, and
  -- capture the pre-accept turn_started_at to check the shift afterward.
  update public.city_matches set turn_clock_paused_at = now() - interval '20 seconds',
    trade_pause_started_at = now() - interval '20 seconds' where id=m;
  select turn_started_at into ts_before from public.city_matches where id=m;

  perform pg_temp.rg_as(1);
  perform public.city_accept_trade(offer_id);

  select turn_clock_paused_at, trade_pause_started_at, trade_pause_ms_used, turn_started_at
    into paused_after, trade_paused_at1, ms_used, ts_after
    from public.city_matches where id=m;

  if paused_after is not null or trade_paused_at1 is not null then
    ok := false; act := act || 'clock/pause markers were not cleared after the offer closed; ';
  end if;
  if ms_used < 19000 or ms_used > 25000 then
    ok := false; act := act || format('trade_pause_ms_used is %s, expected roughly 20000; ', ms_used);
  end if;
  if extract(epoch from (ts_after - ts_before)) < 19 then
    ok := false; act := act || 'turn_started_at was not shifted forward by the pause duration; ';
  end if;

  insert into rg values (default,'BUG-007-F-pause','proposing pauses the active seat''s clock; the response resumes and accounts for it (FR-33)',
    'turn_clock_paused_at/trade_pause_started_at are set on propose; accepting clears them, accumulates ~20s into trade_pause_ms_used, and shifts turn_started_at forward by that same amount',
    case when ok then format('paused on propose; accumulated %sms, shifted turn_started_at by %ss', ms_used, round(extract(epoch from (ts_after-ts_before))::numeric,1)) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-F (FR-43) — an offer arriving while the recipient is the active
-- seat is queued: inactionable until their turn ends, then it surfaces.
-- ===========================================================================
do $blk$
declare m uuid; offer_id uuid; queued_flag boolean; refused_accept boolean := false;
  refused_decline boolean := false; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGF2', 85);
  update public.city_matches set current_seat=0, phase='optional_actions' where id=m;

  -- Seat 1 (off-turn) proposes to seat 0 (the active seat).
  perform pg_temp.rg_as(1);
  offer_id := public.city_propose_trade(m, 0, '{}', '{}', 5, 0);

  select queued into queued_flag from public.city_trade_offers where id=offer_id;
  if not queued_flag then
    ok := false; act := act || 'an offer to the active seat was not marked queued; ';
  end if;

  perform pg_temp.rg_as(0);
  begin
    perform public.city_accept_trade(offer_id);
  exception when others then
    if SQLERRM like '%CITY_OFFER_QUEUED%' then refused_accept := true; end if;
  end;
  if not refused_accept then
    ok := false; act := act || 'accepting a queued offer was not refused with CITY_OFFER_QUEUED; ';
  end if;

  begin
    perform public.city_resolve_trade(offer_id, 'declined');
  exception when others then
    if SQLERRM like '%CITY_OFFER_QUEUED%' then refused_decline := true; end if;
  end;
  if not refused_decline then
    ok := false; act := act || 'declining a queued offer was not refused with CITY_OFFER_QUEUED; ';
  end if;

  -- Ending seat 0's turn surfaces it.
  perform pg_temp.rg_as(0);
  perform public.city_end_turn(m);
  select queued into queued_flag from public.city_trade_offers where id=offer_id;
  if queued_flag then
    ok := false; act := act || 'the offer was still queued after the recipient''s turn ended; ';
  end if;

  insert into rg values (default,'BUG-007-F-queued','a trade to the active seat is queued until their turn ends (FR-43)',
    'accept/decline are both refused with CITY_OFFER_QUEUED while the recipient is on the clock; ending their turn surfaces it',
    case when ok then 'queued while active, both actions refused, surfaced once the turn ended' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-F (FR-33 budget) — once the 90s-per-turn trade-pause budget is
-- used up, further proposals from the active seat stop pausing the clock.
-- ===========================================================================
do $blk$
declare m uuid; paused_marker timestamptz; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGF3', 86);
  update public.city_matches set current_seat=0, phase='optional_actions',
    trade_pause_ms_used = 90000 where id=m;

  perform pg_temp.rg_as(0);
  perform public.city_propose_trade(m, 1, '{}', '{}', 5, 0);

  select turn_clock_paused_at into paused_marker from public.city_matches where id=m;
  if paused_marker is not null then
    ok := false; act := act || 'a proposal paused the clock even though the 90s budget was already spent; ';
  end if;

  insert into rg values (default,'BUG-007-F-budget','the 90s trade-pause budget stops further proposals from pausing the clock',
    'turn_clock_paused_at stays null when trade_pause_ms_used is already >= 90000 at propose time',
    case when ok then 'clock stayed unpaused once the budget was already spent' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-F (FR-33 escape hatch) — a trade pause nobody ever responds to
-- does not leave claim_timeout permanently refusing forever; past 45s it
-- may force-withdraw the stale offer and resume the clock.
-- ===========================================================================
do $blk$
declare m uuid; offer_id uuid; st text; res jsonb; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGF4', 87);
  update public.city_matches set current_seat=0, phase='optional_actions', pace_seconds=40
   where id=m;

  perform pg_temp.rg_as(0);
  offer_id := public.city_propose_trade(m, 1, '{}', '{}', 5, 0);

  -- Numbers chosen so the escape hatch's own 45s bound is exceeded AND the
  -- resumed deadline (turn_started_at shifted forward by the actual pause
  -- length, per city_maybe_resume_trade_clock's own math) has also already
  -- passed, so this single call both resumes the clock and fully resolves
  -- the stall in one step, rather than needing a second, separately-timed
  -- call after resuming.
  update public.city_matches
     set turn_started_at = now() - interval '100 seconds',
         turn_clock_paused_at = now() - interval '50 seconds',
         trade_pause_started_at = now() - interval '50 seconds'
   where id=m;

  perform pg_temp.rg_as(1);
  begin
    select public.city_claim_timeout(m) into res;
  exception when others then
    ok := false; act := act || 'claim_timeout still refused a trade pause well past its own 45s bound: '||SQLERRM||'; ';
  end;

  select status into st from public.city_trade_offers where id=offer_id;
  if ok and st <> 'withdrawn' then
    ok := false; act := act || format('the stale offer''s status is %L, expected withdrawn; ', st);
  end if;

  insert into rg values (default,'BUG-007-F-escape','a stale trade pause past 45s can be force-resolved by claim_timeout',
    'claim_timeout does not refuse forever -- past 45s it withdraws the active seat''s own stale offer, resumes the clock, and resolves the (now also expired) turn',
    case when ok then format('resolved: %s, offer withdrawn', res->>'resolution') else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-H — found only by live two-browser testing, not any of the four
-- audits or the SQL suite: a trade proposed EARLY in a turn (unlike the
-- F-escape test above, which deliberately backdated the whole turn so the
-- resumed deadline had ALSO already passed) triggers the exact same 45s
-- escape hatch, but the resumed turn_started_at (shifted forward by the
-- pause duration) leaves most of pace_seconds still remaining -- the old
-- code fell through to the ordinary deadline check regardless and raised
-- CITY_TURN_CLOCK_STILL_RUNNING, an uncaught exception that rolled back the
-- ENTIRE transaction, undoing the resume the same call had just made. Every
-- real attempt against a fresh trade pause hit this rollback.
-- ===========================================================================
do $blk$
declare m uuid; offer_id uuid; res jsonb; st text; paused_after boolean;
  ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGH12', 101);
  update public.city_matches set current_seat=0, pace_seconds=60 where id=m;

  perform pg_temp.rg_as(0);
  offer_id := public.city_propose_trade(m, 1, '{}', '{}', 5, 0);

  -- Turn started only 2s ago (nearly the full 60s pace window still
  -- "owed" once the pause resumes) -- only the trade pause itself is
  -- stale, backdated past its own 45s bound.
  update public.city_matches
     set turn_started_at = now() - interval '2 seconds',
         turn_clock_paused_at = now() - interval '50 seconds',
         trade_pause_started_at = now() - interval '50 seconds'
   where id=m;

  perform pg_temp.rg_as(1);
  begin
    select public.city_claim_timeout(m) into res;
  exception when others then
    ok := false; act := act || 'claim_timeout raised instead of gracefully resuming: '||SQLERRM||'; ';
  end;

  select status into st from public.city_trade_offers where id=offer_id;
  select turn_clock_paused_at is not null into paused_after from public.city_matches where id=m;

  if ok and st <> 'withdrawn' then
    ok := false; act := act || format('the stale offer''s status is %L, expected withdrawn; ', st);
  end if;
  if ok and paused_after then
    ok := false; act := act || 'turn_clock_paused_at is still set -- the resume did not stick; ';
  end if;
  if ok and res->>'resolution' <> 'trade_pause_resumed' then
    ok := false; act := act || format('expected resolution=trade_pause_resumed, got %s; ', res->>'resolution');
  end if;

  insert into rg values (default,'BUG-007-H-escape-early-pause','the trade-pause escape hatch resumes cleanly even when most of the turn clock is still owed',
    'claim_timeout withdraws the stale offer and resumes the clock without raising, even though the just-shifted turn_started_at means the ordinary deadline has not also passed -- the earlier bug rolled this whole transaction back via an uncaught exception in exactly this case',
    case when ok then format('resolution=%s, offer withdrawn, clock resumed (not still paused)', res->>'resolution') else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-G (FR-49) — an auction never waits out its cap on an absent seat;
-- an away bidder is excluded from the "has everyone passed" tally.
-- ===========================================================================
do $blk$
declare m uuid; prop_idx int; res jsonb; auction_status text;
  ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGG1', 88);
  select idx into prop_idx from public.city_board_spaces where price is not null order by idx limit 1;

  -- Seat 0 declines an unowned property with 3 active, debt-free seats at
  -- the table, opening a real auction everyone (including the decliner)
  -- participates in, per §3.1E.
  update public.city_match_players set position = prop_idx where match_id=m and seat=0;
  update public.city_matches set current_seat=0, phase='required_decision' where id=m;
  perform pg_temp.rg_as(0);
  perform public.city_decline_purchase(m);

  perform 1 from public.city_auctions where match_id=m and status='running';
  if not found then
    ok := false; act := act || 'declining with 3 debt-free active seats did not open a real auction; ';
  end if;

  -- Seat 1 has been away well past the grace period -- cannot click Pass,
  -- and must not be waited on for it either.
  update public.city_match_players set disconnected_at = now() - interval '90 seconds'
   where match_id=m and seat=1;

  -- The decliner and the one remaining present seat both explicitly pass.
  -- Without FR-49's fix, seat 1 (still counted eligible) would leave this
  -- one short and the auction would sit open; with it, excluding the away
  -- seat brings eligible down to exactly these two, and it settles.
  perform pg_temp.rg_as(0);
  perform public.city_pass_auction(m);
  perform pg_temp.rg_as(2);
  select public.city_pass_auction(m) into res;

  select status into auction_status from public.city_auctions
   where match_id=m order by created_at desc limit 1;
  if auction_status <> 'settled' then
    ok := false; act := act || format(
      'auction status is %L after every present seat passed -- expected settled (away seat 1 should not have been waited on); ', auction_status);
  end if;

  insert into rg values (default,'BUG-007-G','an away bidder does not stall an auction''s all-pass fast path (FR-49)',
    'once every seat *actually present* has passed, the auction settles immediately -- an away seat is excluded from the eligibility tally, not waited on',
    case when ok then format('auction settled once both present seats passed, away seat 1 correctly excluded') else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-H (FR-33/FR-42) — forced liquidation runs on its own fixed 90s
-- window, independent of the host's pace preset -- not the ordinary
-- turn_started_at + pace_seconds deadline every other claim_timeout branch
-- uses. Proven by using a pace_seconds well under 90s (Blitz, 25s) and
-- confirming claim_timeout still refuses well after that shorter deadline
-- has passed, only succeeding once the FIXED 90s window (from
-- debt_started_at) has actually elapsed.
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := true; act text := ''; res jsonb; refused boolean := false;
begin
  m := pg_temp.rg_match('CITYRGH1', 90);
  update public.city_matches set current_seat=0, phase='required_decision', pace_seconds=25,
    turn_clock_paused_at=null,
    turn_started_at = now() - interval '40 seconds',
    debt_started_at = now() - interval '40 seconds'
   where id=m;
  update public.city_match_players set pending_debt=50, pending_creditor_seat=null
   where match_id=m and seat=0;

  -- 40s in: the old pace-based (25s) deadline is long gone, but the fixed
  -- 90s liquidation window is not -- must still refuse.
  perform pg_temp.rg_as(1);
  begin
    perform public.city_claim_timeout(m);
    ok := false; act := act || 'claim_timeout succeeded at 40s, before the fixed 90s liquidation window elapsed; ';
  exception when others then
    if SQLERRM !~ 'CITY_TURN_CLOCK_STILL_RUNNING' then
      ok := false; act := act || format('expected CITY_TURN_CLOCK_STILL_RUNNING at 40s, got: %s; ', SQLERRM);
    else
      refused := true;
    end if;
  end;

  -- Past 90s from debt_started_at: must now succeed.
  update public.city_matches set debt_started_at = now() - interval '95 seconds' where id=m;
  select public.city_claim_timeout(m) into res;
  if res->>'resolution' not in ('liquidated','bankrupt') or (res->>'seat')::int <> 0 then
    ok := false; act := act || format('expected a debt resolution for seat 0 past 90s, got %s; ', res);
  end if;

  insert into rg values (default,'BUG-007-H-liquidation-clock','forced liquidation runs on its own fixed 90s window, not the pace preset (FR-33/FR-42)',
    'claim_timeout refuses a debt resolution before 90s have passed since debt_started_at even though the (much shorter) pace-based deadline already elapsed, and succeeds once 90s have genuinely passed',
    case when ok then format('refused at 40s (%s), resolved once past 90s (%s)', refused, res) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-H (verification gap closed) — auto-liquidation actually clears a
-- debt through the REAL caller a stalled player's own client reaches
-- (city_claim_timeout), not just the internal city_liquidate_for_debt
-- function called directly (BUG-007-C's own test bypasses both of its real
-- callers, and BUG-007-B's debt test only ever used an unpayable amount, so
-- this exact path -- a real, payable debt resolved through the real public
-- RPC -- had never actually been exercised end-to-end before this).
-- ===========================================================================
do $blk$
declare m uuid; prop_idx int; prop_price int; expected_raise int;
  res jsonb; debt int; mortgaged boolean; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGH2', 91);
  select idx, price into prop_idx, prop_price from public.city_board_spaces
   where price is not null order by idx limit 1;

  insert into public.city_assets (match_id, space_idx, owner_seat) values (m, prop_idx, 0);
  expected_raise := round(prop_price / 2.0)::integer;

  update public.city_matches set current_seat=0, phase='required_decision',
    turn_clock_paused_at=null,
    turn_started_at = now() - interval '95 seconds',
    debt_started_at = now() - interval '95 seconds'
   where id=m;
  update public.city_match_players set pending_debt = expected_raise, pending_creditor_seat = null
   where match_id=m and seat=0;

  perform pg_temp.rg_as(1);
  select public.city_claim_timeout(m) into res;

  select pending_debt into debt from public.city_match_players where match_id=m and seat=0;
  select is_mortgaged into mortgaged from public.city_assets where match_id=m and space_idx=prop_idx;

  if res->>'resolution' <> 'liquidated' or debt <> 0 or not mortgaged then
    ok := false; act := act || format(
      'expected the real claim_timeout call to liquidate (mortgage the property, clear the debt): resolution=%s debt=%s mortgaged=%s; ',
      res->>'resolution', debt, mortgaged);
  end if;
  perform 1 from public.city_match_players where match_id=m and seat=0 and status='bankrupt';
  if found then
    ok := false; act := act || 'seat 0 was bankrupted despite owning enough to cover the debt; ';
  end if;

  insert into rg values (default,'BUG-007-H-liquidation-real-path','auto-liquidation actually liquidates through the real claim_timeout call, not just the internal function in isolation',
    'a payable debt resolved via the actual public city_claim_timeout RPC results in resolution=liquidated, the property mortgaged, and pending_debt cleared -- not bankruptcy',
    case when ok then format('resolution=%s, debt=%s, mortgaged=%s', res->>'resolution', debt, mortgaged) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-H — a doubles re-roll while an outgoing trade pause is active must
-- correctly close out the pause (accumulate elapsed time into the running
-- 90s/turn budget, clear trade_pause_started_at) instead of leaving it
-- stale while turn_clock_paused_at is cleared anyway -- the exact
-- corruption a cross-round regression audit found: city_end_turn_core's
-- v_again branch cleared turn_clock_paused_at unconditionally but never
-- touched trade_pause_started_at, so a LATER trade's resolution would
-- compute elapsed time against a stale timestamp from a turn ago.
-- ===========================================================================
do $blk$
declare m uuid; ok boolean := true; act text := '';
  paused_after boolean; pause_started_after timestamptz; budget_used integer;
begin
  m := pg_temp.rg_match('CITYRGH3', 92);
  update public.city_matches set current_seat=0, phase='optional_actions', doubles_count=1,
    turn_clock_paused_at=null, trade_pause_ms_used=0, trade_pause_started_at=null
   where id=m;

  perform pg_temp.rg_as(0);
  perform public.city_propose_trade(m, 1, '{}', '{}', 10, 0);

  -- Backdate the pause by 20s, as if the recipient had simply been silent
  -- for a while before the proposer rolled doubles and re-rolled anyway.
  update public.city_matches set trade_pause_started_at = now() - interval '20 seconds' where id=m;

  perform public.city_end_turn(m);

  select turn_clock_paused_at is not null, trade_pause_started_at, trade_pause_ms_used
    into paused_after, pause_started_after, budget_used
    from public.city_matches where id=m;

  if paused_after then
    ok := false; act := act || 'turn_clock_paused_at is still set after the re-roll; ';
  end if;
  if pause_started_after is not null then
    ok := false; act := act || 'trade_pause_started_at is still set (stale) after the re-roll; ';
  end if;
  if budget_used < 18000 or budget_used > 25000 then
    ok := false; act := act || format('trade_pause_ms_used is %s, expected roughly 20000 (the accumulated pause, not lost or corrupted); ', budget_used);
  end if;

  insert into rg values (default,'BUG-007-H-doubles-tradepause','a doubles re-roll correctly closes an active trade pause instead of corrupting it',
    'the re-roll clears turn_clock_paused_at AND properly accumulates the elapsed pause into trade_pause_ms_used AND clears trade_pause_started_at -- never leaving it stale',
    case when ok then format('paused_after=%s, pause_started_after=%s, budget_used=%sms', paused_after, pause_started_after, budget_used) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-H — claim_timeout's own fallback branch must grant an owed
-- doubles re-roll instead of silently discarding it. Found while fixing the
-- pause-corruption bug above: city_claim_timeout's "else" branch never
-- checked doubles_count at all (unlike city_end_turn_core, which always
-- did) -- it just force-advanced past the stalled player, discarding an
-- earned re-roll the instant anyone else's client noticed the ordinary
-- clock had expired. A present player ending their own turn in time was
-- never affected; only this specific stalled-and-noticed-by-someone-else
-- path was wrong.
-- ===========================================================================
do $blk$
declare m uuid; res jsonb; cs int; ph text; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGH4', 93);
  update public.city_matches set current_seat=0, phase='optional_actions', doubles_count=1,
    pace_seconds=40, turn_clock_paused_at=null,
    turn_started_at = now() - interval '41 seconds'
   where id=m;
  update public.city_match_players set disconnected_at = now() - interval '90 seconds'
   where match_id=m and seat=0;

  perform pg_temp.rg_as(1);
  select public.city_claim_timeout(m) into res;

  select current_seat, phase into cs, ph from public.city_matches where id=m;

  if res->>'resolution' <> 'roll_again' then
    ok := false; act := act || format('expected roll_again, got %s; ', res->>'resolution');
  end if;
  if cs <> 0 then
    ok := false; act := act || format('current_seat moved to %s -- an owed doubles re-roll must not advance past the seat that earned it; ', cs);
  end if;
  if ph <> 'awaiting_roll' then
    ok := false; act := act || format('phase is %L, expected awaiting_roll after granting the re-roll; ', ph);
  end if;

  insert into rg values (default,'BUG-007-H-claimtimeout-doubles','claim_timeout grants an owed doubles re-roll instead of silently discarding it',
    'a stalled seat holding doubles_count between 1 and 2, resolved via claim_timeout by another player, gets resolution=roll_again and stays current_seat in phase=awaiting_roll -- not advanced past',
    case when ok then format('resolution=%s, current_seat=%s, phase=%s', res->>'resolution', cs, ph) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-H (FR-31 edge case) — if every seat with standing in an auction
-- (including whoever regains the turn once it settles) is away, settling
-- must still reach status='paused', not hand control back to an away
-- seat and sit 'active' forever until an unrelated reconnect happens to
-- remount the auction UI.
-- ===========================================================================
do $blk$
declare m uuid; st text; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGH5', 94);

  -- Every seat parked in detention rather than left to roll naturally --
  -- city_leave_detention_core's 'roll' method always concludes the turn
  -- regardless of the (seed-dependent) doubles outcome, so the cascade's
  -- path to "nobody present" here is deterministic and doesn't depend on
  -- where a live dice roll happens to land (an away seat resolved via an
  -- ordinary awaiting_roll can legitimately open a fresh auction instead --
  -- that's a different, also-correct outcome, not this scenario). Detention
  -- requires phase='awaiting_roll' (matching a real detained player); the
  -- auction being settled below doesn't depend on city_matches.phase at all
  -- (only city_auctions.status), so this never needs to look like 'auction'.
  update public.city_matches set current_seat=0, phase='awaiting_roll' where id=m;
  update public.city_match_players set disconnected_at = now() - interval '90 seconds',
    in_detention = true, detention_turns = 0
   where match_id=m and seat in (0,1,2);

  insert into public.city_auctions (match_id, space_idx, ends_at, hard_ends_at, status)
  values (m, (select min(idx) from public.city_board_spaces where price is not null),
    now() - interval '1 seconds', now() - interval '1 seconds', 'running');

  perform public.city_settle_auction(m, true);

  select status into st from public.city_matches where id=m;
  if st <> 'paused' then
    ok := false; act := act || format('match status is %L after settling with every seat away -- expected paused; ', st);
  end if;

  insert into rg values (default,'BUG-007-H-auction-allaway-pause','settling an auction with every seat away reaches a durable pause (FR-31)',
    'once an auction settles and every remaining seat (including whoever regains the turn) is away, the match reaches status=paused immediately rather than sitting active with an away current_seat',
    case when ok then format('status=%s', st) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-H — exit_reason distinguishes voluntary retire, a kick/departure,
-- and a forced autopilot retire (previously indistinguishable to a watching
-- player); and disconnected_at/consecutive_autopilot_turns no longer linger
-- forever once a seat is actually out (found by the client-completeness
-- audit: the badge kept showing "Away"/"auto×N" on a retired/bankrupt seat).
-- ===========================================================================
do $blk$
declare m uuid; reason text; dc timestamptz; streak int; ok boolean := true; act text := '';
begin
  -- (a) voluntary retire.
  m := pg_temp.rg_match('CITYRGH6', 95);
  perform pg_temp.rg_as(0);
  perform public.city_retire_self(m);
  select exit_reason, disconnected_at, consecutive_autopilot_turns
    into reason, dc, streak from public.city_match_players where match_id=m and seat=0;
  if reason <> 'voluntary' then
    ok := false; act := act || format('voluntary retire: exit_reason is %L, expected voluntary; ', reason);
  end if;

  -- (b) kick/departure.
  m := pg_temp.rg_match('CITYRGH7', 96);
  update public.city_match_players set disconnected_at = now() - interval '90 seconds',
    consecutive_autopilot_turns = 1 where match_id=m and seat=1;
  perform pg_temp.rg_as_host('CITYRGH7');
  perform public.moderation_kick_ban('CITYRGH7', '22222222-2222-4222-8222-222222222222');
  select exit_reason, disconnected_at, consecutive_autopilot_turns
    into reason, dc, streak from public.city_match_players where match_id=m and seat=1;
  if reason <> 'departed' then
    ok := false; act := act || format('kick: exit_reason is %L, expected departed; ', reason);
  end if;
  if dc is not null or streak <> 0 then
    ok := false; act := act || format('kick: disconnected_at=%s consecutive_autopilot_turns=%s still lingering after retire, expected both cleared; ', dc, streak);
  end if;

  -- (c) forced autopilot retire (same setup as BUG-007-C-forfeit, including
  -- its exact seed -- 80's first roll from position 5 is deterministically
  -- known to land on the safe Customs corner, not a purchasable property
  -- that would open a fresh auction instead of concluding the turn).
  m := pg_temp.rg_match('CITYRGH8', 80);
  update public.city_match_players set disconnected_at = now() - interval '90 seconds',
    consecutive_autopilot_turns = 1, position = 5
   where match_id=m and seat=1;
  update public.city_matches set current_seat=0, phase='optional_actions' where id=m;
  perform pg_temp.rg_as(0);
  perform public.city_end_turn(m);
  select exit_reason, disconnected_at, consecutive_autopilot_turns
    into reason, dc, streak from public.city_match_players where match_id=m and seat=1;
  if reason <> 'autopilot_forced' then
    ok := false; act := act || format('forced retire: exit_reason is %L, expected autopilot_forced; ', reason);
  end if;
  if dc is not null or streak <> 0 then
    ok := false; act := act || format('forced retire: disconnected_at=%s consecutive_autopilot_turns=%s still lingering, expected both cleared; ', dc, streak);
  end if;

  -- (d) bankruptcy also clears stale presence/autopilot state.
  m := pg_temp.rg_match('CITYRGH9', 98);
  update public.city_match_players set disconnected_at = now() - interval '90 seconds',
    consecutive_autopilot_turns = 1 where match_id=m and seat=2;
  perform public.city_bankrupt_seat(m, 2, null);
  select disconnected_at, consecutive_autopilot_turns
    into dc, streak from public.city_match_players where match_id=m and seat=2;
  if dc is not null or streak <> 0 then
    ok := false; act := act || format('bankrupt: disconnected_at=%s consecutive_autopilot_turns=%s still lingering, expected both cleared; ', dc, streak);
  end if;

  insert into rg values (default,'BUG-007-H-exit-reason','exit_reason distinguishes voluntary/departed/autopilot_forced, and retire/bankrupt clear stale presence state',
    'voluntary retire, a kick, and a forced autopilot retire each stamp a distinct exit_reason, and none leaves disconnected_at/consecutive_autopilot_turns lingering on the now-terminal seat',
    case when ok then 'all three exit paths stamp the correct reason and clear stale presence state' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG-007-H (FR-51, verification gap closed) — a bankrupt seat cannot
-- consume another player's trade-pause budget by proposing a trade; never
-- previously asserted.
-- ===========================================================================
do $blk$
declare m uuid; refused boolean := false; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGH11', 100);
  update public.city_match_players set status='bankrupt' where match_id=m and seat=0;
  perform pg_temp.rg_as(0);
  begin
    perform public.city_propose_trade(m, 1, '{}', '{}', 10, 0);
    act := 'city_propose_trade succeeded for a bankrupt seat';
  exception when others then
    if SQLERRM ~ 'CITY_SEAT_OUT' then refused := true;
    else act := 'refused, but with the wrong error: '||SQLERRM; end if;
  end;
  if not refused then ok := false; end if;

  insert into rg values (default,'BUG-007-H-fr51-bankrupt-trade','a bankrupt seat cannot propose a trade (FR-51)',
    'city_propose_trade refuses with CITY_SEAT_OUT for a non-active (bankrupt/retired) seat',
    case when ok then 'refused with CITY_SEAT_OUT' else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- META-OVERLOAD-GRANTS — a general guard, not tied to one audit bug: adding
-- parameters via CREATE OR REPLACE creates a genuinely new pg_proc overload
-- (Postgres identifies functions by their full declared parameter list, not
-- just the required ones), which Postgres grants EXECUTE to PUBLIC by
-- default on creation. This exact trap silently reopened
-- city_assert_can_manage (0077) and city_resolve_landing (0079) after both
-- had been correctly revoked in earlier migrations -- closed in 0080. This
-- check guards the whole city_* surface against it recurring: flags any
-- function name whose LONGEST-signature overload is executable by
-- `authenticated` while a SHORTER sibling overload of the same name is
-- revoked (the exact shape of "a helper got extended and the new overload's
-- default grant was never revoked"). city_settle_auction's two overloads
-- are the opposite shape on purpose (0071: the SHORTER 1-arg wrapper is the
-- deliberately client-callable one; the LONGER 2-arg p_force form is
-- deliberately revoked) and correctly does not match this check.
-- ===========================================================================
do $blk$
declare v_bad text;
begin
  select string_agg(x.proname || '(' || x.args || ')', ', ') into v_bad
    from (
      select p.proname,
             pg_get_function_identity_arguments(p.oid) as args,
             has_function_privilege('authenticated', p.oid, 'execute') as exec,
             row_number() over (partition by p.proname order by p.pronargs desc) as rn_longest
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'city\_%' escape '\' and p.prokind = 'f'
    ) x
   where x.rn_longest = 1
     and x.exec
     and exists (
       select 1 from pg_proc p2 join pg_namespace n2 on n2.oid = p2.pronamespace
        where n2.nspname = 'public' and p2.proname = x.proname
          and pg_get_function_identity_arguments(p2.oid) <> x.args
          and not has_function_privilege('authenticated', p2.oid, 'execute')
     );

  insert into rg values (default,'META-OVERLOAD-GRANTS',
    'no city_* function''s longest overload is publicly executable while a shorter sibling is revoked',
    'zero matches',
    case when v_bad is null then 'none found' else 'found: '||v_bad end,
    case when v_bad is null then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- META-OVERLOAD-AMBIGUITY — a second general guard, found only by a
-- user-requested visual/UX review agent (not any of this session's own SQL
-- assertions or live specs): a function CAN have two overloads that are
-- each individually well-formed and correctly grant-scoped (so
-- META-OVERLOAD-GRANTS above never flags them) and still be genuinely
-- unresolvable for some caller, if a DEFAULT parameter on the longer
-- overload lets it be called with the same argument COUNT as a shorter
-- sibling. city_settle_auction was exactly this shape for years:
-- 0071's city_settle_auction(uuid) (a deliberate, correctly-scoped 1-arg
-- public shell) and 0069/0085/0090's city_settle_auction(uuid, boolean
-- default false) (deliberately revoked from every client role) each look
-- fine in isolation -- but the second one's default meant it was ALSO
-- callable with exactly one argument, and Postgres resolves overloads
-- before checking privileges, so a real 1-arg call from ANY role,
-- including `authenticated`, failed outright with "function ... is not
-- unique" -- confirmed directly, not just as a superuser. This checks
-- every pair of same-named city_* overloads for an overlapping
-- callable-argument-count range (accounting for defaults on either side),
-- which is exactly the shape that produces this class of bug.
-- ===========================================================================
do $blk$
declare v_bad text;
begin
  select string_agg(distinct a.proname || ': (' || a.aargs || ') vs (' || b.aargs || ')', '; ') into v_bad
    from (
      select p.oid, p.proname,
             p.pronargs - p.pronargdefaults as min_args, p.pronargs as max_args,
             pg_get_function_identity_arguments(p.oid) as aargs
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'city\_%' escape '\' and p.prokind = 'f'
    ) a
    join (
      select p.oid, p.proname,
             p.pronargs - p.pronargdefaults as min_args, p.pronargs as max_args,
             pg_get_function_identity_arguments(p.oid) as aargs
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'city\_%' escape '\' and p.prokind = 'f'
    ) b on a.proname = b.proname and a.oid < b.oid
   where a.min_args <= b.max_args and b.min_args <= a.max_args;

  insert into rg values (default,'META-OVERLOAD-AMBIGUITY',
    'no city_* function has two overloads whose callable argument-count ranges overlap',
    'zero matches',
    case when v_bad is null then 'none found' else 'found: '||v_bad end,
    case when v_bad is null then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- BUG (found by visual review, not any prior audit) — the real client call
-- to city_settle_auction (exactly one argument, matching
-- use-city-match.ts's settleAuction()) must actually resolve and settle a
-- genuinely expired auction, as the `authenticated` role a real client
-- uses -- not just as postgres. This is the specific end-to-end
-- regression guard for the overload-ambiguity bug fixed above: it drives
-- the exact call shape a real browser makes when an auction's own clock
-- (not a force-settle, not everyone explicitly passing) is what resolves
-- it, which nothing in this suite exercised before this round.
-- ===========================================================================
do $blk$
declare m uuid; propIdx int; res jsonb; auctionStatus text; ok boolean := true; act text := '';
begin
  m := pg_temp.rg_match('CITYRGSETL', 102);
  select min(idx) into propIdx from public.city_board_spaces where price is not null;

  insert into public.city_auctions (match_id, space_idx, ends_at, hard_ends_at, status)
  values (m, propIdx, now() - interval '1 seconds', now() - interval '1 seconds', 'running');

  perform pg_temp.rg_as(0);
  begin
    select public.city_settle_auction(m) into res;
  exception when others then
    ok := false; act := act || format('the real 1-arg client call raised instead of settling: %s; ', SQLERRM);
  end;

  if ok then
    select status into auctionStatus from public.city_auctions
     where match_id = m order by created_at desc limit 1;
    if auctionStatus <> 'settled' then
      ok := false; act := act || format('auction status is %L after the real settle call, expected settled; ', auctionStatus);
    end if;
  end if;

  insert into rg values (default,'BUG-SETTLE-OVERLOAD','the real 1-arg client call to city_settle_auction resolves and settles a genuinely expired auction',
    'city_settle_auction(p_match_id) -- exactly the argument shape the real client uses -- succeeds and settles the auction, not "function ... is not unique"',
    case when ok then format('settled: %s', res) else act end,
    case when ok then 'PASS' else 'FAIL' end);
end $blk$;

-- ===========================================================================
-- CITY-EVENTS — a code-review pass on migration 0093 (the activity feed)
-- found this suite had zero coverage of city_match_events: every other
-- assertion above would still pass even if a redefined function's insert
-- were on the wrong branch, used the wrong kind, or was silently dropped
-- during a copy-paste (the migration touches 11 functions by hand-copying
-- their bodies). This doesn't re-test game logic already covered above --
-- it asserts specifically that the instrumented functions actually log,
-- with the right kind, actor, and ordering.
-- ===========================================================================
do $blk$
declare
  m uuid; res jsonb; ok boolean := true; act text := '';
  n0 int; boughtId bigint; boughtKind text; boughtActor int;
  mortKind text; mortId bigint;
begin
  m := pg_temp.rg_match('CITYRGEVT', 909);

  select count(*) into n0 from public.city_match_events where match_id = m;
  if n0 <> 0 then
    ok := false; act := act || format('expected 0 events on a freshly-started match, got %s; ', n0);
  end if;

  -- seat 0 stands on a purchasable, unowned space (idx 21, the same one
  -- BUG-010 above uses) and buys it as the real client would.
  delete from public.city_assets where match_id = m and space_idx = 21;
  update public.city_match_players set position = 21, cash = 1000 where match_id = m and seat = 0;
  update public.city_matches set phase = 'required_decision', current_seat = 0 where id = m;
  perform pg_temp.rg_as(0);
  select public.city_buy_property(m) into res;

  select id, kind, actor_seat into boughtId, boughtKind, boughtActor
    from public.city_match_events where match_id = m order by id desc limit 1;
  if boughtKind is distinct from 'bought' or boughtActor is distinct from 0 then
    ok := false; act := act || format('after city_buy_property, expected a bought/seat-0 event, got %s/%s; ', boughtKind, boughtActor);
  end if;

  -- Same seat mortgages what they just bought — a second, later event.
  update public.city_matches set current_seat = 0, phase = 'optional_actions',
    turn_clock_paused_at = null where id = m;
  select public.city_mortgage(m, 21) into res;
  select id, kind into mortId, mortKind
    from public.city_match_events where match_id = m order by id desc limit 1;
  if mortKind is distinct from 'mortgaged' then
    ok := false; act := act || format('after city_mortgage, expected a mortgaged event, got %s; ', mortKind);
  elsif mortId <= boughtId then
    ok := false; act := act || format('mortgaged event id %s did not come after bought event id %s; ', mortId, boughtId);
  end if;

  insert into rg values (default,'CITY-EVENTS','city_match_events actually logs, with the right kind/actor/ordering, for the real client-facing RPCs',
    'zero events on a fresh match; city_buy_property logs a bought/seat-0 row; city_mortgage logs a later mortgaged row',
    case when ok then format('bought=%s(id %s), mortgaged=%s(id %s)', boughtKind, boughtId, mortKind, mortId) else act end,
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
