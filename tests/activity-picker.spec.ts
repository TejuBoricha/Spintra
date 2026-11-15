import { test, expect, type Page } from '@playwright/test';
import { hideConfigBanner } from './helpers/config-banner';
import { skipInDbIntegration } from './helpers/ci-skip';

skipInDbIntegration(test);

// UX audit (7 Oct 2026), finding U-33: the host's activity picker was fourteen 144px tiles in two columns, which ran to three screens
// on a phone, and every tile's label was in the muted text colour ("the label is the whole point of the tile"). It is three compact
// columns now, so the whole list is one screen at 390 x 844, and the labels are in the foreground colour.
// A demo-mode party room (no Supabase), as `pixel-contrast-room.spec.ts` creates it.

async function openPicker(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.goto('/create?type=party');
  await hideConfigBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45000 });
  await hideConfigBanner(page);
  await page.waitForTimeout(1500); // the room has joined and its lobby has rendered
  await page.locator('button[aria-label="Switch game activity"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(400); // the dialog's entrance
}

test.describe('on a phone, 390 x 844', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('all fourteen activities are on one screen, in tiles a finger can hit', async ({ page }) => {
    await openPicker(page);
    const tiles = page.locator('button[aria-label^="Select "]');
    expect(await tiles.count(), 'the party room offers all 14 activities').toBe(14);

    const dialog = page.getByRole('dialog');
    const shape = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, scrolls: el.scrollHeight > el.clientHeight + 1, viewport: window.innerHeight };
    });
    expect(shape.scrolls, 'the dialog does not scroll').toBe(false);
    expect(shape.top, 'the dialog starts on the screen').toBeGreaterThanOrEqual(0);
    expect(shape.bottom, 'and ends on it').toBeLessThanOrEqual(shape.viewport);

    for (const label of await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))) {
      const box = (await page.locator(`button[aria-label="${label}"]`).boundingBox())!;
      expect(box.height, `${label}: height`).toBeGreaterThanOrEqual(44);
      expect(box.width, `${label}: width`).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height, `${label} is inside the screen`).toBeLessThanOrEqual(shape.viewport);
    }
  });
});

test.describe('on a desktop, 1280 x 800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('the labels are in the foreground colour, not the muted one', async ({ page }) => {
    await openPicker(page);
    const colours = await page.locator('button[aria-label^="Select "]').evaluateAll((els) => {
      const foreground = getComputedStyle(document.body).color;
      return els.map((el) => ({ name: el.getAttribute('aria-label'), colour: getComputedStyle(el).color, foreground }));
    });
    expect(colours.length).toBe(14);
    // The tile of the game being played (the lobby has none) is the only one allowed another colour.
    for (const tile of colours) expect(tile.colour, `${tile.name}'s label`).toBe(tile.foreground);
  });
});
