import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import { getRoomByCode } from "./room-lookup";

// Found in the Session 41 audit: this same pre-join validation (room
// exists? locked? full? banned? already a member?) was copy-pasted across
// the home page, Explore, and the navbar's quick-join dialog — and had
// already drifted: navbar.tsx's copy was missing the host/existing-member
// bypass and the ban check entirely, so a banned user (or an existing
// member/host) got different, wrong behavior depending on which of the
// three UIs they used to join. One implementation now backs all three.
export type RoomJoinCheckResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "locked" | "full" | "banned" | "error" };

// Short-lived de-dup cache: the room page's own verifyAccess re-runs this
// same check moments after a pre-check already ran (e.g. from the home
// page), and a user double-clicking "Join" fires it twice in quick
// succession. Neither case needs a second real round-trip.
const CACHE_TTL_MS = 8000;
const cache = new Map<string, { result: RoomJoinCheckResult; expiresAt: number }>();

export async function checkCanJoinRoom(
  supabase: SupabaseClient<Database>,
  roomCode: string,
  userId: string
): Promise<RoomJoinCheckResult> {
  const cacheKey = `${roomCode}:${userId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const result = await runCheck(supabase, roomCode, userId);
  // Don't cache a transient "error" result — the whole point of that state
  // is "we couldn't tell, try again", not "we know this failed".
  if (result.ok || result.reason !== "error") {
    cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return result;
}

async function runCheck(
  supabase: SupabaseClient<Database>,
  roomCode: string,
  userId: string
): Promise<RoomJoinCheckResult> {
  try {
    // The room fetch and the existing-membership check don't depend on each
    // other's result — both only need roomCode/userId — so they run in
    // parallel instead of serially (Session 45 audit: this was still 2
    // avoidable round trips even after Session 41's fix to the room page's
    // own verifyAccess).
    const [{ data: room, error: roomError }, { data: existingPart }] = await Promise.all([
      getRoomByCode(supabase, roomCode),
      supabase
        .from("room_participants")
        .select("id")
        .eq("room_id", roomCode)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    // A real fetch error (network failure, outage) is not the same claim as
    // "this room doesn't exist" — conflating the two here was the same bug
    // separately found and fixed in room-client.tsx's verifyAccess.
    if (roomError) {
      console.error("Failed to fetch room for join check:", roomError);
      return { ok: false, reason: "error" };
    }
    if (!room) {
      return { ok: false, reason: "not_found" };
    }

    const isRoomHost = room.host_id === userId;

    // Reconnecting members and the host bypass lock/capacity/ban checks —
    // those only gate *new* joins.
    if (isRoomHost || existingPart) {
      return { ok: true };
    }

    // Same reasoning: the ban check and the online-participant count are
    // independent of each other.
    const [{ data: ban }, { data: parts }] = await Promise.all([
      supabase
        .from("room_bans")
        .select("id")
        .eq("room_id", roomCode)
        .eq("user_id", userId)
        .maybeSingle(),
      // Only count currently online participants — a disconnected
      // participant's row is kept (is_online=false), not deleted, so
      // counting every row regardless of status would let a room's
      // effective capacity shrink permanently every time someone joins and
      // leaves.
      supabase
        .from("room_participants")
        .select("id")
        .eq("room_id", roomCode)
        .eq("is_online", true),
    ]);

    if (ban) {
      return { ok: false, reason: "banned" };
    }

    if (room.is_locked) {
      return { ok: false, reason: "locked" };
    }

    if (parts && parts.length >= room.max_participants) {
      return { ok: false, reason: "full" };
    }

    return { ok: true };
  } catch (err) {
    console.error("Unexpected error during room join check:", err);
    return { ok: false, reason: "error" };
  }
}

export const ROOM_JOIN_ERROR_MESSAGES: Record<Exclude<RoomJoinCheckResult, { ok: true }>["reason"], string> = {
  not_found: "Room code not found. Please double check.",
  locked: "This room is locked by the host.",
  full: "This room is full.",
  banned: "You have been removed from this room by the host and cannot rejoin.",
  error: "Couldn't check this room right now. Please check your connection and try again.",
};
