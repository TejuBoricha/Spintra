import { test, chromium, devices , type Page } from '@playwright/test';
import { execSync } from 'child_process';
const BASE='http://127.0.0.1:4020';
const sql=(q:string)=>execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${q.replace(/"/g,'\\"')}"`).toString().trim();
const accept=async(p:Page)=>{const b=p.getByRole('button',{name:/^accept$/i}); if(await b.count()) await b.first().click().catch(()=>{});};
const PROFILES=['iPhone 13','Pixel 5','iPad (gen 7)','Galaxy S9+'];

test('TC-COMPAT: real device profiles with touch input', async () => {
  test.setTimeout(900_000);
  const log:string[]=[]; const note=(s:string)=>{log.push(s);console.log('### '+s);};
  const br=await chromium.launch();

  // one live match to view
  const host=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();
  const g=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();
  await host.goto(`${BASE}/create?type=city`); await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/,{timeout:40000});
  const code=host.url().split('/room/')[1];
  await host.getByRole('button',{name:/open a match/i}).click({timeout:40000});
  await host.getByRole('button',{name:/take a seat/i}).click({timeout:30000});
  await g.goto(`${BASE}/room/${code}`); await accept(g);
  await g.getByRole('button',{name:/take a seat/i}).click({timeout:40000});
  for (const p of [host,g]) await p.getByRole('button',{name:/ready/i}).first().click({timeout:20000}).catch(()=>{});
  await host.getByRole('button',{name:/start match/i}).click({timeout:25000});
  await host.waitForTimeout(3000);
  const mid=sql(`select id from city_matches where room_code='${code}' and status='active'`);
  sql(`insert into city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged) values ('${mid}',1,0,2,false),('${mid}',6,1,0,true) on conflict do nothing`);
  note(`room=${code}`);

  for (const name of PROFILES) {
    const d = devices[name as keyof typeof devices];
    if (!d){ note(`${name}: profile not available`); continue; }
    const ctx=await br.newContext({...d});
    const p=await ctx.newPage();
    const errs:string[]=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,90)));
    await p.goto(`${BASE}/room/${code}`); await p.waitForTimeout(5000); await accept(p);
    const m=await p.evaluate(()=>{
      const de=document.documentElement;
      const board=document.querySelector('.grid.aspect-square') as HTMLElement|null;
      const tiles=board?board.children.length:0;
      let tapTooSmall=0;
      document.querySelectorAll<HTMLElement>('button,a[href]').forEach(el=>{
        const r=el.getBoundingClientRect();
        if (r.width>0 && r.height>0 && (r.width<24||r.height<24)) tapTooSmall++;
      });
      return {overflow:de.scrollWidth-de.clientWidth, tiles, tapTooSmall,
              touch:('ontouchstart' in window)||navigator.maxTouchPoints>0,
              dpr:window.devicePixelRatio, ua:navigator.userAgent.slice(0,42), vw:window.innerWidth};
    });
    // real touch interaction, not a mouse click
    let tapped='n/a';
    try { const b=p.getByRole('button',{name:/chat|people|holdings|trade|roll/i}).first();
          if (await b.count()){ await b.tap({timeout:8000}); tapped='tap OK'; } else tapped='no target'; }
    catch(e){ tapped='TAP FAILED: '+String(e).split('\n')[0].slice(0,60); }
    note(`${name} ${m.vw}px dpr=${m.dpr} touch=${m.touch} :: pageOverflow=${m.overflow}px boardTiles=${m.tiles} tapTargets<24px=${m.tapTooSmall} ${tapped} errors=${errs.length?errs[0]:'none'}`);
    await ctx.close();
  }
  console.log('\n===R===\n'+log.join('\n')+'\n===END===');
  await br.close();
});
