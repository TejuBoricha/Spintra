import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

export interface RoomByCode {
  id: string;
  code: string;
  name: string;
  type: string;
  is_locked: boolean;
  max_participants: number;
  host_id: string;
}

/**
 * Look up a single room by its exact code via the get_room_by_code RPC
 * (migration 0062), not a raw `.from("rooms").select()`. The rooms table's
 * RLS only allows reading a row you're already a member/host of or that's
 * public — by design, since RLS can't distinguish "the caller already knew
 * this exact code" from "the caller is enumerating every row". A pre-join
 * lookup (checking lock/capacity/host before the caller has a
 * room_participants row yet) still needs to see the room, which is exactly
 * what this SECURITY DEFINER RPC allows: given one exact code, at most one
 * row back, never a list.
 */
export async function getRoomByCode(
  supabase: SupabaseClient<Database>,
  code: string
): Promise<{ data: RoomByCode | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("get_room_by_code", { p_code: code });
  if (error) return { data: null, error };
  return { data: data?.[0] ?? null, error: null };
}
