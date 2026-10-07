import { test, expect, chromium } from '@playwright/test';
import { execSync } from 'child_process';
import { acceptCookieBanner as accept, BASE, skipIfDemoMode } from './qa-city-helpers';

const sql = (q: string) =>
  execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${q.replace(/"/g, '\\"')}"`).toString().trim();

// The actual player-facing proof for BUG-003. city_claim_timeout was verified
// thoroughly at the SQL layer, but a server-side RPC nobody's client ever
// calls fixes nothing for a real player. This test never clicks anything on
// the stalled player's page at all — it just sits there, exactly like a
// player who has gone quiet — and proves the match recovers on its own, with
// zero manual action from anyone (today that is the server timekeeper, 0110).
test('BUG-003 UI: match recovers automatically from a genuinely silent opponent', async () => {
  test.setTimeout(180_000);
  const log: string[] = [];
  const note = (s: string) => { log.push(s); console.log('### ' + s); };

  const br = await chromium.launch();
  const host = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const guest = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

  await host.goto(`${BASE}/create?type=city`);
  await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
  await skipIfDemoMode(host);
  const code = host.url().split('/room/')[1];
  await host.getByRole('button', { name: /open a match/i }).click({ timeout: 40000 });
  await host.getByRole('button', { name: /take a seat/i }).click({ timeout: 30000 });
  await guest.goto(`${BASE}/room/${code}`);
  await accept(guest);
  await guest.getByRole('button', { name: /take a seat/i }).click({ timeout: 40000 });
  for (const p of [host, guest]) await p.getByRole('button', { name: /ready/i }).first().click({ timeout: 20000 }).catch(() => {});
  await host.getByRole('button', { name: /start match/i }).click({ timeout: 25000 });
  await host.waitForTimeout(2500);
  const mid = sql(`select id from city_matches where room_code='${code}' and status='active'`);
  note(`room=${code} match=${mid}`);

  // Force it to be the GUEST's turn (seat 1 — the host always seats first as
  // seat 0), then back-date the clock to simulate a turn that has genuinely
  // run out, without the guest's page doing anything at all. This is the
  // exact "player still has the tab open but is not responding" scenario the
  // audit described.
  // pace_seconds is constrained to {25, 40, 60} — 25 is the fastest legal
  // value, backdated well past it so the expiry is unambiguous.
  sql(`update city_matches set current_seat=1, phase='awaiting_roll', pace_seconds=25, turn_started_at=now()-interval '30 seconds', turn_clock_paused_at=null where id='${mid}'`);
  const before = sql(`select current_seat from city_matches where id='${mid}'`);
  note(`current_seat forced to stall at seat ${before}, pace_seconds=25, clock backdated 30s`);

  // Reload BOTH so their local match state (and this new effect) picks up
  // the backdated clock, but never click anything on either page from here.
  await host.reload();
  await guest.reload();
  await host.waitForTimeout(1500);
  await guest.waitForTimeout(1500);

  // Nobody clicks anything from here. Two independent recoveries exist: the
  // players' browsers claim an expired turn, and the server's city-tick
  // timekeeper (0110, pg_cron every 5s) does too (checked by hand: with the
  // city-tick job switched off this still passes through the browsers). Either
  // one plays the expired turn. An expired awaiting_roll is auto-rolled, which
  // leaves the phase and starts a fresh clock for the seat's after-roll
  // actions; the seat only changes one full window (25s here) later, so "the
  // seat changed" cannot be the check within a test's time -- the phase leaving
  // awaiting_roll is. The server path alone is covered in the SQL regression.
  await expect
    .poll(() => sql(`select phase from city_matches where id='${mid}'`), {
      timeout: 25_000,
      message: 'nothing played the expired turn',
    })
    .not.toBe('awaiting_roll');

  const after = sql(`select current_seat, phase, turn_number from city_matches where id='${mid}'`);
  const rolled = sql(`select count(*) from city_match_events where match_id='${mid}' and kind='rolled'`);
  note(`state after the expired turn was played, with nobody clicking anything: ${after}; rolled events: ${rolled}`);
  expect(Number(rolled)).toBeGreaterThan(0);

  note('VERDICT: PASS — the expired turn was auto-rolled with zero manual clicks');
  console.log('\n===R===\n' + log.join('\n') + '\n===END===');
  await br.close();
});
