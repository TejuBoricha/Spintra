"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageCircleQuestion, Shuffle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { playSwipe, playPop } from "@/lib/audio";

const BACKUP_PROMPTS = [
  { a: "Be able to fly", b: "Be invisible" },
  { a: "Always be cold", b: "Always be hot" },
  { a: "Live without music", b: "Live without movies" },
  { a: "Have super strength", b: "Have super speed" },
  { a: "Travel to the past", b: "Travel to the future" },
];

export function WouldYouRatherActivity() {
  const { isHost, currentUser, sendActivityEvent, registerEventListener, soundEnabled } = useRoomActivity();
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
        // PostgREST truncates unbounded selects silently (no error) past
        // its configured row cap — an explicit limit makes that ceiling
        // intentional and visible, generous enough to comfortably outgrow
        // the current prompt bank.
        .limit(1000)
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
        setWyrPrompt({ a: event.a, b: event.b });
        setWyrVotes({});
        playSwipe(soundEnabled);
      } else if (event.kind === "wyr_vote") {
        setWyrVotes((prev) => ({
          ...prev,
          [event.userId]: { username: event.username, option: event.option },
        }));
        playPop(soundEnabled);
      } else if (event.kind === "activity_reset") {
        setWyrPrompt(null);
        setWyrVotes({});
      }
    });
  }, [registerEventListener, soundEnabled]);

  return (
    <motion.div
      key="wyr"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-xl mx-auto pt-8"
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
          className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0 rounded-full px-6"
        >
          <Shuffle className="w-4 h-4 mr-2" /> New Question
        </Button>
      )}
      {wyrPrompt ? (
        <>
          <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-6 w-full pt-4">
            {(["A", "B"] as const).map((opt) => {
              const text = opt === "A" ? wyrPrompt.a : wyrPrompt.b;
              const voteCount = Object.values(wyrVotes).filter((v) => v.option === opt).length;
              const myVote = wyrVotes[currentUser.id]?.option;

              const optStyle =
                opt === "A"
                  ? {
                      bg: "bg-gradient-to-br from-rose-500/5 to-orange-500/5",
                      border:
                        myVote === opt
                          ? "border-rose-500 bg-rose-500/10 shadow-rose-500/10"
                          : myVote
                          ? "border-(--border-hairline) opacity-40"
                          : "border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-500/[0.03]",
                      badge: "bg-rose-500/15 text-rose-300 border border-rose-500/20",
                      countColor: "text-rose-400",
                    }
                  : {
                      bg: "bg-gradient-to-br from-cyan-500/5 to-blue-500/5",
                      border:
                        myVote === opt
                          ? "border-cyan-500 bg-cyan-500/10 shadow-cyan-500/10"
                          : myVote
                          ? "border-(--border-hairline) opacity-40"
                          : "border-cyan-500/20 hover:border-cyan-500/50 hover:bg-cyan-500/[0.03]",
                      badge: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20",
                      countColor: "text-cyan-400",
                    };

              return (
                <motion.button
                  key={opt}
                  whileHover={myVote ? {} : { scale: 1.02, y: -2 }}
                  whileTap={myVote ? {} : { scale: 0.98 }}
                  onClick={() => {
                    if (myVote) return;
                    sendActivityEvent({
                      kind: "wyr_vote",
                      userId: currentUser.id,
                      username: currentUser.username,
                      option: opt,
                    });
                  }}
                  aria-pressed={myVote === opt}
                  // outline-none + the app's shared focus-visible ring —
                  // this raw motion.button otherwise fell back to the
                  // browser default outline, unlike every shared Button.
                  className={`relative flex flex-col p-6 h-48 rounded-3xl border text-left transition-all duration-300 shadow-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${optStyle.bg} ${optStyle.border}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge
                      className={`text-[10px] uppercase font-bold tracking-wider ${optStyle.badge}`}
                    >
                      Option {opt}
                    </Badge>
                    {/* Explicit non-color "this is your vote" signal — the
                        border/opacity shift alone is a weak cue, especially
                        for color-blind users. */}
                    {myVote === opt && (
                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${optStyle.countColor}`}>
                        <Check className="w-3.5 h-3.5" aria-hidden="true" /> Your vote
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-base flex-1 line-clamp-3 leading-relaxed text-foreground">
                    {text}
                  </p>
                  <div className="flex items-baseline gap-2 mt-4">
                    <span className={`text-3xl font-black ${optStyle.countColor}`}>{voteCount}</span>
                    <span className="text-xs text-muted-foreground font-semibold">
                      vote{voteCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </motion.button>
              );
            })}

            {/* Central VS Divider */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 border border-(--border-hairline) shadow-xl z-10">
              <span className="text-xs font-black text-white tracking-widest">VS</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {Object.values(wyrVotes).map((v, i) => (
              <Badge
                key={i}
                className={
                  v.option === "A"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                }
              >
                {v.username} → {v.option}
              </Badge>
            ))}
          </div>
        </>
      ) : (
        <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-3xl p-12 text-center w-full shadow-xl">
          <p className="mb-4 flex justify-center">
            <Emoji name="thinking_face" size={48} />
          </p>
          <p className="text-muted-foreground font-medium">
            {isHost ? "Press New Question to start" : "Waiting for host to ask a question…"}
          </p>
        </div>
      )}
    </motion.div>
  );
}
