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

// Four functional bugs found by a user-requested visual/UX review, fixed here.

test('city: debt status text shows the raise-funds message, not the stale buy-prompt', async () => {
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
  psql(`update city_matches set current_seat=0, phase='required_decision', debt_started_at=now() where id='${matchId}';`);
  psql(`update city_match_players set pending_debt=500, pending_creditor_seat=null where match_id='${matchId}' and seat=0;`);

  await host.reload();
  await host.waitForTimeout(1500);

  await expect(host.getByText(/short on cash/i)).toBeVisible({ timeout: 10000 });
  await expect(host.getByText(/is unclaimed\. buy it for/i)).toHaveCount(0);

  await browser.close();
});

test('city: participant action buttons register a click immediately after opening People tab', async () => {
  test.setTimeout(60_000);
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto(`${BASE}/create?type=city`);
  await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
  const code = host.url().split('/room/')[1];
  await guest.goto(`${BASE}/room/${code}`);
  await accept(guest);
  await host.waitForTimeout(1000);

  // Switch to Chat first (if not already the default) so switching to
  // People is a genuine tab transition, then click immediately -- no
  // settle delay -- exactly the scenario that was flaky.
  await host.getByRole('button', { name: /^chat$/i }).click({ timeout: 10000 }).catch(() => {});
  await host.getByRole('button', { name: /^people/i }).click({ timeout: 10000 });
  const blockButton = host.getByRole('button', { name: /^block /i }).first();
  await blockButton.waitFor({ state: 'visible', timeout: 5000 });
  await blockButton.click({ timeout: 3000 });
  // A successful click flips this specific button to its "Unblock" label.
  await expect(host.getByRole('button', { name: /^unblock /i }).first()).toBeVisible({ timeout: 3000 });

  await browser.close();
});

test('site: resizing past the mobile breakpoint with the drawer open does not freeze the page', async () => {
  test.setTimeout(60_000);
  const browser = await chromium.launch();
  const host = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();

  await host.goto(`${BASE}/create?type=city`);
  await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
  await host.waitForTimeout(1000);

  // Open the mobile sidebar drawer.
  await host.getByRole('button', { name: /toggle chat and participants sidebar/i }).click({ timeout: 10000 });
  await host.waitForTimeout(500);

  // Resize past the md breakpoint (768px) while the drawer is open.
  await host.setViewportSize({ width: 1024, height: 800 });
  await host.waitForTimeout(500);

  // The page must still respond to clicks -- try the "Open a match" button,
  // which only exists on this pre-match screen and would be unreachable
  // under a stuck invisible overlay.
  const openMatch = host.getByRole('button', { name: /open a match/i });
  await expect(openMatch).toBeVisible({ timeout: 5000 });
  await openMatch.click({ timeout: 5000 });
  await expect(host.getByRole('button', { name: /take a seat/i })).toBeVisible({ timeout: 10000 });

  await browser.close();
});

test('city: reloading right after a match finishes keeps the player in the room', async () => {
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
  // city_match_results is a view derived live from city_matches/
  // city_match_players -- finishing the match and giving each seat a real
  // final_net_worth is all that's needed for it to populate. The xp bump
  // mirrors what city_finish_match's real award path does: the client's
  // own locally-cached xp is now stale relative to the server -- exactly
  // the mismatch that used to trip restrict_host_participant_update on
  // reconnect.
  psql(`update city_match_players set final_net_worth = cash where match_id='${matchId}';`);
  psql(`update city_matches set status='finished' where id='${matchId}';`);
  // The same bypass flag _record_award/award_score set for a real,
  // legitimate server-side XP write -- not impersonating any particular
  // user, just reproducing exactly what a real match finish does to this
  // row.
  const hostUserId = psql(`select host_id from rooms where code='${code}';`);
  psql(`select set_config('request.jwt.claims', json_build_object('sub','${hostUserId}','role','authenticated')::text, false), set_config('app.bypass_participant_restriction','true',false); update room_participants set xp = xp + 50 where room_id='${code}' and user_id='${hostUserId}';`);

  await host.reload();
  await host.waitForTimeout(2500);

  // Must still be on the room page, not redirected to /explore.
  expect(host.url()).toContain(`/room/${code}`);
  await expect(host.getByText(/unable to join room/i)).toHaveCount(0);

  await browser.close();
});
