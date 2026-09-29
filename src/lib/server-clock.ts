import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Spintra City's deadlines (turn clocks, auctions) are server timestamps, and
// the screen used to compare them with the browser's own clock. A computer
// whose clock is off (the owner's PC ran 43.7 seconds fast) then showed 0:00
// at the start of every turn and asked the server to end things early. The
// server now enforces every deadline itself (city_tick, migration 0110);
// this keeps what the screen shows in step with it.
//
// serverNow() is Date.now() corrected by the measured gap to the database's
// clock. Until the first sync it is plain Date.now().

let offsetMs = 0;

export function serverNow(): number {
  return Date.now() + offsetMs;
}

// A few round trips, keeping the fastest: the first request on a cold
// connection can take seconds, and the midpoint of a slow, lopsided round
// trip is a poor guess of when the server read its clock.
const SAMPLES = 3;

/**
 * Measures the browser-to-server clock gap (server_now, migration 0110).
 * Resolves true once a usable measurement was taken.
 */
export async function syncServerClock(supabase: SupabaseClient<Database>): Promise<boolean> {
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < SAMPLES; i++) {
    const sentAt = Date.now();
    const { data, error } = await supabase.rpc("server_now");
    const receivedAt = Date.now();
    if (error || !data) continue;
    const serverMs = new Date(data).getTime();
    if (!Number.isFinite(serverMs)) continue;
    const rtt = receivedAt - sentAt;
    if (!best || rtt < best.rtt) best = { rtt, offset: serverMs - (sentAt + receivedAt) / 2 };
  }
  if (!best) return false;
  offsetMs = best.offset;
  return true;
}
