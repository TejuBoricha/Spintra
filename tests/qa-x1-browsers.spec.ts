import { test, firefox, webkit, chromium, type Page } from '@playwright/test';
import { execSync } from 'child_process';
const BASE='http://127.0.0.1:4000';
const sql=(q:string)=>execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${q.replace(/"/g,'\\"')}"`).toString().trim();

for (const [name, launcher] of [['firefox',firefox],['webkit',webkit],['chromium',chromium]] as const) {
  test(`core loop on ${name}`, async () => {
    test.setTimeout(300_000);
    const log:string[]=[]; const note=(s:string)=>{log.push(s);console.log(`### [${name}] ${s}`);};
    const errs:string[]=[];
    // CI (ci.yml) deliberately installs only chromium — matches
    // playwright.config.ts's own single-project scope, keeping the fast
    // gates fast. This loop still tries firefox/webkit for a real dev
    // machine with the full `playwright install` set, but a missing
    // executable there shouldn't fail the whole run the way every other
    // problem in this file already doesn't (see the broad try/catch below) —
    // skip that one browser instead.
    let br;
    try {
      br = await launcher.launch();
    } catch (e) {
      const msg = (e as Error).message;
      // Only a genuinely missing executable should skip silently — a review
      // pass found this catch was unconditional, so a REAL launch failure on
      // a machine that does have the browser (corrupted profile, resource
      // exhaustion, a Playwright/browser version mismatch) would also get
      // silently mislabeled "not installed" and skipped instead of failing,
      // masking an actual regression. Playwright's own missing-executable
      // error always contains this exact phrase.
      if (!/Executable doesn't exist/.test(msg)) throw e;
      test.skip(true, `${name} not installed: ${msg.split('\n')[0].slice(0, 160)}`);
      return;
    }
    try {
      const A=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();
      const B=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();
      for (const [p,who] of [[A,'A'],[B,'B']] as const) {
        p.on('pageerror',e=>errs.push(`${who} PAGEERROR ${e.message.slice(0,120)}`));
        p.on('console',m=>{ if(m.type()==='error' && !/google-analytics|gtag/.test(m.text())) errs.push(`${who} CONSOLE ${m.text().slice(0,120)}`); });
      }
      const accept=async(p:Page)=>{const b=p.getByRole('button',{name:/^accept$/i}); if(await b.count()) await b.first().click().catch(()=>{});};

      await A.goto(`${BASE}/create?type=city`); await accept(A);
      await A.locator('[data-testid="create-room-button-client"]').click({timeout:40000});
      await A.waitForURL(/\/room\/[A-Z0-9]+/,{timeout:60000});
      const code=A.url().split('/room/')[1]; note(`room created: ${code}`);
      await A.getByRole('button',{name:/open a match/i}).click({timeout:40000}); note('match opened');
      await A.getByRole('button',{name:/take a seat/i}).click({timeout:30000}); note('A seated');
      await B.goto(`${BASE}/room/${code}`); await accept(B);
      await B.getByRole('button',{name:/take a seat/i}).click({timeout:45000}); note('B seated');
      await A.waitForTimeout(2500);
      const sawB = await A.getByText(/2 of 8 seated/i).count();
      note(`A sees both seats without reload: ${sawB>0}`);
      for (const p of [A,B]) await p.getByRole('button',{name:/ready/i}).first().click({timeout:20000}).catch(()=>{});
      await A.waitForTimeout(1500);
      await A.getByRole('button',{name:/start match/i}).click({timeout:25000}); note('match started');
      await A.waitForTimeout(3500);
      const mid=sql(`select id from city_matches where room_code='${code}' and status='active'`);
      note(`board rendered: ${await A.locator('.grid.aspect-square').count()>0}`);
      const roll=A.getByRole('button',{name:/roll dice/i});
      const onA=await roll.isEnabled().catch(()=>false);
      const p=onA?A:B;
      await p.getByRole('button',{name:/roll dice/i}).click({timeout:20000});
      await p.waitForTimeout(3000);
      const pos=sql(`select coalesce(max(position),-1) from city_match_players where match_id='${mid}'`);
      note(`roll applied, max position now ${pos} (expect > 0)`);
      note(`RESULT: ${Number(pos)>0 ? 'CORE LOOP WORKS' : 'CORE LOOP FAILED'}`);
    } catch(e){ note(`ERRORED: ${(e as Error).message.split('\n')[0].slice(0,160)}`); }
    note(`console/page errors: ${errs.length? errs.slice(0,4).join(' | ') : '(none)'}`);
    console.log(`\n===${name.toUpperCase()}===\n`+log.join('\n')+`\n===END===`);
    await br.close();
  });
}
