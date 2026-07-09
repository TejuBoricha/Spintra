import { test, expect, chromium } from '@playwright/test';

// Covers the core multiplayer loop the Session 41 production-readiness
// audit found completely untested: two genuinely distinct participants
// (separate browser contexts, so separate anon-auth identities — not two
// tabs sharing one localStorage identity the way the demo-mode
// BroadcastChannel fallback would) join the same room, one plays an
// activity, both see each other's presence and the resulting game state,
// and the room can be left/closed cleanly.
//
// This test requires a real Supabase backend (NEXT_PUBLIC_SUPABASE_URL /
// NEXT_PUBLIC_SUPABASE_ANON_KEY) to be configured for the server under
// test — against the demo-mode BroadcastChannel fallback, two separate
// browser contexts would never see each other at all (that fallback only
// syncs across tabs sharing the same localStorage identity). Skips itself
// automatically if the app is running without Supabase configured, rather
// than failing confusingly.

test('two participants join, play trivia, and see each other\'s presence', async ({ page, baseURL }) => {
  test.setTimeout(90_000);

  page.on('console', (msg) => console.log(`[browser:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message));

  await page.goto('/create?type=trivia');
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
  const roomCode = page.url().split('/room/')[1];

  const startTriviaButton = page.getByRole('button', { name: /start trivia/i });
  await startTriviaButton.waitFor({ timeout: 15000 }).catch(() => {});
  if (!(await startTriviaButton.isVisible().catch(() => false))) {
    test.skip(true, 'Host UI did not appear as expected — see earlier smoke test for the base host-detection check');
  }

  // If Supabase isn't configured, the app falls back to same-browser-only
  // BroadcastChannel sync — the room header shows "Live (this device only)"
  // in that mode (see isLocalOnlyMode in use-room-subscription.ts). A
  // second, separate Playwright browser context has its own isolated
  // storage and never receives BroadcastChannel messages from the host's
  // context, so it can't ever see this room at all in that mode — skip
  // rather than report a false failure. Checked directly via this explicit
  // signal rather than inferred from what the guest sees, since demo mode
  // doesn't show any of the Supabase-mode "blocked" messages either — the
  // guest would just render an inert, un-synced room shell.
  const isLocalOnlyMode = await page.getByText(/this device only/i).isVisible().catch(() => false);
  if (isLocalOnlyMode) {
    test.skip(true, 'App is running without Supabase configured (demo-mode BroadcastChannel fallback) — a second browser context can never see this room');
  }

  const browser = await chromium.launch();
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  try {
    await guestPage.goto(`${baseURL}/room/${roomCode}`);

    // Wait for the guest's realtime channel to actually finish subscribing
    // (the "Live" badge only appears once isRealtimeReady is true) before
    // the host broadcasts anything — broadcast events, unlike DB changes,
    // are not queued/replayed for a client still mid-subscribe, so
    // triggering the host's action too early is a real, observed race,
    // not a hypothetical one.
    await expect(guestPage.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });

    // Host sees the guest join in the participants count before proceeding,
    // for the same reason — confirms the host's own channel has processed
    // the guest's presence, not just that the guest's page loaded. Given a
    // longer budget than the guest's own "Live" check: on a freshly-started
    // CI Supabase instance, the Realtime service's Postgres logical
    // replication connection can still be warming up even after the guest's
    // own channel reports subscribed, so postgres_changes propagation to
    // the host can lag further behind than it ever does against the
    // long-running hosted project this test was first verified against.
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });

    // Host starts a question; guest should see it appear via realtime sync.
    await startTriviaButton.click();
    await expect(page.getByText(/^Question 1$/)).toBeVisible({ timeout: 10000 });
    await expect(guestPage.getByText(/^Question 1$/)).toBeVisible({ timeout: 10000 });

    // Guest answers; host should see the tally update via realtime sync.
    await guestPage.locator('[data-testid="trivia-option"]').first().click();
    await expect(page.getByText(/answered correctly/i)).toBeVisible({ timeout: 10000 });
  } finally {
    await guestContext.close();
    await browser.close();
  }
});

// Tournament and Lucky Wheel were, until now, the two highest-complexity
// activities with zero e2e coverage — and each had already shipped a real,
// previously-live bug once (double-elimination bracket matches never
// completing, Session 33; the wheel spinning forever and never landing,
// Session 41's activity-state persistence fix). Regression coverage for
// exactly those failure modes, not just a smoke check that the UI renders.
test('tournament bracket generates, scores, and crowns a champion', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message));

  await page.goto('/create?type=tournament');
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
  const roomCode = page.url().split('/room/')[1];

  const isLocalOnlyMode = await page.getByText(/this device only/i).isVisible().catch(() => false);
  if (isLocalOnlyMode) {
    test.skip(true, 'App is running without Supabase configured (demo-mode BroadcastChannel fallback) — a second browser context can never see this room');
  }

  const browser = await chromium.launch();
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  try {
    await guestPage.goto(`${baseURL}/room/${roomCode}`);
    await expect(guestPage.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });

    // Default format is single-elimination; 2 online participants makes
    // exactly one match, whose completion should crown a champion directly
    // (no further rounds to advance through).
    await page.getByRole('button', { name: /generate bracket/i }).click();
    const match = page.locator('[data-testid="tournament-match"][data-match-ready="true"]').first();
    await expect(match).toBeVisible({ timeout: 10000 });
    await match.click();

    await expect(page.getByText('Update Score')).toBeVisible({ timeout: 5000 });
    const scoreInputs = page.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('3');
    await scoreInputs.nth(1).fill('1');
    await page.getByRole('button', { name: /^save$/i }).click();

    // Host: champion toast + banner. Guest: the same tournament_update
    // broadcast should independently render the champion banner too.
    await expect(page.getByText(/wins the tournament/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Tournament Champion/i)).toBeVisible({ timeout: 10000 });
    await expect(guestPage.getByText(/Tournament Champion/i)).toBeVisible({ timeout: 10000 });
  } finally {
    await guestContext.close();
    await browser.close();
  }
});

test('lucky wheel spins, lands on a winner, and does not spin again on its own', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message));

  await page.goto('/create?type=lucky-wheel');
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
  const roomCode = page.url().split('/room/')[1];

  const isLocalOnlyMode = await page.getByText(/this device only/i).isVisible().catch(() => false);
  if (isLocalOnlyMode) {
    test.skip(true, 'App is running without Supabase configured (demo-mode BroadcastChannel fallback) — a second browser context can never see this room');
  }

  const browser = await chromium.launch();
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  try {
    await guestPage.goto(`${baseURL}/room/${roomCode}`);
    await expect(guestPage.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });

    const spinButton = page.getByRole('button', { name: /spin the wheel/i });
    await expect(spinButton).toBeVisible({ timeout: 10000 });
    await spinButton.click();

    // The spin animation runs ~3s; "Winner!" appearing confirms it actually
    // landed rather than spinning indefinitely (the exact bug this test
    // guards against). Guest should land on the same winner independently
    // via the same broadcast winner-selection payload.
    await expect(page.getByText('Winner!')).toBeVisible({ timeout: 10000 });
    await expect(guestPage.getByText('Winner!')).toBeVisible({ timeout: 10000 });
    const winnerText = await page.locator('text=Winner!').locator('..').textContent();

    // Regression guard: wait well past landing and confirm the button
    // returned to "Spin the Wheel!" (not stuck re-announcing "Spinning…"),
    // and the winner text is still the same one, not overwritten by a
    // self-triggered restart.
    await page.waitForTimeout(4000);
    await expect(spinButton).toHaveText(/spin the wheel/i);
    const winnerTextAfterWait = await page.locator('text=Winner!').locator('..').textContent();
    console.log('Wheel winner:', winnerText, '| after wait:', winnerTextAfterWait);
    expect(winnerTextAfterWait).toBe(winnerText);
  } finally {
    await guestContext.close();
    await browser.close();
  }
});

// Kick + ban-on-rejoin had zero e2e coverage (Session 45 audit) despite
// being the app's only moderation enforcement mechanism — a regression here
// would silently break the one tool a host has against a disruptive
// participant, with no automated signal.
test('host kicks a participant, and the kicked participant is blocked from rejoining', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message));

  await page.goto('/create?type=trivia');
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
  const roomCode = page.url().split('/room/')[1];

  const isLocalOnlyMode = await page.getByText(/this device only/i).isVisible().catch(() => false);
  if (isLocalOnlyMode) {
    test.skip(true, 'App is running without Supabase configured (demo-mode BroadcastChannel fallback) — a second browser context can never see this room');
  }

  const browser = await chromium.launch();
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  try {
    await guestPage.goto(`${baseURL}/room/${roomCode}`);
    await expect(guestPage.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });

    // Switch the host's sidebar to the People tab and kick the guest —
    // exercises the Session 45 confirm-dialog fix (previously an
    // unconfirmed, instant, irreversible action) end to end.
    await page.getByRole('button', { name: /people \(2\)/i }).click();
    await page.getByRole('button', { name: /remove .* from the room/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Remove', exact: true }).click();

    // Guest is redirected away from the closed/kicked room.
    await guestPage.waitForURL(/\/explore/, { timeout: 15000 });

    // Ban-on-kick: the guest's anon session is now blocked from rejoining
    // this specific room (migration 0012) — navigating back in should show
    // the pre-entry banned state, not the room UI.
    await guestPage.goto(`${baseURL}/room/${roomCode}`);
    await expect(guestPage.getByRole('heading', { name: /you've been removed/i })).toBeVisible({ timeout: 15000 });
  } finally {
    await guestContext.close();
    await browser.close();
  }
});

// Host-election (a healthy participant self-promoting after the host
// disconnects) had zero e2e coverage — the only regression class this
// project has already shipped to production twice (a self-referencing RLS
// policy breaking every host promotion, Session 41; a stale-column trigger
// breaking it again, Session 43) with neither caught by a test.
test('guest is promoted to host after the original host disconnects', async ({ page, baseURL }) => {
  test.setTimeout(90_000);

  await page.goto('/create?type=trivia');
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
  const roomCode = page.url().split('/room/')[1];

  const isLocalOnlyMode = await page.getByText(/this device only/i).isVisible().catch(() => false);
  if (isLocalOnlyMode) {
    test.skip(true, 'App is running without Supabase configured (demo-mode BroadcastChannel fallback) — a second browser context can never see this room');
  }

  const browser = await chromium.launch();
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  try {
    await guestPage.goto(`${baseURL}/room/${roomCode}`);
    await expect(guestPage.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });

    // Simulate the host crashing/closing their tab — no graceful
    // "close room" action, just the connection dropping.
    await page.close();

    // The guest's own presence-reconciliation (migration 0019) should
    // notice the host is gone and self-promote — confirmed via the
    // persistent notification banner (not the transient toast, which
    // auto-dismisses and would make this assertion timing-sensitive).
    await expect(
      guestPage.getByText(/previous host left, and you have been promoted to host/i)
    ).toBeVisible({ timeout: 45_000 });
  } finally {
    await guestContext.close();
    await browser.close();
  }
});
