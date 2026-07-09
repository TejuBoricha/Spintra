"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Flag, ShieldOff, History, Check, UserX, Undo2 } from "lucide-react";
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
import { logModerationAction, type ModerationActionKind } from "@/lib/moderation";
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
      .select("id, reason, reviewed, created_at, reported_user_id, reporter_id, chat_messages(content)")
      .eq("room_id", roomCode)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setReports(data as unknown as MessageReport[]);
    }
  }, [roomCode]);

  const loadBans = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
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
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const report = reports.find((r) => r.id === reportId);
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, reviewed: true } : r)));
    await supabase.from("message_reports").update({ reviewed: true }).eq("id", reportId);
    if (report) {
      logModerationAction(roomCode, currentUserId, "dismiss_report", report.reported_user_id, null, report.reason);
    }
  };

  const confirmKickReportedUser = async () => {
    if (!kickTargetId) return;
    setIsKicking(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
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
      logModerationAction(roomCode, currentUserId, "kick_ban", kickTargetId, participantRow?.username ?? null);
      toast.success("Participant removed from the room.");
    } catch (error) {
      console.error("Failed to remove reported participant:", error);
      toast.error("Unable to remove participant.");
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
        const { error } = await supabase.from("room_bans").delete().eq("id", unbanTargetId);
        if (error) throw error;
        if (ban) {
          logModerationAction(roomCode, currentUserId, "unban", ban.user_id, ban.username);
        }
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Moderation</DialogTitle>
            <DialogDescription>Only you, as the host, can see this.</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
            <TabsList className="w-full">
              <TabsTrigger value="reports" className="flex-1 text-xs">
                <Flag className="w-3.5 h-3.5 mr-1" /> Reports
                {unreviewedCount > 0 && <span className="ml-1 text-rose-400">({unreviewedCount})</span>}
              </TabsTrigger>
              <TabsTrigger value="bans" className="flex-1 text-xs">
                <ShieldOff className="w-3.5 h-3.5 mr-1" /> Bans
                {bans.length > 0 && <span className="ml-1">({bans.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 text-xs">
                <History className="w-3.5 h-3.5 mr-1" /> History
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
                    className={`rounded-xl border p-3 space-y-1.5 ${
                      report.reviewed ? "border-border opacity-50" : "border-rose-500/30 bg-rose-500/5"
                    }`}
                  >
                    <p className="text-sm break-words">
                      {report.chat_messages?.content || (
                        <span className="italic text-muted-foreground">Message no longer available</span>
                      )}
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
            </TabsContent>

            <TabsContent value="bans">
              <div className="space-y-3 max-h-80 overflow-y-auto mt-3">
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
            </TabsContent>

            <TabsContent value="history">
              <div className="space-y-2 max-h-80 overflow-y-auto mt-3">
                {actions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No moderation actions yet.</p>
                )}
                {actions.map((action) => (
                  <div key={action.id} className="rounded-xl border border-border p-3 space-y-1">
                    <p className="text-sm">
                      {ACTION_LABEL[action.action_kind]}{" "}
                      <span className="font-medium">{action.target_username || "Unknown user"}</span>
                    </p>
                    {action.detail && (
                      <p className="text-xs text-muted-foreground">Reason: {action.detail}</p>
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
