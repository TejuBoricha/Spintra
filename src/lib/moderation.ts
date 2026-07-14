import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ModerationActionKind = "dismiss_report" | "kick_ban" | "unban";

// ── Transactional moderation verbs (migration 0055) ─────────────────────
// Each call runs as ONE database transaction that re-verifies the caller is
// the room's current host and (for kick) refuses self-targeting, then
// performs every step of the verb atomically — kick & ban also closes all
// open reports about the target and writes the audit-log row itself. Do NOT
// pair these with logModerationAction(); the function already logged.
// All three throw on rule violations ("only the room host may moderate",
// self-kick) — callers surface that as a toast.

export async function moderationKickBan(
  roomCode: string,
  targetUserId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Moderation requires a Supabase connection." };
  const { error } = await supabase.rpc("moderation_kick_ban", {
    p_room_code: roomCode,
    p_target_user_id: targetUserId,
  });
  return { error: error ? error.message : null };
}

export async function moderationUnban(
  roomCode: string,
  banId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Moderation requires a Supabase connection." };
  const { error } = await supabase.rpc("moderation_unban", {
    p_room_code: roomCode,
    p_ban_id: banId,
  });
  return { error: error ? error.message : null };
}

export async function moderationDismissReport(
  roomCode: string,
  reportId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Moderation requires a Supabase connection." };
  const { error } = await supabase.rpc("moderation_dismiss_report", {
    p_room_code: roomCode,
    p_report_id: reportId,
  });
  return { error: error ? error.message : null };
}

// logModerationAction (the client-side history insert this file used to
// export) is gone: the RPCs above write the moderation_actions row inside
// the same transaction as the action itself, so a separate best-effort
// client write would only ever produce duplicates.
