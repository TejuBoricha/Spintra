"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";
import { playCoinFlip, playTick } from "@/lib/audio";

export function CoinFlipActivity() {
  const { isHost, sendActivityEvent, registerEventListener, soundEnabled } = useRoomActivity();
  const [coinResult, setCoinResult] = useState<"Heads" | "Tails" | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "coin_flipping") {
        setCoinFlipping(true);
        setCoinResult(null);
        playCoinFlip(soundEnabled);
      } else if (event.kind === "coin_flip") {
        setCoinResult(event.result);
        setCoinFlipping(false);
        playTick(soundEnabled);
      } else if (event.kind === "activity_reset") {
        setCoinResult(null);
        setCoinFlipping(false);
      }
    });
  }, [registerEventListener, soundEnabled]);

  return (
    <motion.div
      key="coin-flip"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-8 max-w-sm mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Coins className="w-6 h-6 text-amber-400" /> Coin Flip
      </h2>

      {/* 3D Animated Coin aligned with standalone tool design */}
      <motion.div
        className="relative w-40 h-40 mx-auto"
        animate={coinFlipping ? { rotateY: [0, 720, 1440, 2160, 2880] } : {}}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{ perspective: 800 }}
      >
        <div
          className={`w-full h-full rounded-full bg-gradient-to-br ${
            coinResult === "Heads"
              ? "from-yellow-500 to-amber-600 shadow-yellow-500/20"
              : coinResult === "Tails"
              ? "from-slate-400 to-slate-600 shadow-slate-500/20"
              : "from-purple-500/30 to-cyan-500/30 border border-white/10"
          } flex items-center justify-center shadow-2xl`}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={coinResult !== null ? coinResult : "flip"}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Emoji
                name={coinResult === "Heads" ? "coin" : coinResult === "Tails" ? "eagle" : "coin"}
                size={64}
                pop
              />
            </motion.span>
          </AnimatePresence>
        </div>
      </motion.div>

      {coinResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Badge className="text-lg px-6 py-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30">
            {coinResult}!
          </Badge>
        </motion.div>
      )}

      {isHost && (
        <Button
          disabled={coinFlipping}
          onClick={() => {
            sendActivityEvent({ kind: "coin_flipping" });
            setTimeout(() => {
              const result = Math.random() < 0.5 ? "Heads" : "Tails";
              sendActivityEvent({ kind: "coin_flip", result });
            }, 1300);
          }}
          className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white border-0 w-full"
        >
          {coinFlipping ? "Flipping…" : "Flip Coin"}
        </Button>
      )}
      {!isHost && !coinResult && !coinFlipping && (
        <p className="text-muted-foreground text-sm">Waiting for host to flip…</p>
      )}
    </motion.div>
  );
}
