"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/emoji";
import type { ActivityEvent } from "@/lib/types";

interface DiceActivityProps {
  isHost: boolean;
  diceResults: number[];
  diceRolling: boolean;
  sendActivityEvent: (event: ActivityEvent) => void;
  onActivityEventRef: React.RefObject<((event: ActivityEvent) => void) | null>;
}

export function DiceActivity({ isHost, diceResults, diceRolling, sendActivityEvent, onActivityEventRef }: DiceActivityProps) {
  return (
    <motion.div
      key="dice"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-md mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2"><Emoji name="game_die" size={28} /> Dice Roller</h2>
      <div className="flex flex-wrap gap-4 justify-center">
        {(diceResults.length > 0 ? diceResults : [0]).map((val, i) => (
          <motion.div
            key={i}
            animate={diceRolling ? { rotate: [0, 180, 360], scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.8, delay: i * 0.1 }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-4xl font-black text-white shadow-xl border border-purple-500/50"
          >
            {val === 0 ? "?" : ["⚀","⚁","⚂","⚃","⚄","⚅"][val - 1]}
          </motion.div>
        ))}
      </div>
      {diceResults.length > 1 && (
        <p className="text-lg font-semibold text-purple-300">
          Total: {diceResults.reduce((a, b) => a + b, 0)}
        </p>
      )}
      {isHost && (
        <div className="flex gap-3 flex-wrap justify-center">
          {[1, 2, 4].map((count) => (
            <Button
              key={count}
              disabled={diceRolling}
              onClick={() => {
                sendActivityEvent({ kind: "dice_rolling" });
                if (onActivityEventRef.current) onActivityEventRef.current({ kind: "dice_rolling" });
                setTimeout(() => {
                  const results = Array.from({ length: count }, () => Math.ceil(Math.random() * 6));
                  sendActivityEvent({ kind: "dice_roll", results });
                  if (onActivityEventRef.current) onActivityEventRef.current({ kind: "dice_roll", results });
                }, 900);
              }}
              variant="outline"
              className="border-purple-500/50 hover:bg-purple-500/20"
            >
              Roll {count}d6
            </Button>
          ))}
        </div>
      )}
      {!isHost && diceResults.length === 0 && (
        <p className="text-muted-foreground text-sm">Waiting for host to roll…</p>
      )}
    </motion.div>
  );
}
