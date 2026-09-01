import { test, expect, chromium, type Page } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://127.0.0.1:4020';
const sql = (q: string) =>
  execSync(`docker exec supabase_db_Spintra-1 psql -U postgres -d postgres -t -A -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
const accept = async (p: Page) => {
  const b = p.getByRole('button', { name: /^accept$/i });
  if (await b.count()) await b.first().click().catch(() => {});
};

test('site-wide: nav does not overflow its container at 768x1024', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(800);
  const overflow = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return null;
    const panel = nav.firstElementChild as HTMLElement | null;
    const row = panel?.firstElementChild as HTMLElement | null;
    return {
      panelOverflow: panel ? panel.scrollWidth - panel.clientWidth : null,
      rowOverflow: row ? row.scrollWidth - row.clientWidth : null,
    };
  });
  console.log('BUG-041 nav overflow at 768x1024:', JSON.stringify(overflow));
  expect(overflow?.panelOverflow ?? 0).toBeLessThanOrEqual(1);
});

test('site-wide: footer links meet a 24px tap target', async ({ page }) => {
  await page.goto(`${BASE}/`);
  const heights = await page.evaluate(() =>
    Array.from(document.querySelectorAll('footer a')).map((a) => ({
      text: a.textContent,
      height: a.getBoundingClientRect().height,
    }))
  );
  console.log('BUG-043 footer link heights:', JSON.stringify(heights));
  for (const h of heights) expect(h.height).toBeGreaterThanOrEqual(24);
});

// 390px (a real phone) was never the problem — left-4/right-4 alone already
// gives a reasonably compact box there. The audit's repro width is exactly
// the range below sm: (640px) where the banner previously had NO max-width
// at all and stretched edge-to-edge minus 2rem, e.g. 736px wide at 768px —
// wide enough to plausibly sit over a bottom-anchored game control.
test('site-wide: cookie banner does not span full width at tablet-ish sizes', async ({ page, context }) => {
  await context.clearCookies();
  // Just below the sm: breakpoint (640px) — sm:max-w-md already handled
  // anything at or above it, even before this fix.
  await page.setViewportSize({ width: 600, height: 1000 });
  await page.addInitScript(() => window.localStorage.removeItem('spintra-cookie-consent'));
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1200);
  const box = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Cookie notice"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { width: r.width, viewportWidth: window.innerWidth, right: r.right };
  });
  console.log('BUG-040 cookie banner box at 600px:', JSON.stringify(box));
  if (box) {
    expect(box.width).toBeLessThan(400);
    // hugs the right edge rather than being centered/left-anchored
    expect(box.right).toBeGreaterThan(box.viewportWidth - 32);
  }
});

// City: status text, cross-client narration, tooltips, all in one live match.
test('city: status text and off-turn narration are correct through a real turn', async () => {
  test.setTimeout(180_000);
  const br = await chromium.launch();
  const host = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const guest = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

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

  // Force a deterministic scenario: host (seat 0) about to land on a rent
  // space owned by the guest (seat 1), well clear of Departure.
  sql(`delete from city_assets where match_id='${mid}'`);
  sql(`insert into city_assets(match_id,space_idx,owner_seat,buildings,is_mortgaged) values ('${mid}',26,1,0,false)`);
  sql(`update city_match_players set position=20, cash=1000 where match_id='${mid}' and seat=0`);
  sql(`update city_match_players set cash=1000 where match_id='${mid}' and seat=1`);
  sql(`update city_matches set current_seat=0, phase='awaiting_roll' where id='${mid}'`);
  await host.reload();
  await guest.reload();
  await host.waitForTimeout(1000);
  await guest.waitForTimeout(1000);

  // BUG-034 (part 1): it's the host's turn, awaiting_roll -> "roll the dice".
  await expect(host.getByRole('status').filter({ hasText: /roll the dice/i })).toBeVisible({ timeout: 10000 });

  await host.getByRole('button', { name: /^roll dice$/i }).click();
  await host.waitForTimeout(2500);

  // BUG-035: the OFF-TURN guest must see the roll narration too, not just
  // "Waiting for X" — this is the whole point of the fix.
  const guestStatus = await guest.getByRole('status').last().textContent();
  console.log('BUG-035 guest status text after host rolls:', guestStatus);
  expect(guestStatus).toMatch(/rolled/i);
  expect(guestStatus).not.toMatch(/^waiting for/i);

  // BUG-034 (part 2): host is now past awaiting_roll (optional_actions or
  // required_decision) — refresh to drop the local lastRoll state entirely
  // and confirm the status text still reflects the server phase, not a
  // stale "roll the dice" fallback.
  await host.reload();
  await host.waitForTimeout(1500);
  await accept(host);
  const hostStatusAfterRefresh = await host.getByRole('status').last().textContent();
  console.log('BUG-034 host status text after refresh, post-roll:', hostStatusAfterRefresh);
  expect(hostStatusAfterRefresh).not.toMatch(/roll the dice/i);

  await br.close();
});
