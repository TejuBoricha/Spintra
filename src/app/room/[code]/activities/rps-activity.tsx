"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Swords, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";

const RPS_EMOJI = { Rock: "raised_fist", Paper: "raised_hand", Scissors: "victory_hand" } as const;

export function RpsActivity() {
  const { isHost, currentUser, sendActivityEvent, registerEventListener } = useRoomActivity();
  const [rpsChoices, setRpsChoices] = useState<Record<string, { username: string; choice: string }>>({});

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "rps_choice") {
        setRpsChoices((prev) => ({
          ...prev,
          [event.userId]: { username: event.username, choice: event.choice },
        }));
      } else if (event.kind === "rps_reset" || event.kind === "activity_reset") {
        setRpsChoices({});
      }
    });
  }, [registerEventListener]);

  return (
    <motion.div
      key="rps"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-md mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Swords className="w-6 h-6 text-red-400" /> Rock Paper Scissors
      </h2>
      {!rpsChoices[currentUser.id] ? (
        <div className="flex gap-4">
          {(["Rock", "Paper", "Scissors"] as const).map((choice) => (
            <motion.button
              key={choice}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                sendActivityEvent({ kind: "rps_choice", userId: currentUser.id, username: currentUser.username, choice });
              }}
              className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-white/20 hover:border-red-500/50 hover:bg-red-500/10 transition-all"
            >
              <Emoji name={RPS_EMOJI[choice]} size={44} animated={false} />
              <span className="text-xs text-muted-foreground">{choice}</span>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="glass-card p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground mb-1">Your pick</p>
          <p className="text-3xl font-bold flex items-center justify-center gap-2">
            <Emoji name={RPS_EMOJI[rpsChoices[currentUser.id].choice as keyof typeof RPS_EMOJI]} size={32} pop /> {rpsChoices[currentUser.id].choice}
          </p>
        </div>
      )}
      <div className="w-full space-y-2">
        {Object.values(rpsChoices).map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2 glass rounded-xl">
            <span className="font-medium text-sm">{r.username}</span>
            <span className="ml-auto">
              {r.username === currentUser.username || isHost ? (
                <Emoji name={RPS_EMOJI[r.choice as keyof typeof RPS_EMOJI]} size={24} animated={false} />
              ) : (
                <Emoji name="shushing_face" size={24} animated={false} />
              )}
            </span>
          </div>
        ))}
      </div>
      {isHost && Object.keys(rpsChoices).length >= 2 && (
        <Button
          onClick={() => {
            sendActivityEvent({ kind: "rps_reset" });
          }}
          variant="outline"
          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> New Round
        </Button>
      )}
    </motion.div>
  );
}
