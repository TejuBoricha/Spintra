import { test, expect } from '@playwright/test';

test('create and join room shows host for creator', async ({ page }) => {
  // Surface browser-side console/errors in the CI log — Playwright doesn't
  // forward these by default, and the last CI failure turned out to be a
  // genuine caught-by-error.tsx runtime exception with no visible detail.
  page.on('console', (msg) => console.log(`[browser:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message));

  await page.goto('/create', { waitUntil: 'networkidle' });

  // Wait for the client to hydrate and the create button to appear
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');

  // Verify URL and host UI. The default room type is Team Maker, and only
  // the host sees the "set up teams" prompt (participants see "Waiting for
  // host..." instead) -- so this doubles as a host-detection check.
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
  await expect(page.getByText('Choose how many teams to create')).toBeVisible();
});
