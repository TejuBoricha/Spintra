import { test, expect, chromium } from '@playwright/test';
import { acceptCookieBanner, skipIfDemoMode, BASE } from './qa-city-helpers';

// Audit R-9: a room link typed or pasted in lowercase (easy on a phone) said "Room Not
// Found", because the code was looked up as typed and room codes are uppercase. The room
// page now sends a lowercase or padded code to the real address.

test('a room link in lowercase opens the room at its real address', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE}/create?type=trivia`);
  await acceptCookieBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  await skipIfDemoMode(page);
  const code = page.url().split('/room/')[1].split(/[?#]/)[0];
  expect(code).toBe(code.toUpperCase());

  const browser = await chromium.launch();
  const guest = await (await browser.newContext()).newPage();
  try {
    await guest.goto(`${BASE}/room/${code.toLowerCase()}`);
    await acceptCookieBanner(guest);
    // Sent to the real address...
    await expect(guest).toHaveURL(new RegExp(`/room/${code}$`), { timeout: 30000 });
    // ...and the room opens: the guest is in it and the host sees them.
    await expect(guest.getByText('Live', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });
    await expect(guest.getByRole('heading', { name: /room not found/i })).toHaveCount(0);
  } finally {
    await browser.close();
  }
});
