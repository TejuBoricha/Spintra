import { test, expect, type Page } from '@playwright/test';
import { SITE_PAGES, NOT_FOUND_PATH } from './site-routes';

// UX audit (7 Oct 2026): on a phone the live home page was 421px wide in a 390px window. The
// footer's single row of seven items was 449px wide and centred, so it ran off both edges: the
// first link, "Explore", sat 30px beyond the left edge where it cannot be scrolled to, and the
// page scrolled sideways. Never Have I Ever's three buttons (396px in a 358px column) were cut off
// the left edge the same way, and the Teachers page's "Start a Classroom Room" button was wider
// than a 320px phone. Sideways overflow also shifts position:fixed layers on a real phone (the
// cookie banner's Accept and Decline ended up beyond the screen edge).
//
// For every page at three phone and tablet widths: the page does not scroll sideways, no text or
// control sticks out past the left or right edge of the screen (even when a parent clips it, which
// would hide the problem from the page-width check), and no control is wider than the block it sits
// in (a button 45px wider than its card's content box hugged the card's right edge on a 320px phone,
// with room to spare on the left, and the page-width check could not see it). Fixed layers such as
// the navbar and the cookie notice are measured too. Boxes that scroll on purpose (overflow auto or
// scroll, such as a wide table) are left alone.
//
// Invisible things are skipped, so the page must be at rest first (see `settle`): the review of the
// first version (9 Oct 2026) found that it never scrolled, so the home page's perks, tool grid and final
// call to action, which appear when they scroll into view, stayed invisible and were never measured.

const WIDTHS = [320, 390, 768];

/** Problems with anything wider than the screen or its box, as readable strings (empty when fine). */
async function overflowProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    const docWidth = document.documentElement.scrollWidth;
    if (docWidth > vw + 1) out.push(`the page is ${docWidth}px wide in a ${vw}px window`);
    const label = (el: Element) => {
      const text = ((el as HTMLElement).innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 28);
      return `${el.tagName.toLowerCase()}${text ? ` "${text}"` : ''}`;
    };
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const hasOwnText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
      const isControl = /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
      if (!hasOwnText && !isControl) continue;
      // Screen-reader-only text, and anything that cannot be seen, is not a visual problem.
      if (/(^|\s)sr-only(\s|$)/.test(el.getAttribute('class') ?? '')) continue;
      let hidden = false;
      let scrollsOnPurpose = false;
      for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
        const o = getComputedStyle(n);
        if (Number(o.opacity) < 0.05) hidden = true;
        if (n !== el && /(auto|scroll)/.test(o.overflowX)) scrollsOnPurpose = true;
      }
      if (hidden || scrollsOnPurpose) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right > vw + 1 || r.left < -1) out.push(`${label(el)} spans ${Math.round(r.left)} to ${Math.round(r.right)}px in a ${vw}px window`);
      // A control wider than the content box of the block it sits in spills into that block's padding
      // (or past it), and centred text no longer centres it. Flex and grid parents size to their children.
      if (isControl && el.parentElement) {
        const p = el.parentElement;
        const ps = getComputedStyle(p);
        if (/^(block|flow-root|list-item)$/.test(ps.display)) {
          const room =
            p.getBoundingClientRect().width -
            parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight) -
            parseFloat(ps.borderLeftWidth) - parseFloat(ps.borderRightWidth);
          if (r.width > room + 2) out.push(`${label(el)} is ${Math.round(r.width)}px wide in a ${Math.round(room)}px box`);
        }
      }
    }
    return out.slice(0, 6);
  });
}

/**
 * Brings the page to rest before it is measured: scrolls through it once (items that appear when they
 * scroll into view are invisible until then, and invisible things are skipped), waits for every finite
 * time-driven animation to end, then waits until the number of invisible elements has stopped changing
 * for 600ms (the entrances that JavaScript drives, which the animation list does not show). Looping
 * animations and animations tied to scrolling (the home hero's fade-on-scroll is a ViewTimeline that only
 * moves when the page does) are not waited for.
 */
async function settle(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight / 2));
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every((a) => !a.effect || a.timeline !== document.timeline || a.playState !== 'running' || a.effect.getComputedTiming().iterations === Infinity),
    undefined,
    { timeout: 5000 },
  );
  let hidden = -1;
  let since = Date.now();
  await expect
    .poll(
      async () => {
        const n = await page.evaluate(() => Array.from(document.body.querySelectorAll('*')).filter((el) => Number(getComputedStyle(el).opacity) < 0.05).length);
        if (n !== hidden) {
          hidden = n;
          since = Date.now();
        }
        return Date.now() - since >= 600;
      },
      { message: 'the page stopped changing', timeout: 8000, intervals: [100] },
    )
    .toBe(true);
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px wide`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of [...SITE_PAGES, NOT_FOUND_PATH]) {
      test(`${path}: nothing makes the page scroll sideways or sticks out of the screen`, async ({ page }) => {
        await page.goto(path);
        // Each test starts without a stored choice, so the cookie notice mounts after hydration; measure it too.
        await expect(page.getByRole('region', { name: 'Cookie notice' })).toBeVisible();
        await settle(page);
        await expect.poll(() => overflowProblems(page), { message: 'nothing is wider than the screen or its box', timeout: 5000 }).toEqual([]);
      });
    }
  });
}

// Never Have I Ever's two answer buttons are one pair: at 320px they wrapped onto two rows ("I Have" alone,
// then "Never Have" next to the sound button), at 360 to 390px the sound button sits centred under the pair.
test.describe('Never Have I Ever: the two answer buttons share a row on a phone', () => {
  for (const width of [320, 360, 390]) {
    test(`at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/tools/never-have-i-ever');
      const have = page.getByRole('button', { name: 'I Have', exact: true });
      const never = page.getByRole('button', { name: 'Never Have', exact: true });
      await expect(have).toBeVisible();
      await expect(never).toBeVisible();
      const [a, b] = await Promise.all([have.boundingBox(), never.boundingBox()]);
      expect(Math.abs(a!.y - b!.y), '"I Have" and "Never Have" are on the same row').toBeLessThan(2);
    });
  }
});
