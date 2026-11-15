import { test, expect, type Page, type Locator } from '@playwright/test';
import { GAMES } from '../src/lib/games';
import { skipInDbIntegration } from './helpers/ci-skip';
import { createDemoPartyRoom } from './helpers/demo-room';

skipInDbIntegration(test);

// UX audit (7 Oct 2026), finding U-33: the host's activity picker was fourteen 144px tiles in two columns, which ran to three screens
// on a phone, and every tile's label was in the muted text colour ("the label is the whole point of the tile"). It is three compact
// columns now, so the whole list is one screen at 390 x 844, and the labels are in the foreground colour and stay inside their tiles
// (the wider Plus Jakarta Sans of U-14 has "Tournament" at the edge of a 96px tile). A demo-mode party room (no Supabase).

/** How many tiles a party room offers: every game that is not create-only. */
const PARTY_TILES = GAMES.filter((g) => !g.createOnly).length;

async function openPicker(page: Page) {
  await createDemoPartyRoom(page);
  await page.locator('button[aria-label="Switch game activity"]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('button[aria-label^="Select "]')).toHaveCount(PARTY_TILES);
  await settled(dialog); // its entrance has finished: the boxes below are the final ones
  return dialog;
}

/** Waits until a box stops moving (the same rectangle on two reads, a frame apart). */
async function settled(locator: Locator) {
  await expect
    .poll(async () => {
      const a = await locator.boundingBox();
      await locator.page().waitForTimeout(80);
      const b = await locator.boundingBox();
      return !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
    })
    .toBe(true);
}

for (const [width, height] of [[390, 844], [360, 740], [320, 640]] as const) {
  test.describe(`on a phone, ${width} x ${height}`, () => {
    test.use({ viewport: { width, height } });

    test('every activity is in a tile a finger can hit, and every label stays inside its tile', async ({ page }) => {
      const dialog = await openPicker(page);
      const tiles = page.locator('button[aria-label^="Select "]');
      const read = await tiles.evaluateAll((els) =>
        els.map((el) => {
          const box = el.getBoundingClientRect();
          const label = el.querySelector('span');
          const labelBox = label?.getBoundingClientRect();
          return {
            name: el.getAttribute('aria-label') ?? '',
            width: box.width,
            height: box.height,
            // a label that overflows its tile: wider than the tile's content box, or a word wider than the span that holds it
            labelOverflow: !labelBox || labelBox.right > box.right + 0.5 || labelBox.left < box.left - 0.5 || (label?.scrollWidth ?? 0) > (label?.clientWidth ?? 0) + 1,
            tileOverflow: el.scrollWidth > el.clientWidth + 1,
          };
        }),
      );
      for (const tile of read) {
        expect(tile.height, `${tile.name}: height`).toBeGreaterThanOrEqual(44);
        expect(tile.width, `${tile.name}: width`).toBeGreaterThanOrEqual(44);
        expect(tile.labelOverflow, `${tile.name}: the label is inside the tile`).toBe(false);
        expect(tile.tileOverflow, `${tile.name}: the tile does not overflow`).toBe(false);
      }
      const page_ = await page.evaluate(() => ({ sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
      expect(page_.sideways, 'the page does not scroll sideways').toBe(false);
      expect(await dialog.evaluate((el) => el.getBoundingClientRect().left), 'the dialog starts on the screen').toBeGreaterThanOrEqual(0);
    });
  });
}

test.describe('on a phone, 390 x 844: one screen', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the whole list is on the screen and the dialog does not scroll', async ({ page }) => {
    const dialog = await openPicker(page);
    const shape = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, scrolls: el.scrollHeight > el.clientHeight + 1, viewport: window.innerHeight };
    });
    expect(shape.scrolls, 'the dialog does not scroll').toBe(false);
    expect(shape.top, 'the dialog starts on the screen').toBeGreaterThanOrEqual(0);
    expect(shape.bottom, 'and ends on it').toBeLessThanOrEqual(shape.viewport);
    for (const box of await page.locator('button[aria-label^="Select "]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom))) {
      expect(box, 'every tile is inside the screen').toBeLessThanOrEqual(shape.viewport);
    }
  });
});

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test(`the labels are in the foreground colour, not the muted one, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPicker(page);
    const read = await page.locator('button[aria-label^="Select "]').evaluateAll((els) => {
      // The foreground token as the page resolves it, from a probe element, not from another element's colour.
      const probe = document.createElement('span');
      probe.style.color = 'var(--foreground)';
      document.body.appendChild(probe);
      const foreground = getComputedStyle(probe).color;
      probe.remove();
      return els.map((el) => ({
        name: el.getAttribute('aria-label'),
        colour: getComputedStyle(el).color,
        active: el.className.includes('border-primary bg-primary/20'),
        foreground,
      }));
    });
    expect(read.length).toBe(PARTY_TILES);
    // The tile of the game being played is the one allowed another colour (the brand's); a fresh lobby has none.
    for (const tile of read.filter((t) => !t.active)) expect(tile.colour, `${tile.name}'s label`).toBe(tile.foreground);
  });
}
