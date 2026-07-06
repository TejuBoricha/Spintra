"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Grid3x3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";
import { shuffleArray } from "@/lib/utils";

const COLUMN_RANGES: Record<string, [number, number]> = {
  B: [1, 15],
  I: [16, 30],
  N: [31, 45],
  G: [46, 60],
  O: [61, 75],
};
const COLUMNS = Object.keys(COLUMN_RANGES);

function shuffle<T>(arr: T[]): T[] {
  return shuffleArray(arr);
}

function generateCard(): number[][] {
  return COLUMNS.map((col) => {
    const [min, max] = COLUMN_RANGES[col];
    const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return shuffle(pool).slice(0, 5);
  });
}

const LINES: [number, number][][] = [
  ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => [c, r] as [number, number])),
  ...[0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => [c, r] as [number, number])),
  [0, 1, 2, 3, 4].map((i) => [i, i] as [number, number]),
  [0, 1, 2, 3, 4].map((i) => [i, 4 - i] as [number, number]),
];

export function BingoActivity() {
  const { isHost, sendActivityEvent, registerEventListener, currentUser } = useRoomActivity();

  const [bingoCalled, setBingoCalled] = useState<number[]>([]);
  const [bingoWinner, setBingoWinner] = useState<string | null>(null);

  const [card, setCard] = useState<number[][]>(generateCard);
  const hasCalledBingoRef = useRef(false);
  const prevCalledLenRef = useRef(0);

  useEffect(() => {
    return registerEventListener((event) => {
      switch (event.kind) {
        case "bingo_call": {
          setBingoCalled((prev) => [...prev, event.number]);
          break;
        }
        case "bingo_win": {
          // Two players can each independently detect their own win and
          // broadcast it before either has seen the other's event (no
          // server-side arbitration). Keeping only the first one received
          // per client — instead of always overwriting with whichever
          // arrived most recently — stops a client from flip-flopping which
          // name it shows as more of these events trickle in.
          setBingoWinner((prev) => prev ?? event.username);
          break;
        }
        case "bingo_reset":
          setBingoCalled([]);
          setBingoWinner(null);
          break;
        case "activity_reset":
          setBingoCalled([]);
          setBingoWinner(null);
          break;
      }
    });
  }, [registerEventListener]);

  useEffect(() => {
    if (bingoCalled.length === 0 && prevCalledLenRef.current > 0) {
      setCard(generateCard());
      hasCalledBingoRef.current = false;
    }
    prevCalledLenRef.current = bingoCalled.length;
  }, [bingoCalled]);

  const isMarked = useCallback(
    (col: number, row: number) => (col === 2 && row === 2) || bingoCalled.includes(card[col][row]),
    [card, bingoCalled]
  );

  useEffect(() => {
    if (hasCalledBingoRef.current || bingoWinner) return;
    const gotBingo = LINES.some((line) => line.every(([col, row]) => isMarked(col, row)));
    if (gotBingo) {
      hasCalledBingoRef.current = true;
      sendActivityEvent({ kind: "bingo_win", username: currentUser.username });
    }
  }, [bingoCalled, bingoWinner, isMarked, sendActivityEvent, currentUser.username]);

  const lastCalled = bingoCalled[bingoCalled.length - 1];
  const columnFor = (n: number) => COLUMNS[Math.floor((n - 1) / 15)];

  return (
    <motion.div
      key="bingo"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-xl mx-auto pt-8 w-full"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Grid3x3 className="w-6 h-6 text-cyan-400" /> Bingo
      </h2>
      {bingoWinner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl w-full max-w-xs"
        >
          <p className="text-sm text-emerald-300 font-semibold uppercase tracking-wider mb-1">Bingo Winner!</p>
          <p className="text-2xl font-black text-emerald-400 flex items-center justify-center gap-2">
            {bingoWinner} <Emoji name="party_popper" size={26} pop />
          </p>
        </motion.div>
      )}
      {/* Same "waiting for host" cue 11 of 14 activities already show —
          without it a guest just sees an inert card with no hint that only
          the host can call numbers. */}
      {!isHost && bingoCalled.length === 0 && !bingoWinner && (
        <EmptyState icon={<Emoji name="bullseye" size={48} />} description="Waiting for host to call the first number…" />
      )}
      {lastCalled && !bingoWinner && (
        <motion.div
          key={lastCalled}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          role="status"
          aria-live="polite"
          className="w-20 h-20 rounded-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-600 border border-cyan-400/40 shadow-xl shadow-cyan-500/10 text-white select-none"
        >
          <span className="text-[10px] uppercase font-bold tracking-widest leading-none text-cyan-200/80 mb-0.5">Called</span>
          <span className="text-2xl font-black">{columnFor(lastCalled)}-{lastCalled}</span>
        </motion.div>
      )}

      {/* Bingo card layout matching standalone premium grid style */}
      <div className="glass-card p-5 rounded-3xl border border-border shadow-2xl bg-gradient-to-br from-white/[0.01] to-white/[0.03]">
        <div className="grid grid-cols-5 gap-2 mb-2">
          {COLUMNS.map((col) => (
            <div
              key={col}
              className="w-12 h-8 flex items-center justify-center font-black text-cyan-400 text-base tracking-wider uppercase select-none"
            >
              {col}
            </div>
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="grid grid-cols-5 gap-2">
            {COLUMNS.map((_, col) => {
              const marked = isMarked(col, row);
              const isFree = col === 2 && row === 2;

              let styleClass = "border-border text-muted-foreground bg-muted/30";
              if (marked) {
                styleClass = isFree
                  ? "bg-amber-500/20 border-amber-500 text-amber-200 shadow-amber-500/10"
                  : "bg-cyan-500/20 border-cyan-500 text-cyan-200 shadow-cyan-500/10";
              }

              return (
                <div
                  key={col}
                  className={`w-12 h-12 flex items-center justify-center rounded-xl text-sm font-bold border transition-all duration-300 select-none ${styleClass}`}
                >
                  {isFree ? (
                    <Emoji name="trophy" size={20} animated={false} />
                  ) : (
                    card[col][row]
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {isHost && (
        <div className="flex gap-4 w-full justify-center">
          <Button
            disabled={bingoCalled.length >= 75 || !!bingoWinner}
            onClick={() => {
              const remaining = Array.from({ length: 75 }, (_, i) => i + 1).filter(
                (n) => !bingoCalled.includes(n)
              );
              if (remaining.length === 0) return;
              const number = remaining[Math.floor(Math.random() * remaining.length)];
              sendActivityEvent({ kind: "bingo_call", number });
            }}
            className="h-11 px-6 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border-0 rounded-full font-bold shadow-lg shadow-cyan-500/10"
          >
            Call Next Number
          </Button>

          {bingoCalled.length > 0 && (
            <Button
              onClick={() => {
                sendActivityEvent({ kind: "bingo_reset" });
              }}
              variant="outline"
              className="h-11 px-5 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 rounded-full transition-all"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
