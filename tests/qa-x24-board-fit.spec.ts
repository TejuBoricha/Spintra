import { test, expect } from '@playwright/test';
import { startTwoPlayerCityMatch, setHostTurn } from './qa-city-helpers';

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
      const box = (await stage.boundingBox())!;
      expect(box.x, `${name}: board starts left of the screen`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${name}: board runs past the right edge`).toBeLessThanOrEqual(w);
      expect(Math.abs(box.width - box.height), `${name}: board is not square`).toBeLessThanOrEqual(2);

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
    await expect(host.getByTestId('city-board-stage')).toBeVisible();
    if (name.startsWith('laptop')) await host.getByRole('button', { name: /^roll dice$/i }).click();
    const dice = host.getByTestId('city-dice');
    await expect(dice).toBeVisible({ timeout: 15_000 });
    const d = (await dice.boundingBox())!;
    const s = (await host.getByTestId('city-board-stage').boundingBox())!;
    expect(d.x, `${name}: dice hang off the left of the board`).toBeGreaterThanOrEqual(s.x);
    expect(d.y).toBeGreaterThanOrEqual(s.y);
    expect(d.x + d.width, `${name}: dice hang off the right of the board`).toBeLessThanOrEqual(s.x + s.width);
    expect(d.y + d.height, `${name}: dice hang off the bottom of the board`).toBeLessThanOrEqual(s.y + s.height);
  }
  await browser.close();
});
