import { test, expect } from '@playwright/test';
import { SITE_PAGES, NOT_FOUND_PATH } from './site-routes';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), finding U-26: a heading or a paragraph that ends on a single word of its own ("Pick a game and
// / play.") reads as a mistake. On `main` that happened to 76 headings, paragraphs and list items across the 24 pages at
// a phone's width and a desktop's, and the site had no wrapping rule. globals.css now balances headings and prettifies
// paragraphs (text-wrap), and the two card captions that still orphaned say text-balance.
//
// No database is involved, so `db-integration` (the job with a real Supabase, NEXT_PUBLIC_SUPABASE_URL) leaves this to `validate`, as it
// does the pixel-contrast specs; the timings behind that are in .github/workflows/ci.yml. Locally it always runs.
test.skip(!!process.env.CI && !!process.env.NEXT_PUBLIC_SUPABASE_URL, 'run by the validate job, see .github/workflows/ci.yml');

test('headings are balanced and paragraphs are prettified', async ({ page }) => {
  await page.goto('/legal/terms');
  await page.waitForLoadState('load');
  const wrap = await page.evaluate(() => {
    const of = (selector: string) => getComputedStyle(document.querySelector(selector) as Element).getPropertyValue('text-wrap');
    return { h1: of('h1'), h2: of('h2'), p: of('p') };
  });
  expect(wrap).toEqual({ h1: 'balance', h2: 'balance', p: 'pretty' });
});

for (const width of [390, 1280]) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    test('no heading, paragraph or list item ends on a word of its own', async ({ page }) => {
      test.setTimeout(120_000);
      await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
      const orphans: Record<string, string[]> = {};
      let examined = 0; // the lines of text the scan really measured: a slow load must not make it check nothing
      for (const path of [...SITE_PAGES, NOT_FOUND_PATH]) {
        await page.goto(path);
        await page.waitForLoadState('load');
        await hideConfigBanner(page);
        await page.waitForTimeout(400); // hydration, so client-rendered text exists
        const { found, seen } = await page.evaluate(() => {
          const out: string[] = [];
          let seen = 0;
          for (const el of document.querySelectorAll('p, h1, h2, h3, li')) {
            const text = (el.textContent || '').trim();
            // A leaf of the text: not one that holds another block, and long enough to wrap in the first place.
            if (text.length < 25 || el.querySelector('p, h1, h2, h3, li, div')) continue;
            const style = getComputedStyle(el);
            const box = el.getBoundingClientRect();
            if (style.display === 'none' || style.visibility === 'hidden' || box.width < 1 || box.height < 1) continue;
            // Every word's last line box (a word that wraps mid-way has two), found by range.
            const words: { top: number }[] = [];
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              const re = /\S+/g;
              for (let m = re.exec(node.textContent || ''); m; m = re.exec(node.textContent || '')) {
                const range = document.createRange();
                range.setStart(node, m.index);
                range.setEnd(node, m.index + m[0].length);
                const rects = range.getClientRects();
                if (rects.length) words.push({ top: Math.round(rects[rects.length - 1].top) });
              }
            }
            seen++;
            if (words.length < 3 || new Set(words.map((w) => w.top)).size < 2) continue;
            const last = words[words.length - 1].top;
            // Words within 3px of the last one share its line (an icon or a smaller inline element shifts a baseline).
            if (words.filter((w) => Math.abs(w.top - last) <= 3).length === 1) out.push(text.slice(-50));
          }
          return { found: out, seen };
        });
        examined += seen;
        if (found.length) orphans[path] = found;
      }
      expect(orphans).toEqual({});
      expect(examined, 'the scan measured text on the pages').toBeGreaterThan(150);
    });
  });
}
