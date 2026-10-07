import { test, expect, type Page } from '@playwright/test';
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
// Per page and per screen size (so a failure names the page), it checks that the navbar and the
// heading exist and become fully visible (polled against a deadline, not a fixed sleep), that the
// entrance that gets them there is short (a later change cannot quietly bring back a long wait),
// and that no block of text above the fold is still hidden.

const toolPaths = [...new Set(GAMES.map((g) => g.href))].filter((href) => href.startsWith('/tools/'));
const pages = ['/', '/tools', '/explore', ...toolPaths];
const screens = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

// The longest the heading's entrance (delay plus duration, on the element or any ancestor) may take.
const MAX_HEADING_ENTRANCE_S = 1.2;
const MAX_NAV_ENTRANCE_S = 1.0;

/** What the user sees: opacity (the product over the element and its ancestors), entrance length, and any hidden text above the fold. */
async function sample(page: Page) {
  return page.evaluate(() => {
    const first = (v: string) => parseFloat(v.split(',')[0]) || 0;
    const look = (el: Element | null) => {
      if (!el) return null;
      let opacity = 1;
      let entrance = 0;
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        opacity *= Number(cs.opacity);
        entrance = Math.max(entrance, first(cs.animationDelay) + first(cs.animationDuration));
      }
      return { opacity, entrance };
    };
    // Text of 20 or more characters inside the first screen whose effective opacity is 0.
    const hiddenText: string[] = [];
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim();
      if (own.length < 20) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom <= 0 || r.top >= window.innerHeight) continue;
      if ((look(el)?.opacity ?? 1) === 0) hiddenText.push(`${el.tagName.toLowerCase()} "${own.slice(0, 40)}"`);
    }
    return { nav: look(document.querySelector('nav')), h1: look(document.querySelector('h1')), hiddenText };
  });
}

async function blockedPage(page: Page, path: string) {
  await page.route('**/_next/static/**/*.js', (route) => route.abort());
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

for (const screen of screens) {
  test.describe(`before any JavaScript runs, on a ${screen.name}`, () => {
    test.use({ viewport: { width: screen.width, height: screen.height }, reducedMotion: 'no-preference' });

    for (const path of pages) {
      test(`${path}: the navbar and the heading are there, fully visible, quickly, and nothing above the fold is hidden`, async ({ page }) => {
        await blockedPage(page, path);
        await expect.poll(async () => (await sample(page)).nav?.opacity, { message: 'the navbar exists and is visible', timeout: 4000 }).toBe(1);
        await expect.poll(async () => (await sample(page)).h1?.opacity, { message: 'the heading exists and is visible', timeout: 4000 }).toBe(1);
        const s = await sample(page);
        expect(s.h1?.entrance, `the heading's entrance (delay plus duration) takes at most ${MAX_HEADING_ENTRANCE_S}s`).toBeLessThanOrEqual(MAX_HEADING_ENTRANCE_S);
        expect(s.nav?.entrance, `the navbar's entrance takes at most ${MAX_NAV_ENTRANCE_S}s`).toBeLessThanOrEqual(MAX_NAV_ENTRANCE_S);
        // Entrances are over by now (the poll above waited for them), so anything still at opacity 0 is hidden for good.
        await expect.poll(async () => (await sample(page)).hiddenText, { message: 'no text above the fold is left hidden', timeout: 4000 }).toEqual([]);
      });
    }
  });
}

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const path of ['/', '/tools/dice']) {
    test(`${path}: the heading and navbar are visible at once, with no entrance at all`, async ({ page }) => {
      await blockedPage(page, path);
      const s = await sample(page);
      expect(s.nav?.opacity, 'navbar').toBe(1);
      expect(s.h1?.opacity, 'heading').toBe(1);
      expect(s.h1?.entrance, 'no entrance').toBeLessThanOrEqual(0.01);
    });
  }
});
