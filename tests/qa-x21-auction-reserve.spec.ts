import { test, expect } from '@playwright/test';
import { sql, startTwoPlayerCityMatch, setHostTurn } from './qa-city-helpers';

// Audit C-8 (migration 0112): an auction opens at half the list price, not a
// flat 10, and every player is told it has opened. Two real browsers; the DB
// only puts the host on an unowned property with a purchase to decide.

test('C-8: an auction opens at half the list price, everyone is told, and the bid buttons start there', async () => {
  test.setTimeout(120_000);
  const { browser, host, guest, matchId } = await startTwoPlayerCityMatch();
  try {
    sql(`delete from city_assets where match_id='${matchId}'`);
    const price = Number(sql(`select price from city_board_spaces where idx=1`));
    const reserve = Math.max(10, Math.ceil(price / 20) * 10);
    expect(reserve, 'the reserve is above the old floor of 10').toBeGreaterThan(10);

    sql(`update city_match_players set position=1 where match_id='${matchId}' and seat=0`);
    setHostTurn(matchId, 'required_decision');
    await host.getByRole('button', { name: /^pass$/i }).click({ timeout: 20000 });

    // Both players see the auction, and that it starts at the reserve. (The
    // panel's own sentence: the toast and the screen-reader line say it too.)
    for (const p of [host, guest]) {
      await expect(p.getByText(/up for auction/i)).toBeVisible({ timeout: 15000 });
      await expect(p.getByText(new RegExp(`Nobody bought it, so everyone gets to bid.*Bids start at ${reserve}\\b`))).toBeVisible();
    }
    // The player who didn't open it is told by a toast, without having to
    // look for the panel.
    await expect(
      guest.locator('[data-sonner-toast]').filter({ hasText: new RegExp(`Auction: .*Bids start at ${reserve}\\b`) })
    ).toBeVisible({ timeout: 10000 });
    expect(sql(`select opening_bid from city_auctions where match_id='${matchId}' and status='running'`)).toBe(
      String(reserve)
    );

    // The first bid button offers the reserve, and placing it works.
    const firstBid = guest.getByRole('button', { name: /^bid /i }).first();
    await expect(firstBid).toHaveText(new RegExp(`Bid ${reserve}\\b`));
    await firstBid.click();
    await expect
      .poll(() => sql(`select high_bid from city_auctions where match_id='${matchId}' and status='running'`), {
        timeout: 15000,
      })
      .toBe(String(reserve));
    // The clock text names the new reset.
    await expect(guest.getByText(/resets it to\s*15s/i)).toBeVisible();
  } finally {
    await browser.close();
  }
});
