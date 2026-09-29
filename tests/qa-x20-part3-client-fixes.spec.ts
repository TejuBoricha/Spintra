import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { acceptCookieBanner as accept, createCityRoom, skipIfDemoMode, sql, BASE } from './qa-city-helpers';

// Audit wave 2a, part 3 (client half): C-20 (the dice replayed on End turn),
// C-7 (no "Roll again" after doubles) and R-15 (an incoming chat message
// scrolled the whole page). Real two-player matches against the real stack;
// the DB is only used to put the match in a known state, the way qa-x15 does,
// because the dice themselves are random.

interface Match {
  browser: Browser;
  host: Page;
  guest: Page;
  matchId: string;
}

async function startTwoPlayerMatch(): Promise<Match> {
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  const code = await createCityRoom(host);
  await skipIfDemoMode(host);
  await host.getByRole('button', { name: /open a match/i }).click({ timeout: 40000 });
  await host.getByRole('button', { name: /take a seat/i }).click({ timeout: 30000 });

  await guest.goto(`${BASE}/room/${code}`);
  await accept(guest);
  await guest.getByRole('button', { name: /take a seat/i }).click({ timeout: 40000 });

  for (const p of [host, guest]) {
    await p.getByRole('button', { name: /ready/i }).first().click({ timeout: 20000 }).catch(() => {});
  }
  await host.getByRole('button', { name: /start match/i }).click({ timeout: 25000 });

  await expect
    .poll(() => sql(`select count(*) from city_matches where room_code='${code}' and status='active'`), {
      timeout: 20000,
    })
    .toBe('1');
  const matchId = sql(`select id from city_matches where room_code='${code}'`);
  return { browser, host, guest, matchId };
}

// Host's turn, with a fresh 60s clock so nothing times out mid-test.
const setTurn = (matchId: string, phase: string, doublesCount: number) =>
  sql(
    `update city_matches set current_seat=0, phase='${phase}', doubles_count=${doublesCount}, pace_seconds=60, turn_started_at=now(), turn_clock_paused_at=null where id='${matchId}'`
  );

