"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trophy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface ScoreRow {
  user_id: string;
  points: number;
}

interface StandingRow {
  userId: string;
  username: string;
  points: number;
  position: number;
}

// Live standings for Trivia/RPS/Bingo (ADR-008). Unlike the host-only
// moderation panels this otherwise mirrors structurally, room_scores has
// participant-scoped (not host-scoped) SELECT RLS — every participant can
// view the scoreboard, only the host can reset it.
//
// Rendered in room-header.tsx, which is deliberately memo()'d against
// unrelated re-renders (chat keystrokes, participant presence churn) — see
// that file's comments. Usernames are resolved by this component's own
// lightweight query rather than a `participants` prop threaded down from
// room-client.tsx, specifically so a join/leave/presence/XP change doesn't
// force RoomHeader to re-render on every participant update just to keep
// this panel's data current; only actually opening the dialog or a real
// score change triggers a (re)fetch here.
export function ScoreboardPanel({ roomCode, isHost }: { roomCode: string; isHost: boolean }) {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const loadScores = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const [{ data: scoreData, error: scoreError }, { data: nameData, error: nameError }] = await Promise.all([
      supabase.from("room_scores").select("user_id, points").eq("room_id", roomCode),
      supabase.from("room_participants").select("user_id, username").eq("room_id", roomCode),
    ]);
    if (!scoreError && scoreData) setScores(scoreData);
    if (!nameError && nameData) {
      setUsernames(Object.fromEntries(nameData.map((p) => [p.user_id, p.username ?? "Guest"])));
    }
  }, [roomCode]);

  useEffect(() => {
    queueMicrotask(() => loadScores());

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`room_scores_${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_scores", filter: `room_id=eq.${roomCode}` },
        () => loadScores()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, loadScores]);

  // Ties share a rank position (standard competition ranking: 1,1,3 — not
  // 1,1,2) — a Business Rule from the original decision analysis, not an
  // afterthought.
  const standings = useMemo<StandingRow[]>(() => {
    const totals = new Map<string, number>();
    for (const row of scores) {
      totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + row.points);
    }
    const rows = Array.from(totals.entries())
      .map(([userId, points]) => ({
        userId,
        points,
        username: usernames[userId] ?? "Unknown",
      }))
      .sort((a, b) => b.points - a.points);

    return rows.reduce<{ out: StandingRow[]; lastPoints: number | null }>(
      (acc, row, i) => {
        const position = row.points !== acc.lastPoints ? i + 1 : acc.out[acc.out.length - 1].position;
        return { out: [...acc.out, { ...row, position }], lastPoints: row.points };
      },
      { out: [], lastPoints: null }
    ).out;
  }, [scores, usernames]);

  const confirmReset = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setIsResetting(true);
    try {
      const { error } = await supabase.from("room_scores").delete().eq("room_id", roomCode);
      if (error) throw error;
      toast.success("Scoreboard reset.");
    } catch (error) {
      console.error("Failed to reset scoreboard:", error);
      toast.error("Unable to reset the scoreboard.");
    } finally {
      setIsResetting(false);
      setIsResetConfirmOpen(false);
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
              aria-label="Scoreboard"
            />
          }
        >
          <Trophy className="w-4 h-4 text-amber-400" />
        </TooltipTrigger>
        <TooltipContent>Scoreboard</TooltipContent>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scoreboard</DialogTitle>
            <DialogDescription>
              Points from Trivia, Rock Paper Scissors, and Bingo. Scores stick around across game
              switches until someone resets them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {standings.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No scores yet — play a round of Trivia, RPS, or Bingo to get on the board.
              </p>
            )}
            {standings.map((row) => (
              <div
                key={row.userId}
                className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border"
              >
                <span className="text-sm font-bold text-muted-foreground w-6 text-center shrink-0">
                  {row.position}
                </span>
                <span className="text-sm font-medium flex-1 truncate">{row.username}</span>
                <span className="text-sm font-bold text-amber-400 shrink-0">{row.points} pts</span>
              </div>
            ))}
          </div>

          {isHost && standings.length > 0 && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsResetConfirmOpen(true)}
                className="text-rose-400 hover:text-rose-300"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Reset Scoreboard
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the scoreboard?</DialogTitle>
            <DialogDescription>
              Clears everyone&apos;s points back to zero. This doesn&apos;t affect the current
              activity or anyone&apos;s XP.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetConfirmOpen(false)} disabled={isResetting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReset} disabled={isResetting}>
              {isResetting ? "Resetting..." : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
