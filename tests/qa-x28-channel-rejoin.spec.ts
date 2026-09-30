import { test, expect, type Page } from '@playwright/test';
import { acceptCookieBanner, skipIfDemoMode, BASE } from './qa-city-helpers';

// Audit L-1: when the realtime server closes a room's channel (it does this to a
// whole room when a burst of messages goes over its limits) the page only changed
// its banner to "Trying to reconnect..." and never joined again, so a normal game
// round could leave every student deaf until they refreshed. The realtime client
// re-joins a channel after a connection error by itself, but not one the server
// closed on purpose; the page has to join again itself.
//
// The server's close is sent to the page over the real realtime socket (a Phoenix
// `phx_close` frame carrying the channel's current join ref), so this exercises
// the real client, not a stub.

type Frame = [string | null, string | null, string, string, unknown];

async function watchRealtime(page: Page) {
  const joins: Record<string, number> = {};
  const joinRefs: Record<string, string> = {};
  let toPage: ((data: string) => void) | null = null;

  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    const server = ws.connectToServer();
    toPage = (data) => ws.send(data);
    ws.onMessage((message) => {
      if (typeof message === 'string') {
        try {
          const [joinRef, , topic, event] = JSON.parse(message) as Frame;
          if (event === 'phx_join') {
            joins[topic] = (joins[topic] ?? 0) + 1;
            if (joinRef) joinRefs[topic] = joinRef;
          }
        } catch {
          /* not a JSON frame */
        }
      }
      server.send(message);
    });
    server.onMessage((message) => ws.send(message));
  });

  return {
    joins,
    /** What the server does when it closes one channel on purpose. */
    closeChannel: (topic: string) => {
      if (!toPage) throw new Error('no realtime socket yet');
      const joinRef = joinRefs[topic];
      if (!joinRef) throw new Error(`never joined ${topic}`);
      toPage(JSON.stringify([joinRef, null, topic, 'phx_close', {}]));
    },
  };
}

async function openTriviaRoom(page: Page): Promise<string> {
  await page.goto(`${BASE}/create?type=trivia`);
  await acceptCookieBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  await skipIfDemoMode(page);
  return page.url().split('/room/')[1].split(/[?#]/)[0];
}

for (const suffix of ['', ':events']) {
  test(`the page joins again after the server closes the room's ${suffix ? 'game event' : 'main'} channel`, async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await (await browser.newContext()).newPage();
    const rt = await watchRealtime(page);
    const code = await openTriviaRoom(page);
    const topic = `realtime:room:${code}${suffix}`;

    await expect.poll(() => rt.joins[topic] ?? 0, { timeout: 30000 }).toBe(1);
    // Let the first join settle, then have the server close the channel.
    await page.waitForTimeout(1500);
    rt.closeChannel(topic);

    await expect.poll(() => rt.joins[topic] ?? 0, { timeout: 30000 }).toBeGreaterThanOrEqual(2);
    // Back to normal: no lingering failure or "trying to reconnect" notice.
    await expect(
      page.getByRole('status').filter({ hasText: /realtime (connection lost|subscription failed)|still having trouble/i })
    ).toHaveCount(0, { timeout: 30000 });
  });
}

test('a channel the server keeps closing is joined again after a growing wait, not in a tight loop', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await (await browser.newContext()).newPage();
  const rt = await watchRealtime(page);
  const code = await openTriviaRoom(page);
  const topic = `realtime:room:${code}`;

  await expect.poll(() => rt.joins[topic] ?? 0, { timeout: 30000 }).toBe(1);

  // Close it again straight after each re-join. The waits are 1s, 2s, 4s, each
  // between 50% and 100% of that, so the third is never shorter than 2s.
  const delays: number[] = [];
  for (let round = 1; round <= 3; round++) {
    await page.waitForTimeout(1200);
    const before = rt.joins[topic];
    const closedAt = Date.now();
    rt.closeChannel(topic);
    await expect.poll(() => rt.joins[topic], { timeout: 30000 }).toBeGreaterThan(before);
    delays.push(Date.now() - closedAt);
  }
  expect(delays[0]).toBeLessThan(3500);
  expect(delays[2]).toBeGreaterThanOrEqual(1900);
});
