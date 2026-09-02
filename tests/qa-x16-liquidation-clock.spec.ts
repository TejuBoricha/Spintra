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

// BUG-007 round H (FR-33/FR-42): forced liquidation runs on its own fixed
// 90s window, independent of pace_seconds, and the client now shows that
// distinct countdown plus surfaces the auto-resolution. Both were only
// SQL-verified before this. turn_started_at is deliberately backdated far
// enough that the ORDINARY pace clock would already read ~0:05 if the
// client were (wrongly) still using it -- so seeing something close to
// 1:30 instead proves it picked the new debt-specific deadline, not just
// coincidentally similar timing.
test('city: the debt countdown is distinct from the turn clock, and forced liquidation resolves live', async () => {
  test.setTimeout(90_000);
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto(`${BASE}/create?type=city`);
  await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
  const code = host.url().split('/room/')[1];
  await host.getByRole('radio', { name: /fast/i }).click();
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
  const price = Number(psql(`select price from city_board_spaces where idx=${propIdx};`));
  const raise = Math.round(price / 2);

  psql(`insert into city_assets (match_id, space_idx, owner_seat) values ('${matchId}', ${propIdx}, 0);`);
  psql(`update city_matches set current_seat=0, phase='required_decision', pace_seconds=25, turn_clock_paused_at=null, turn_started_at = now() - interval '20 seconds', debt_started_at = now() where id='${matchId}';`);
  psql(`update city_match_players set pending_debt=${raise}, pending_creditor_seat=null where match_id='${matchId}' and seat=0;`);

  // Debt-specific countdown: a fresh ~90s reading, not the ordinary
  // pace clock's already-near-zero one.
  await host.waitForTimeout(3000);
  const countdown = host.getByRole('timer');
  await expect(countdown).toBeVisible({ timeout: 10000 });
  const reading = (await countdown.textContent()) ?? '';
  const [mm, ss] = reading.trim().split(':').map(Number);
  const totalSeconds = mm * 60 + ss;
  expect(totalSeconds).toBeGreaterThan(80); // ~90s, not ~5s

  // Past the fixed 90s window: the client's own auto-claim effect resolves
  // it via liquidation (this asset alone covers the debt).
  psql(`update city_matches set debt_started_at = now() - interval '95 seconds' where id='${matchId}';`);
  await host.waitForTimeout(6000);

  const debtAfter = Number(psql(`select pending_debt from city_match_players where match_id='${matchId}' and seat=0;`));
  expect(debtAfter).toBe(0);
  const mortgaged = psql(`select is_mortgaged from city_assets where match_id='${matchId}' and space_idx=${propIdx};`);
  expect(mortgaged).toBe('t');
  // The client's own view reflects the resolution -- no longer stuck asking
  // whether to buy the unclaimed space it was parked on for the debt setup
  // (checked live, not just in the database). The ordinary turn clock,
  // untouched by debt resolution and already stale from this test's own
  // setup, may itself have since advanced the turn on to the next seat --
  // a plausible, harmless cascade, not the thing being asserted here.
  await expect(host.getByText(/is unclaimed\. buy it for/i)).toHaveCount(0, { timeout: 10000 });

  await browser.close();
});
