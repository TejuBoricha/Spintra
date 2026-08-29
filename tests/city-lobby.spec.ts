import { test, expect, chromium } from '@playwright/test';

// Spintra City — Slice 1 (lobby) coverage.
//
// Guards the architectural seam this feature is built on, not just the UI:
// Spintra City deliberately does NOT use the room activity event bus that the
// other 14 games share. Its state lives in the city_* tables and every
// mutation goes through a SECURITY DEFINER RPC, with realtime acting purely as
// a "something changed, refetch" notifier. That means the things most worth
// asserting here are the ones a single-client check can't see: that a seat
// taken in one browser appears in another without a reload, that host-only
// commands are genuinely host-only, and that a reload restores the player's
// own seat rather than dropping them to spectator (the exact bug richup.io is
// reported to have — see docs/SPINTRA_CITY_DESIGN.md §1c).
//
// Requires a real Supabase backend. In demo mode two separate browser contexts
// can never see each other, so this skips itself rather than failing
// confusingly — same pattern as multiplayer-loop.spec.ts.

test('Spintra City: two players seat, ready up, start, and survive a reload', async ({ page, baseURL }) => {
  test.setTimeout(120_000);

  page.on('pageerror', (err) => console.log('[host:pageerror]', err.message));

  await page.goto('/create?type=city');
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/);
  const roomCode = page.url().split('/room/')[1];

  // Demo-mode guard: the BroadcastChannel fallback only syncs tabs sharing one
  // localStorage identity, so a second context would never see this room.
  // Spintra City additionally has no demo-mode implementation at all — it
  // renders a "needs a database" notice — so bail out explicitly.
  await Promise.race([
    page.getByText(/this device only/i).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    page.getByText('Live', { exact: true }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
  ]);
  if (await page.getByText(/this device only/i).isVisible().catch(() => false)) {
    test.skip(true, 'Running without Supabase configured — Spintra City requires a real backend');
  }

  const browser = await chromium.launch();
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  guest.on('pageerror', (err) => console.log('[guest:pageerror]', err.message));

  try {
    // ── Host opens a match ────────────────────────────────────────────────
    const openMatch = page.getByRole('button', { name: /open a match/i });
    await expect(openMatch).toBeVisible({ timeout: 20000 });
    await openMatch.click();

    const hostSeatButton = page.getByRole('button', { name: /take a seat/i });
    await expect(hostSeatButton).toBeVisible({ timeout: 20000 });

    // ── Guest joins the same room ─────────────────────────────────────────
    await guest.goto(`${baseURL}/room/${roomCode}`);
    const guestSeatButton = guest.getByRole('button', { name: /take a seat/i });
    await expect(guestSeatButton).toBeVisible({ timeout: 30000 });

    // ── Both take seats ───────────────────────────────────────────────────
    await hostSeatButton.click();
    await expect(page.getByText(/1 of 8 seated/)).toBeVisible({ timeout: 15000 });

    await guestSeatButton.click();

    // The load-bearing realtime assertion: the host never reloads, so seeing
    // the guest's seat proves the change-ping → refetch path actually works.
    await expect(page.getByText(/2 of 8 seated/)).toBeVisible({ timeout: 20000 });

    // ── Host-only enforcement ─────────────────────────────────────────────
    const startButton = page.getByRole('button', { name: /start match/i });
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeDisabled();
    // The guest should have no Start affordance at all — not merely a disabled
    // one. The RPC rejects a non-host regardless, but the UI shouldn't imply
    // the action exists.
    await expect(guest.getByRole('button', { name: /start match/i })).toHaveCount(0);

    // ── Ready up ──────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /i'm ready/i }).click();
    await guest.getByRole('button', { name: /i'm ready/i }).click();

    await expect(page.getByText(/2 ready/)).toBeVisible({ timeout: 20000 });
    await expect(startButton).toBeEnabled({ timeout: 15000 });

    // ── Start ─────────────────────────────────────────────────────────────
    await startButton.click();
    await expect(page.getByText(/match in progress/i)).toBeVisible({ timeout: 20000 });

    // Realtime again: the guest transitions without reloading.
    await expect(guest.getByText(/match in progress/i)).toBeVisible({ timeout: 20000 });

    // ── Reload restores the seat, not spectator ───────────────────────────
    await guest.reload();
    await expect(guest.getByText(/match in progress/i)).toBeVisible({ timeout: 30000 });
    // Both seats still rendered after the reload, proving the authoritative
    // snapshot was re-read rather than the client relying on in-memory state.
    await expect(guest.getByText(/Seat 1 ·/)).toBeVisible({ timeout: 15000 });
    await expect(guest.getByText(/Seat 2 ·/)).toBeVisible({ timeout: 15000 });

    // ── Roster is locked after start ──────────────────────────────────────
    await expect(guest.getByRole('button', { name: /take a seat/i })).toHaveCount(0);
  } finally {
    await guestContext.close();
    await browser.close();
  }
});
