import { test, expect, chromium, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:4000';
const accept = async (p: Page) => {
  const b = p.getByRole('button', { name: /^accept$/i });
  if (await b.count()) await b.first().click().catch(() => {});
};

// BUG-007 round E (FR-29): a player can voluntarily retire from a live match,
// distinct from a disconnect. Confirms the button, the confirm dialog
// (including cancel), the resulting spectator state on the retiring client,
// and that the match genuinely carries on for the remaining players — a
// 3-seat match is used deliberately: retiring the 3rd of 3 down to 2 proves
// the match keeps running, which a 2-player match couldn't (one retirement
// there would correctly end the match via last-player-standing instead).
test('city: a player can voluntarily retire mid-match and the match carries on', async () => {
  test.setTimeout(150_000);
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();
  const p2 = await (await browser.newContext()).newPage();
  const p3 = await (await browser.newContext()).newPage();

  await host.goto(`${BASE}/create?type=city`);
  await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
  const code = host.url().split('/room/')[1];
  await host.getByRole('button', { name: /open a match/i }).click({ timeout: 40000 });
  await host.getByRole('button', { name: /take a seat/i }).click({ timeout: 30000 });

  for (const p of [p2, p3]) {
    await p.goto(`${BASE}/room/${code}`);
    await accept(p);
    await p.getByRole('button', { name: /take a seat/i }).click({ timeout: 40000 });
  }
  for (const p of [host, p2, p3]) {
    await p.getByRole('button', { name: /ready/i }).first().click({ timeout: 20000 }).catch(() => {});
  }
  await host.getByRole('button', { name: /start match/i }).click({ timeout: 25000 });
  await host.waitForTimeout(1500);

  // The retire button is visible to a seated, still-playing participant.
  const retireBtn = p3.getByRole('button', { name: /^retire$/i });
  await expect(retireBtn).toBeVisible({ timeout: 15000 });

  // Cancelling ("Keep playing") does not retire the seat.
  await retireBtn.click();
  await expect(p3.getByRole('heading', { name: /retire from this match/i })).toBeVisible();
  await p3.getByRole('button', { name: /keep playing/i }).click();
  await expect(p3.getByRole('button', { name: /^retire$/i })).toBeVisible();

  // Confirming retires the seat.
  await retireBtn.click();
  await p3.getByRole('button', { name: /^yes, retire$/i }).click();
  await p3.waitForTimeout(1500);

  // BUG-007 round H: spectator text now distinguishes why a seat left
  // (voluntary/departed/autopilot_forced/bankrupt) instead of one generic
  // sentence for every exit path.
  await expect(p3.getByText(/you retired from this match/i)).toBeVisible({ timeout: 15000 });
  // Retiring twice is refused server-side (CITY_SEAT_OUT); the control
  // shouldn't even be offered once the seat is already out.
  await expect(p3.getByRole('button', { name: /^retire$/i })).toHaveCount(0);

  // The match itself is still running for the two remaining players — proves
  // this is "one seat leaves," not "the match ended."
  await host.reload();
  await accept(host);
  await host.waitForTimeout(1000);
  await expect(host.getByText(/waiting for|your turn|roll the dice/i)).toBeVisible({ timeout: 15000 });
  await expect(host.getByRole('heading', { name: /wins$/i })).toHaveCount(0);

  await browser.close();
});
