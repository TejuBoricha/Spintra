"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/emoji";
import { fireConfetti, CelebrationBanner } from "@/components/celebration";
import { getGameByType } from "@/lib/games";
import { generateBingoCard as generateCard, BINGO_LINES as LINES, BINGO_COLUMNS as COLUMNS } from "@/lib/utils";
import { playPop, playSuccess } from "@/lib/audio";

const GameIcon = getGameByType("bingo")!.icon;

export default function BingoPage() {
  // Card is randomized client-side only — generating it during the initial
  // (server-rendered) pass would make the server's random card differ from
  // the client's, causing a hydration mismatch. Populate it after mount instead.
  const [card, setCard] = useState<number[][] | null>(null);
  const [called, setCalled] = useState<number[]>([]);
  const [hasBingo, setHasBingo] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above the initial state
    setCard(generateCard());
  }, []);

  const isMarked = useCallback(
    (col: number, row: number) => {
      // Free center space
      if (col === 2 && row === 2) return true;
      return !!card && called.includes(card[col][row]);
    },
    [card, called]
  );

  const checkBingo = useCallback(
    (calledSoFar: number[]) => {
      if (!card) return false;
      return LINES.some((line) =>
        line.every(([col, row]) => (col === 2 && row === 2) || calledSoFar.includes(card[col][row]))
      );
    },
    [card]
  );

  const callNumber = () => {
    if (hasBingo) return;
    const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    const remaining = allNumbers.filter((n) => !called.includes(n));
    if (remaining.length === 0) return;
    const next = remaining[Math.floor(Math.random() * remaining.length)];
    const updated = [...called, next];
    setCalled(updated);
    playPop(soundEnabled);
    if (checkBingo(updated)) {
      setHasBingo(true);
      playSuccess(soundEnabled);
      fireConfetti();
    }
  };

  const reset = () => {
    setCard(generateCard());
    setCalled([]);
    setHasBingo(false);
  };

  const lastCalled = called[called.length - 1];
  const columnFor = (n: number) => COLUMNS[Math.floor((n - 1) / 15)];

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <GameIcon className="w-4 h-4 text-teal-400" />
            <span className="text-sm text-muted-foreground">Classic number bingo</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Bingo</h1>
          <div className="flex items-center justify-center gap-3 mb-8">
            <p className="text-muted-foreground">Call numbers and mark your card.</p>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Sound On" : "Sound Off"}
              aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
              className="p-1.5 rounded-lg border border-(--border-hairline) bg-(--surface-sunken) hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </motion.div>

        {hasBingo && (
          <div className="mb-8">
            <CelebrationBanner
              icon={<Emoji name="party_popper" size={48} pop />}
              title="Bingo!"
              subtitle={`Called ${called.length} number${called.length !== 1 ? "s" : ""}`}
            />
          </div>
        )}

        {lastCalled && !hasBingo && (
          <motion.p
            key={lastCalled}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-2xl font-bold text-teal-400 mb-4"
          >
            {columnFor(lastCalled)}-{lastCalled}
          </motion.p>
        )}

        <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-4 mb-6 inline-block">
          <div className="grid grid-cols-5 gap-1 mb-1">
            {COLUMNS.map((col) => (
              <div key={col} className="w-14 h-8 flex items-center justify-center font-black text-teal-400">
                {col}
              </div>
            ))}
          </div>
          {card ? (
            [0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="grid grid-cols-5 gap-1">
                {COLUMNS.map((_, col) => {
                  const marked = isMarked(col, row);
                  const isFree = col === 2 && row === 2;
                  return (
                    <div
                      key={col}
                      className={`w-14 h-14 flex items-center justify-center rounded-lg text-sm font-semibold border transition-colors ${
                        marked ? "bg-teal-500/30 border-teal-500 text-teal-200" : "border-(--border-hairline) text-muted-foreground"
                      }`}
                    >
                      {isFree ? <Emoji name="trophy" size={20} animated={false} /> : card[col][row]}
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            [0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="grid grid-cols-5 gap-1">
                {COLUMNS.map((_, col) => (
                  <div key={col} className="w-14 h-14 rounded-lg border border-(--border-hairline) bg-(--surface-sunken) animate-pulse" />
                ))}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-center gap-3">
          <Button
            onClick={callNumber}
            disabled={!card || hasBingo || called.length >= 75}
            className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white border-0"
          >
            Call Next Number
          </Button>
          <Button onClick={reset} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" /> New Card
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">{called.length} of 75 numbers called</p>
      </div>
    </div>
  );
}
