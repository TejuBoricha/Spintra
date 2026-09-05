import { test, expect, chromium, type Page } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://127.0.0.1:4000';
const accept = async (p: Page) => {
  const b = p.getByRole('button', { name: /^accept$/i });
  await b.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await b.count()) await b.first().click().catch(() => {});
  await p
    .getByRole('region', { name: /cookie notice/i })
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
};

const psql = (sql: string) =>
  execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${sql}"`)
    .toString()
    .trim();

// BUG-007 round H live coverage: the 3-tier away badge (reconnecting 0-60s /
// away 60s+), the autopilot-streak counter, forced retire after 2 straight
// autopiloted turns, and the terminal-seat hygiene fix (a retired seat's
// badge must stop showing Away/auto once it's out) -- all previously only
// verified at the SQL level.
//
// city_match_players.disconnected_at (not room_participants.is_online) is
// what the client and the autopilot cascade actually read, and is set
// directly here -- flipping is_online itself was tried first and doesn't
// stick: g2's browser tab is still genuinely connected throughout (on
// purpose, so it can later show the forced-retired seat's own view), and
// its own presence heartbeat immediately re-asserts is_online=true,
// fighting a manual override. city_track_disconnect's own trigger path is
// already covered by BUG-007-A's SQL assertion; this test's job is the
// CLIENT's reaction to disconnected_at, not the trigger that sets it.
// Guest 2's own browser tab is deliberately left open and subscribed
// throughout, doubling as the forced-retired seat's own view once that
// happens.
test('city: away badge, autopilot counter, forced retire, and terminal-seat hygiene are all live', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();
  const g1 = await (await browser.newContext()).newPage();
  const g2 = await (await browser.newContext()).newPage();

  await host.goto(`${BASE}/create?type=city`);
  await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
  const code = host.url().split('/room/')[1];
  await host.getByRole('button', { name: /open a match/i }).click({ timeout: 40000 });
  await host.getByRole('button', { name: /take a seat/i }).click({ timeout: 30000 });

  for (const p of [g1, g2]) {
    await p.goto(`${BASE}/room/${code}`);
    await accept(p);
    await p.getByRole('button', { name: /take a seat/i }).click({ timeout: 40000 });
  }
  for (const p of [host, g1, g2]) {
    await p.getByRole('button', { name: /ready/i }).first().click({ timeout: 20000 }).catch(() => {});
  }
  await host.getByRole('button', { name: /start match/i }).click({ timeout: 25000 });
  await host.waitForTimeout(1500);

  const matchId = psql(`select id from city_matches where room_code='${code}';`);
  // Skip host's own awaiting_roll entirely (straight to optional_actions,
  // as if they'd already rolled) and pin the pace to its max valid preset
  // with a fresh turn_started_at -- without this, the ordinary turn clock
  // genuinely expires partway through this test's own accumulating waits
  // and claim_timeout auto-resolves host's real (never manually played)
  // turn, which was observed to open a real, unrelated auction mid-test.
  // Every deadline this test actually cares about is still driven precisely
  // via its own turn_started_at/disconnected_at backdating below.
  psql(`update city_matches set current_seat=0, phase='optional_actions', pace_seconds=60, turn_started_at=now(), turn_clock_paused_at=null where id='${matchId}';`);
  // g2 joined last, so they're seat 2 (host=0, g1=1).
  psql(`update city_match_players set disconnected_at = now() where match_id='${matchId}' and seat=2;`);

  // Within the 0-60s grace window: a muted "reconnecting" indicator, not
  // the amber "Away" one -- FR-25's "flagged immediately, no gameplay
  // effect yet" is a real, distinct state, not the same badge early.
  await host.waitForTimeout(6000);
  await expect(host.getByTitle(/connection dropped/i)).toBeVisible({ timeout: 10000 });
  await expect(host.getByTitle(/the server plays this seat's turns automatically/i)).toHaveCount(0);

  // Past 60s: the real away/autopilot-eligible badge.
  psql(`update city_match_players set disconnected_at = now() - interval '65 seconds' where match_id='${matchId}' and seat=2;`);
  psql(`update city_matches set turn_started_at=now() where id='${matchId}';`);
  await host.waitForTimeout(6000);
  await expect(host.getByTitle(/the server plays this seat's turns automatically/i)).toBeVisible({ timeout: 10000 });

  // Force two full autopiloted turns for seat 2 so it gets force-retired.
  // Important subtlety confirmed while writing this test: the streak/forced
  // -retire logic lives entirely inside city_run_autopilot_from_current's
  // OWN cascade -- it only increments for a seat the cascade itself walks
  // onto after city_advance_turn, not for whichever seat claim_timeout's own
  // branches resolve directly. So this drives it the same way the
  // equivalent SQL test does: seat 1 (present) genuinely ends their turn via
  // the real UI, city_advance_turn hands the turn to seat 2 (away), and the
  // cascade resolves+increments IT as part of that same call.
  // Parked in detention rather than left to roll naturally -- an away
  // seat's autopiloted resolution genuinely rolls real dice (FR-27), and a
  // roll landing on a purchasable property correctly opens a real auction
  // instead of concluding (a different, also-correct outcome, not this
  // scenario) -- the exact seed-dependence this session's SQL suite already
  // hit and fixed the same way. city_leave_detention_core's 'roll' method
  // always concludes the turn regardless of the dice outcome.
  psql(`update city_match_players set in_detention=true, detention_turns=0 where match_id='${matchId}' and seat=2;`);

  for (let i = 0; i < 2; i++) {
    psql(`update city_matches set current_seat=1, phase='optional_actions', turn_clock_paused_at=null where id='${matchId}';`);
    await g1.reload();
    await g1.waitForTimeout(1500);
    await g1.getByRole('button', { name: /^end turn$/i }).click({ timeout: 15000 });
    await host.waitForTimeout(2000);
  }

  const status = psql(`select status from city_match_players where match_id='${matchId}' and seat=2;`);
  expect(status).toBe('retired');
  const exitReason = psql(`select exit_reason from city_match_players where match_id='${matchId}' and seat=2;`);
  expect(exitReason).toBe('autopilot_forced');

  // Terminal-seat hygiene: the badge row must no longer show Away/auto for
  // the now-retired seat (BUG-007 round H finding 4), confirmed on host's
  // still-live view.
  await expect(host.getByTitle(/the server plays this seat's turns automatically/i)).toHaveCount(0, { timeout: 10000 });
  await expect(host.getByTitle(/turn\(s\) auto-played in a row/i)).toHaveCount(0);

  // g2's own tab (still fully live -- only the DB row said they were
  // offline) should show the autopilot_forced spectator text.
  await expect(g2.getByText(/retired after missing too many turns in a row/i)).toBeVisible({ timeout: 15000 });

  await browser.close();
});
