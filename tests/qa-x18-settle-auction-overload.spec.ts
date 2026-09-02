import { test, expect, chromium, type Page } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://127.0.0.1:4000';
const accept = async (p: Page) => {
  const b = p.getByRole('button', { name: /^accept$/i });
  await b.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await b.count()) await b.first().click().catch(() => {});
  await p
    .getByRole('region', { name: /cookie notice/i })
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
};

const psql = (sql: string) =>
  execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${sql}"`)
    .toString()
    .trim();

// Found by a visual-review agent, not any prior audit: city_settle_auction
// has had two ambiguous overloads since migration 0071 (long before
// BUG-007) -- the real client's own 1-arg RPC call ("function ... is not
// unique") has been silently failing forever whenever an auction resolves
// via its own natural clock rather than a force-settle or every seat
// explicitly passing. Nothing in 55 SQL assertions or 14 live specs ever
// happened to exercise that exact path. This proves the fix (migration
// 0091) live: an auction left to expire on its own actually settles.
test('city: an auction that expires on its own clock actually settles, not silently hangs', async () => {
  test.setTimeout(60_000);
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
  for (const p of [host, guest]) {
    await p.getByRole('button', { name: /ready/i }).first().click({ timeout: 20000 }).catch(() => {});
  }
  await host.getByRole('button', { name: /start match/i }).click({ timeout: 25000 });
  await host.waitForTimeout(1500);

  const matchId = psql(`select id from city_matches where room_code='${code}';`);
  const propIdx = psql(`select min(idx) from city_board_spaces where price is not null;`);

  // A real auction whose clock has already run out -- nobody bids, nobody
  // clicks Pass. The client's own auto-settle effect (city-auction.tsx)
  // must be the thing that resolves it, through the exact RPC call this
  // bug lived in.
  psql(`update city_matches set current_seat=0, phase='auction' where id='${matchId}';`);
  psql(`insert into city_auctions (match_id, space_idx, ends_at, hard_ends_at, status) values ('${matchId}', ${propIdx}, now() - interval '1 seconds', now() - interval '1 seconds', 'running');`);

  await host.reload();
  await host.waitForTimeout(4000);

  const status = psql(`select status from city_auctions where match_id='${matchId}' order by created_at desc limit 1;`);
  expect(status).toBe('settled');
  // The auction panel itself should be gone, not stuck reading "closing…".
  await expect(host.getByText(/up for auction/i)).toHaveCount(0, { timeout: 10000 });

  await browser.close();
});
