"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  moderationKickBan,
  moderationUnban,
  moderationDismissReport,
  type ModerationActionKind,
} from "@/lib/moderation";
import { toast } from "sonner";

interface MessageReport {
  id: string;
  reason: string | null;
  reviewed: boolean;
  created_at: string;
  reported_user_id: string;
  reporter_id: string;
  reporter_username: string | null;
  chat_messages: { content: string; username: string | null } | null;
}

interface RoomBan {
  id: string;
  user_id: string;
  username: string | null;
  created_at: string;
}

interface ModerationAction {
  id: string;
  action_kind: ModerationActionKind;
  target_user_id: string;
  target_username: string | null;
  detail: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<ModerationActionKind, string> = {
  dismiss_report: "Dismissed a report against",
  kick_ban: "Removed and banned",
  unban: "Unbanned",
};

// Merges MessageReportsPanel and UnbanPanel into one tabbed surface, plus a
// new History tab (ADR-010). The two source panels were already
// structurally identical (icon+badge trigger, realtime-subscribed list
// Dialog, nested confirm Dialog) — this extracts their internals into tab
// bodies verbatim rather than redesigning either; the confirm dialogs stay
// SIBLINGS of the main Dialog in the returned fragment, matching the
// originals exactly, not nested inside the tabbed Dialog.
export function ModerationDashboard({
  roomCode,
  currentUserId,
}: {
  roomCode: string;
  currentUserId: string;
}) {
  const [activeTab, setActiveTab] = useState("reports");
  const [isOpen, setIsOpen] = useState(false);

  // --- Reports tab state (from MessageReportsPanel) ---
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [kickTargetId, setKickTargetId] = useState<string | null>(null);
  const [isKicking, setIsKicking] = useState(false);

  // --- Bans tab state (from UnbanPanel) ---
  const [bans, setBans] = useState<RoomBan[]>([]);
  const [unbanTargetId, setUnbanTargetId] = useState<string | null>(null);
  const [isUnbanning, setIsUnbanning] = useState(false);

  // --- History tab state (new) ---
  const [actions, setActions] = useState<ModerationAction[]>([]);

  const loadReports = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("message_reports")
      .select(
        "id, reason, reviewed, created_at, reported_user_id, reporter_id, reporter_username, chat_messages(content, username)"
      )
      .eq("room_id", roomCode)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setReports(data as unknown as MessageReport[]);
    }
  }, [roomCode]);

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

  const loadActions = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("moderation_actions")
      .select("id, action_kind, target_user_id, target_username, detail, created_at")
      .eq("room_id", roomCode)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) {
      setActions(data as ModerationAction[]);
    }
  }, [roomCode]);

  useEffect(() => {
    queueMicrotask(() => {
      loadReports();
      loadBans();
      loadActions();
    });

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`moderation_dashboard_${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reports", filter: `room_id=eq.${roomCode}` },
        () => loadReports()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_bans", filter: `room_id=eq.${roomCode}` },
        () => loadBans()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moderation_actions", filter: `room_id=eq.${roomCode}` },
        () => loadActions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, loadReports, loadBans, loadActions]);

  const markReviewed = async (reportId: string) => {
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, reviewed: true } : r)));
    // One transactional RPC (migration 0055): flips reviewed and writes the
    // history row together, host-verified inside the database.
    const { error } = await moderationDismissReport(roomCode, reportId);
    if (error) {
      console.error("Failed to dismiss report:", error);
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, reviewed: false } : r)));
      toast.error("Unable to dismiss report.");
    }
  };

  const confirmKickReportedUser = async () => {
    if (!kickTargetId) return;
    // Hard guard against self-moderation, independent of the UI check: a host
    // banning themself deletes their own participant row and locks them out of
    // their own room.
    if (kickTargetId === currentUserId) {
      toast.error("You can't kick or ban yourself.");
      setKickTargetId(null);
      return;
    }
    setIsKicking(true);
    try {
      // One transactional RPC (migration 0055): snapshots the participant,
      // deletes them, records the ban, closes every open report about them,
      // and writes the history row — atomically, host-verified and
      // self-kick-rejected inside the database.
      const { error } = await moderationKickBan(roomCode, kickTargetId);
      if (error) {
        console.error("Failed to remove reported participant:", error);
        toast.error("Unable to remove participant.");
        return;
      }
      setReports((prev) =>
        prev.map((r) => (r.reported_user_id === kickTargetId ? { ...r, reviewed: true } : r))
      );
      toast.success("Participant removed from the room.");
    } finally {
      setIsKicking(false);
      setKickTargetId(null);
    }
  };

  const confirmUnban = async () => {
    if (!unbanTargetId) return;
    setIsUnbanning(true);
    try {
      const ban = bans.find((b) => b.id === unbanTargetId);
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        // One transactional RPC (migration 0055): deletes the ban row and
        // writes the history row together, host-verified in the database.
        const { error } = await moderationUnban(roomCode, unbanTargetId);
        if (error) throw new Error(error);
      } else {
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
              aria-label="Moderation dashboard"
              className="relative"
            />
          }
        >
          <Shield className="w-4 h-4 text-rose-400" />
          {unreviewedCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 justify-center bg-rose-500 text-white text-[10px] border-0">
              {unreviewedCount}
            </Badge>
          )}
        </TooltipTrigger>
        <TooltipContent>Moderation{unreviewedCount > 0 ? ` (${unreviewedCount} new)` : ""}</TooltipContent>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-black">Moderation</DialogTitle>
            <DialogDescription>Keep the room civil.</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
            <TabsList variant="line" className="h-auto justify-start bg-transparent p-0 gap-4 border-b border-(--border-hairline)">
              <TabsTrigger value="reports" className="px-0 pb-2 text-sm font-semibold">
                Reports
                {unreviewedCount > 0 && <span className="ml-1 text-rose-400">({unreviewedCount})</span>}
              </TabsTrigger>
              <TabsTrigger value="bans" className="px-0 pb-2 text-sm font-semibold">
                Banned
                {bans.length > 0 && <span className="ml-1">({bans.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="history" className="px-0 pb-2 text-sm font-semibold">
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reports">
              <div className="space-y-3 max-h-80 overflow-y-auto mt-3">
                {reports.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No reports for this room.</p>
                )}
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className={`rounded-2xl border p-4 space-y-2 ${
                      report.reviewed ? "border-(--border-hairline) opacity-50" : "border-rose-500/30 bg-rose-500/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm font-semibold">
                        {report.reporter_username || "Someone"} reported a message from{" "}
                        {report.chat_messages?.username || "Unknown"}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {!report.reviewed && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markReviewed(report.id)}
                            className="h-7 text-xs"
                          >
                            Dismiss
                          </Button>
                        )}
                        {/* A report can outlive a host change and end up describing the
                            *current* host (kicked → unbanned → rejoined → promoted).
                            Offering Kick & Ban here would let the host ban themself. */}
                        {report.reported_user_id === currentUserId ? (
                          <span className="text-[11px] text-muted-foreground italic">
                            This report is about you
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setKickTargetId(report.reported_user_id)}
                            className="h-7 text-xs"
                          >
                            Kick & Ban
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground wrap-break-word">
                      &quot;
                      {report.chat_messages?.content ?? (
                        <span className="italic">Message no longer available</span>
                      )}
                      &quot;
                    </p>
                    {report.reason && (
                      <p className="text-[11px] text-muted-foreground">Reason: {report.reason}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="bans">
              <div className="space-y-3 max-h-80 overflow-y-auto mt-3">
                {bans.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No one is banned from this room.</p>
                )}
                {bans.map((ban) => (
                  <div
                    key={ban.id}
                    className="rounded-2xl border border-(--border-hairline) bg-(--surface-panel) p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{ban.username || "Unknown user"}</p>
                      {ban.created_at && (
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(ban.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUnbanTargetId(ban.id)}
                      className="h-8 text-xs shrink-0"
                      icon={<Undo2 className="w-3 h-3" />}
                    >
                      Unban
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="space-y-4 max-h-80 overflow-y-auto mt-3">
                {actions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No moderation actions yet.</p>
                )}
                {actions.map((action) => (
                  <div key={action.id}>
                    <p className="text-sm text-muted-foreground">
                      {ACTION_LABEL[action.action_kind]}{" "}
                      <span className="font-semibold text-foreground">{action.target_username || "Unknown user"}</span>
                    </p>
                    {action.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5">Reason: {action.detail}</p>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(action.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
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
