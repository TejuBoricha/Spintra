import { test, chromium , type Page } from '@playwright/test';
import { execSync } from 'child_process';
const BASE='http://127.0.0.1:4000';
const sql=(q:string)=>execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${q.replace(/"/g,'\\"')}"`).toString().trim();
const accept=async(p:Page)=>{const b=p.getByRole('button',{name:/^accept$/i}); if(await b.count()) await b.first().click().catch(()=>{});};

test('TC-PERF: long-session memory profile', async () => {
  test.setTimeout(1_500_000);
  const log:string[]=[]; const note=(s:string)=>{log.push(s);console.log('### '+s);};
  const br=await chromium.launch({args:['--js-flags=--expose-gc']});
  const A=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();
  const B=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();

  await A.goto(`${BASE}/create?type=city`); await accept(A);
  await A.locator('[data-testid="create-room-button-client"]').click();
  await A.waitForURL(/\/room\/[A-Z0-9]+/,{timeout:40000});
  const code=A.url().split('/room/')[1];
  await A.getByRole('button',{name:/open a match/i}).click({timeout:40000});
  await A.getByRole('button',{name:/take a seat/i}).click({timeout:30000});
  await B.goto(`${BASE}/room/${code}`); await accept(B);
  await B.getByRole('button',{name:/take a seat/i}).click({timeout:40000});
  for (const p of [A,B]) await p.getByRole('button',{name:/ready/i}).first().click({timeout:20000}).catch(()=>{});
  await A.getByRole('button',{name:/start match/i}).click({timeout:25000});
  await A.waitForTimeout(3000);
  const mid=sql(`select id from city_matches where room_code='${code}' and status='active'`);
  note(`room=${code} match=${mid}`);

  const cdp=await A.context().newCDPSession(A);
  const heap=async()=>{ const { metrics } = (await cdp.send('Performance.getMetrics')) as unknown as { metrics: Array<{ name: string; value: number }> };
    const m: Record<string, number> = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    return {heap:Math.round(m.JSHeapUsedSize/1048576*10)/10, nodes:m.Nodes, listeners:m.JSEventListeners, docs:m.Documents}; };
  await cdp.send('Performance.enable');

  const samples: Array<Record<string, number>> = [];
  const base=await heap(); samples.push({turn:0,...base});
  note(`baseline heap=${base.heap}MB nodes=${base.nodes} listeners=${base.listeners}`);

  let turns=0;
  for (let i=0;i<300;i++){
    const st=sql(`select status from city_matches where id='${mid}'`);
    if (st!=='active'){ note(`match ended at turn ${turns} (${st})`); break; }
    for (const p of [A,B]) {
      for (const nm of [/roll dice/i,/^Buy /i,/^Pass$/,/end turn/i]) {
        const b=p.getByRole('button',{name:nm});
        if (await b.count() && await b.first().isEnabled().catch(()=>false)) {
          await b.first().click({timeout:6000}).catch(()=>{}); await p.waitForTimeout(280); turns++;
        }
      }
    }
    if (i>0 && i%25===0){ const s=await heap(); samples.push({turn:turns,...s});
      note(`after ~${turns} actions: heap=${s.heap}MB nodes=${s.nodes} listeners=${s.listeners} docs=${s.docs}`); }
  }
  await A.waitForTimeout(3000);
  const fin=await heap(); samples.push({turn:turns,...fin});
  const first=samples[0], last=samples[samples.length-1];
  const growth=Math.round((last.heap-first.heap)*10)/10;
  const perAction=turns? Math.round((last.heap-first.heap)/turns*1000)/1000 : 0;
  note(`FINAL after ${turns} actions: heap ${first.heap}MB -> ${last.heap}MB (${growth>=0?'+':''}${growth}MB, ${perAction}MB/action)`);
  note(`nodes ${first.nodes} -> ${last.nodes} | listeners ${first.listeners} -> ${last.listeners} | documents ${first.docs} -> ${last.docs}`);
  note(`VERDICT: ${growth < 25 && last.listeners < first.listeners*3 ? 'no runaway growth — PASS' : 'possible leak — investigate'}`);
  console.log('\n===R===\n'+log.join('\n')+'\n===END===');
  await br.close();
});
