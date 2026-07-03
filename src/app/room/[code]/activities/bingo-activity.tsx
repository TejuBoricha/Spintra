"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/emoji";
import type { ActivityEvent, User } from "@/lib/types";

const COLUMN_RANGES: Record<string, [number, number]> = {
  B: [1, 15],
  I: [16, 30],
  N: [31, 45],
  G: [46, 60],
  O: [61, 75],
};
const COLUMNS = Object.keys(COLUMN_RANGES);

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
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

interface BingoActivityProps {
  isHost: boolean;
  currentUser: User;
  bingoCalled: number[];
  bingoWinner: string | null;
  sendActivityEvent: (event: ActivityEvent) => void;
  onActivityEventRef: React.RefObject<((event: ActivityEvent) => void) | null>;
}

export function BingoActivity({ isHost, currentUser, bingoCalled, bingoWinner, sendActivityEvent, onActivityEventRef }: BingoActivityProps) {
  const [card, setCard] = useState<number[][]>(generateCard);
  // Guard flags only — never read for rendering, so refs (not state) are correct here.
  const hasCalledBingoRef = useRef(false);
  const prevCalledLenRef = useRef(bingoCalled.length);

  // Generate a fresh card when the host starts a new game (called numbers
  // reset back to empty after previously having some) — not on initial mount.
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
      if (onActivityEventRef.current) onActivityEventRef.current({ kind: "bingo_win", username: currentUser.username });
    }
  }, [bingoCalled, bingoWinner, isMarked, sendActivityEvent, onActivityEventRef, currentUser.username]);

  const lastCalled = bingoCalled[bingoCalled.length - 1];
  const columnFor = (n: number) => COLUMNS[Math.floor((n - 1) / 15)];

  return (
    <motion.div
      key="bingo"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-md mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Grid3x3 className="w-6 h-6 text-teal-400" /> Bingo
      </h2>
      {bingoWinner && (
        <motion.p
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-2xl font-bold text-teal-400 flex items-center justify-center gap-2"
        >
          {bingoWinner} <Emoji name="party_popper" size={28} pop /> Bingo!
        </motion.p>
      )}
      {lastCalled && !bingoWinner && (
        <motion.p key={lastCalled} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-xl font-bold text-teal-400">
          {columnFor(lastCalled)}-{lastCalled}
        </motion.p>
      )}
      <div className="glass-card p-3">
        <div className="grid grid-cols-5 gap-1 mb-1">
          {COLUMNS.map((col) => (
            <div key={col} className="w-11 h-7 flex items-center justify-center font-black text-teal-400 text-sm">{col}</div>
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="grid grid-cols-5 gap-1">
            {COLUMNS.map((_, col) => {
              const marked = isMarked(col, row);
              const isFree = col === 2 && row === 2;
              return (
                <div
                  key={col}
                  className={`w-11 h-11 flex items-center justify-center rounded-lg text-xs font-semibold border transition-colors ${
                    marked ? "bg-teal-500/30 border-teal-500 text-teal-200" : "border-white/10 text-muted-foreground"
                  }`}
                >
                  {isFree ? <Emoji name="trophy" size={16} animated={false} /> : card[col][row]}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {isHost && !bingoWinner && (
        <Button
          disabled={bingoCalled.length >= 75}
          onClick={() => {
            const remaining = Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !bingoCalled.includes(n));
            if (remaining.length === 0) return;
            const number = remaining[Math.floor(Math.random() * remaining.length)];
            sendActivityEvent({ kind: "bingo_call", number });
            if (onActivityEventRef.current) onActivityEventRef.current({ kind: "bingo_call", number });
          }}
          className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white border-0"
        >
          Call Next Number
        </Button>
      )}
      {isHost && bingoWinner && (
        <Button
          onClick={() => {
            sendActivityEvent({ kind: "bingo_reset" });
            if (onActivityEventRef.current) onActivityEventRef.current({ kind: "bingo_reset" });
          }}
          variant="outline"
        >
          New Game
        </Button>
      )}
      {!isHost && bingoCalled.length === 0 && (
        <p className="text-muted-foreground text-sm">Waiting for host to call the first number…</p>
      )}
    </motion.div>
  );
}
