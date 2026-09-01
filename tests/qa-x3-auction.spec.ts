import { test, chromium , type Page } from '@playwright/test';
import { execSync } from 'child_process';
const BASE='http://127.0.0.1:4020';
const sql=(q:string)=>execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${q.replace(/"/g,'\\"')}"`).toString().trim();
const accept=async(p:Page)=>{const b=p.getByRole('button',{name:/^accept$/i}); if(await b.count()) await b.first().click().catch(()=>{});};

test('TC-MULTI-11: auction in a live match', async () => {
  test.setTimeout(300_000);
  const log:string[]=[]; const note=(s:string)=>{log.push(s);console.log('### '+s);};
  const br=await chromium.launch();
  const A=await (await br.newContext({viewport:{width:1280,height:1000}})).newPage();
  const B=await (await br.newContext({viewport:{width:1280,height:1000}})).newPage();

  await A.goto(`${BASE}/create?type=city`); await accept(A);
  await A.locator('[data-testid="create-room-button-client"]').click();
  await A.waitForURL(/\/room\/[A-Z0-9]+/,{timeout:40000});
  const code=A.url().split('/room/')[1]; note(`room=${code}`);
  await A.getByRole('button',{name:/open a match/i}).click({timeout:40000});
  await A.getByRole('button',{name:/take a seat/i}).click({timeout:30000});
  await B.goto(`${BASE}/room/${code}`); await accept(B);
  await B.getByRole('button',{name:/take a seat/i}).click({timeout:40000});
  for (const p of [A,B]) await p.getByRole('button',{name:/ready/i}).first().click({timeout:20000}).catch(()=>{});
  await A.getByRole('button',{name:/start match/i}).click({timeout:25000});
  await A.waitForTimeout(3000);
  const mid=sql(`select id from city_matches where room_code='${code}' and status='active'`);
  const seat=sql(`select current_seat from city_matches where id='${mid}'`);
  note(`match=${mid} current_seat=${seat}`);

  // put the active seat on an unowned property in the buy/decline phase
  sql(`update city_match_players set position=39 where match_id='${mid}' and seat=${seat}`);
  sql(`update city_matches set phase='required_decision' where id='${mid}'`);
  const onTurn = seat==='0' ? A : B;
  const offTurn = seat==='0' ? B : A;
  await onTurn.reload(); await onTurn.waitForTimeout(3500); await accept(onTurn);

  const pass=onTurn.getByRole('button',{name:/^pass$|decline/i});
  note(`Pass/decline button present: ${await pass.count()>0}`);
  if (await pass.count()===0){ note('cannot reach decline via UI'); console.log('\n===R===\n'+log.join('\n')+'\n===END==='); await br.close(); return; }
  await pass.first().click({timeout:15000});
  await onTurn.waitForTimeout(2500);
  note(`match phase now: ${sql(`select coalesce(phase,'null') from city_matches where id='${mid}'`)}`);
  note(`auction rows: ${sql(`select coalesce(string_agg(status||' space='||space_idx,','),'none') from city_auctions where match_id='${mid}'`)}`);

  // does the auction panel appear for BOTH players without reload?
  let bSaw=false;
  for (let i=0;i<15;i++){ await offTurn.waitForTimeout(1000);
    if (/auction|up for auction|bid/i.test(await offTurn.locator('body').innerText())){ bSaw=true; note(`off-turn player saw the auction after ~${i+1}s (no reload)`); break; } }
  if(!bSaw) note('off-turn player did NOT see the auction within 15s');
  note(`on-turn player sees auction UI: ${/auction|up for auction|bid/i.test(await onTurn.locator('body').innerText())}`);

  // place a bid from the off-turn player
  const bid=offTurn.getByRole('button',{name:/^bid /i});
  note(`bid buttons visible to off-turn player: ${await bid.count()}`);
  if (await bid.count()){
    await bid.first().click({timeout:12000}).catch(e=>note('bid click failed: '+String(e).slice(0,80)));
    await offTurn.waitForTimeout(2500);
    note(`after bid: ${sql(`select coalesce(string_agg('high='||high_bid||' seat='||coalesce(high_seat::text,'-'),','),'none') from city_auctions where match_id='${mid}' and status='running'`)}`);
  }
  // other player passes -> should settle
  const passBtn=onTurn.getByRole('button',{name:/^pass$/i});
  if (await passBtn.count()){ await passBtn.first().click({timeout:12000}).catch(()=>{}); await onTurn.waitForTimeout(3000); }
  note(`auction final: ${sql(`select coalesce(string_agg(status||' winner='||coalesce(high_seat::text,'none'),','),'none') from city_auctions where match_id='${mid}'`)}`);
  note(`space 39 owner: ${sql(`select coalesce(max(owner_seat)::text,'unowned') from city_assets where match_id='${mid}' and space_idx=39`)}`);
  console.log('\n===R===\n'+log.join('\n')+'\n===END===');
  await br.close();
});
