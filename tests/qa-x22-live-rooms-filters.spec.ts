import { test, expect } from '@playwright/test';
import { acceptCookieBanner } from './qa-city-helpers';

// Product decision 2026-09-29: the Live Rooms filter "Popular" (1+ online) is
// gone, since the page only lists rooms with someone online and it showed the
// same rooms as "All", and "Trending" (2+ online) says what it means.

test('Live Rooms: the filters are All / 2+ players / New / ..., with no Popular or Trending', async ({ page }) => {
  await page.goto('/explore');
  await acceptCookieBanner(page);

  await expect(page.getByRole('heading', { name: /^live rooms$/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('2+ players', { exact: true })).toBeVisible();
  await expect(page.getByText('All', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Popular', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Trending', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/live trending rooms/i)).toHaveCount(0);
});
