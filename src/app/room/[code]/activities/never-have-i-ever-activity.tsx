"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { playSwipe, playPop } from "@/lib/audio";

const BACKUP_STATEMENTS = [
  "Never have I ever lied to get out of trouble",
  "Never have I ever pulled an all-nighter",
  "Never have I ever gone skydiving",
  "Never have I ever eaten something off the floor",
  "Never have I ever ghosted someone",
];

export function NeverHaveIEverActivity() {
  const { isHost, currentUser, sendActivityEvent, registerEventListener, soundEnabled } = useRoomActivity();
  const [nhiePrompt, setNhiePrompt] = useState<string | null>(null);
  const [nhieConfessions, setNhieConfessions] = useState<
    Record<string, { username: string; choice: "have" | "never" }>
  >({});
  const [statements, setStatements] = useState<string[]>(BACKUP_STATEMENTS);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase && isHost) {
      supabase
        .from("activity_prompts")
        .select("*")
        .eq("activity_type", "never-have-i-ever")
        // PostgREST truncates unbounded selects silently (no error) past
        // its configured row cap — an explicit limit makes that ceiling
        // intentional and visible, generous enough to comfortably outgrow
        // the current prompt bank.
        .limit(1000)
        .then(({ data, error }) => {
          if (data && !error) {
            const fetched = data.map((p) => (p.prompt_data as { text: string }).text);
            if (fetched.length > 0) {
              setStatements(fetched);
            }
          }
        });
    }
  }, [isHost]);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "nhie_prompt") {
        setNhiePrompt(event.text);
        setNhieConfessions({});
        playSwipe(soundEnabled);
      } else if (event.kind === "nhie_confess") {
        setNhieConfessions((prev) => ({
          ...prev,
          [event.userId]: { username: event.username, choice: event.choice },
        }));
        playPop(soundEnabled);
      } else if (event.kind === "activity_reset") {
        setNhiePrompt(null);
        setNhieConfessions({});
      }
    });
  }, [registerEventListener, soundEnabled]);

  return (
    <motion.div
      key="nhie"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-xl mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Eye className="w-6 h-6 text-violet-400" /> Never Have I Ever
      </h2>
      {isHost && (
        <Button
          onClick={() => {
            const text = statements[Math.floor(Math.random() * statements.length)];
            sendActivityEvent({ kind: "nhie_prompt", text });
          }}
          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0 rounded-full px-6"
        >
          <Shuffle className="w-4 h-4 mr-2" /> Next Statement
        </Button>
      )}
      {nhiePrompt ? (
        <>
          <div className="w-full text-center px-8 py-10 rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 shadow-lg shadow-violet-500/5 leading-relaxed">
            <p className="text-xl font-bold text-foreground leading-normal">{nhiePrompt}</p>
          </div>
          <div className="flex gap-4 w-full pt-2">
            {(["have", "never"] as const).map((choice) => {
              const count = Object.values(nhieConfessions).filter((c) => c.choice === choice).length;
              const myChoice = nhieConfessions[currentUser.id]?.choice;

              const config =
                choice === "have"
                  ? {
                      bg: "from-rose-500/5 to-pink-500/5",
                      border:
                        myChoice === choice
                          ? "border-rose-500 bg-rose-500/10 shadow-rose-500/10"
                          : myChoice
                          ? "border-border opacity-40"
                          : "border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-500/[0.03]",
                      text: "text-rose-400",
                    }
                  : {
                      bg: "from-emerald-500/5 to-teal-500/5",
                      border:
                        myChoice === choice
                          ? "border-emerald-500 bg-emerald-500/10 shadow-emerald-500/10"
                          : myChoice
                          ? "border-border opacity-40"
                          : "border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/[0.03]",
                      text: "text-emerald-400",
                    };

              return (
                <motion.button
                  key={choice}
                  whileHover={myChoice ? {} : { scale: 1.02, y: -2 }}
                  whileTap={myChoice ? {} : { scale: 0.98 }}
                  onClick={() => {
                    if (myChoice) return;
                    sendActivityEvent({
                      kind: "nhie_confess",
                      userId: currentUser.id,
                      username: currentUser.username,
                      choice,
                    });
                  }}
                  className={`flex-1 py-6 rounded-2xl border font-bold transition-all duration-300 shadow-md ${config.bg} ${config.border}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {choice === "have" ? (
                      <>
                        <Emoji name="raised_hand" size={20} />
                        <span className="text-base text-rose-300">I have</span>
                      </>
                    ) : (
                      <>
                        <Emoji name="person_gesturing_no" size={20} />
                        <span className="text-base text-emerald-300">Never</span>
                      </>
                    )}
                  </div>
                  <div className={`text-3xl font-black mt-2 ${config.text}`}>{count}</div>
                </motion.button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {Object.values(nhieConfessions).map((c, i) => (
              <Badge
                key={i}
                className={
                  c.choice === "have"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }
              >
                {c.username} → {c.choice === "have" ? "I have" : "Never"}
              </Badge>
            ))}
          </div>
        </>
      ) : (
        <div className="glass-card p-12 rounded-3xl text-center w-full border border-border shadow-xl">
          <p className="mb-4 flex justify-center">
            <Emoji name="see_no_evil_monkey" size={48} />
          </p>
          <p className="text-muted-foreground font-medium">
            {isHost ? "Press Next Statement to start" : "Waiting for host…"}
          </p>
        </div>
      )}
    </motion.div>
  );
}
