"use client";

import { useState, useEffect, useCallback } from "react";
import { Flag, Check, UserX } from "lucide-react";
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
import { toast } from "sonner";

interface MessageReport {
  id: string;
  reason: string | null;
  reviewed: boolean;
  created_at: string;
  reported_user_id: string;
  reporter_id: string;
  chat_messages: { content: string } | null;
}

export function MessageReportsPanel({
  roomCode,
  currentUserId,
}: {
  roomCode: string;
  currentUserId: string;
}) {
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [kickTargetId, setKickTargetId] = useState<string | null>(null);
  const [isKicking, setIsKicking] = useState(false);

  const loadReports = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("message_reports")
      .select("id, reason, reviewed, created_at, reported_user_id, reporter_id, chat_messages(content)")
      .eq("room_id", roomCode)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setReports(data as unknown as MessageReport[]);
    }
  }, [roomCode]);

  useEffect(() => {
    queueMicrotask(() => loadReports());

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`message_reports_${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reports", filter: `room_id=eq.${roomCode}` },
        () => loadReports()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, loadReports]);

  const markReviewed = async (reportId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, reviewed: true } : r)));
    await supabase.from("message_reports").update({ reviewed: true }).eq("id", reportId);
  };

  // Previously a host had to close this panel and separately find the
  // reported user in the participant list to act on a report — found in the
  // Session 45 audit. Self-contained here (not threaded through
  // handleKickParticipant/participants from room-client.tsx) specifically to
  // avoid re-introducing the RoomHeader re-render regression an earlier
  // session fixed: this only needs the host's own (stable) id, not the
  // full, frequently-changing participants array.
  const confirmKickReportedUser = async () => {
    if (!kickTargetId) return;
    setIsKicking(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      // Snapshot the username and device fingerprint before deleting the
      // participant row — once it's gone there's no other source. username
      // is for the unban panel's list (migration 0043); fingerprint_hash is
      // for cross-identity ban matching (migration 0047) — the
      // copy_fingerprint_to_ban trigger can only fall back to null once
      // this row is deleted.
      const { data: participantRow } = await supabase
        .from("room_participants")
        .select("username, fingerprint_hash")
        .eq("room_id", roomCode)
        .eq("user_id", kickTargetId)
        .maybeSingle();
      await supabase
        .from("room_participants")
        .delete()
        .eq("room_id", roomCode)
        .eq("user_id", kickTargetId);
      const { error: banError } = await supabase.from("room_bans").upsert(
        {
          room_id: roomCode,
          user_id: kickTargetId,
          banned_by: currentUserId,
          username: participantRow?.username ?? null,
          fingerprint_hash: participantRow?.fingerprint_hash ?? null,
        },
        { onConflict: "room_id,user_id", ignoreDuplicates: false }
      );
      if (banError) {
        console.error("Failed to record room ban:", banError.message || JSON.stringify(banError));
      }
      toast.success("Participant removed from the room.");
    } catch (error) {
      console.error("Failed to remove reported participant:", error);
      toast.error("Unable to remove participant.");
    } finally {
      setIsKicking(false);
      setKickTargetId(null);
    }
  };

  const unreviewedCount = reports.filter((r) => !r.reviewed).length;

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(true)}
              aria-label="View reported messages"
              className="relative"
            />
          }
        >
          <Flag className="w-4 h-4 text-rose-400" />
          {unreviewedCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 justify-center bg-rose-500 text-white text-[10px] border-0">
              {unreviewedCount}
            </Badge>
          )}
        </TooltipTrigger>
        <TooltipContent>Reported messages{unreviewedCount > 0 ? ` (${unreviewedCount} new)` : ""}</TooltipContent>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reported Messages</DialogTitle>
            <DialogDescription>
              Only you, as the host, can see this. Dismiss a report once you&apos;ve handled it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {reports.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No reports for this room.</p>
            )}
            {reports.map((report) => (
              <div
                key={report.id}
                className={`rounded-xl border p-3 space-y-1.5 ${
                  report.reviewed ? "border-border opacity-50" : "border-rose-500/30 bg-rose-500/5"
                }`}
              >
                <p className="text-sm break-words">
                  {report.chat_messages?.content || <span className="italic text-muted-foreground">Message no longer available</span>}
                </p>
                {report.reason && (
                  <p className="text-xs text-muted-foreground">Reason: {report.reason}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(report.created_at).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setKickTargetId(report.reported_user_id)}
                      className="h-7 text-xs text-rose-400 hover:text-rose-300"
                    >
                      <UserX className="w-3 h-3 mr-1" /> Remove
                    </Button>
                    {!report.reviewed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markReviewed(report.id)}
                        className="h-7 text-xs"
                      >
                        <Check className="w-3 h-3 mr-1" /> Dismiss
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!kickTargetId} onOpenChange={(open) => { if (!open) setKickTargetId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this participant?</DialogTitle>
            <DialogDescription>
              They&apos;ll be removed from the room immediately and blocked from rejoining, unless
              they clear their browser data or use a different device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKickTargetId(null)} disabled={isKicking}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmKickReportedUser} disabled={isKicking}>
              {isKicking ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
