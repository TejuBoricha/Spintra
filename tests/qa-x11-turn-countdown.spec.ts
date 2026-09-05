import { test, expect, chromium, type Page } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://127.0.0.1:4000';
const sql = (q: string) =>
  execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
const accept = async (p: Page) => {
  const b = p.getByRole('button', { name: /^accept$/i });
  if (await b.count()) await b.first().click().catch(() => {});
};

// BUG-006: a visible, ticking countdown now exists for the running turn
// clock, matching city_claim_timeout's own deadline exactly.
test('city: a live turn countdown is visible and actually ticks down', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch();
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto(`${BASE}/create?type=city`);
  await accept(host);
  await host.locator('[data-testid="create-room-button-client"]').click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 40000 });
  const code = host.url().split('/room/')[1];
  await host.getByRole('button', { name: /open a match/i }).click({ timeout: 40000 });
  await host.getByRole('button', { name: /take a seat/i }).click({ timeout: 30000 });
  await guest.goto(`${BASE}/room/${code}`);
  await accept(guest);
  await guest.getByRole('button', { name: /take a seat/i }).click({ timeout: 40000 });
  for (const p of [host, guest]) await p.getByRole('button', { name: /ready/i }).first().click({ timeout: 20000 }).catch(() => {});
  await host.getByRole('button', { name: /start match/i }).click({ timeout: 25000 });
  await host.waitForTimeout(2000);

  const mid = sql(`select id from city_matches where room_code='${code}' and status='active'`);
  // Backdate the clock so the countdown starts at a known, small value.
  sql(`update city_matches set turn_started_at = now() - interval '35 seconds', pace_seconds = 40 where id='${mid}'`);
  await host.reload();
  await accept(host);
  await host.waitForTimeout(1000);

  const timer = host.getByRole('timer');
  await expect(timer).toBeVisible({ timeout: 10000 });
  const first = await timer.textContent();
  console.log('BUG-006 countdown reading (expect ~0:05):', first);
  expect(first).toMatch(/^0:0[0-9]$/);

  const toSeconds = (t: string | null) => {
    const [m, s] = (t ?? '0:00').split(':').map(Number);
    return m * 60 + s;
  };

  await host.waitForTimeout(2200);
  const second = await timer.textContent();
  console.log('BUG-006 countdown reading ~2s later (must be lower):', second);
  expect(toSeconds(second)).toBeLessThan(toSeconds(first));

  await browser.close();
});
