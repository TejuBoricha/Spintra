"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { HeartHandshake, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/emoji";
import { useRoomActivity, useRoomParticipants } from "../context/room-activity-context";

export function NameDrawActivity() {
  const { isHost, sendActivityEvent, registerEventListener } = useRoomActivity();
  const { participants } = useRoomParticipants();
  const [ndWinner, setNdWinner] = useState<string | null>(null);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "nd_winner") {
        setNdWinner(event.winner);
      } else if (event.kind === "activity_reset") {
        setNdWinner(null);
      }
    });
  }, [registerEventListener]);

  return (
    <motion.div
      key="name-draw"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-8 max-w-md mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <HeartHandshake className="w-6 h-6 text-pink-400" /> Name Draw
      </h2>
      {ndWinner ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center glass-card p-10 rounded-2xl border-2 border-pink-500/50 w-full"
        >
          <p className="text-sm text-muted-foreground mb-2">Selected</p>
          <p className="text-4xl font-black text-pink-400 flex items-center justify-center gap-2">
            {ndWinner} <Emoji name="party_popper" size={36} pop />
          </p>
        </motion.div>
      ) : (
        <div className="glass-card p-10 rounded-2xl text-center border border-white/10 w-full">
          <p className="mb-3 flex justify-center"><Emoji name="admission_tickets" size={48} /></p>
          <p className="text-muted-foreground">{isHost ? "Draw a name from the room" : "Waiting for host to draw…"}</p>
        </div>
      )}
      {isHost && (
        <Button
          onClick={() => {
            const online = participants.filter((p) => p.is_online);
            const winner = online[Math.floor(Math.random() * online.length)]?.user?.username || "?";
            sendActivityEvent({ kind: "nd_winner", winner });
          }}
          className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white border-0"
        >
          <Shuffle className="w-4 h-4 mr-2" /> Draw a Name
        </Button>
      )}
    </motion.div>
  );
}
