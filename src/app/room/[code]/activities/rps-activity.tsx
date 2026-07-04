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
      className="flex flex-col items-center gap-8 max-w-md mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Swords className="w-6 h-6 text-rose-500" /> Rock Paper Scissors
      </h2>

      {!rpsChoices[currentUser.id] ? (
        <div className="flex gap-4">
          {(["Rock", "Paper", "Scissors"] as const).map((choice) => {
            const config = {
              Rock: { border: "hover:border-rose-500/50 hover:bg-rose-500/10", text: "text-rose-400" },
              Paper: { border: "hover:border-cyan-500/50 hover:bg-cyan-500/10", text: "text-cyan-400" },
              Scissors: { border: "hover:border-purple-500/50 hover:bg-purple-500/10", text: "text-purple-400" },
            }[choice];

            return (
              <motion.button
                key={choice}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  sendActivityEvent({
                    kind: "rps_choice",
                    userId: currentUser.id,
                    username: currentUser.username,
                    choice,
                  });
                }}
                className={`flex flex-col items-center gap-3 p-6 w-28 rounded-2xl border border-white/10 ${config.border} shadow-lg hover:shadow-2xl transition-all duration-300 bg-white/[0.02]`}
              >
                <Emoji name={RPS_EMOJI[choice]} size={44} pop />
                <span className={`text-sm font-semibold ${config.text}`}>{choice}</span>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-6 rounded-2xl text-center w-full max-w-xs border border-white/10 shadow-xl bg-gradient-to-br from-white/[0.01] to-white/[0.03]">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Your pick</p>
          <div className="flex flex-col items-center gap-2">
            <Emoji
              name={RPS_EMOJI[rpsChoices[currentUser.id].choice as keyof typeof RPS_EMOJI]}
              size={56}
              pop
            />
            <span className="text-xl font-bold text-white mt-1">
              {rpsChoices[currentUser.id].choice}
            </span>
          </div>
        </div>
      )}

      <div className="w-full space-y-2 max-h-56 overflow-y-auto pr-1">
        {Object.values(rpsChoices).map((r, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl shadow-sm"
          >
            <span className="font-semibold text-sm text-muted-foreground">{r.username}</span>
            <span className="text-[10px] text-purple-400/80 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/10">
              Locked In
            </span>
            <span className="ml-auto flex items-center gap-2">
              {r.username === currentUser.username || isHost ? (
                <>
                  <Emoji name={RPS_EMOJI[r.choice as keyof typeof RPS_EMOJI]} size={20} animated={false} />
                  <span className="text-xs font-semibold">{r.choice}</span>
                </>
              ) : (
                <>
                  <Emoji name="shushing_face" size={20} animated={false} />
                  <span className="text-xs text-muted-foreground">Chosen</span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      {isHost && Object.keys(rpsChoices).length >= 1 && (
        <Button
          onClick={() => {
            sendActivityEvent({ kind: "rps_reset" });
          }}
          variant="outline"
          className="h-10 px-5 text-sm font-semibold border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-full transition-all"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> New Round
        </Button>
      )}
    </motion.div>
  );
}
