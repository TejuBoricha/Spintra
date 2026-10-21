import { test, expect, type Page } from '@playwright/test';
import { SITE_PAGES, NOT_FOUND_PATH } from './site-routes';
import { hideConfigBanner } from './helpers/config-banner';

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
// would hide the problem from the page-width check), and no control sticks out of the content box
// of the box it sits in, into its padding (a button 45px wider than its card's content box hugged the
// card's right edge on a 320px phone, with room to spare on the left, and the page-width check could
// not see it). Fixed layers such as
// the navbar and the cookie notice are measured too. The box rule is for controls (links, buttons and fields: the
// things with a fixed label that cannot wrap); text of any kind is held to the screen edges only. Boxes that scroll on purpose (overflow auto or
// scroll, such as a wide table) are left alone.
//
// Invisible things are skipped, so the page is measured at every scroll stop, once the entrances there
// have finished: items that appear when they scroll into view (the home page's perks, tool grid and
// final call to action) are measured while they are visible, even if a later component hides them
// again after they leave the screen. The first version never scrolled, so those stayed invisible and
// were never measured (review of PR #76, 9 Oct 2026).

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
      // A control wider than the content box of the box it sits in spills into that box's padding (or past
      // it), and centred text no longer centres it. The box is the nearest ancestor that makes one (an
      // inline element does not); a control placed with position absolute or fixed answers to another box.
      // Any display type counts: a flex or grid parent does not shrink a label that cannot wrap.
      if (isControl && cs.position !== 'absolute' && cs.position !== 'fixed') {
        let p = el.parentElement;
        while (p && /^(inline|contents)$/.test(getComputedStyle(p).display)) p = p.parentElement;
        if (p) {
          const ps = getComputedStyle(p);
          const pr = p.getBoundingClientRect();
          const padL = parseFloat(ps.paddingLeft) + parseFloat(ps.borderLeftWidth);
          const padR = parseFloat(ps.paddingRight) + parseFloat(ps.borderRightWidth);
          const spill = Math.max(pr.left + padL - r.left, r.right - (pr.right - padR));
          // Whatever the padding is, a control belongs inside the content box (2px for rounding): padding is what
          // keeps a control off the edge, so a control in it is crowding the edge or sits off-centre.
          if (spill > 2) {
            out.push(`${label(el)} is ${Math.round(r.width)}px wide in a ${Math.round(pr.width - padL - padR)}px box and sticks out ${Math.round(spill)}px into its padding`);
          }
        }
      }
    }
    return out.slice(0, 6);
  });
}

/**
 * Waits until the page is at rest: every finite, time-driven animation has ended, and the opacity that
 * JavaScript-driven entrances set inline has stopped changing for 150ms. Looping animations and animations
 * tied to scrolling (the home hero's fade-on-scroll is a ViewTimeline that only moves when the page does) are
 * not waited for. The wait is bounded and never fails: a page with something that keeps changing is measured
 * at the deadline, not reported as broken.
 */
async function atRest(page: Page) {
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => !a.effect || a.timeline !== document.timeline || a.playState !== 'running' || a.effect.getComputedTiming().iterations === Infinity),
      undefined,
      { timeout: 3000 },
    )
    .catch(() => {});
  const deadline = Date.now() + 1000;
  let last = '';
  let since = Date.now();
  while (Date.now() < deadline) {
    const now = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[style*="opacity"]')).map((el) => el.style.opacity).join(','));
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= 150) break;
    await page.waitForTimeout(50);
  }
}

/**
 * Measures at every scroll stop. The stops are 0.8 of a viewport apart, so they overlap (an item that straddles one
 * boundary is whole on screen at the next), the page height is read again at every stop (lazy chunks and the cookie
 * notice change it after load), and the last stop is the real bottom.
 */
