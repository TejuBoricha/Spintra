"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoomActivity } from "../context/room-activity-context";

export function CoinFlipActivity() {
  const { isHost, sendActivityEvent, registerEventListener } = useRoomActivity();
  const [coinResult, setCoinResult] = useState<"Heads" | "Tails" | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "coin_flipping") {
        setCoinFlipping(true);
      } else if (event.kind === "coin_flip") {
        const payload = event as { result: "Heads" | "Tails" };
        setCoinResult(payload.result);
        setCoinFlipping(false);
      } else if (event.kind === "activity_reset") {
        setCoinResult(null);
        setCoinFlipping(false);
      }
    });
  }, [registerEventListener]);

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
      <motion.div
        animate={coinFlipping ? { rotateY: [0, 720], scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 1.2, ease: "easeInOut" }}
        className={`w-36 h-36 rounded-full flex items-center justify-center text-5xl font-black shadow-2xl border-4 ${
          coinResult === "Heads"
            ? "bg-gradient-to-br from-amber-400 to-yellow-600 border-amber-500 text-white"
            : coinResult === "Tails"
            ? "bg-gradient-to-br from-slate-400 to-slate-600 border-slate-500 text-white"
            : "bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border-white/20 text-white/40"
        }`}
      >
        {coinResult === "Heads" ? "H" : coinResult === "Tails" ? "T" : "?"}
      </motion.div>
      {coinResult && (
        <motion.p
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-3xl font-bold text-amber-400"
        >
          {coinResult}!
        </motion.p>
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
      {!isHost && !coinResult && (
        <p className="text-muted-foreground text-sm">Waiting for host to flip…</p>
      )}
    </motion.div>
  );
}
