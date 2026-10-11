import { test, expect } from '@playwright/test';
import { SITE_PAGES, NOT_FOUND_PATH } from './site-routes';
import { contrastProblems, describe, newContrastDecoder, settleAndScrollThrough } from './helpers/pixel-contrast';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), finding U-04: more than 50 text elements failed WCAG AA contrast, most of them the results
// and the main buttons of the tools (white on amber 2.0 : 1, mint on mint 1.0 : 1, a coin badge 1.03 : 1). The
// measurement is from pixels (tests/helpers/pixel-contrast.ts): what is really behind each piece of text, however it
// was coloured. Every page in both themes at a desktop width, the phone width for the pages most people land on, and
// (tests/ux-contrast-states.spec.ts) the states a tool is really read in: a result, a winner, a filled list.

const PAGES = [...SITE_PAGES, NOT_FOUND_PATH];
const PHONE_PAGES = ['/', '/tools', '/tools/coin-flip', '/for-teachers'];

for (const theme of ['dark', 'light'] as const) {
  for (const [label, viewport, paths] of [
    ['desktop', { width: 1280, height: 800 }, PAGES],
    ['phone', { width: 390, height: 844 }, PHONE_PAGES],
  ] as const) {
    test.describe(`${theme} theme, ${label}`, () => {
      test.use({ viewport, reducedMotion: 'reduce', colorScheme: theme });

      for (const path of paths) {
        test(`${path}: every piece of text passes AA contrast`, async ({ page }) => {
          test.setTimeout(120_000);
          await page.addInitScript((t) => {
            localStorage.setItem('spintra-theme', t);
            localStorage.setItem('spintra-cookie-consent', 'denied');
          }, theme);
          const decoder = await newContrastDecoder(page);
          await page.goto(path);
          await hideConfigBanner(page); // CI's Supabase-less build shows a red bar across the top; visitors never do
          await settleAndScrollThrough(page);
          const { checked, unmeasured, problems } = await contrastProblems(page, decoder);
          await decoder.close();
          expect(checked, `the page has text to check (not measured: ${unmeasured.slice(0, 6).join('; ')})`).toBeGreaterThan(5);
          expect(unmeasured.length, `most text could be measured (not measured: ${unmeasured.slice(0, 8).join('; ')})`).toBeLessThanOrEqual(Math.max(8, Math.ceil((checked + unmeasured.length) * 0.15)));
        expect(describe(problems), 'text under WCAG AA contrast').toEqual([]);
        });
      }
    });
  }
}
