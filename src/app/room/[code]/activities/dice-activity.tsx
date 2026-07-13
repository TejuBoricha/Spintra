"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";
import { playDiceRoll, playTick } from "@/lib/audio";

export function DiceActivity() {
  const { isHost, sendActivityEvent, registerEventListener, soundEnabled } = useRoomActivity();
  const [diceResults, setDiceResults] = useState<number[]>([]);
  const [diceRolling, setDiceRolling] = useState(false);
  // Same unmount-cleanup gap as Coin Flip's flipTimerRef — without this, a
  // pending roll broadcast could still fire after the host switched away
  // from Dice, leaking a stray event into whatever activity followed.
  const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "dice_rolling") {
        setDiceRolling(true);
        playDiceRoll(soundEnabled);
        
        if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
        
        // Host migration fix: compute instantly, delay the UI locally.
        if (event.results) {
          rollTimerRef.current = setTimeout(() => {
            setDiceResults(event.results!); // Use non-null assertion since we checked it
            setDiceRolling(false);
            playTick(soundEnabled);
          }, 900);
        }
      } else if (event.kind === "dice_roll") {
        // Kept for backward compatibility with pre-migration event logs
        if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
        setDiceResults(event.results);
        setDiceRolling(false);
        playTick(soundEnabled);
      } else if (event.kind === "activity_reset") {
        if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
        setDiceResults([]);
        setDiceRolling(false);
      }
    });
  }, [registerEventListener, soundEnabled]);

  return (
    <motion.div
      key="dice"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-8 max-w-md mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Emoji name="game_die" size={28} /> Dice Roller
      </h2>

      {/* Announces each roll's values to screen readers — the dice faces
          themselves are purely visual glyphs. Visually hidden; the visible
          grid below stays exactly as it was. */}
      <div className="sr-only" role="status" aria-live="polite">
        {!diceRolling && diceResults.length > 0
          ? `Rolled: ${diceResults.join(", ")}${diceResults.length > 1 ? ` — total ${diceResults.reduce((a, b) => a + b, 0)}` : ""}`
          : null}
      </div>

      {/* Dice Grid aligned with standalone tool design */}
      <div className="flex flex-wrap gap-6 justify-center py-4">
        {(diceResults.length > 0 ? diceResults : [0]).map((val, i) => (
          <motion.div
            key={i}
            animate={diceRolling ? { rotate: [0, 180, 360], scale: [1, 1.25, 1], y: [0, -20, 0] } : { rotate: 0, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: i * 0.08, ease: "easeInOut" }}
            className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-(--violet-600) flex items-center justify-center text-5xl font-black text-white shadow-2xl border border-(--border-strong) select-none ${
              val === 0 ? "opacity-40" : "shadow-glow-primary-sm"
            }`}
          >
            {val === 0 ? "?" : ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][val - 1]}
          </motion.div>
        ))}
      </div>

      {diceResults.length > 1 && (
        <motion.p
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-xl font-bold text-(--brand-primary-strong) bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20"
        >
          Total: {diceResults.reduce((a, b) => a + b, 0)}
        </motion.p>
      )}

      {isHost && (
        <div className="flex flex-col items-center gap-2 w-full">
          {diceResults.length === 0 && !diceRolling && (
            <p className="text-xs text-muted-foreground">Press Roll to see the result</p>
          )}
          <div className="flex gap-3 flex-wrap justify-center w-full">
          {[1, 2, 4].map((count) => (
            <Button
              key={count}
              disabled={diceRolling}
              onClick={() => {
              const results = Array.from({ length: count }, () => Math.ceil(Math.random() * 6));
              sendActivityEvent({ kind: "dice_rolling", results });
            }}
              variant="outline"
              className="h-10 px-5 text-sm font-semibold border-primary/30 hover:bg-primary/10 text-(--brand-primary-strong) rounded-full transition-all"
            >
              Roll {count}d6
            </Button>
          ))}
          </div>
        </div>
      )}
      {!isHost && diceResults.length === 0 && !diceRolling && (
        <EmptyState icon={<Emoji name="game_die" size={48} />} description="Waiting for host to roll…" />
      )}
    </motion.div>
  );
}
