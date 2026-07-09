import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ModerationActionKind = "dismiss_report" | "kick_ban" | "unban";

// Best-effort history write (ADR-010) — shared by every host-action call
// site (message-reports-panel.tsx's dismiss/kick, use-room-subscription.ts's
// kick, unban-panel.tsx's unban) rather than duplicated per file. Mirrors
// the existing room_bans insert's own "failure here doesn't block the
// primary action" pattern: never awaited by a caller that needs it to
// succeed — a missing history row is a lesser problem than blocking a real
// moderation action on it. No-ops in demo/local-only mode; moderation
// history is a Supabase-only feature, same as Room Settings and
// Scoreboard/XP.
export async function logModerationAction(
  roomCode: string,
  actorId: string,
  actionKind: ModerationActionKind,
  targetUserId: string,
  targetUsername: string | null,
  detail: string | null = null
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await supabase.from("moderation_actions").insert({
    room_id: roomCode,
    actor_id: actorId,
    action_kind: actionKind,
    target_user_id: targetUserId,
    target_username: targetUsername,
    detail,
  });
  if (error) {
    console.error("Failed to log moderation action:", error.message);
  }
}
