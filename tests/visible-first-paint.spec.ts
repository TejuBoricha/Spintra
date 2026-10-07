import { test, expect, type Browser } from '@playwright/test';
import { GAMES } from '../src/lib/games';

// SEO audit S-2 (7 Oct 2026): on a throttled phone the home page and every tool page painted
// their heading about 5 s in (Largest Contentful Paint 4.8 to 5.0 s, Google's "good" line is
// 2.5 s). The server HTML carried the navbar and the page header at style="opacity:0" (a
// framer-motion `initial`), so nothing above the fold showed until the JavaScript bundle had
// loaded and run. Entrances are CSS now, so the content is visible before any of the app's
// JavaScript has run. The test blocks the app's script bundles (the page never hydrates, which
// is the state Largest Contentful Paint waits through on a slow phone) and leaves the browser
// itself normal, so CSS animations still play.

const toolPaths = [...new Set(GAMES.map((g) => g.href))].filter((href) => href.startsWith('/tools/'));
const pages = ['/', '/tools', '/explore', ...toolPaths];

/** The opacity the user actually sees: the product of the element's and every ancestor's. */
async function effectiveOpacity(browser: Browser, baseURL: string, path: string, reducedMotion: 'reduce' | 'no-preference') {
  const context = await browser.newContext({ reducedMotion });
  try {
    const page = await context.newPage();
    await page.route('**/_next/static/**/*.js', (route) => route.abort());
    await page.goto(baseURL + path, { waitUntil: 'domcontentloaded' });
    // The entrance takes 0.5 s plus up to 0.5 s of delay; reduced motion has none.
    if (reducedMotion === 'no-preference') await page.waitForTimeout(1500);
    return await page.evaluate(() => {
      const product = (el: Element | null) => {
        let o = 1;
        for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
        return o;
      };
      return { nav: product(document.querySelector('nav')), h1: product(document.querySelector('h1')) };
    });
  } finally {
    await context.close();
  }
}

test('the navbar and the page heading are fully visible before any JavaScript runs, on the home page, the tools index and every tool page', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  for (const path of pages) {
    const o = await effectiveOpacity(browser, baseURL!, path, 'no-preference');
    expect(o.nav, `${path}: the navbar is visible before hydration`).toBe(1);
    expect(o.h1, `${path}: the heading is visible before hydration`).toBe(1);
  }
});

test('with reduced motion the heading and navbar are visible at once, with no entrance at all', async ({ browser, baseURL }) => {
  for (const path of ['/', '/tools/dice']) {
    const o = await effectiveOpacity(browser, baseURL!, path, 'reduce');
    expect(o.nav, `${path}: navbar`).toBe(1);
    expect(o.h1, `${path}: heading`).toBe(1);
  }
});
