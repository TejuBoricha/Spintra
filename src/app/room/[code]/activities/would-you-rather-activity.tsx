"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageCircleQuestion, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const BACKUP_PROMPTS = [
  { a: "Be able to fly", b: "Be invisible" },
  { a: "Always be cold", b: "Always be hot" },
  { a: "Live without music", b: "Live without movies" },
  { a: "Have super strength", b: "Have super speed" },
  { a: "Travel to the past", b: "Travel to the future" },
];

export function WouldYouRatherActivity() {
  const { isHost, currentUser, sendActivityEvent, registerEventListener } = useRoomActivity();
  const [wyrPrompt, setWyrPrompt] = useState<{ a: string; b: string } | null>(null);
  const [wyrVotes, setWyrVotes] = useState<Record<string, { username: string; option: "A" | "B" }>>({});
  const [prompts, setPrompts] = useState<{ a: string; b: string }[]>(BACKUP_PROMPTS);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase && isHost) {
      supabase
        .from("activity_prompts")
        .select("*")
        .eq("activity_type", "would-you-rather")
        .then(({ data, error }) => {
          if (data && !error) {
            const fetched = data.map((p) => p.prompt_data as { a: string; b: string });
            if (fetched.length > 0) {
              setPrompts(fetched);
            }
          }
        });
    }
  }, [isHost]);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "wyr_prompt") {
        const payload = event as { a: string; b: string };
        setWyrPrompt({ a: payload.a, b: payload.b });
        setWyrVotes({});
      } else if (event.kind === "wyr_vote") {
        const payload = event as { userId: string; username: string; option: "A" | "B" };
        setWyrVotes((prev) => ({
          ...prev,
          [payload.userId]: { username: payload.username, option: payload.option },
        }));
      } else if (event.kind === "activity_reset") {
        setWyrPrompt(null);
        setWyrVotes({});
      }
    });
  }, [registerEventListener]);

  return (
    <motion.div
      key="wyr"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-lg mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <MessageCircleQuestion className="w-6 h-6 text-emerald-400" /> Would You Rather
      </h2>
      {isHost && (
        <Button
          onClick={() => {
            const prompt = prompts[Math.floor(Math.random() * prompts.length)];
            sendActivityEvent({ kind: "wyr_prompt", ...prompt });
          }}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0"
        >
          <Shuffle className="w-4 h-4 mr-2" /> New Question
        </Button>
      )}
      {wyrPrompt ? (
        <>
          <div className="grid grid-cols-2 gap-4 w-full">
            {(["A", "B"] as const).map((opt) => {
              const text = opt === "A" ? wyrPrompt.a : wyrPrompt.b;
              const voteCount = Object.values(wyrVotes).filter((v) => v.option === opt).length;
              const myVote = wyrVotes[currentUser.id]?.option;
              return (
                <motion.button
                  key={opt}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (myVote) return;
                    sendActivityEvent({ kind: "wyr_vote", userId: currentUser.id, username: currentUser.username, option: opt });
                  }}
                  className={`p-6 rounded-2xl border-2 text-left transition-all ${
                    myVote === opt
                      ? "border-emerald-500 bg-emerald-500/20"
                      : myVote
                      ? "border-white/10 opacity-60"
                      : "border-white/20 hover:border-emerald-500/50 hover:bg-emerald-500/10"
                  }`}
                >
                  <Badge className="mb-3 bg-white/10 text-white/60">Option {opt}</Badge>
                  <p className="font-semibold">{text}</p>
                  <p className="mt-3 text-2xl font-black text-emerald-400">{voteCount}</p>
                  <p className="text-xs text-muted-foreground">vote{voteCount !== 1 ? "s" : ""}</p>
                </motion.button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.values(wyrVotes).map((v, i) => (
              <Badge key={i} className={v.option === "A" ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-500/20 text-blue-300"}>
                {v.username} → {v.option}
              </Badge>
            ))}
          </div>
        </>
      ) : (
        <div className="glass-card p-8 rounded-2xl text-center w-full border border-white/10">
          <p className="mb-3 flex justify-center"><Emoji name="thinking_face" size={48} /></p>
          <p className="text-muted-foreground">{isHost ? "Press New Question to start" : "Waiting for host…"}</p>
        </div>
      )}
    </motion.div>
  );
}
