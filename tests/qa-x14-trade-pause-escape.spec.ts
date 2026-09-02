import { test, expect, chromium, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:4000';
// Same rationale as qa-x13's own accept() — a bare best-effort dismissal is
// not reliable for a trade panel that can render close to the viewport's
// bottom edge.
const accept = async (p: Page) => {
  const b = p.getByRole('button', { name: /^accept$/i });
  await b.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await b.count()) await b.first().click().catch(() => {});
  await p
    .getByRole('region', { name: /cookie notice/i })
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
};

// BUG-007 round H: this specific scenario (a trade proposed to an
// unresponsive partner) was the whole reason the server-side 45s escape
// hatch exists (rounds F/G) -- but the client's only caller of
// city_claim_timeout unconditionally skipped calling it whenever the turn
// clock was paused, which a trade pause always sets. That made the escape
// hatch dead code no real client could ever reach. This test proves the
// fix: propose a trade, have the recipient simply never respond, and
// confirm the proposer's own client eventually clears the stale offer and
// resumes on its own -- no click from either side.
test('city: an unanswered trade proposal is force-withdrawn after 45s, with no click from either side', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto(`${BASE}/create?type=city`);
  await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
  const code = host.url().split('/room/')[1];
  // Slow (60s) pace -- well clear of the 45s escape hatch, so the ordinary
  // per-turn clock can't race it and fire first.
  await host.getByRole('radio', { name: /slow/i }).click();
  await host.getByRole('button', { name: /open a match/i }).click({ timeout: 40000 });
  await host.getByRole('button', { name: /take a seat/i }).click({ timeout: 30000 });
  await guest.goto(`${BASE}/room/${code}`);
  await accept(guest);
  await guest.getByRole('button', { name: /take a seat/i }).click({ timeout: 40000 });
  for (const p of [host, guest]) {
    await p.getByRole('button', { name: /ready/i }).first().click({ timeout: 20000 }).catch(() => {});
  }
  await host.getByRole('button', { name: /start match/i }).click({ timeout: 25000 });
  await host.waitForTimeout(1500);

  await host.getByRole('button', { name: /propose a trade/i }).click();
  await host.getByTestId('trade-partner').first().click();
  const giveCashInput = host.locator('[data-testid="trade-panel"] input[type="number"]').first();
  await giveCashInput.fill('10');
  await host.getByRole('button', { name: /send offer/i }).click();

  await expect(host.getByText(/waiting on/i)).toBeVisible({ timeout: 15000 });

  // The guest never touches Accept/Decline. Wait past the 45s window (plus
  // slack for the client's own setTimeout and a refetch round trip).
  await host.waitForTimeout(50_000);

  await expect(host.getByText(/waiting on/i)).toHaveCount(0, { timeout: 15000 });

  await browser.close();
});
