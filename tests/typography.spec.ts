import { test, expect } from '@playwright/test';
import { SITE_PAGES, NOT_FOUND_PATH } from './site-routes';
import { hideConfigBanner } from './helpers/config-banner';
import { skipInDbIntegration } from './helpers/ci-skip';

skipInDbIntegration(test);

// UX audit (7 Oct 2026), finding U-14: the body font was never applied. The design system says Plus Jakarta Sans for text and
// Archivo for headings, but `font-family: var(--font-body)` resolved to nothing (the theme is `@theme inline`, so the variable is
// never emitted, and next/font's variables were on <body>, below the element the rule was on), so 92% of the text on the site
// rendered in the visitor's system font: a Mac, an Android phone and a Windows laptop each showed a different site. The legal
// pages' title was in the system font too. The three variables are on <html> now, with a base rule for text and for headings.

// next/font names its families `__plusJakartaSans_<hash>` and so on; the variable holds that name first.
const TEXT = /plus.?jakarta/i;
const DISPLAY = /archivo/i;
const MONO = /jetbrains.?mono/i;

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height } });
    for (const path of [...SITE_PAGES, NOT_FOUND_PATH]) {
      test(`${path}: text is in Plus Jakarta Sans, headings in Archivo, and the fonts are loaded`, async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
        await page.goto(path);
        await page.waitForLoadState('load');
        await hideConfigBanner(page);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        const read = await page.evaluate(() => {
          const first = (el: Element) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
          const share: Record<string, number> = {};
          let chars = 0;
          const strangers: string[] = [];
          // The app's own content: the navbar, the page and the footer (not scripts, the SVG inside icons, or a third party's overlay).
          for (const el of Array.from(document.querySelectorAll('#main-content *, nav *, footer *'))) {
            if (el.closest('script, style, noscript, svg, option')) continue;
            const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => (n.textContent ?? '').trim()).join('');
            if (!own || el.getBoundingClientRect().width < 1) continue;
            const family = first(el);
            share[family] = (share[family] ?? 0) + own.length;
            chars += own.length;
            if (!/plus.?jakarta|archivo|jetbrains.?mono/i.test(family)) strangers.push(`${el.tagName.toLowerCase()} "${own.slice(0, 30)}" in ${family}`);
          }
          const loaded = Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family);
          return {
            body: first(document.body),
            h1s: Array.from(document.querySelectorAll('h1')).map(first),
            // A heading that says `font-body` on purpose is a small label (Create's "Choose Game Type"), not a display heading.
            headings: Array.from(document.querySelectorAll('h2, h3, h4')).filter((h) => !/\bfont-body\b/.test(h.getAttribute('class') ?? '')).map(first),
            strangers: strangers.slice(0, 5),
            textChars: chars,
            loaded,
          };
        });

        expect(read.textChars, 'measured some text').toBeGreaterThan(50);
        expect(read.body, 'body text').toMatch(TEXT);
        expect(read.h1s.length, 'the page has a title').toBeGreaterThanOrEqual(1);
        for (const family of read.h1s) expect(family, 'every h1').toMatch(DISPLAY);
        for (const family of read.headings) expect(family, 'h2 to h4').toMatch(DISPLAY);
        expect(read.strangers, 'no text in a font that is not one of the three').toEqual([]);
        expect(read.loaded.some((f) => TEXT.test(f)), `the text face is downloaded (loaded: ${read.loaded.join(', ')})`).toBe(true);
        expect(read.loaded.some((f) => DISPLAY.test(f)), 'the heading face is downloaded').toBe(true);
      });
    }
  });
}

test('the monospace face is the designed one where a page asks for it (the Join dialog\'s room code)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await hideConfigBanner(page);
  await page.getByRole('button', { name: 'Join a room', exact: true }).click();
  const box = page.getByLabel('Room code, character 1 of 6');
  await expect(box).toBeVisible();
  const family = await box.evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim());
  expect(family).toMatch(MONO);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => Array.from(document.fonts).some((f) => f.status === 'loaded' && /jetbrains/i.test(f.family))), 'downloaded').toBe(true);
});
