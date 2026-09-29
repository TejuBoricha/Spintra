import { test, expect } from '@playwright/test';
import { sql, startTwoPlayerCityMatch } from './qa-city-helpers';

// Audit C-4 (product decision 2026-09-29): Timed mode is reachable from the
// lobby, shows a match clock, ends at the limit, and "Play again" repeats how
// the match was set up. The server rule (the limit ends the match on every
// hand-off) has its own SQL checks in scripts/city-regression.sql.

test('C-4: pick Timed in the lobby, see the match clock, play out the limit, and Play again repeats the setup', async () => {
  test.setTimeout(150_000);
  const { browser, host, guest, matchId } = await startTwoPlayerCityMatch({ timedMinutes: 15 });
  try {
    // The lobby choice reached the server.
    expect(sql(`select mode || ':' || time_limit_minutes from city_matches where id='${matchId}'`)).toBe('timed:15');

    // Both players see the match clock.
    for (const p of [host, guest]) {
      await expect(p.getByTestId('city-match-clock')).toContainText(/timed match/i, { timeout: 15000 });
      await expect(p.getByTestId('city-match-clock')).toContainText(/1[45]:\d\d left/);
    }

    // Time runs out mid-match: the clock says the round still finishes.
    sql(`update city_matches set started_at = now() - interval '16 minutes' where id='${matchId}'`);
    await expect(host.getByTestId('city-match-clock')).toContainText(/time's up/i, { timeout: 15000 });
    expect(sql(`select status from city_matches where id='${matchId}'`)).toBe('active');

    // The last seat of the round ends their turn: the match ends on net worth.
    sql(
      `update city_matches set current_seat=1, phase='optional_actions', doubles_count=0, pace_seconds=60, turn_started_at=now(), turn_clock_paused_at=null where id='${matchId}'`
    );
    await guest.getByRole('button', { name: /^end turn$/i }).click({ timeout: 20000 });
    await expect
      .poll(() => sql(`select status from city_matches where id='${matchId}'`), { timeout: 20000 })
      .toBe('finished');

    // "Play again" repeats the mode, the limit and the pace (the pace was set
    // to 60 above; a fresh match would default to 40).
    await host.getByRole('button', { name: /^play again$/i }).click({ timeout: 20000 });
    await expect
      .poll(
        () =>
          sql(
            `select mode || ':' || time_limit_minutes || ':' || pace_seconds from city_matches where room_code=(select room_code from city_matches where id='${matchId}') and status<>'finished'`
          ),
        { timeout: 20000 }
      )
      .toBe('timed:15:60');
    await expect(host.getByTestId('city-lobby-mode')).toContainText(/timed match · 15 minutes/i);
  } finally {
    await browser.close();
  }
});

test('C-4: Classic is still the default, and says so', async () => {
  test.setTimeout(120_000);
  const { browser, host, guest, matchId } = await startTwoPlayerCityMatch();
  try {
    expect(sql(`select mode || ':' || coalesce(time_limit_minutes::text, 'none') from city_matches where id='${matchId}'`)).toBe(
      'classic:none'
    );
    // No match clock in a Classic match.
    await expect(host.getByRole('button', { name: /^roll dice$/i })).toBeVisible({ timeout: 15000 });
    await expect(host.getByTestId('city-match-clock')).toHaveCount(0);
    await expect(guest.getByTestId('city-match-clock')).toHaveCount(0);
  } finally {
    await browser.close();
  }
});
