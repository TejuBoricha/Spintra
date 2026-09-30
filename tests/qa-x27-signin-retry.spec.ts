import { test, expect, type Page } from '@playwright/test';
import { withAuthRetry, isTransientAuthError } from '../src/lib/supabase/auth-retry';
import { acceptCookieBanner, skipIfDemoMode, sql, BASE } from './qa-city-helpers';

// Audit L-3: when a class arrives at once the auth service answers 429 to the
// anonymous sign-in. Nothing retried it, and with no session every room lookup
// came back empty, so students saw "Room not found" / "Unable to join room".
// Now the sign-in is retried with a short, jittered back-off, and a student who
// is still refused is told the truth: sign-in is busy.

const tooMany = { code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' };
const rateLimited = { error: { status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' } };

test.describe('withAuthRetry (no browser)', () => {
  test('retries a rate limit, waits longer each time, and returns the success', async () => {
    const results = [rateLimited, rateLimited, { error: null, data: 'ok' }];
    let calls = 0;
    const waits: number[] = [];
    const out = await withAuthRetry(async () => results[calls++], {
      random: () => 1,
      sleep: async (ms) => void waits.push(ms),
    });
    expect(out).toEqual({ error: null, data: 'ok' });
    expect(calls).toBe(3);
    expect(waits).toEqual([1000, 2000]);
  });

  test('each wait is between half and all of its step, so a class does not retry in lockstep', async () => {
    const waits: number[] = [];
    await withAuthRetry(async () => rateLimited, { random: () => 0, sleep: async (ms) => void waits.push(ms) });
    expect(waits).toEqual([500, 1000, 2000]);
  });

  test('gives up after four tries and returns the last error', async () => {
    let calls = 0;
    const out = await withAuthRetry(
      async () => (calls++, rateLimited),
      { sleep: async () => {} }
    );
    expect(calls).toBe(4);
    expect(out.error).toBe(rateLimited.error);
  });

  test('does not retry a permanent error', async () => {
    let calls = 0;
    const disabled = { error: { status: 422, code: 'anonymous_provider_disabled', message: 'Anonymous sign-ins are disabled' } };
    const out = await withAuthRetry(async () => (calls++, disabled), { sleep: async () => { throw new Error('should not wait'); } });
    expect(calls).toBe(1);
    expect(out.error).toBe(disabled.error);
  });

  test('tells transient errors from permanent ones', () => {
    expect(isTransientAuthError({ status: 429 })).toBe(true);
    expect(isTransientAuthError({ status: 503 })).toBe(true);
    expect(isTransientAuthError({ status: 0, name: 'AuthRetryableFetchError' })).toBe(true);
    expect(isTransientAuthError({ code: 'over_request_rate_limit' })).toBe(true);
    expect(isTransientAuthError({ message: 'Too many requests' })).toBe(true);
    expect(isTransientAuthError({ status: 422, message: 'Anonymous sign-ins are disabled' })).toBe(false);
    expect(isTransientAuthError({ status: 400, message: 'Invalid' })).toBe(false);
    expect(isTransientAuthError(null)).toBe(false);
  });
});

async function hostOpensTriviaRoom(host: Page): Promise<string> {
  await host.goto(`${BASE}/create?type=trivia`);
  await acceptCookieBanner(host);
  await host.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await host.click('[data-testid="create-room-button-client"]');
  await host.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  await skipIfDemoMode(host);
  return host.url().split('/room/')[1].split(/[?#]/)[0];
}

const participantCount = (code: string) =>
  Number(sql(`select count(*) from room_participants where room_id = '${code}'`));

test('a student whose sign-in is rate limited twice still gets into the room', async ({ browser }) => {
  test.setTimeout(150_000);
  const host = await (await browser.newContext()).newPage();
  const code = await hostOpensTriviaRoom(host);
  expect(participantCount(code)).toBe(1);

  const student = await (await browser.newContext()).newPage();
  let signups = 0;
  await student.route('**/auth/v1/signup**', (route) => {
    signups++;
    if (signups <= 2) {
      return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify(tooMany) });
    }
    return route.continue();
  });
  await student.goto(`${BASE}/room/${code}`);
  await acceptCookieBanner(student);

  await expect.poll(() => participantCount(code), { timeout: 60000 }).toBe(2);
  expect(signups).toBe(3);
  await expect(student.getByRole('heading', { name: /room not found|sign-in is busy/i })).toHaveCount(0);
});

test('a student who is still refused is told sign-in is busy, not that the room is missing', async ({ browser }) => {
  test.setTimeout(150_000);
  const host = await (await browser.newContext()).newPage();
  const code = await hostOpensTriviaRoom(host);

  const student = await (await browser.newContext()).newPage();
  let signups = 0;
  await student.route('**/auth/v1/signup**', (route) => {
    signups++;
    return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify(tooMany) });
  });
  await student.goto(`${BASE}/room/${code}`);

  await expect(student.getByRole('heading', { name: /sign-in is busy/i })).toBeVisible({ timeout: 60000 });
  await expect(student.getByText(/wait a few seconds and try again/i)).toBeVisible();
  await expect(student.getByRole('button', { name: /try again/i })).toBeVisible();
  await expect(student.getByRole('heading', { name: /room not found/i })).toHaveCount(0);
  expect(signups).toBe(4);
  expect(participantCount(code)).toBe(1);
});
