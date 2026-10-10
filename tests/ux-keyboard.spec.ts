import { test, expect } from '@playwright/test';
import { SITE_PAGES, NOT_FOUND_PATH } from './site-routes';
import { focusRingProblems, newDecoder, outlineProblem } from './helpers/focus-ring';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), findings U-01, U-02 and U-03.
//
// U-01: in the light theme the keyboard focus ring was a pale lime glow on cream, 1.07 to 1.2 : 1
// against the page (WCAG asks for 3 : 1). U-02: the cards on /tools and /for-teachers had
// `outline-none` and nothing in its place, so a keyboard user saw nothing at all. U-03: every
// button that is also a link was a <button> inside an <a>, which is invalid HTML and made each one
// two Tab stops (a real Tab traversal found 8 repeats among the home page's 44 stops).

// Every page in both themes: the ring is drawn the same way almost everywhere, but a card that is an inline
// link around a block, an image that framer-motion makes tabbable, a field that scrolls in behind the fixed
// navbar, or a custom indicator in the brand lime (the Lucky wheel's colour swatches: 1.4 : 1 on cream) is a
// per-page problem, and the light theme is where the lime fails.
const PAGES_BY_THEME = { dark: [...SITE_PAGES, NOT_FOUND_PATH], light: [...SITE_PAGES, NOT_FOUND_PATH] } as const;

for (const theme of ['dark', 'light'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', colorScheme: theme });

    for (const path of PAGES_BY_THEME[theme]) {
      test(`${path}: every Tab stop shows a focus ring that passes 3 : 1`, async ({ page }) => {
        test.setTimeout(150_000); // up to 45 stops, two pictures each, on a single loaded CI worker
        await page.addInitScript(([t]) => {
          localStorage.setItem('spintra-theme', t);
          localStorage.setItem('spintra-cookie-consent', 'denied');
        }, [theme]);
        const decoder = await newDecoder(page);
        await page.goto(path);
        // Let the page settle: hydration, and fonts changing the layout, would move things under the pictures.
        await page.waitForLoadState('load');
        await page.waitForTimeout(600);
        const { stops, measured, unmeasured, problems } = await focusRingProblems(page, decoder);
        await decoder.close();
        expect(stops, 'the page has Tab stops to check').toBeGreaterThan(5);
        // A stop with no picture (it moved when it lost focus, or it is too big) is not judged, so say how many
        // were not and fail if that is more than a fifth: a missing ring must not hide among skipped stops.
        expect(measured, `most Tab stops get a picture (not measured: ${unmeasured.join('; ')})`).toBeGreaterThanOrEqual(Math.ceil(stops * 0.8));
        expect(problems.map((p) => `stop ${p.stop} ${p.what}: ${p.why}`), 'every Tab stop shows a focus indicator that passes 3 : 1').toEqual([]);
      });
    }
  });
}

test.describe('one control, one Tab stop', () => {
  for (const path of [...SITE_PAGES, NOT_FOUND_PATH]) {
    test(`${path}: no button inside a link, no link inside a button`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('load');
      const nested = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href] button, button a[href], a[href] a[href], button button, a[href] [role="button"], [role="button"] a[href]')).map((el) => {
          const outer = el.parentElement?.closest('a, button, [role="button"]');
          return `${outer?.tagName.toLowerCase()} "${(outer?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24)}" > ${el.tagName.toLowerCase()}`;
        }),
      );
      expect(nested, 'a link that looks like a button is one element (ButtonLink)').toEqual([]);
    });
  }

  test('the navbar and the home page call-to-action buttons are links, once each', async ({ page }) => {
    await page.goto('/');
    for (const name of ['LIVE ROOMS', 'TOOLS', 'HOST']) {
      await expect(page.getByRole('link', { name, exact: true }), `${name} is a link`).toHaveCount(1);
      await expect(page.getByRole('button', { name, exact: true }), `${name} is not also a button`).toHaveCount(0);
    }
    await expect(page.getByRole('link', { name: 'Create Room' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore Games' })).toBeVisible();
  });

  test('the home page has no repeated Tab stops (it had 44 stops, 8 of them repeats)', async ({ page }) => {
    await page.goto('/');
    await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
    await page.reload();
    await page.waitForLoadState('load');
    const seen: string[] = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()}@${Math.round(r.x)},${Math.round(r.y + window.scrollY)}`;
      });
      if (!stop || seen.includes(stop)) break;
      seen.push(stop);
    }
    // No two stops at the same place: a link and a button on top of each other would share a corner.
    const corners = seen.map((s) => s.split('@')[1]);
    const repeated = corners.filter((c, i) => corners.indexOf(c) !== i);
    expect(repeated, 'two Tab stops never share the same spot').toEqual([]);
    expect(seen.length, 'the home page needs few Tab stops').toBeLessThanOrEqual(38);
  });
});

// The Tab test above visits what is on screen when the page loads, so it never opens a dialog. The six
// room-code boxes in the Join dialog had `outline-none` and signalled focus only by a border colour swap (the
// code review of the accessibility wave found that); they now draw the same outline as everything else.
for (const theme of ['dark', 'light'] as const) {
  test.describe(`Join dialog, ${theme} theme`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', colorScheme: theme });

    test('the room-code boxes show a focus outline that passes 3 : 1', async ({ page }) => {
      await page.addInitScript(([t]) => {
        localStorage.setItem('spintra-theme', t);
        localStorage.setItem('spintra-cookie-consent', 'denied');
      }, [theme]);
      await page.goto('/');
      await page.waitForLoadState('load');
      await hideConfigBanner(page);
      await page.getByRole('button', { name: 'JOIN', exact: true }).click();
      for (const n of [1, 2, 3]) {
        const box = page.getByLabel(`Room code, character ${n} of 6`);
        if (n > 1) await page.keyboard.press('Tab');
        await expect(box, `box ${n} has focus`).toBeFocused();
        const handle = await box.elementHandle();
        expect(await outlineProblem(handle!, 3), `box ${n}'s focus indicator`).toBeNull();
      }
    });
  });
}

// The skip link points at <main id="main-content">. A fragment link only moves the keyboard's starting point in
// browsers that do it for any element; <main tabIndex={-1}> makes the jump work everywhere, and the next Tab
// then starts inside the content instead of back at the skip link.
test('the skip link moves focus into the page: its target has focus and the next Tab stays inside it', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('main')), 'the next Tab lands inside the main content').toBe(true);
});