async function problemsWhileScrolling(page: Page): Promise<string[]> {
  const found = new Set<string>();
  const step = Math.floor(page.viewportSize()!.height * 0.8);
  let reachedBottom = false;
  for (let y = 0, stops = 0; stops < 200 && !reachedBottom; y += step, stops++) {
    const { top, max } = await page.evaluate((want) => {
      window.scrollTo(0, want);
      return { top: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight };
    }, y);
    await atRest(page);
    for (const problem of await overflowProblems(page)) found.add(problem);
    reachedBottom = top >= max - 1;
  }
  // A page that is never finished measuring is a failure, not a pass: the unmeasured part is the blind spot.
  if (!reachedBottom) found.add('the bottom of the page was never reached while measuring');
  return [...found].slice(0, 6);
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px wide`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of [...SITE_PAGES, NOT_FOUND_PATH]) {
      test(`${path}: nothing makes the page scroll sideways or sticks out of the screen`, async ({ page }) => {
        await page.goto(path);
        // Each test starts without a stored choice, so the cookie notice mounts after hydration; give it the
        // chance to be measured too. Not every page or state shows it, so its absence is not a failure here
        // (`qa-x9-client-polish.spec.ts` covers the notice itself).
        await page.getByRole('region', { name: 'Cookie notice' }).waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        expect(await problemsWhileScrolling(page), 'nothing is wider than the screen or its box').toEqual([]);
      });
    }
  });
}

// Larger text (UX audit U-41): a phone's text-size setting (or a browser's "text only" zoom) makes every size in rem
// grow while the screen stays 360 or 390px wide. Controls that cannot wrap, and grid or flex children that cannot shrink
// below their text, then run past the edge where they cannot be scrolled to (WCAG 1.4.4 Resize Text, 1.4.10 Reflow).
// At 150% and 390px seven pages broke; the same rules at 360px found five more places (the Dice Roll button, Guess
// Number, Word Scramble, the Tournament banner and the e-mail address on the Privacy page). Same rules as above, with
// the root font size raised. The warning bar of a build made without Supabase is hidden (a visitor never sees it);
// the cookie notice is left in, because a first-time visitor does. 320px at 200% is not covered (see TASKS.md).
for (const width of [360, 390]) {
  test.describe(`at ${width}px wide with the text 150% as large`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of [...SITE_PAGES, NOT_FOUND_PATH]) {
      test(`${path}: nothing makes the page scroll sideways or sticks out of the screen`, async ({ page }) => {
        await page.goto(path);
        await hideConfigBanner(page);
        await page.addStyleTag({ content: 'html { font-size: 150% !important; }' });
        await page.getByRole('region', { name: 'Cookie notice' }).waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        expect(await problemsWhileScrolling(page), 'nothing is wider than the screen or its box').toEqual([]);
      });
    }
  });
}

// The Dice page's Roll button is one label that grows with the dice ("Roll 1d6" to "Roll 10d100"): the default state
// fits with a few pixels to spare, the longest one did not.
test.describe('Dice: the Roll button in its longest state stays inside its panel with larger text', () => {
  for (const width of [360, 390]) {
    test(`at ${width}px wide, ten dice of D100`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/tools/dice');
      await hideConfigBanner(page);
      await page.addStyleTag({ content: 'html { font-size: 150% !important; }' });
      await page.getByRole('button', { name: 'D100', exact: true }).click();
      await page.getByRole('slider', { name: 'Number of dice' }).fill('10');
      await expect(page.getByRole('button', { name: /^Roll 10d100/i })).toBeVisible();
      expect(await problemsWhileScrolling(page), 'nothing is wider than the screen or its box').toEqual([]);
    });
  }
});

// A box that hides its overflow (overflow-hidden) is still a scroll container: clicking or focusing a control in it scrolls
// it sideways to the control, which moved the whole Dice page 61px left (its glow blobs made the page-sized box 432px
// wide in a 360px window; Tournament and Name Draw had the same with an 800px glow, and the home page's closing card
// is 96px wider than itself). overflow-clip clips the same way and cannot be scrolled. The rule needs no click, so it
// covers every page at every width: no visible box (100px or wider, which leaves out screen-reader-only text and the
// hidden 12px honeypot on /create) hides content beyond its own width, unless it is a line of text with an ellipsis.
test.describe('No visible box that hides its overflow can be scrolled sideways', () => {
  for (const path of [...SITE_PAGES, NOT_FOUND_PATH]) {
    test(`${path}: a box that clips a glow or blob is overflow-clip, not overflow-hidden`, async ({ page }) => {
      await page.goto(path);
      for (const width of [320, 360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        const movable = await page.evaluate(() =>
          Array.from(document.querySelectorAll('*'))
            .filter((el) => {
              const cs = getComputedStyle(el);
              return cs.overflowX === 'hidden' && cs.textOverflow !== 'ellipsis' && el.clientWidth >= 100 && el.scrollWidth > el.clientWidth + 1;
            })
            .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(/\s+/).slice(0, 4).join('.')} is ${el.scrollWidth}px wide in a ${el.clientWidth}px box`),
        );
        expect(movable, `at ${width}px: a box that hides sideways overflow can still be scrolled by focus; use overflow-clip`).toEqual([]);
      }
    });
  }
});

