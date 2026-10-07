import { test, expect, type Browser, type Page } from '@playwright/test';
import { GAMES } from '../src/lib/games';

// SEO audit S-2 (7 Oct 2026): on a throttled phone the home page and every tool page painted
// their heading about 5 s in (Largest Contentful Paint 4.8 to 5.0 s, Google's "good" line is
// 2.5 s). The server HTML carried the navbar and the page header at style="opacity:0" (a
// framer-motion `initial`), so nothing above the fold showed until the JavaScript bundle had
// loaded and run. Entrances are CSS now, so the content is visible before any of the app's
// JavaScript has run. The test blocks the app's script bundles (the page never hydrates, which
// is the state Largest Contentful Paint waits through on a slow phone) and leaves the browser
// itself normal, so CSS animations still play.
//
// Two things are checked: the heading and navbar do become fully visible without the app's
// scripts (polled against a deadline, not a fixed sleep), and the entrance that gets them
// there is short, so a later change cannot quietly bring back a long wait.

const toolPaths = [...new Set(GAMES.map((g) => g.href))].filter((href) => href.startsWith('/tools/'));
const pages = ['/', '/tools', '/explore', ...toolPaths];

// The longest the heading's entrance (delay plus duration, on the element or any ancestor) may take.
const MAX_HEADING_ENTRANCE_S = 1.2;
const MAX_NAV_ENTRANCE_S = 1.0;

/** What the user sees: the product of the element's and every ancestor's opacity, and how long its entrance takes. */
async function sample(page: Page) {
  return page.evaluate(() => {
    const first = (v: string) => parseFloat(v.split(',')[0]) || 0;
    const look = (el: Element | null) => {
      let opacity = 1;
      let entrance = 0;
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        opacity *= Number(cs.opacity);
        entrance = Math.max(entrance, first(cs.animationDelay) + first(cs.animationDuration));
      }
      return { opacity, entrance };
    };
    return { nav: look(document.querySelector('nav')), h1: look(document.querySelector('h1')) };
  });
}

async function blockedPage(browser: Browser, baseURL: string, path: string, reducedMotion: 'reduce' | 'no-preference') {
  const context = await browser.newContext({ reducedMotion });
  const page = await context.newPage();
  await page.route('**/_next/static/**/*.js', (route) => route.abort());
  await page.goto(baseURL + path, { waitUntil: 'domcontentloaded' });
  return { page, close: () => context.close() };
}

test('the navbar and the page heading become fully visible before any JavaScript runs, quickly, on the home page, the tools index and every tool page', async ({ browser, baseURL }) => {
  test.setTimeout(150_000);
  for (const path of pages) {
    const { page, close } = await blockedPage(browser, baseURL!, path, 'no-preference');
    try {
      await expect.poll(async () => (await sample(page)).nav.opacity, { message: `${path}: the navbar is visible before hydration`, timeout: 4000 }).toBe(1);
      await expect.poll(async () => (await sample(page)).h1.opacity, { message: `${path}: the heading is visible before hydration`, timeout: 4000 }).toBe(1);
      const s = await sample(page);
      expect(s.h1.entrance, `${path}: the heading's entrance (delay plus duration) takes at most ${MAX_HEADING_ENTRANCE_S}s`).toBeLessThanOrEqual(MAX_HEADING_ENTRANCE_S);
      expect(s.nav.entrance, `${path}: the navbar's entrance takes at most ${MAX_NAV_ENTRANCE_S}s`).toBeLessThanOrEqual(MAX_NAV_ENTRANCE_S);
    } finally {
      await close();
    }
  }
});

test('with reduced motion the heading and navbar are visible at once, with no entrance at all', async ({ browser, baseURL }) => {
  for (const path of ['/', '/tools/dice']) {
    const { page, close } = await blockedPage(browser, baseURL!, path, 'reduce');
    try {
      const s = await sample(page);
      expect(s.nav.opacity, `${path}: navbar`).toBe(1);
      expect(s.h1.opacity, `${path}: heading`).toBe(1);
      expect(s.h1.entrance, `${path}: no entrance`).toBeLessThanOrEqual(0.01);
    } finally {
      await close();
    }
  }
});
