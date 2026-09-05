import { test, chromium, type Page } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://127.0.0.1:4000';
const sql = (q: string) =>
  execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
const accept = async (p: Page) => {
  const b = p.getByRole('button', { name: /^accept$/i });
  if (await b.count()) await b.first().click().catch(() => {});
};

// Behavioral proof for BUG-038: a client idling on match 1 must NOT refetch
// when a trade or auction happens in a completely separate match. This is the
// property the source-level harness check (city-regression.mjs) can only
// infer statically; this test exercises it for real.
test('BUG-038: idle client on match 1 does not refetch on match 2 activity', async () => {
  test.setTimeout(240_000);
  const log: string[] = [];
  const note = (s: string) => { log.push(s); console.log('### ' + s); };

  const br = await chromium.launch();

  async function makeMatch(roomLabel: string) {
    const host = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    const guest = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await host.goto(`${BASE}/create?type=city`);
    await accept(host);
    await host.locator('[data-testid="create-room-button-client"]').click();
    await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
    const code = host.url().split('/room/')[1];
    await host.getByRole('button', { name: /open a match/i }).click({ timeout: 40000 });
    await host.getByRole('button', { name: /take a seat/i }).click({ timeout: 30000 });
    await guest.goto(`${BASE}/room/${code}`);
    await accept(guest);
    await guest.getByRole('button', { name: /take a seat/i }).click({ timeout: 40000 });
    for (const p of [host, guest]) await p.getByRole('button', { name: /ready/i }).first().click({ timeout: 20000 }).catch(() => {});
    await host.getByRole('button', { name: /start match/i }).click({ timeout: 25000 });
    await host.waitForTimeout(2500);
    const mid = sql(`select id from city_matches where room_code='${code}' and status='active'`);
    note(`${roomLabel} room=${code} match=${mid}`);
    return { host, guest, code, mid };
  }

  const m1 = await makeMatch('MATCH-1 (observer)');
  const m2 = await makeMatch('MATCH-2 (noisemaker)');

  // give match 1 something tradeable and let it go quiet
  sql(`insert into city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged) values ('${m1.mid}',1,0,0,false),('${m1.mid}',6,1,0,false) on conflict do nothing`);
  await m1.host.reload();
  await m1.host.waitForTimeout(3500);
  await accept(m1.host);

  const countReqs = (p: Page) => {
    let n = 0;
    p.on('request', (r) => { if (/\/rest\/v1\/city_/.test(r.url())) n++; });
    return () => n;
  };
  const getM1Count = countReqs(m1.host);

  await m1.host.waitForTimeout(4000); // idle baseline window
  const baseline = getM1Count();
  note(`match-1 host: requests during idle baseline = ${baseline}`);

  // now generate real trade activity in match 2 — a completely separate match
  sql(`insert into city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged) values ('${m2.mid}',1,0,0,false),('${m2.mid}',6,1,0,false) on conflict do nothing`);
  await m2.host.reload();
  await m2.host.waitForTimeout(3000);
  await accept(m2.host);
  await m2.host.getByRole('button', { name: /propose a trade/i }).first().click({ timeout: 15000 });
  const panel = m2.host.locator('[data-testid="trade-panel"]');
  await panel.waitFor({ timeout: 15000 });
  await m2.host.locator('[data-testid="trade-partner"]').first().click({ timeout: 10000 });
  await m2.host.waitForTimeout(800);
  const toggle = panel.locator('button[aria-pressed]').first();
  if (await toggle.isEnabled()) await toggle.click().catch(() => {});
  await m2.host.waitForTimeout(500);
  await panel.getByRole('button', { name: /send offer/i }).first().click({ timeout: 10000 }).catch(() => {});
  note(`match-2 trade offers created: ${sql(`select count(*) from city_trade_offers where match_id='${m2.mid}'`)}`);

  // watch match 1 for the next 6s — it must NOT react to match 2's trade
  await m1.host.waitForTimeout(6000);
  const afterOtherMatchActivity = getM1Count();
  const leaked = afterOtherMatchActivity - baseline;
  note(`match-1 host: requests in the 6s after MATCH-2's trade = ${leaked} (must be 0)`);

  // control: prove match-1's OWN activity still triggers a refetch, so a 0
  // above means "correctly scoped", not "the listener stopped working"
  sql(`update city_matches set current_seat=0, phase='awaiting_roll' where id='${m1.mid}'`);
  const before = getM1Count();
  await m1.host.getByRole('button', { name: /roll dice/i }).click({ timeout: 15000 }).catch(() => {});
  await m1.host.waitForTimeout(3000);
  const ownActivity = getM1Count() - before;
  note(`match-1 host: requests after its OWN roll = ${ownActivity} (must be > 0 -- proves the client is still listening)`);

  note(`VERDICT: ${leaked === 0 && ownActivity > 0 ? 'PASS -- scoped correctly, not just deaf' : 'FAIL'}`);
  console.log('\n===R===\n' + log.join('\n') + '\n===END===');
  await br.close();
});
