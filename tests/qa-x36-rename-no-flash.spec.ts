import { test, expect } from '@playwright/test';
import { acceptCookieBanner, skipIfDemoMode, BASE } from './qa-city-helpers';

// Audit R-10: renaming yourself in a room briefly flashed "Realtime connection lost" /
// "Realtime subscription failed", because the room's realtime effect depended on the
// username, so a rename tore the channels down and the teardown's own "closed" status was
// shown as a failure. Teardown is no longer taken for a drop (audit L-1, PR #62). This test
// watches the page for any such text while a player renames themselves.

test('renaming yourself does not flash a connection-lost notice', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE}/create?type=trivia`);
  await acceptCookieBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  await skipIfDemoMode(page);
  await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 30000 });

  // Record every moment the page shows a failure notice, however briefly.
  await page.evaluate(() => {
    const w = window as unknown as { __flash: string[] };
    w.__flash = [];
    const re = /realtime (connection lost|subscription failed)|trying to reconnect/i;
    new MutationObserver(() => {
      const m = document.body.innerText.match(re);
      if (m) w.__flash.push(m[0]);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });

  await page.getByRole('button', { name: /^people \(\d+\)$/i }).click();
  await page.getByRole('button', { name: /^edit username$/i }).first().click();
  await page.getByRole('textbox', { name: /^edit username$/i }).fill('Renamer');
  await page.getByRole('button', { name: /^save username$/i }).click();
  await expect(page.getByText(/\(Renamer\)/)).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(6000);

  const flashes = await page.evaluate(() => (window as unknown as { __flash: string[] }).__flash);
  expect(flashes, `failure notices shown during the rename: ${flashes.join(', ')}`).toEqual([]);
  await expect(page.getByText('Live', { exact: true })).toBeVisible();
});