// Rock Paper Scissors' "You VS AI" row is one row on every phone at the normal text size: the first fix for larger text
// (flex-wrap) dropped "AI" onto its own row on 320, 360 and 375px phones, which no sideways-scroll rule can see.
test.describe('Rock Paper Scissors: You, VS and AI share one row at the normal text size', () => {
  for (const width of [320, 360, 375, 390]) {
    test(`at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/tools/rps');
      const [you, ai] = [page.getByText('You', { exact: true }), page.getByText('AI', { exact: true })];
      await expect(you).toHaveCount(1);
      await expect(ai).toHaveCount(1);
      const [a, b] = [await you.boundingBox(), await ai.boundingBox()];
      expect(Math.abs(a!.y - b!.y), '"You" and "AI" are on the same row').toBeLessThan(4);
      expect(b!.x, '"AI" is to the right of "You"').toBeGreaterThan(a!.x + a!.width);
    });
  }
});

// The "computer is choosing" spinner keeps its size: a percentage cap on the icon inside its auto-sized, rotating wrapper
// resolved against the icon's own width and made it 41px wide and 48px tall (and 28 by 72px at 150% on a 360px phone).
test.describe('Rock Paper Scissors: the spinner keeps its size and shape while the computer chooses', () => {
  for (const [width, text] of [[390, 100], [360, 150]] as const) {
    test(`at ${width}px wide with the text at ${text}%`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/tools/rps');
      await page.addStyleTag({ content: `html { font-size: ${text}% !important; }` });
      // From the keyboard: the cookie notice covers the choice buttons at the bottom of a phone screen.
      await page.getByRole('button', { name: 'Rock' }).focus();
      await page.keyboard.press('Enter');
      const spinner = page.locator('svg.lucide-swords');
      await expect(spinner).toBeVisible();
      // Layout size, not the bounding box, which grows while the icon turns.
      const { w, h, tile } = await spinner.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { w: parseFloat(cs.width), h: parseFloat(cs.height), tile: el.closest('div.rounded-2xl')!.getBoundingClientRect().width };
      });
      expect(Math.abs(w - h), 'the icon is square').toBeLessThan(1);
      if (text === 100) expect(w, 'the icon is its usual 3rem').toBeGreaterThan(47);
      expect(w, 'the icon fits its tile').toBeLessThanOrEqual(tile);
    });
  }
});

// The same goes for the rows that were made to wrap for larger text (Dice's Roll and sound buttons, Guess Number's field,
// Guess button and sound button): at the normal text size they fit on one row on a 320px phone, as they always did, and
// the Roll button keeps its height (a first version let `wrap` and a stray `py-6` make it 20px taller at every width).
test.describe('Dice and Guess Number: the rows made to wrap for larger text stay one row at the normal text size', () => {
  for (const width of [320, 360, 390]) {
    test(`Dice at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/tools/dice');
      const roll = page.getByRole('button', { name: /^Roll 1d6/i });
      const sound = page.getByRole('button', { name: /sound effects/i });
      await expect(roll).toBeVisible();
      const [a, b] = [await roll.boundingBox(), await sound.boundingBox()];
      expect(Math.abs(a!.y + a!.height / 2 - (b!.y + b!.height / 2)), 'Roll and the sound button are on the same row').toBeLessThan(4);
      expect(a!.height, 'the Roll button keeps its height').toBeLessThanOrEqual(54);
    });

    test(`Guess Number at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/tools/guess-number');
      const [field, guess, sound] = [page.getByRole('spinbutton'), page.getByRole('button', { name: 'Guess', exact: true }), page.getByRole('button', { name: /sound effects/i })];
      await expect(guess).toBeVisible();
      const [f, g, s] = [await field.boundingBox(), await guess.boundingBox(), await sound.boundingBox()];
      // The row is top-aligned (no items-center), so one row means the same top edge; a wrapped item is 40px or more lower.
      for (const other of [g!, s!]) {
        expect(Math.abs(f!.y - other.y), 'the field, Guess and the sound button are on one row').toBeLessThan(4);
      }
    });
  }
});

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
      // ... and on that row they are on the screen with room to spare, not squeezed past its edges.
      expect(Math.min(a!.x, b!.x), 'the pair starts clear of the left edge').toBeGreaterThanOrEqual(8);
      expect(width - Math.max(a!.x + a!.width, b!.x + b!.width), 'the pair ends clear of the right edge').toBeGreaterThanOrEqual(8);
    });
  }
});

// The home page's closing call to action is a nowrap button inside a padded card. With bigger text (the
// operating system's text size, or a browser's "text only" zoom) the button grows while the screen does not,
// so it has to wrap its label instead of spilling out of the card.
test.describe('home page: the closing "Create a room" button stays inside its card', () => {
  for (const width of [320, 390]) {
    test(`at ${width}px wide with the text twice as large`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      const card = page.getByTestId('closing-card');
      const button = card.getByRole('link', { name: 'Create a room', exact: true });
      await button.scrollIntoViewIfNeeded();
      await atRest(page);
      const [b, c] = [await button.boundingBox(), await card.boundingBox()];
      expect(b, 'the button is on the page').not.toBeNull();
      expect(c, 'the card is on the page').not.toBeNull();
      // Inside the card, and clear of its edge by a thumb's worth of the card's own padding.
      expect(b!.x - c!.x, 'space between the button and the card edge, left').toBeGreaterThanOrEqual(8);
      expect(c!.x + c!.width - (b!.x + b!.width), 'space between the button and the card edge, right').toBeGreaterThanOrEqual(8);
    });
  }
});
