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
  // The status badge starts as "Connecting..." and only resolves to "Live"
  // or "Live (this device only)" once isRealtimeReady flips — a bare
  // isVisible() check right after waitForURL races that transition and can
  // read false before the badge has settled. Wait for either final state
  // (bounded, since "this device only" never appears in real-Supabase mode)
  // before reading which one actually showed up.
  await Promise.race([
    page.getByText(/this device only/i).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    page.getByText('Live', { exact: true }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
  ]);
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

  // The status badge starts as "Connecting..." and only resolves to "Live"
  // or "Live (this device only)" once isRealtimeReady flips — a bare
  // isVisible() check right after waitForURL races that transition and can
  // read false before the badge has settled. Wait for either final state
  // (bounded, since "this device only" never appears in real-Supabase mode)
  // before reading which one actually showed up.
  await Promise.race([
    page.getByText(/this device only/i).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    page.getByText('Live', { exact: true }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
  ]);
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

  // The status badge starts as "Connecting..." and only resolves to "Live"
  // or "Live (this device only)" once isRealtimeReady flips — a bare
  // isVisible() check right after waitForURL races that transition and can
  // read false before the badge has settled. Wait for either final state
  // (bounded, since "this device only" never appears in real-Supabase mode)
  // before reading which one actually showed up.
  await Promise.race([
    page.getByText(/this device only/i).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    page.getByText('Live', { exact: true }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
  ]);
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

  // The status badge starts as "Connecting..." and only resolves to "Live"
  // or "Live (this device only)" once isRealtimeReady flips — a bare
  // isVisible() check right after waitForURL races that transition and can
  // read false before the badge has settled. Wait for either final state
  // (bounded, since "this device only" never appears in real-Supabase mode)
  // before reading which one actually showed up.
  await Promise.race([
    page.getByText(/this device only/i).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    page.getByText('Live', { exact: true }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
  ]);
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

  // The status badge starts as "Connecting..." and only resolves to "Live"
  // or "Live (this device only)" once isRealtimeReady flips — a bare
  // isVisible() check right after waitForURL races that transition and can
  // read false before the badge has settled. Wait for either final state
  // (bounded, since "this device only" never appears in real-Supabase mode)
  // before reading which one actually showed up.
  await Promise.race([
    page.getByText(/this device only/i).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    page.getByText('Live', { exact: true }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
  ]);
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

// Reconnect (the same identity rejoining the same room, e.g. a page
// refresh) had zero e2e coverage — exercises trackSelf's existing-
// participant branch (an UPDATE, not an INSERT, so it must not double-count
// against room capacity) and the activity-state replay path that recovers
// in-progress game state after a full remount.
test('same participant reconnecting sees no duplicate row and recovers in-progress state', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
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

  await Promise.race([
    page.getByText(/this device only/i).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    page.getByText('Live', { exact: true }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
  ]);
  const isLocalOnlyMode = await page.getByText(/this device only/i).isVisible().catch(() => false);
  if (isLocalOnlyMode) {
    test.skip(true, 'App is running without Supabase configured (demo-mode BroadcastChannel fallback) — a second browser context can never see this room');
  }

  const browser = await chromium.launch();
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  try {
    await startTriviaButton.click();
    await expect(page.getByText(/^Question 1$/)).toBeVisible({ timeout: 10000 });
    // The activity-state persist debounces 600ms (use-room-subscription.ts)
    // before the question is actually written to room_activity_state — the
    // guest below only ever sees it via that persisted-row replay (they
    // weren't subscribed yet to catch the original broadcast), so joining
    // before the debounce flushes would race a write that hasn't happened.
    await page.waitForTimeout(1000);

    await guestPage.goto(`${baseURL}/room/${roomCode}`);
    await expect(guestPage.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });
    // Establish the baseline before reload: activity-state replay already
    // works on a fresh join, so a failure to see this after reload below is
    // specifically a reconnect-path issue, not a general replay issue.
    await expect(guestPage.getByText(/^Question 1$/)).toBeVisible({ timeout: 10000 });

    // Reconnect as the SAME identity — reusing this context's storage
    // (anon-auth session), not minting a new browser context, which would
    // create a fresh identity and defeat the point of this test entirely.
    await guestPage.reload();

    // Guest reaches Live again — not stuck on Connecting…, not shown a
    // removed/locked/full screen.
    await expect(guestPage.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });

    // Host still shows exactly 2, not 3 — proves the reconnect resolved via
    // an UPDATE of the existing room_participants row (trackSelf's
    // existingParticipant branch), not a duplicate INSERT.
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 15000 });

    // In-progress activity state survived the full remount via the
    // persisted event-log replay path, not just the initial join.
    await expect(guestPage.getByText(/^Question 1$/)).toBeVisible({ timeout: 10000 });

    // Functional confirmation the reconnected session is fully live, not
    // just visually settled.
    await guestPage.locator('[data-testid="trivia-option"]').first().click();
    await expect(page.getByText(/answered correctly/i)).toBeVisible({ timeout: 10000 });
  } finally {
    await guestContext.close();
    await browser.close();
  }
});

// Presence reconciliation's normal (non-crash) path had zero e2e coverage —
// only the crash-detection branch is exercised by the host-election test
// above. A third participant joining after the first two have already
// settled is the most direct way to hit the handler's crashed.length === 0
// branch (nobody previously known-online is missing from the new sync),
// and that same participant's later clean departure exercises the
// crashed.length > 0 branch for a NON-host — distinct from the host-crash
// scenario, since nobody should ever be promoted when the host never left.
test('presence reconciliation settles cleanly as a third participant joins and leaves', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message));

  await page.goto('/create?type=trivia');
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
  const roomCode = page.url().split('/room/')[1];

  await Promise.race([
    page.getByText(/this device only/i).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    page.getByText('Live', { exact: true }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
  ]);
  const isLocalOnlyMode = await page.getByText(/this device only/i).isVisible().catch(() => false);
  if (isLocalOnlyMode) {
    test.skip(true, 'App is running without Supabase configured (demo-mode BroadcastChannel fallback) — a second browser context can never see this room');
  }

  const browser = await chromium.launch();
  const guestContext1 = await browser.newContext();
  const guestPage1 = await guestContext1.newPage();
  const guestContext2 = await browser.newContext();
  const guestPage2 = await guestContext2.newPage();

  try {
    await guestPage1.goto(`${baseURL}/room/${roomCode}`);
    await expect(guestPage1.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });

    // This join's presence sync only ADDS a participant nobody previously
    // saw as missing — necessarily exercises the reconciliation handler's
    // crashed.length === 0 branch on both the host's and guestPage1's
    // channels (no is_online write should fire for this sync).
    await guestPage2.goto(`${baseURL}/room/${roomCode}`);
    await expect(guestPage2.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/People \(3\)/)).toBeVisible({ timeout: 30000 });
    await expect(guestPage1.getByText(/People \(3\)/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/promoted to host/i)).not.toBeVisible();
    await expect(guestPage1.getByText(/promoted to host/i)).not.toBeVisible();

    // People (N) counts every participant ROW ever created for the room,
    // not just currently-online ones (a disconnected row is marked
    // is_online: false, never deleted — see migration 0026's header) — it
    // does not decrease on a clean departure, only a kick/removal. Open the
    // People list and read the per-row "• Online"/"• Offline" status text
    // instead, which is what actually reflects presence reconciliation.
    await page.getByRole('button', { name: /people \(3\)/i }).click();
    await expect(page.getByText(/• Online/)).toHaveCount(2, { timeout: 15000 });

    // Non-host, clean departure — no page.close() crash simulation, just a
    // context closing normally.
    await guestContext2.close();

    // Proves the crashed.length > 0 reconciliation write correctly fires
    // for a non-host's stale row: their row is still listed (People (3)
    // never changes) but now shown offline, while the host and guest1
    // remain online.
    await expect(page.getByText(/• Offline/)).toHaveCount(1, { timeout: 30000 });
    await expect(page.getByText(/• Online/)).toHaveCount(1);
    await expect(page.getByText(/People \(3\)/)).toBeVisible();

    // The key assertion distinguishing this from the host-crash test above:
    // the host never left, so no promotion should ever be considered,
    // regardless of how another participant's presence churns.
    await expect(page.getByText(/promoted to host/i)).not.toBeVisible();
    await expect(guestPage1.getByText(/promoted to host/i)).not.toBeVisible();
  } finally {
    await guestContext1.close();
    await browser.close();
  }
});

