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
