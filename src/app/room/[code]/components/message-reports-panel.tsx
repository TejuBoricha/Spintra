"use client";

import { useState, useEffect, useCallback } from "react";
import { Flag, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface MessageReport {
  id: string;
  reason: string | null;
  reviewed: boolean;
  created_at: string;
  reported_user_id: string;
  reporter_id: string;
  chat_messages: { content: string } | null;
}

export function MessageReportsPanel({ roomCode }: { roomCode: string }) {
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [isOpen, setIsOpen] = useState(false);

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
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
