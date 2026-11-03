import { test, expect } from '@playwright/test';
import { SITE_PAGES, NOT_FOUND_PATH } from './site-routes';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), finding U-12: only the home page had a footer, so Terms, Privacy and the copyright could be reached from
// the home page, the cookie notice and Settings and nowhere else. A visitor who landed on a tool page from search had no way to the
// legal pages, or back to the hub, except the navbar. Every page now has exactly one footer landmark with working links to both
// legal pages (a room is an app screen, not a page, and has none).

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height } });
    for (const path of [...SITE_PAGES, NOT_FOUND_PATH]) {
      test(`${path}: one footer, with Terms and Privacy`, async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
        await page.goto(path);
        await hideConfigBanner(page);
        const footer = page.locator('footer');
        await expect(footer, 'exactly one footer').toHaveCount(1);
        // outside <main>, so it is the page's footer landmark (the home page's own footer sits inside its <main>, as before)
        if (path !== '/') await expect(page.getByRole('contentinfo')).toHaveCount(1);
        await expect(footer.getByRole('link', { name: 'Terms', exact: true })).toHaveAttribute('href', '/legal/terms');
        await expect(footer.getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute('href', '/legal/privacy');
        await expect(footer).toContainText(`© ${new Date().getFullYear()} Spintra`);
      });
    }
  });
}

test('a footer link works from a tool page', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.goto('/tools/coin-flip');
  await hideConfigBanner(page);
  await page.locator('footer').getByRole('link', { name: 'Terms', exact: true }).click();
  await expect(page).toHaveURL(/\/legal\/terms$/);
});
