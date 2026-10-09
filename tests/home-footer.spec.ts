import { test, expect, type Page } from '@playwright/test';

// The home footer. Review of PR #76 (9 Oct 2026): the footer links were 44px tall below the `md` breakpoint
// and 36px above it, so a touch tablet (768px and wider: iPad portrait, large foldables) got the mouse size.
// The size has to follow the pointer, not only the width.

async function footerLinkHeights(page: Page): Promise<Record<string, number>> {
  await page.goto('/');
  const links = page.locator('footer nav a');
  await expect(links.first()).toBeVisible();
  return links.evaluateAll((els) =>
    Object.fromEntries(els.map((a) => [(a.textContent ?? '').trim(), Math.round(a.getBoundingClientRect().height)])),
  );
}

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
      for (const [name, h] of Object.entries(heights)) expect(h, `${name}`).toBeGreaterThanOrEqual(44);
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
