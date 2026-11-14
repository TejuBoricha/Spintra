import { test, expect } from '@playwright/test';
import { GAMES } from '../src/lib/games';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), finding U-16, the small things a person sees on the page everyone sees: the rule and "Try it" row of a
// card sat higher in one card than in its neighbours (the cards were not columns), the hero said "14 games to play" while the
// section below said "17 games and room modes" (two numbers, typed by hand), and a mouse-wheel cue showed on a touch screen.
// ("play" alone on a line is U-26, text-wrap.spec.ts.)

const PLAYABLE = GAMES.filter((g) => !g.createOnly).length;
const MODES = GAMES.length - PLAYABLE;

async function openHome(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.goto('/');
  await page.waitForLoadState('load');
  await hideConfigBanner(page);
}

test('the hero and the section under it count the same games, and the grid has one card for each', async ({ page }) => {
  await openHome(page);
  const hero = page.getByText(/^\d+ games to play$/).filter({ visible: true });
  const section = page.getByText(/^\d+ games and \d+ room modes\./).filter({ visible: true });
  await expect(hero).toHaveText(`${PLAYABLE} games to play`);
  await expect(section).toContainText(`${PLAYABLE} games and ${MODES} room modes.`);
  await expect(page.getByTestId('feature-card').filter({ visible: true })).toHaveCount(GAMES.length);
});

for (const width of [1280, 768]) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('the footers of the cards in a row share a bottom edge', async ({ page }) => {
      await openHome(page);
      // The cards fade in as they scroll into view; read them once they all have.
      const cards = page.getByTestId('feature-card').filter({ visible: true });
      await expect(cards).toHaveCount(GAMES.length);
      for (let i = 0; i < GAMES.length; i++) await cards.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      const rows = await page.evaluate(() => {
        const byTop = new Map<number, { footer: number; card: number }[]>();
        for (const card of document.querySelectorAll('[data-testid="feature-card"]')) {
          const box = card.getBoundingClientRect();
          if (box.width === 0) continue; // the copy React keeps hidden while it streams
          const footer = (card.querySelector('[data-testid="feature-card-footer"]') as HTMLElement).getBoundingClientRect();
          const top = Math.round(box.top + window.scrollY);
          const key = [...byTop.keys()].find((k) => Math.abs(k - top) <= 2) ?? top;
          byTop.set(key, [...(byTop.get(key) ?? []), { footer: Math.round(footer.bottom + window.scrollY), card: Math.round(box.bottom + window.scrollY) }]);
        }
        return [...byTop.values()];
      });
      expect(rows.length, 'the cards are laid out in rows').toBeGreaterThanOrEqual(Math.ceil(GAMES.length / 3));
      for (const row of rows) {
        const footers = row.map((c) => c.footer);
        expect(Math.max(...footers) - Math.min(...footers), `footer bottoms in a row: ${footers.join(', ')}`).toBeLessThanOrEqual(1);
        const bottoms = row.map((c) => c.card);
        expect(Math.max(...bottoms) - Math.min(...bottoms), `card bottoms in a row: ${bottoms.join(', ')}`).toBeLessThanOrEqual(1);
      }
    });
  });
}

test('the scroll cue is for a mouse: shown with one, hidden on a touch screen', async ({ page, browser }) => {
  await openHome(page);
  await expect(page.getByTestId('scroll-cue').filter({ visible: true })).toHaveCount(1);

  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await touch.newPage();
  await openHome(phone);
  expect(await phone.evaluate(() => matchMedia('(pointer: coarse)').matches), 'the context emulates a touch screen').toBe(true);
  await expect(phone.getByTestId('scroll-cue')).toBeHidden();
  await touch.close();
});