// Counts how often the dice node is (re)mounted: every mount is one replay of
// the tumble animation.
const installDiceCounter = (p: Page) =>
  p.evaluate(() => {
    const w = window as unknown as { __diceMounts: number };
    w.__diceMounts = 0;
    new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of Array.from(m.addedNodes)) {
          if (n.nodeType !== 1) continue;
          const el = n as Element;
          if (el.matches('[data-testid="city-dice-roll"]') || el.querySelector('[data-testid="city-dice-roll"]')) {
            w.__diceMounts++;
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
const diceMounts = (p: Page) => p.evaluate(() => (window as unknown as { __diceMounts: number }).__diceMounts);
const resetDiceMounts = (p: Page) => p.evaluate(() => ((window as unknown as { __diceMounts: number }).__diceMounts = 0));

test('C-20: the dice tumble once per roll and do not replay on End turn', async () => {
  test.setTimeout(120_000);
  const { browser, host, matchId } = await startTwoPlayerMatch();
  try {
    setTurn(matchId, 'awaiting_roll', 0);
    const rollBtn = host.getByRole('button', { name: /^roll dice$/i });
    await expect(rollBtn).toBeEnabled({ timeout: 15000 });

    await installDiceCounter(host);
    await rollBtn.click();
    await expect(host.getByTestId('city-dice-roll')).toBeVisible({ timeout: 15000 });
    // Long enough for the roll's own refetch (and any realtime ping) to land.
    await host.waitForTimeout(2500);
    expect(await diceMounts(host), 'one roll is one tumble').toBe(1);

    // The landing is random (a purchase, a card, a tax...); put the turn in
    // the plain "rolled, may end turn" state so the End turn button is there.
    setTurn(matchId, 'optional_actions', 0);
    sql(`update city_match_players set in_detention=false, pending_debt=0 where match_id='${matchId}' and seat=0`);
    const endBtn = host.getByRole('button', { name: /^end turn$/i });
    await expect(endBtn).toBeEnabled({ timeout: 15000 });

    await resetDiceMounts(host);
    await endBtn.click();
    await expect
      .poll(() => sql(`select current_seat from city_matches where id='${matchId}'`), { timeout: 15000 })
      .toBe('1');
    await host.waitForTimeout(1500);
    expect(await diceMounts(host), 'End turn must not replay the tumble').toBe(0);
  } finally {
    await browser.close();
  }
});

test('C-7: after doubles the button says "Roll again" and takes the re-roll and rolls', async () => {
  test.setTimeout(120_000);
  const { browser, host, guest, matchId } = await startTwoPlayerMatch();
  try {
    // As if the host had just rolled doubles and finished with the landing.
    sql(`update city_matches set last_roll_result=null, last_roll_turn=null where id='${matchId}'`);
    setTurn(matchId, 'optional_actions', 1);

    const rollAgain = host.getByRole('button', { name: /^roll again$/i });
    await expect(rollAgain).toBeEnabled({ timeout: 15000 });
    // It replaces both buttons rather than sitting beside a disabled Roll dice.
    await expect(host.getByRole('button', { name: /^end turn$/i })).toHaveCount(0);
    await expect(host.getByRole('button', { name: /^roll dice$/i })).toHaveCount(0);
    // Only the player whose turn it is gets it.
    await expect(guest.getByRole('button', { name: /^roll again$/i })).toHaveCount(0);

    const before = Number(sql(`select turn_number from city_matches where id='${matchId}'`));
    await installDiceCounter(host);
    await rollAgain.click();

    // The server granted the re-roll (a new turn_number) and the roll was made
    // in it (last_roll_turn caught up), all from the one click.
    await expect
      .poll(
        () => sql(`select (last_roll_turn = turn_number)::text || ':' || turn_number from city_matches where id='${matchId}'`),
        { timeout: 20000 }
      )
      .toBe(`true:${before + 1}`);
    await expect(host.getByTestId('city-dice-roll')).toBeVisible({ timeout: 15000 });
    await host.waitForTimeout(2500);
    expect(await diceMounts(host), 'the chained roll tumbles once, not twice').toBe(1);

    // Without doubles pending it is the ordinary End turn again.
    setTurn(matchId, 'optional_actions', 0);
    await expect(host.getByRole('button', { name: /^end turn$/i })).toBeEnabled({ timeout: 15000 });
    await expect(host.getByRole('button', { name: /^roll again$/i })).toHaveCount(0);
  } finally {
    await browser.close();
  }
});

// Sends `count` chat messages from `guest` (well under the chat rate limit of
// 20 per 10s, migration 0011) and waits until `host` has the last one.
async function sendChat(guest: Page, host: Page, count: number, tag: string) {
  const input = guest.getByLabel('Type a message');
  for (let i = 1; i <= count; i++) {
    await input.fill(`${tag} message ${i}`);
    await input.press('Enter');
    await guest.waitForTimeout(120);
  }
  await expect(host.getByText(`${tag} message ${count}`)).toBeAttached({ timeout: 20000 });
  await host.waitForTimeout(1500); // longer than a smooth scroll
}

const chatList = (p: Page) =>
  p.evaluate(() => {
    const vp = document.querySelector('[role="log"]')?.closest('[data-slot="scroll-area-viewport"]') as HTMLElement | null;
    return vp ? { top: vp.scrollTop, height: vp.scrollHeight, client: vp.clientHeight } : null;
  });

test('R-15: an incoming chat message does not scroll the page (City match)', async () => {
  test.setTimeout(150_000);
  const { browser, host, guest } = await startTwoPlayerMatch();
  try {
    await host.setViewportSize({ width: 1280, height: 600 });
    await host.waitForTimeout(500);

    const pageOverflow = await host.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(pageOverflow, 'a City match page is taller than the screen').toBeGreaterThan(400);
    await host.evaluate(() => window.scrollTo(0, 300));
    await host.waitForTimeout(300);
    const before = await host.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(200);

    await sendChat(guest, host, 16, 'r15');

    const after = await host.evaluate(() => window.scrollY);
    expect(Math.abs(after - before), `the page moved from ${before} to ${after}`).toBeLessThanOrEqual(2);
  } finally {
    await browser.close();
  }
});

// The other half of the same change: the chat list is now scrolled directly
// (scrollTo on its own viewport) instead of via scrollIntoView, so check the
// newest message still ends up in view where the list really does have a
// bounded height: the mobile chat sheet. (On desktop the list grows with its
// content and the page scrolls instead, see audit R-13.)
test('R-15: the chat list still follows the newest message (mobile sheet)', async () => {
  test.setTimeout(150_000);
  const browser = await chromium.launch();
  try {
    const host = await (await browser.newContext()).newPage();
    const guest = await (await browser.newContext()).newPage();
    await host.goto(`${BASE}/create?type=party`);
    await accept(host);
    await host.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
    await host.click('[data-testid="create-room-button-client"]');
    await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
    await skipIfDemoMode(host);
    const code = host.url().split('/room/')[1].split(/[?#]/)[0];
    await guest.goto(`${BASE}/room/${code}`);
    await accept(guest);
    await host.setViewportSize({ width: 390, height: 800 });
    // Open the sheet first: its content isn't mounted while it is closed.
    await host.getByRole('button', { name: /toggle chat and participants sidebar/i }).click();
    await expect(host.getByLabel('Type a message')).toBeVisible({ timeout: 10000 });

    await sendChat(guest, host, 16, 'follow');

    const list = await chatList(host);
    expect(list, 'the chat list viewport exists').not.toBeNull();
    expect(list!.height, 'the chat list overflows').toBeGreaterThan(list!.client);
    expect(list!.top + list!.client, 'the chat list is scrolled to its newest message').toBeGreaterThanOrEqual(list!.height - 8);
  } finally {
    await browser.close();
  }
});
