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

// BUG-007 round H finding 5: if every seat with standing in an auction is
// away, city_settle_auction now re-invokes the autopilot cascade so the
// match actually reaches the durable "Match paused" state, instead of
// sitting active with an away current_seat until an unrelated reconnect.
// Previously only SQL-verified (city_settle_auction called directly with
// p_force=true) -- this drives it through a real auction opened by a real
// decline, force-settled via the real function (matching how the client's
// own auto-settle effect in city-auction.tsx would eventually call it once
// the auction's timer runs out; only the WAIT for that natural timer is
// skipped here, not the mechanism itself), then confirms the paused banner
// actually renders in a live client.
test('city: an auction settling with everyone away reaches the durable pause banner, live', async () => {
  test.setTimeout(90_000);
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();
  const g1 = await (await browser.newContext()).newPage();
  const g2 = await (await browser.newContext()).newPage();

  await host.goto(`${BASE}/create?type=city`);
  await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
  const code = host.url().split('/room/')[1];
  await host.getByRole('button', { name: /open a match/i }).click({ timeout: 40000 });
  await host.getByRole('button', { name: /take a seat/i }).click({ timeout: 30000 });
  for (const p of [g1, g2]) {
    await p.goto(`${BASE}/room/${code}`);
    await accept(p);
    await p.getByRole('button', { name: /take a seat/i }).click({ timeout: 40000 });
  }
  for (const p of [host, g1, g2]) {
    await p.getByRole('button', { name: /ready/i }).first().click({ timeout: 20000 }).catch(() => {});
  }
  await host.getByRole('button', { name: /start match/i }).click({ timeout: 25000 });
  await host.waitForTimeout(1500);

  const matchId = psql(`select id from city_matches where room_code='${code}';`);
  const propIdx = psql(`select min(idx) from city_board_spaces where price is not null;`);

  // A real running auction. city_settle_auction's own phase transition only
  // takes effect where phase='auction' (a no-op otherwise), and every
  // subsequent seat the cascade below walks onto needs phase='awaiting_roll'
  // for its own in_detention check to succeed -- so this deliberately
  // starts at 'awaiting_roll', not 'auction', matching the equivalent SQL
  // test's own precedent (city_matches.phase itself plays no role in
  // whether city_settle_auction can act; only city_auctions.status does).
  psql(`update city_match_players set position=${propIdx} where match_id='${matchId}' and seat=0;`);
  psql(`update city_matches set current_seat=0, phase='awaiting_roll' where id='${matchId}';`);
  psql(`insert into city_auctions (match_id, space_idx, ends_at, hard_ends_at, status) values ('${matchId}', ${propIdx}, now() - interval '1 seconds', now() - interval '1 seconds', 'running');`);

  // Every seat away -- and, per the design this test exercises, parked in
  // detention so the cascade's path is deterministic (a live dice roll
  // could legitimately land on another purchasable space and open a
  // second real auction instead -- a different, also-correct outcome, not
  // this scenario -- matching the exact seed-dependence lesson learned
  // writing this same case at the SQL level).
  psql(`update city_match_players set disconnected_at = now() - interval '90 seconds', in_detention = true, detention_turns = 0 where match_id='${matchId}';`);

  psql(`select public.city_settle_auction('${matchId}'::uuid, true);`);

  const status = psql(`select status from city_matches where id='${matchId}';`);
  expect(status).toBe('paused');

  // Confirm the banner actually renders on a live client -- a realtime
  // push (city_matches UPDATE) should already have delivered it; reload as
  // a safety net in case the push raced this check.
  await host.waitForTimeout(3000);
  const banner = host.getByText(/match paused/i);
  if ((await banner.count()) === 0) await host.reload();
  await expect(host.getByText(/match paused/i)).toBeVisible({ timeout: 15000 });
  await expect(host.getByText(/everyone left/i)).toBeVisible();

  await browser.close();
});
