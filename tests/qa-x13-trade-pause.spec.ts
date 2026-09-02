import { test, expect, chromium, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:4000';
// A fire-and-forget accept() (count() then maybe-click, silently caught) is
// enough for other specs in this suite, whose actionable elements sit clear
// of the viewport's bottom edge. This test's trade panel does not — its
// "Send offer" button can render close enough to the fixed-position cookie
// banner that a not-yet-dismissed banner genuinely intercepts the click
// (confirmed directly: Playwright's own actionability retry log named the
// cookie-notice region as the intercepting element). Wait for the banner
// and confirm it's actually gone, rather than a zero-wait best-effort.
const accept = async (p: Page) => {
  const b = p.getByRole('button', { name: /^accept$/i });
  await b.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await b.count()) await b.first().click().catch(() => {});
  await p
    .getByRole('region', { name: /cookie notice/i })
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
};

// BUG-007 round F (FR-33/FR-43): a real cash-only trade proposed and
// accepted through the actual UI, confirming city_propose_trade and
// city_accept_trade still work correctly end-to-end after this round's
// pause/queue additions — the exact mechanics (pause timing, the 90s
// budget, the 45s escape hatch, queued-offer refusal) are already proven
// directly at the SQL level; this is the live-client confirmation that the
// trade panel itself still renders and works.
test('city: a real trade proposal is visible and can be accepted live', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto(`${BASE}/create?type=city`);
  await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
  const code = host.url().split('/room/')[1];
  // Slow (60s) pace, not the 40s default — this test fills in a trade form
  // by hand, and the default pace has been observed to legitimately expire
  // mid-test via the same auto-claim mechanism a real slow-but-present
  // player would also trigger (correct, pre-existing behavior, not a bug
  // in the trade-pause work this test is actually checking).
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

  // Host proposes a small cash-only offer to the guest.
  await host.getByRole('button', { name: /propose a trade/i }).click();
  await host.getByTestId('trade-partner').first().click();
  const giveCashInput = host.locator('[data-testid="trade-panel"] input[type="number"]').first();
  await giveCashInput.fill('10');
  await host.getByRole('button', { name: /send offer/i }).click();

  // The proposer sees it as outgoing ("waiting on").
  await expect(host.getByText(/waiting on/i)).toBeVisible({ timeout: 15000 });

  // The recipient sees it live (realtime, no reload) and can accept it.
  await expect(guest.getByRole('button', { name: /^accept$/i }).last()).toBeVisible({ timeout: 15000 });
  await guest.getByRole('button', { name: /^accept$/i }).last().click();

  // Both sides settle back to no pending offers once accepted.
  await expect(host.getByText(/waiting on/i)).toHaveCount(0, { timeout: 15000 });

  await browser.close();
});
