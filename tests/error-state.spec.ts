import { test, expect } from '@playwright/test';
import { NOT_FOUND_PATH } from './site-routes';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), finding U-18: the 404, a room that is gone and a route that threw were three separate looks
// (a bare "404" in the system font with one button; a card with a different radius; a hand-built link style), and the
// 404 had the home page's title, which is what a search result or a tab lists. They are one ErrorState now. Demo mode can
// produce the 404 and one of the room's cards (a visitor on the room's ban list); the other cards (not found, locked, full,
// could not connect) and the route error need a failing room lookup or a thrown render, which only a real Supabase gives.

test('the 404 has its own title, a heading in the display font, and two ways forward', async ({ page }) => {
  const response = await page.goto(NOT_FOUND_PATH);
  expect(response?.status()).toBe(404);
  await hideConfigBanner(page);

  await expect(page).toHaveTitle('Page not found | Spintra');
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);

  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText('Page not found');
  expect(await heading.evaluate((el) => getComputedStyle(el).fontFamily), 'the display font, not the system one').toMatch(/archivo/i);
  await page.waitForTimeout(500); // the heading's effect, if it took focus, has run by now
  expect(await page.evaluate(() => document.activeElement === document.body), 'focus stays at the top of the document, as on every page load').toBe(true);

  const tools = page.getByRole('link', { name: 'Browse tools', exact: true });
  const home = page.getByRole('link', { name: 'Go home', exact: true });
  await expect(tools).toHaveAttribute('href', '/tools');
  await expect(home).toHaveAttribute('href', '/');
  await tools.click();
  await expect(page).toHaveURL(/\/tools$/);
});

test('a banned visitor gets the same card with the heading focused and two ways out', async ({ page }) => {
  // demo mode keeps its ban list in localStorage, keyed by room code
  await page.addInitScript(() => {
    localStorage.setItem('spintra-cookie-consent', 'denied');
    localStorage.setItem('spintra-room-user', JSON.stringify({ id: 'banned-1', username: 'Tester', xp: 0, rank: 'rookie', avatar_url: '', created_at: '2026-01-01T00:00:00.000Z' }));
    localStorage.setItem('spintra-room-bans-ABCD23', JSON.stringify(['banned-1']));
  });
  await page.goto('/room/ABCD23');
  await hideConfigBanner(page);

  const heading = page.getByRole('heading', { level: 1, name: "You've Been Removed" });
  await expect(heading).toBeVisible();
  await expect(heading, 'the card replaced a page, so the heading takes focus').toBeFocused();
  expect(await heading.evaluate((el) => getComputedStyle(el).fontFamily), 'the display font').toMatch(/archivo/i);

  const explore = page.getByRole('link', { name: 'Back to Explore', exact: true });
  await expect(explore).toHaveAttribute('href', '/explore');
  await expect(page.getByRole('link', { name: 'Browse tools', exact: true })).toHaveAttribute('href', '/tools');

  await explore.click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect.poll(() => page.title(), { message: 'the Explore page has its own title' }).toMatch(/^Explore/);
});
