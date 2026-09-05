import { test, expect, chromium, type Page } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://127.0.0.1:4000';
const sql = (q: string) =>
  execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
const accept = async (p: Page) => {
  const b = p.getByRole('button', { name: /^accept$/i });
  if (await b.count()) await b.first().click().catch(() => {});
};

// BUG-033 (pace half): host picks a pace preset before opening the match,
// and it actually persists to the row (FR-42).
test('city: host can pick a pace preset that persists to the match', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();

  await host.goto(`${BASE}/create?type=city`);
  await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
  const code = host.url().split('/room/')[1];

  await host.getByRole('radio', { name: /slow/i }).click();
  await host.getByRole('button', { name: /open a match/i }).click({ timeout: 40000 });
  await host.waitForTimeout(1500);

  const pace = sql(`select pace_seconds from city_matches where room_code='${code}' and status='lobby'`);
  console.log('BUG-033 pace_seconds after selecting Slow (60s):', pace);
  expect(pace).toBe('60');

  await browser.close();
});

// BUG-030: mortgaging Porto (price 55) should raise 28, not 27.
test('city: mortgage raises the correctly-rounded amount, live', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

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
  await host.waitForTimeout(2000);

  const mid = sql(`select id from city_matches where room_code='${code}' and status='active'`);
  sql(`delete from city_assets where match_id='${mid}'`);
  sql(`insert into city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged) values ('${mid}',1,0,0,false)`);
  const cashBefore = sql(`select cash from city_match_players where match_id='${mid}' and seat=0`);
  await host.reload();
  await accept(host);
  await host.waitForTimeout(1500);

  await host.getByRole('button', { name: /^mortgage/i }).first().click();
  await host.waitForTimeout(1500);
  const cashAfter = sql(`select cash from city_match_players where match_id='${mid}' and seat=0`);
  const raised = Number(cashAfter) - Number(cashBefore);
  console.log('BUG-030 live mortgage raised:', raised, '(expect 28)');
  expect(raised).toBe(28);

  await browser.close();
});

// BUG-033 (FR-36 half): a genuine spectator (joins the room, never seats)
// sees a clear spectator message, not "Waiting for X".
test('city: a never-seated room member sees a spectator message', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  const onlooker = await (await browser.newContext()).newPage();

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
  await host.waitForTimeout(2000);

  // onlooker joins the room after the match is already active, and never seats
  await onlooker.goto(`${BASE}/room/${code}`);
  await accept(onlooker);
  await onlooker.waitForTimeout(2000);

  const statusText = await onlooker.getByRole('status').last().textContent();
  console.log('BUG-033 (FR-36) never-seated onlooker status text:', statusText);
  expect(statusText).toMatch(/spectating/i);
  expect(statusText).not.toMatch(/^waiting for/i);

  await browser.close();
});
