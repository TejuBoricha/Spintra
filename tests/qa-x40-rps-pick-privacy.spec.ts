import { test, expect, chromium, type Page } from '@playwright/test';
import { acceptCookieBanner, skipIfDemoMode, BASE } from './qa-city-helpers';

// Audits G-5 and G-6, in a real room. G-5 (PR #112): the host saw everyone's pick before
// choosing; the pick list now shows "Chosen" until the round resolves. G-6: the list decided
// "this pick is yours" by display name, and names are not unique, so two players called alike
// each saw the other's pick early (and the result could read "Sam, Sam win!"). It is decided
// by user id now, and players who share a name are told apart by a short id.
// Neither was covered by a test before. The same flow runs with different names and with the
// same name.

const rows = (p: Page) => p.getByTestId('rps-pick-row');

async function rename(p: Page, name: string) {
  await p.getByRole('button', { name: /^people \(\d+\)$/i }).click();
  await p.getByRole('button', { name: /^edit username$/i }).first().click();
  await p.getByRole('textbox', { name: /^edit username$/i }).fill(name);
  await p.getByRole('button', { name: /^save username$/i }).click();
  await expect(p.getByText(new RegExp(`\\(${name}\\)`))).toBeVisible({ timeout: 15000 });
}

for (const sameName of [false, true]) {
  test(`picks stay hidden until the round resolves, then everyone sees them (${sameName ? 'two players with the same name' : 'different names'})`, async ({ page }) => {
    test.setTimeout(180_000);
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

      if (sameName) {
        await rename(page, 'Sam');
        await rename(guest, 'Sam');
      }

      await page.getByRole('button', { name: /switch game activity/i }).click({ timeout: 30000 });
      await page.getByRole('button', { name: /^select rock paper scissors$/i }).click();
      await expect(guest.getByRole('heading', { name: /rock paper scissors/i })).toBeVisible({ timeout: 15000 });

      // The host picks Rock. The host sees their own pick; the guest sees only that someone
      // has chosen, even when that someone has the guest's own name.
      await page.getByRole('button', { name: /rock/i }).click();
      await expect(rows(page)).toHaveCount(1, { timeout: 15000 });
      await expect(rows(page).first()).toContainText('Rock');
      await expect(rows(guest)).toHaveCount(1, { timeout: 15000 });
      await expect(rows(guest).first()).toContainText('Chosen');
      await expect(rows(guest).first()).not.toContainText('Rock');

      // The guest picks Paper: the round resolves and each of them sees both picks, the host's
      // included for the non-host.
      await guest.getByRole('button', { name: /paper/i }).click();
      for (const p of [page, guest]) {
        await expect(rows(p)).toHaveCount(2, { timeout: 15000 });
        await expect(p.getByText('Paper beats Rock')).toBeVisible({ timeout: 15000 });
        await expect(rows(p).filter({ hasText: 'Rock' })).toHaveCount(1);
        await expect(rows(p).filter({ hasText: 'Paper' })).toHaveCount(1);
        await expect(rows(p).filter({ hasText: 'Chosen' })).toHaveCount(0);
      }

      if (sameName) {
        // Two players called Sam are told apart by a short id, in the list and in the result.
        for (const p of [page, guest]) {
          await expect(rows(p).filter({ hasText: /Sam \([0-9a-f]{4}\)/ })).toHaveCount(2);
          await expect(p.getByRole('status').filter({ hasText: /Sam \([0-9a-f]{4}\) wins!/ })).toBeVisible();
        }
      }
    } finally {
      await browser.close();
    }
  });
}
