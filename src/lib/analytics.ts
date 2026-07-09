import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// First-party analytics only (migration 0041) — no third-party tool, per
// the cookie banner's "no advertising or third-party tracking" promise.
// Deliberately just 3 events answering real product questions (rooms
// created, rooms actually joined, which games get played), not
// instrumentation of every click. No-ops entirely in demo mode: there's no
// backend to log to, and that's fine — this is internal telemetry, never a
// feature a user depends on.
export type AnalyticsEventName = "room_created" | "room_joined" | "activity_started";

export function trackEvent(eventName: AnalyticsEventName, actorId: string, activityType?: string | null): void {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  // Same fire-and-forget pattern as every other non-critical write in this
  // codebase (e.g. changeActivity's room_activity_state upsert) — the
  // Supabase client resolves with an `{ error }` field rather than
  // rejecting, so this is a true no-op on failure, not a silently-swallowed
  // throw; never worth surfacing to the user for internal telemetry.
  supabase
    .from("analytics_events")
    .insert({ event_name: eventName, actor_id: actorId, activity_type: activityType ?? null })
    .then(() => {}, () => {});
}
