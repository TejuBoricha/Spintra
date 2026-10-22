import { test, expect } from '@playwright/test';
import { NOT_FOUND_PATH } from './site-routes';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), finding U-18: the 404, a room that is gone and a route that threw were three separate looks
// (a bare "404" in the system font with one button; a card with a different radius; a hand-built link style), and the
// 404 had the home page's title, which is what a search result or a tab lists. They are one ErrorState now. The room
// cards and the route error need a failing room lookup or a thrown render, which no page of the demo-mode site can
// produce, so what is tested here is the 404, which is the same component with the same two actions.

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
