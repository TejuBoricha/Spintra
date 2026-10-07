import { test, expect, type Locator, type Page } from '@playwright/test';
import { startTwoPlayerCityMatch, setHostTurn } from './qa-city-helpers';

// The board follows a screen change a few frames late: it measures its column,
// then re-renders at the new size (11 to 47ms on a fast machine, longer on a busy
// CI runner). Read once, straight after a resize, it can still be the previous
// screen's board: a CI run on 30 Sep saw 836px, the 1920x1080 size, on an 820px
// screen. So wait until two reads two frames apart agree and the board fits;
// a board that never fits still fails, with the reason. `checkFold` ("the whole board
// is on screen") is a claim about the moment of load, so the after-a-roll test turns it off.
async function settledBoard(page: Page, stage: Locator, name: string, w: number, h: number, checkFold = true) {
  const problem = async () => {
    const a = (await stage.boundingBox())!;
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const b = (await stage.boundingBox())!;
    if (a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height) return 'still resizing';
    if (b.x < 0) return `starts ${Math.round(-b.x)}px left of the screen`;
    if (b.x + b.width > w) return `runs ${Math.round(b.x + b.width - w)}px past the right edge`;
    if (Math.abs(b.width - b.height) > 2) return `is not square (${Math.round(b.width)}x${Math.round(b.height)})`;
    // The WHOLE board is on screen at load (a cut-off bottom row hides Departure,
    // where everyone starts). Not on the 320px phone, where the header and the
    // stacked seat row leave less room than the smallest readable board.
    if (checkFold && w >= 360 && b.y + b.height > h) return `has its bottom row ${Math.round(b.y + b.height - h)}px below the fold at load`;
    return '';
  };
  await expect.poll(problem, { message: `${name}: the board`, timeout: 10_000 }).toBe('');
  return (await stage.boundingBox())!;
}

// Audit wave 4, step 1: the board is scaled to the screen and the roll, dice and
// buttons live on it (C-3, C-19, C-31, C-17), tapping a tile shows its details
// (C-12), and your own seat says "you" (C-13).
const SIZES: [string, number, number][] = [
  ['laptop 1366x768', 1366, 768],
  ['desktop 1920x1080', 1920, 1080],
  ['portrait tablet 820x1180', 820, 1180],
  ['phone 390x844', 390, 844],
  ['small phone 320x658', 320, 658],
];

test('the board fits the screen, the actions are on it, tiles explain themselves, and you are marked', async () => {
  test.setTimeout(180_000);
  const { browser, host, matchId } = await startTwoPlayerCityMatch();
  setHostTurn(matchId, 'awaiting_roll');

  for (const [name, w, h] of SIZES) {
    await test.step(name, async () => {
      await host.setViewportSize({ width: w, height: h });
      await host.evaluate(() => window.scrollTo(0, 0));
      const stage = host.getByTestId('city-board-stage');
      await expect(stage).toBeVisible();
      // The board scales to its column, so it never needs a sideways scroll.
      await expect
        .poll(() => host.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), {
          message: `${name}: the page scrolls sideways`,
        })
        .toBeLessThanOrEqual(0);
      // Inside the screen, square, and whole at load (see settledBoard).
      await settledBoard(host, stage, name, w, h);

      // The seat badges and the turn clock share a row; at 320px they overlapped.
      const clock = host.getByText(/^\d:\d{2}$/).first();
      if (await clock.count()) {
        const c = (await clock.boundingBox())!;
        for (const b of await host.getByTestId('city-seat-badge').all()) {
          const bb = (await b.boundingBox())!;
          const overlap = bb.x < c.x + c.width && c.x < bb.x + bb.width && bb.y < c.y + c.height && c.y < bb.y + bb.height;
          expect(overlap, `${name}: the turn clock overlaps a seat badge`).toBe(false);
        }
      }

      // The roll button is on the board (in its centre), and on screen without scrolling.
      const roll = host.getByRole('button', { name: /^roll dice$/i });
      await expect(roll).toBeVisible();
      const r = (await roll.boundingBox())!;
      const centre = (await host.getByTestId('city-board-centre').boundingBox())!;
      expect(r.x, `${name}: Roll dice is outside the board centre`).toBeGreaterThanOrEqual(centre.x - 1);
      expect(r.x + r.width).toBeLessThanOrEqual(centre.x + centre.width + 1);
      expect(r.y + r.height, `${name}: Roll dice is below the fold`).toBeLessThanOrEqual(h);
      // Big enough to tap, at every size (the buttons are not scaled with the tiles).
      expect(r.height, `${name}: Roll dice is too small to tap`).toBeGreaterThanOrEqual(32);
    });
  }

  await test.step('you are marked, and only you', async () => {
    const badges = host.getByTestId('city-seat-badge');
    await expect(badges).toHaveCount(2);
    await expect(badges.locator('span', { hasText: /^you$/ })).toHaveCount(1);
  });

  await test.step('tapping a tile shows what it is, and Close hides it', async () => {
    await host.setViewportSize({ width: 390, height: 844 });
    const detail = host.getByTestId('city-tile-detail');
    await expect(detail).toHaveCount(0);
    await host.getByRole('button', { name: /^Melbourne/ }).first().click();
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('Melbourne');
    await expect(detail).toContainText('Australia');
    await expect(detail).toContainText('210');
    await expect(detail).toContainText('Nobody yet');
    await host.getByRole('button', { name: /close tile details/i }).click();
    await expect(detail).toHaveCount(0);
  });

  await browser.close();
});

test('after a roll the dice show on the board, inside its frame', async () => {
  test.setTimeout(120_000);
  const { browser, host, matchId } = await startTwoPlayerCityMatch();
  setHostTurn(matchId, 'awaiting_roll');
  for (const [name, w, h] of [SIZES[0], SIZES[3]]) {
    await host.setViewportSize({ width: w, height: h });
    const stage = host.getByTestId('city-board-stage');
    await expect(stage).toBeVisible();
    if (name.startsWith('laptop')) await host.getByRole('button', { name: /^roll dice$/i }).click();
    const dice = host.getByTestId('city-dice');
    await expect(dice).toBeVisible({ timeout: 15_000 });
    // Settled first, so the dice and the board are read from the same layout. Not the
    // "whole board at load" check: this is after a roll, not at load.
    const s = await settledBoard(host, stage, name, w, h, false);
    const d = (await dice.boundingBox())!;
    expect(d.x, `${name}: dice hang off the left of the board`).toBeGreaterThanOrEqual(s.x);
    expect(d.y).toBeGreaterThanOrEqual(s.y);
    expect(d.x + d.width, `${name}: dice hang off the right of the board`).toBeLessThanOrEqual(s.x + s.width);
    expect(d.y + d.height, `${name}: dice hang off the bottom of the board`).toBeLessThanOrEqual(s.y + s.height);
  }
  await browser.close();
});