// Room Settings Panel (ADR-007) had zero e2e coverage on introduction. A host
// editing name/capacity after creation writes discrete `rooms` columns that
// the existing rooms-UPDATE realtime handler is supposed to fan out to every
// client — this asserts that propagation end to end (the whole point of the
// feature), and that capacity is bounded to the DB-enforced ceiling (migration
// 0049, CHECK 2..50).
test('host edits room name and capacity, and a guest sees both changes live', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message));

  await page.goto('/create?type=trivia');
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
  const roomCode = page.url().split('/room/')[1];

  await Promise.race([
    page.getByText(/this device only/i).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    page.getByText('Live', { exact: true }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
  ]);
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

    // Open the host-only settings panel and edit two fields in one save.
    await page.getByRole('button', { name: /room settings/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // The panel loads the room's current values (name/is_public/capacity) from
    // the DB on open and keeps the fields disabled until that read resolves —
    // wait for the name field to become editable before interacting.
    await expect(page.getByLabel('Room name')).toBeEnabled({ timeout: 10000 });
    await page.getByLabel('Room name').fill('Renamed By Host');

    // Raise capacity to the ceiling via the slider's End key (Radix maps End
    // to max) — deterministic, unlike a pixel drag. The DB CHECK from 0049
    // caps this at 50, so this also confirms the ceiling round-trips.
    const slider = page.getByRole('slider');
    await slider.focus();
    await slider.press('End');
    await expect(page.getByText('50 people')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('Room settings updated.')).toBeVisible({ timeout: 10000 });

    // Both changes propagate to the host's own header and — the real point —
    // to the guest, purely via the rooms-UPDATE realtime handler.
    await expect(page.getByRole('heading', { name: 'Renamed By Host' })).toBeVisible({ timeout: 10000 });
    await expect(guestPage.getByRole('heading', { name: 'Renamed By Host' })).toBeVisible({ timeout: 15000 });
    await expect(guestPage.getByText(/\/\s*50\s*online/)).toBeVisible({ timeout: 15000 });
  } finally {
    await guestContext.close();
    await browser.close();
  }
});
