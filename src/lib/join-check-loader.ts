/**
 * The room-join pre-check and the Supabase client it needs, loaded on demand instead of in
 * every page's first load (search audit S-7: about 63 KB compressed, for something most visits
 * never use). Shared by the navbar's join dialog and the home page's join box.
 *
 * If the chunk cannot be fetched (the page was left open across a deploy, or the connection
 * dropped), `loadJoinCheck` resolves to null and the caller skips the pre-check and goes to the
 * room: the pre-check is only a courtesy (a clearer message for a full, locked or missing room),
 * and the room page runs its own checks.
 */
export type JoinCheck = {
  getSupabaseBrowserClient: typeof import("@/lib/supabase/client").getSupabaseBrowserClient;
  checkCanJoinRoom: typeof import("@/lib/room-join-check").checkCanJoinRoom;
  ROOM_JOIN_ERROR_MESSAGES: typeof import("@/lib/room-join-check").ROOM_JOIN_ERROR_MESSAGES;
};

export async function loadJoinCheck(): Promise<JoinCheck | null> {
  try {
    const [client, check] = await Promise.all([import("@/lib/supabase/client"), import("@/lib/room-join-check")]);
    return {
      getSupabaseBrowserClient: client.getSupabaseBrowserClient,
      checkCanJoinRoom: check.checkCanJoinRoom,
      ROOM_JOIN_ERROR_MESSAGES: check.ROOM_JOIN_ERROR_MESSAGES,
    };
  } catch (error) {
    // Falls back on purpose, but leaves a trace: a chunk that fails for everyone (after a deploy) would otherwise be invisible.
    console.warn("The join pre-check could not be loaded; joining without it.", error);
    return null;
  }
}
