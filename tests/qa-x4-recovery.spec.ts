import { test, chromium , type Page } from '@playwright/test';
import { execSync } from 'child_process';
const BASE='http://127.0.0.1:4020';
const sql=(q:string)=>execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${q.replace(/"/g,'\\"')}"`).toString().trim();
const accept=async(p:Page)=>{const b=p.getByRole('button',{name:/^accept$/i}); if(await b.count()) await b.first().click().catch(()=>{});};

test('TC-REC-05/06/07: offline mid-turn, reconnect, leave and rejoin', async () => {
  test.setTimeout(360_000);
  const log:string[]=[]; const note=(s:string)=>{log.push(s);console.log('### '+s);};
  const br=await chromium.launch();
  const ctxA=await br.newContext({viewport:{width:1280,height:1000}});
  const ctxB=await br.newContext({viewport:{width:1280,height:1000}});
  const A=await ctxA.newPage(); const B=await ctxB.newPage();

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
  const onTurn = seat==='0'?A:B; const which = seat==='0'?'A':'B';
  note(`match=${mid} current_seat=${seat} (${which})`);

  // TC-REC-05: go offline mid-turn with a legitimately enabled Roll
  const roll=onTurn.getByRole('button',{name:/roll dice/i});
  note(`roll enabled before offline: ${await roll.isEnabled().catch(()=>false)}`);
  const ctx = which==='A'?ctxA:ctxB;
  await ctx.setOffline(true); note('network OFF');
  await roll.click({timeout:12000}).catch(e=>note('roll click while offline threw: '+String(e).slice(0,70)));
  await onTurn.waitForTimeout(4000);
  const offlineText=await onTurn.locator('body').innerText();
  note(`any offline/reconnect indicator shown: ${/offline|reconnect|connection|no internet|lost/i.test(offlineText)}`);
  note(`error surfaced to user while offline: ${/couldn|could not|failed|try again|error/i.test(offlineText)}`);
  note(`DB position unchanged while offline: ${sql(`select coalesce(max(position),-1) from city_match_players where match_id='${mid}'`)}`);

  // TC-REC-06: back online — does it recover WITHOUT a reload?
  await ctx.setOffline(false); note('network ON');
  await onTurn.waitForTimeout(6000);
  let recovered=false;
  for (let i=0;i<12;i++){
    if (await onTurn.getByRole('button',{name:/roll dice/i}).isEnabled().catch(()=>false)){ recovered=true; note(`controls usable again after ~${(i+1)*2}s, no reload`); break; }
    await onTurn.waitForTimeout(2000);
  }
  if(!recovered) note('controls NOT usable again within 24s of reconnecting');
  // can they actually act?
  let acted=false;
  try { await onTurn.getByRole('button',{name:/roll dice/i}).click({timeout:10000}); await onTurn.waitForTimeout(3000);
        acted = Number(sql(`select coalesce(max(position),-1) from city_match_players where match_id='${mid}'`))>0; } catch{}
  note(`could act after reconnect (roll applied in DB): ${acted}`);
  note(`TC-REC-06 VERDICT: ${recovered&&acted?'recovers correctly — PASS':'did not recover cleanly — FAIL'}`);

  // TC-REC-07: leave the room entirely and come back
  await B.goto(`${BASE}/`); await B.waitForTimeout(2500);
  await B.goto(`${BASE}/room/${code}`); await B.waitForTimeout(5000); await accept(B);
  const bText=await B.locator('body').innerText();
  const stillSeated = !/take a seat/i.test(bText) && /\d[,.]?\d*/.test(bText);
  note(`after leaving and returning, B is restored to their seat (not spectator): ${stillSeated}`);
  note(`B sees the board: ${await B.locator('.grid.aspect-square').count()>0}`);
  note(`seats in DB still 2: ${sql(`select count(*) from city_match_players where match_id='${mid}'`)}`);
  console.log('\n===R===\n'+log.join('\n')+'\n===END===');
  await br.close();
});
