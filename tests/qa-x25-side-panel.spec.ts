import { test, expect } from '@playwright/test';
import { startTwoPlayerCityMatch, setHostTurn, sql } from './qa-city-helpers';

// Audit wave 4, step 2 (C-19, C-30, R-13): on a laptop or desktop screen the board, the
// players, the narration, the Activity / Holdings / Trade tabs and the room chat input
// are all on screen at once, with no scrolling. Narrower match views keep the stacked
// layout with every section visible, so a phone or a 1280px window is unchanged.
const WIDE: [string, number, number][] = [
  ['laptop 1366x768', 1366, 768],
  ['laptop 1440x900', 1440, 900],
  ['desktop 1920x1080', 1920, 1080],
];

test('on a laptop or desktop nothing needs scrolling: board, panel and chat input are all on screen', async () => {
  test.setTimeout(180_000);
  const { browser, host, matchId } = await startTwoPlayerCityMatch();
  try {
    setHostTurn(matchId, 'awaiting_roll');
    for (const [name, w, h] of WIDE) {
      await test.step(name, async () => {
        await host.setViewportSize({ width: w, height: h });
        await host.evaluate(() => window.scrollTo(0, 0));
        await expect(host.getByRole('tablist')).toBeVisible();
        await host.waitForTimeout(800);
        const m = await host.evaluate(() => {
          const box = (sel: string) => {
            const r = document.querySelector(sel)?.getBoundingClientRect();
            return r ? { top: r.top, bottom: r.bottom, right: r.right } : null;
          };
          const chat = document.querySelector('input[aria-label="Type a message"]')?.getBoundingClientRect();
          return {
            overflowY: document.documentElement.scrollHeight - window.innerHeight,
            overflowX: document.documentElement.scrollWidth - window.innerWidth,
            board: box('[data-testid="city-board-stage"]'),
            tabs: box('[role="tablist"]'),
            chatBottom: chat ? chat.bottom : null,
          };
        });
        expect(m.overflowY, `${name}: the page scrolls vertically`).toBeLessThanOrEqual(2);
        expect(m.overflowX, `${name}: the page scrolls sideways`).toBeLessThanOrEqual(0);
        expect(m.board!.bottom, `${name}: the board's bottom row is below the fold`).toBeLessThanOrEqual(h);
        expect(m.tabs!.bottom, `${name}: the tab strip is below the fold`).toBeLessThanOrEqual(h);
        expect(m.chatBottom, `${name}: the chat input is below the fold`).not.toBeNull();
        expect(m.chatBottom!, `${name}: the chat input is below the fold`).toBeLessThanOrEqual(h);
      });
    }
  } finally {
    await browser.close();
  }
});

test('the side tabs show one panel at a time on a wide screen, and all three when stacked', async () => {
  test.setTimeout(150_000);
  const { browser, host, matchId } = await startTwoPlayerCityMatch();
  try {
    setHostTurn(matchId, 'awaiting_roll');
    const activity = host.getByText('Nothing has happened yet.');
    const holdings = host.getByText(/your holdings/i);
    const propose = host.getByRole('button', { name: /propose a trade/i });

    await host.setViewportSize({ width: 1366, height: 768 });
    await expect(host.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true');
    await expect(activity).toBeVisible();
    await expect(holdings).toBeHidden();
    await expect(propose).toBeHidden();

    await host.getByRole('tab', { name: 'Holdings' }).click();
    await expect(holdings).toBeVisible();
    await expect(activity).toBeHidden();

    await host.getByRole('tab', { name: /^Trade/ }).click();
    await expect(propose).toBeVisible();
    await expect(holdings).toBeHidden();

    // A 1280px window (the size most of the suite runs at) keeps the stacked layout:
    // no tab strip, everything visible without choosing anything.
    await host.setViewportSize({ width: 1280, height: 720 });
    await expect(host.getByRole('tablist')).toBeHidden();
    await expect(activity).toBeVisible();
    await expect(holdings).toBeVisible();
    await expect(propose).toBeVisible();
  } finally {
    await browser.close();
  }
});

test('a trade offer waiting for you shows as a dot on the Trade tab, even from another tab', async () => {
  test.setTimeout(150_000);
  const { browser, host, guest, matchId } = await startTwoPlayerCityMatch();
  try {
    setHostTurn(matchId, 'awaiting_roll');
    for (const p of [host, guest]) await p.setViewportSize({ width: 1366, height: 768 });
    // The guest sits on the Activity tab, not looking at Trade.
    await expect(guest.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true');
    await expect(guest.getByRole('tab', { name: /waiting/i })).toHaveCount(0);

    await host.getByRole('tab', { name: /^Trade/ }).click();
    await host.getByRole('button', { name: /propose a trade/i }).click();
    await host.getByTestId('trade-partner').first().click();
    await host.locator('[data-testid="trade-panel"] input[type="number"]').first().fill('10');
    await host.getByRole('button', { name: /send offer/i }).click();
    await expect.poll(() => sql(`select count(*) from city_trade_offers where match_id='${matchId}' and status='pending'`), { timeout: 15000 }).toBe('1');

    // The guest is told without changing tabs, and the tab still says Trade.
    await expect(guest.getByRole('tab', { name: /^Trade.*1 offer waiting/ })).toBeVisible({ timeout: 15000 });
    await expect(guest.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true');

    // Opening the tab shows the offer, and accepting clears the dot.
    await guest.getByRole('tab', { name: /^Trade/ }).click();
    await guest.getByRole('button', { name: /^accept$/i }).last().click();
    await expect(guest.getByRole('tab', { name: /waiting/i })).toHaveCount(0, { timeout: 15000 });
  } finally {
    await browser.close();
  }
});
