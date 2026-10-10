import { test, expect, chromium, type Page } from '@playwright/test';

// The home footer. Review of PR #76 (9 Oct 2026): the footer links were 44px tall below the `md` breakpoint
// and 36px above it, so a touch tablet (768px and wider: iPad portrait, large foldables) got the mouse size.
// The size has to follow the pointer, not only the width, and "the pointer" means every input the device has:
// a touchscreen laptop reports a fine primary pointer, and its screen still takes fingers.

async function footerLinkHeights(page: Page): Promise<Record<string, number>> {
  await page.goto('/');
  const links = page.locator('footer nav a');
  await expect(links.first()).toBeVisible();
  return links.evaluateAll((els) =>
    Object.fromEntries(els.map((a) => [(a.textContent ?? '').trim(), Math.round(a.getBoundingClientRect().height)])),
  );
}

const coarse = (page: Page) => page.evaluate(() => matchMedia('(pointer: coarse)').matches);

test.describe('footer links: tap targets follow the pointer', () => {
  test.describe('a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    test('every link is at least 44px tall', async ({ page }) => {
      const heights = await footerLinkHeights(page);
      expect(Object.keys(heights).length, 'the footer has its seven links').toBe(7);
      for (const [name, h] of Object.entries(heights)) expect(h, `${name}`).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('a touch tablet, 768px wide', () => {
    test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true });
    test('every link is at least 44px tall', async ({ page }) => {
      const heights = await footerLinkHeights(page);
      // Without this the test would say "36 instead of 44" if the browser stopped reporting a coarse pointer.
      expect(await coarse(page), 'the browser reports a coarse pointer for this device').toBe(true);
      for (const [name, h] of Object.entries(heights)) expect(h, `${name}`).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('a touch device at desktop width, 1280px wide', () => {
    test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    test('the links keep their 44px height: a finger can tap them', async ({ page }) => {
      const heights = await footerLinkHeights(page);
      for (const [name, h] of Object.entries(heights)) expect(h, `${name}`).toBeGreaterThanOrEqual(44);
    });
  });

  // A touchscreen laptop or a 2-in-1 with a trackpad: the primary pointer is fine, and the screen still takes
  // fingers. Playwright's `hasTouch` makes the primary pointer coarse, so it cannot stand in for this profile;
  // Chromium's own device settings (the ones its device emulation uses: pointer types are 2 = coarse, 4 = fine,
  // and 6 is both) do. They are launch arguments, which a test file cannot change for one test group, so this
  // test starts its own browser.
  test('a touchscreen laptop with a trackpad, 1280px wide: the links keep their 44px height', async ({ baseURL }) => {
    const browser = await chromium.launch({
      args: ['--blink-settings=primaryPointerType=4,availablePointerTypes=6,primaryHoverType=2,availableHoverTypes=2'],
    });
    try {
      const page = await (await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } })).newPage();
      const heights = await footerLinkHeights(page);
      const media = await page.evaluate(() => ({ fine: matchMedia('(pointer: fine)').matches, touchToo: matchMedia('(any-pointer: coarse)').matches }));
      expect(media, 'a fine primary pointer, with touch available as well').toEqual({ fine: true, touchToo: true });
      for (const [name, h] of Object.entries(heights)) expect(h, `${name}`).toBeGreaterThanOrEqual(44);
    } finally {
      await browser.close();
    }
  });

  test.describe('a tablet-width window with a mouse, 768px wide', () => {
    test.use({ viewport: { width: 768, height: 1024 } });
    test('the links stay compact (36px): only a coarse pointer makes them taller', async ({ page }) => {
      const heights = await footerLinkHeights(page);
      expect(await coarse(page), 'the browser reports a fine pointer').toBe(false);
      for (const [name, h] of Object.entries(heights)) {
        expect(h, `${name}`).toBeGreaterThanOrEqual(24);
        expect(h, `${name} is not bigger than it needs to be`).toBeLessThanOrEqual(40);
      }
    });
  });

  test.describe('a desktop with a mouse', () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    test('the links stay compact (36px) and no smaller than 24px', async ({ page }) => {
      const heights = await footerLinkHeights(page);
      for (const [name, h] of Object.entries(heights)) {
        expect(h, `${name}`).toBeGreaterThanOrEqual(24);
        expect(h, `${name} is not bigger than it needs to be`).toBeLessThanOrEqual(40);
      }
    });
  });
});
