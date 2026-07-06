"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { playSwipe } from "@/lib/audio";

const BACKUP_TRUTHS = [
  "What's your biggest fear?",
  "What's the most embarrassing thing you've done?",
  "What's a secret you've never told anyone?",
  "Who was your first crush?",
  "What's the worst lie you've told?",
];

const BACKUP_DARES = [
  "Do your best celebrity impression",
  "Speak in an accent for the next 3 minutes",
  "Text your crush right now",
  "Do 10 jumping jacks",
  "Sing a song for 30 seconds",
];

const TOD_BUTTONS = [
  {
    type: "truth",
    label: "Truth",
    color: "from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500",
    emoji: "thinking_face",
  },
  {
    type: "dare",
    label: "Dare",
    color: "from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500",
    emoji: "fire",
  },
] as const;

export function TruthOrDareActivity() {
  const { isHost, sendActivityEvent, registerEventListener, soundEnabled } = useRoomActivity();
  const [todPrompt, setTodPrompt] = useState<{ type: string; text: string } | null>(null);
  const [prompts, setPrompts] = useState<{ truths: string[]; dares: string[] }>({
    truths: BACKUP_TRUTHS,
    dares: BACKUP_DARES,
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase && isHost) {
      supabase
        .from("activity_prompts")
        .select("*")
        .eq("activity_type", "truth-or-dare")
        // PostgREST truncates unbounded selects silently (no error) past
        // its configured row cap — an explicit limit makes that ceiling
        // intentional and visible, generous enough to comfortably outgrow
        // the current prompt bank.
        .limit(1000)
        .then(({ data, error }) => {
          if (data && !error) {
            const fetchedTruths = data
              .filter((p) => p.category === "truth")
              .map((p) => (p.prompt_data as { text: string }).text);
            const fetchedDares = data
              .filter((p) => p.category === "dare")
              .map((p) => (p.prompt_data as { text: string }).text);

            setPrompts({
              truths: fetchedTruths.length > 0 ? fetchedTruths : BACKUP_TRUTHS,
              dares: fetchedDares.length > 0 ? fetchedDares : BACKUP_DARES,
            });
          }
        });
    }
  }, [isHost]);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "tod_prompt") {
        setTodPrompt({ type: event.promptType, text: event.text });
        playSwipe(soundEnabled);
      } else if (event.kind === "activity_reset") {
        setTodPrompt(null);
      }
    });
  }, [registerEventListener, soundEnabled]);

  return (
    <motion.div
      key="tod"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-8 max-w-xl mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <ShieldAlert className="w-6 h-6 text-pink-500" /> Truth or Dare
      </h2>
      {isHost && (
        <div className="flex gap-4 w-full">
          {TOD_BUTTONS.map((btn) => {
            const list = btn.type === "truth" ? prompts.truths : prompts.dares;
            return (
              <Button
                key={btn.type}
                disabled={!!todPrompt}
                onClick={() => {
                  const text = list[Math.floor(Math.random() * list.length)];
                  sendActivityEvent({
                    kind: "tod_prompt",
                    promptType: btn.type,
                    text,
                  });
                }}
                className={`flex-1 h-12 bg-gradient-to-r ${btn.color} text-white border-0 rounded-full font-bold shadow-lg`}
              >
                <Emoji name={btn.emoji} size={18} className="mr-2" /> Draw {btn.label}
              </Button>
            );
          })}
        </div>
      )}
      {todPrompt ? (
        <motion.div
          key={todPrompt.text}
          initial={{ opacity: 0, scale: 0.9, rotateX: -20 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 12 }}
          role="status"
          aria-live="polite"
          className={`w-full text-center px-8 py-10 rounded-3xl border-2 shadow-2xl leading-relaxed ${
            todPrompt.type === "truth"
              ? "bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border-cyan-500/40 text-cyan-100 shadow-cyan-500/10"
              : "bg-gradient-to-br from-pink-500/5 to-rose-500/5 border-pink-500/40 text-pink-100 shadow-pink-500/10"
          }`}
        >
          <Badge
            className={`mb-4 text-xs font-semibold px-4 py-1 gap-1.5 uppercase tracking-wider ${
              todPrompt.type === "truth"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20"
                : "bg-pink-500/15 text-pink-300 border border-pink-500/20"
            }`}
          >
            {todPrompt.type === "truth" ? (
              <>
                Truth <Emoji name="thinking_face" size={16} />
              </>
            ) : (
              <>
                Dare <Emoji name="fire" size={16} />
              </>
            )}
          </Badge>
          <p className="text-xl font-bold leading-normal text-white">{todPrompt.text}</p>
        </motion.div>
      ) : (
        <div className="glass-card p-12 rounded-3xl text-center w-full border border-white/10 shadow-xl">
          <p className="mb-4 flex justify-center">
            <Emoji name="performing_arts" size={48} />
          </p>
          <p className="text-muted-foreground font-medium">
            {isHost ? "Choose Truth or Dare above" : "Waiting for host to draw a card…"}
          </p>
        </div>
      )}
    </motion.div>
  );
}
