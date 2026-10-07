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
// For every page at three phone and tablet widths: the page does not scroll sideways, and no text
// or control sticks out past the left or right edge of the screen (even when a parent clips it,
// which would hide the problem from the page-width check), fixed layers such as the navbar and the
// cookie notice included. Boxes that scroll on purpose (overflow auto or scroll, such as a wide
// table) are left alone. The check waits for the entrance animations to finish first: late items
// start invisible (`reveal-delay-3` and up), and invisible things are skipped, so measuring early
// could pass on a page that overflows once everything has appeared.

const WIDTHS = [320, 390, 768];

/** Problems with anything wider than the screen, as readable strings (empty when fine). */
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
    }
    return out.slice(0, 6);
  });
}

/**
 * Waits until every finite, time-driven animation on the page (the entrance fades and slides) has run to the
 * end. Looping ones never end, and neither do animations tied to scrolling (the home hero's fade-on-scroll is a
 * ViewTimeline that only moves when the page does), so those are not waited for.
 */
async function entrancesDone(page: Page) {
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.timeline !== document.timeline || a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
    undefined,
    { timeout: 5000 },
  );
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px wide`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of [...SITE_PAGES, NOT_FOUND_PATH]) {
      test(`${path}: nothing makes the page scroll sideways or sticks out of the screen`, async ({ page }) => {
        await page.goto(path);
        // Entrances slide elements sideways for half a second; the settled page is what counts.
        await entrancesDone(page);
        await expect.poll(() => overflowProblems(page), { message: 'nothing is wider than the screen', timeout: 5000 }).toEqual([]);
      });
    }
  });
}
