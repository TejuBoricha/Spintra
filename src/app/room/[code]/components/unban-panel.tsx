"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldOff, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { listBannedUserIdsFromRoom, unbanUserFromRoom } from "@/lib/room-bans";
import { toast } from "sonner";

interface RoomBan {
  id: string;
  user_id: string;
  username: string | null;
  created_at: string;
}

// Host-facing counterpart to a kick+ban action — closes the "no unban path"
// gap the Session 45 audit deliberately deferred (see docs/TASKS.md).
// Structurally mirrors MessageReportsPanel (icon+badge trigger, realtime-
// subscribed list Dialog, nested confirm Dialog per row) since that's
// already this app's established pattern for a host-only moderation list.
export function UnbanPanel({ roomCode }: { roomCode: string }) {
  const [bans, setBans] = useState<RoomBan[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unbanTargetId, setUnbanTargetId] = useState<string | null>(null);
  const [isUnbanning, setIsUnbanning] = useState(false);

  const loadBans = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const ids = listBannedUserIdsFromRoom(roomCode);
      setBans(ids.map((user_id) => ({ id: user_id, user_id, username: null, created_at: "" })));
      return;
    }
    const { data, error } = await supabase
      .from("room_bans")
      .select("id, user_id, username, created_at")
      .eq("room_id", roomCode)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setBans(data);
    }
  }, [roomCode]);

  useEffect(() => {
    queueMicrotask(() => loadBans());

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`room_bans_${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_bans", filter: `room_id=eq.${roomCode}` },
        () => loadBans()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, loadBans]);

  const confirmUnban = async () => {
    if (!unbanTargetId) return;
    setIsUnbanning(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { error } = await supabase.from("room_bans").delete().eq("id", unbanTargetId);
        if (error) throw error;
      } else {
        const ban = bans.find((b) => b.id === unbanTargetId);
        if (ban) unbanUserFromRoom(roomCode, ban.user_id);
      }
      setBans((prev) => prev.filter((b) => b.id !== unbanTargetId));
      toast.success("Participant unbanned.");
    } catch (error) {
      console.error("Failed to unban participant:", error);
      toast.error("Unable to unban participant.");
    } finally {
      setIsUnbanning(false);
      setUnbanTargetId(null);
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(true)}
              aria-label="View banned users"
              className="relative"
            />
          }
        >
          <ShieldOff className="w-4 h-4 text-muted-foreground" />
          {bans.length > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 justify-center bg-muted-foreground text-background text-[10px] border-0">
              {bans.length}
            </Badge>
          )}
        </TooltipTrigger>
        <TooltipContent>Banned users{bans.length > 0 ? ` (${bans.length})` : ""}</TooltipContent>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Banned Users</DialogTitle>
            <DialogDescription>
              Only you, as the host, can see this. Unban someone to let them rejoin the room.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {bans.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No one is banned from this room.</p>
            )}
            {bans.map((ban) => (
              <div key={ban.id} className="rounded-xl border border-border p-3 space-y-1.5">
                <p className="text-sm font-medium">{ban.username || "Unknown user"}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground">
                    {ban.created_at ? new Date(ban.created_at).toLocaleString() : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setUnbanTargetId(ban.id)}
                    className="h-7 text-xs"
                  >
                    <Undo2 className="w-3 h-3 mr-1" /> Unban
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!unbanTargetId} onOpenChange={(open) => { if (!open) setUnbanTargetId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unban this participant?</DialogTitle>
            <DialogDescription>They&apos;ll be able to rejoin the room again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnbanTargetId(null)} disabled={isUnbanning}>
              Cancel
            </Button>
            <Button variant="default" onClick={confirmUnban} disabled={isUnbanning}>
              {isUnbanning ? "Unbanning..." : "Unban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
