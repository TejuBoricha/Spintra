import { test, chromium , type Page } from '@playwright/test';
import { execSync } from 'child_process';
const BASE='http://127.0.0.1:4020';
const sql=(q:string)=>execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${q.replace(/"/g,'\\"')}"`).toString().trim();
const accept=async(p:Page)=>{const b=p.getByRole('button',{name:/^accept$/i}); if(await b.count()) await b.first().click().catch(()=>{});};

test('TC-MULTI-10: does a sent trade offer reach the recipient without a reload?', async () => {
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
  sql(`insert into city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged) values ('${mid}',1,0,0,false),('${mid}',3,0,0,false),('${mid}',6,1,0,false) on conflict do nothing`);
  await A.reload(); await A.waitForTimeout(3500); await accept(A);
  await B.reload(); await B.waitForTimeout(3500); await accept(B);

  const bBefore=(await B.locator('body').innerText()).toLowerCase();
  note(`B mentions an offer BEFORE send: ${/offer|wants|proposes|trade from/.test(bBefore)}`);

  await A.getByRole('button',{name:/propose a trade/i}).first().click({timeout:15000});
  const panel=A.locator('[data-testid="trade-panel"]'); await panel.waitFor({timeout:15000});
  await A.locator('[data-testid="trade-partner"]').first().click({timeout:10000});
  await A.waitForTimeout(1000);
  const toggles=panel.locator('button[aria-pressed]'); const tc=await toggles.count();
  let picked=0;
  for (let i=0;i<tc && picked<1;i++){ const t=toggles.nth(i); if (await t.isEnabled()){ await t.click().catch(()=>{}); picked++; } }
  await A.waitForTimeout(600);
  await panel.getByRole('button',{name:/send offer/i}).first().click({timeout:10000});
  await A.waitForTimeout(1500);
  note(`offer rows in DB: ${sql(`select count(*) from city_trade_offers where match_id='${mid}'`)}`);

  // B must NOT be reloaded — watch for up to 20s
  let seen=false, at=0;
  for (let i=0;i<20;i++){
    await B.waitForTimeout(1000);
    const t=(await B.locator('body').innerText()).toLowerCase();
    if (/offer|wants|proposes|accept/.test(t) && (await B.getByRole('button',{name:/accept/i}).count())>0){ seen=true; at=i+1; break; }
  }
  note(`B saw the incoming offer WITHOUT reload: ${seen}${seen?` (after ~${at}s)`:' (waited 20s)'}`);
  if (!seen){ await B.reload(); await B.waitForTimeout(3500); await accept(B);
    const after=(await B.locator('body').innerText()).toLowerCase();
    note(`after a manual reload B sees it: ${/offer|wants|proposes/.test(after) && (await B.getByRole('button',{name:/accept/i}).count())>0}`); }
  note(`VERDICT: ${seen?'trade offers propagate live — PASS':'offer NOT pushed to recipient — FAIL'}`);
  console.log('\n===R===\n'+log.join('\n')+'\n===END===');
  await br.close();
});
