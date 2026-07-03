"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";

export function TruthOrDareActivity() {
  const { isHost, sendActivityEvent, registerEventListener } = useRoomActivity();
  const [todPrompt, setTodPrompt] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "tod_prompt") {
        const payload = event as { promptType: "truth" | "dare"; text: string };
        setTodPrompt({ type: payload.promptType, text: payload.text });
      } else if (event.kind === "activity_reset") {
        setTodPrompt(null);
      }
    });
  }, [registerEventListener]);

  return (
    <motion.div
      key="tod"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-8 max-w-md mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <ShieldAlert className="w-6 h-6 text-pink-400" /> Truth or Dare
      </h2>
      {isHost && (
        <div className="flex gap-3 w-full">
          {[
            { type: "truth", label: "Draw Truth", color: "from-cyan-600 to-blue-600", prompts: ["What's your biggest fear?","What's the most embarrassing thing you've done?","What's a secret you've never told anyone?","Who was your first crush?","What's the worst lie you've told?"] },
            { type: "dare", label: "Draw Dare", color: "from-pink-600 to-red-600", prompts: ["Do your best celebrity impression","Speak in an accent for the next 3 minutes","Text your crush right now","Do 10 jumping jacks","Sing a song for 30 seconds"] },
          ].map((btn) => (
            <Button
              key={btn.type}
              onClick={() => {
                const text = btn.prompts[Math.floor(Math.random() * btn.prompts.length)];
                sendActivityEvent({ kind: "tod_prompt", promptType: btn.type as "truth" | "dare", text });
              }}
              className={`flex-1 bg-gradient-to-r ${btn.color} text-white border-0`}
            >
              {btn.label}
            </Button>
          ))}
        </div>
      )}
      {todPrompt ? (
        <motion.div
          key={todPrompt.text}
          initial={{ opacity: 0, scale: 0.9, rotateX: -20 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          className={`glass-card p-8 rounded-2xl text-center w-full border-2 ${todPrompt.type === "truth" ? "border-cyan-500/50" : "border-pink-500/50"}`}
        >
          <Badge className={`mb-4 gap-1 ${todPrompt.type === "truth" ? "bg-cyan-500/20 text-cyan-300" : "bg-pink-500/20 text-pink-300"}`}>
            {todPrompt.type === "truth" ? (
              <>Truth <Emoji name="thinking_face" size={18} /></>
            ) : (
              <>Dare <Emoji name="fire" size={18} /></>
            )}
          </Badge>
          <p className="text-xl font-semibold">{todPrompt.text}</p>
        </motion.div>
      ) : (
        <div className="glass-card p-8 rounded-2xl text-center w-full border border-white/10">
          <p className="mb-3 flex justify-center"><Emoji name="performing_arts" size={48} /></p>
          <p className="text-muted-foreground">{isHost ? "Choose Truth or Dare above" : "Waiting for host to draw a card…"}</p>
        </div>
      )}
    </motion.div>
  );
}
