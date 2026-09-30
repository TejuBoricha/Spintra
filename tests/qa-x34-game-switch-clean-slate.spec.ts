import { test, expect, chromium } from '@playwright/test';
import { acceptCookieBanner, skipIfDemoMode, BASE } from './qa-city-helpers';

// Audit G-2: switching to another game and back showed non-host players the
// previous round (a stale trivia question), because only the host cleared the event
// log on a game switch, and the stale round was written back and came back after a
// refresh. Every client now starts a game switch from an empty log, and the server
// keeps one log per game (wave 1). The game switcher only exists in Party and Classroom
// rooms. This test pins it: play a trivia question, switch
// to Coin Flip and back, and a non-host must be looking at a fresh trivia, not the old
// question, including after a refresh.

test('switching to another game and back does not bring the old round back for a non-host', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${BASE}/create?type=party`);
  await acceptCookieBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  await skipIfDemoMode(page);
  const code = page.url().split('/room/')[1].split(/[?#]/)[0];

  const browser = await chromium.launch();
  const guest = await (await browser.newContext()).newPage();
  try {
    await guest.goto(`${BASE}/room/${code}`);
    await acceptCookieBanner(guest);
    await expect(guest.getByText('Live', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });

    // The host picks Trivia (a Party room starts with no game), then plays round one, seen by both.
    await page.getByRole('button', { name: /switch game activity/i }).click({ timeout: 30000 });
    await page.getByRole('button', { name: /^select trivia$/i }).click();
    await page.getByRole('button', { name: /start trivia/i }).click({ timeout: 30000 });
    await expect(page.getByText(/^Question 1$/)).toBeVisible({ timeout: 15000 });
    await expect(guest.getByText(/^Question 1$/)).toBeVisible({ timeout: 15000 });

    // Host switches to Coin Flip, then back to Trivia.
    await page.getByRole('button', { name: /switch game activity/i }).click();
    await page.getByRole('button', { name: /^select coin flip$/i }).click();
    await expect(guest.getByRole('heading', { name: /coin flip/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(guest.getByText(/^Question 1$/)).toHaveCount(0);

    await page.getByRole('button', { name: /switch game activity/i }).click();
    await page.getByRole('button', { name: /^select trivia$/i }).click();

    // The host is back at a fresh trivia (Start Trivia offered), and the guest is not
    // looking at the old question.
    await expect(page.getByRole('button', { name: /start trivia/i })).toBeVisible({ timeout: 15000 });
    await expect(guest.getByRole('heading', { name: /^trivia$/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(guest.getByText(/^Question 1$/)).toHaveCount(0);

    // And it stays that way after the guest refreshes (nothing stale is written back).
    await guest.reload();
    await expect(guest.getByRole('heading', { name: /^trivia$/i }).first()).toBeVisible({ timeout: 30000 });
    await guest.waitForTimeout(2000);
    await expect(guest.getByText(/^Question 1$/)).toHaveCount(0);
  } finally {
    await browser.close();
  }
});
