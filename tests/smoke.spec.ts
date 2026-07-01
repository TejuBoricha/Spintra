import { test, expect } from '@playwright/test';

test('create and join room shows host for creator', async ({ page }) => {
  await page.goto('/create', { waitUntil: 'networkidle' });

  // Wait for the client to hydrate and the create button to appear
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');

  // Wait for created badge
  await page.waitForSelector('[data-testid="created-room-badge"]', { timeout: 5000 });

  // Click Join Room
  await page.click('[data-testid="join-room-button"]');

  // Verify URL and host UI
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]+/);
  await expect(page.locator('text=You are the host')).toBeVisible();
});
