import { test, expect } from '@playwright/test';
import { SITE_PAGES } from './site-routes';
import { GAMES } from '../src/lib/games';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), findings U-13 and U-21. Each of the 14 tool pages wrote its own header: the title was white on one,
// lime on another and capitals on a third, at two sizes, in the system font on 13 of them, with the first element 8 px or 44 px
// under the banner, and every page reserved a full screen, so the written section under a 500 px tool started 120 to 470 px
// further down than it had to. And across the site the title started 16 to 233 px under the navbar, depending on the page.
// ToolHeader is the one header, `page-top` is the one top padding.

const TOOLS = [...new Set(GAMES.map((g) => g.href))].filter((href) => href.startsWith('/tools/'));

async function open(page: import('@playwright/test').Page, path: string) {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.goto(path);
  await page.waitForLoadState('load');
  await hideConfigBanner(page);
  await page.waitForTimeout(500); // the header's entrance, and hydration
}

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height }, reducedMotion: 'reduce' });

    test('every tool page opens with the same header: chip, title in the display font, subtitle, at the same place', async ({ page }) => {
      test.setTimeout(120_000);
      const seen: Record<string, { chipTop: number; h1Top: number; size: string; transform: string; font: string; subtitle: boolean }> = {};
      for (const path of TOOLS) {
        await open(page, path);
        seen[path] = await page.evaluate(() => {
          const header = document.querySelector('[data-tool-header]') as HTMLElement;
          const h1 = header.querySelector('h1') as HTMLElement;
          const chip = header.firstElementChild as HTMLElement;
          const cs = getComputedStyle(h1);
          return {
            chipTop: Math.round(chip.getBoundingClientRect().top + scrollY),
            h1Top: Math.round(h1.getBoundingClientRect().top + scrollY),
            size: cs.fontSize,
            transform: cs.textTransform,
            font: cs.fontFamily,
            subtitle: !!header.querySelector('p'),
          };
        });
      }
      const first = Object.values(seen)[0];
      for (const [path, m] of Object.entries(seen)) {
        expect(m.font, `${path}: the title is in the display font`).toMatch(/archivo/i);
        expect(m.transform, `${path}: the title is not in capitals`).toBe('none');
        expect(m.size, `${path}: the title has the common size`).toBe(first.size);
        expect(m.subtitle, `${path}: there is a subtitle`).toBe(true);
        // phones wrap a long title onto two lines, which moves the title and nothing before it: the chip is the fixed point
        expect(Math.abs(m.chipTop - first.chipTop), `${path}: the header starts at ${m.chipTop}, the first page's at ${first.chipTop}`).toBeLessThanOrEqual(2);
      }
    });

    test('no tool page reserves a screen: the written section starts right under the tool', async ({ page }) => {
      test.setTimeout(120_000);
      const gaps: Record<string, number> = {};
      for (const path of TOOLS) {
        await open(page, path);
        gaps[path] = await page.evaluate(() => {
          const root = (document.querySelector('[data-tool-header]') as HTMLElement).closest('.page-top') as HTMLElement;
          const about = document.querySelector('section[aria-label="About this tool"]') as HTMLElement;
          // the lowest thing a person sees in the tool: not a decorative glow or a fixed background
          let lowest = 0;
          for (const el of root.querySelectorAll<HTMLElement>('*')) {
            const cs = getComputedStyle(el);
            if (cs.position === 'fixed' || (cs.position === 'absolute' && cs.pointerEvents === 'none')) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            lowest = Math.max(lowest, r.bottom + scrollY);
          }
          return Math.round(about.getBoundingClientRect().top + scrollY - lowest);
        });
      }
      // the page's own bottom padding (4rem) and nothing more
      const tooFar = Object.entries(gaps).filter(([, gap]) => gap > 100);
      expect(tooFar, `empty space between the tool and the written section, in px: ${JSON.stringify(gaps)}`).toEqual([]);
    });
  });
}

test.describe('one page top', () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  test('the first thing on every page starts 2rem under what is above it', async ({ page }) => {
    test.setTimeout(120_000);
    const offsets: Record<string, number> = {};
    for (const path of SITE_PAGES.filter((p) => p !== '/')) {
      await open(page, path);
      offsets[path] = await page.evaluate(() => {
        const root = document.querySelector('main .page-top') as HTMLElement | null;
        if (!root) return -1;
        // where its parent's content begins: the navbar's clearance under <main>, or the bottom of the tools banner above it
        const parent = root.parentElement as HTMLElement;
        const floor = parent.getBoundingClientRect().top + scrollY + parseFloat(getComputedStyle(parent).paddingTop);
        const start = root.getBoundingClientRect().top + scrollY + parseFloat(getComputedStyle(root).paddingTop);
        return Math.round(start - floor);
      });
    }
    expect(offsets, 'px between the navbar clearance (or the tools banner) and the page content: 32 on every page').toEqual(Object.fromEntries(Object.keys(offsets).map((k) => [k, 32])));
  });
});
