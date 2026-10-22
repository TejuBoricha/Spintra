import { test, expect } from '@playwright/test';
import { SITE_PAGES, NOT_FOUND_PATH } from './site-routes';
import { hideConfigBanner } from './helpers/config-banner';
import { contrastProblems } from './helpers/pixel-contrast';

// UX audit (7 Oct 2026), finding U-04: text that does not meet WCAG 1.4.3 (4.5 : 1, or 3 : 1 for large text), judged from the
// pixels because axe cannot read text on gradients and translucent layers (ux-axe.spec.ts has its colour-contrast rule off for
// that reason). Every page, both themes, a phone and a desktop. How it measures is in helpers/pixel-contrast.ts.

const PAGES = [...SITE_PAGES, NOT_FOUND_PATH];

for (const [theme, width, height] of [['dark', 1280, 800], ['light', 1280, 800], ['dark', 390, 844], ['light', 390, 844]] as const) {
  test.describe(`${theme} theme, ${width}px wide`, () => {
    test.use({ viewport: { width, height }, colorScheme: theme, reducedMotion: 'reduce' });
    for (const path of PAGES) {
      test(`${path}: all text has enough contrast`, async ({ page }) => {
        await page.addInitScript(([t]) => {
          localStorage.setItem('spintra-theme', t);
          localStorage.setItem('spintra-cookie-consent', 'denied'); // the notice would sit over the page's last lines
        }, [theme]);
        await page.goto(path);
        await page.waitForLoadState('load');
        await hideConfigBanner(page);
        await page.waitForTimeout(400); // hydration, so client-rendered text exists
        expect(await contrastProblems(page)).toEqual([]);
      });
    }
  });
}
