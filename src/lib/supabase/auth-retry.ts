// Retry for the anonymous sign-in that every visitor makes before doing anything
// (audit L-3). When a whole class arrives at once the auth service starts
// answering 429 (Q-2); without a session every room lookup then comes back empty
// (row-level security), so students saw "Room not found" or "Unable to join
// room" and nothing retried. A short, jittered back-off gets almost everyone in;
// only what is still failing after that is shown as "busy", which is true.

/** True for the errors that go away by themselves: rate limits, network and server trouble. */
export function isTransientAuthError(error: unknown): boolean {
  const e = error as { status?: number; code?: string; name?: string; message?: string } | null;
  if (!e) return false;
  if (typeof e.status === "number" && (e.status === 429 || e.status === 0 || e.status >= 500)) return true;
  if (e.code === "over_request_rate_limit" || e.code === "over_email_send_rate_limit") return true;
  if (e.name === "AuthRetryableFetchError") return true;
  return /rate limit|too many requests/i.test(e.message ?? "");
}

interface RetryOptions {
  /** Total tries, including the first. */
  attempts?: number;
  /** Wait before the second try; it doubles each time. */
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

/**
 * Runs `attempt` (a call that resolves to `{ error }`, like supabase-js does)
 * until it succeeds, fails with something permanent, or runs out of tries, and
 * returns the last result. Waits 1s, 2s, 4s (each between 50% and 100% of that,
 * so a class does not retry in lockstep and hit the limit again).
 */
export async function withAuthRetry<T extends { error: unknown }>(
  attempt: () => Promise<T>,
  { attempts = 4, baseDelayMs = 1000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), random = Math.random }: RetryOptions = {}
): Promise<T> {
  let result = await attempt();
  for (let n = 1; n < attempts && result.error && isTransientAuthError(result.error); n++) {
    await sleep(baseDelayMs * 2 ** (n - 1) * (0.5 + random() * 0.5));
    result = await attempt();
  }
  return result;
}

export const AUTH_BUSY_MESSAGE =
  "Sign-in is busy right now, probably because a lot of people are joining at once. Wait a few seconds and try again.";
