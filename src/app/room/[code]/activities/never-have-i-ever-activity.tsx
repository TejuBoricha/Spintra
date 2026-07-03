"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const BACKUP_STATEMENTS = [
  "Never have I ever lied to get out of trouble",
  "Never have I ever pulled an all-nighter",
  "Never have I ever gone skydiving",
  "Never have I ever eaten something off the floor",
  "Never have I ever ghosted someone",
];

export function NeverHaveIEverActivity() {
  const { isHost, currentUser, sendActivityEvent, registerEventListener } = useRoomActivity();
  const [nhiePrompt, setNhiePrompt] = useState<string | null>(null);
  const [nhieConfessions, setNhieConfessions] = useState<Record<string, { username: string; choice: "have" | "never" }>>({});
  const [statements, setStatements] = useState<string[]>(BACKUP_STATEMENTS);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase && isHost) {
      supabase
        .from("activity_prompts")
        .select("*")
        .eq("activity_type", "never-have-i-ever")
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
        const payload = event as { text: string };
        setNhiePrompt(payload.text);
        setNhieConfessions({});
      } else if (event.kind === "nhie_confess") {
        const payload = event as { userId: string; username: string; choice: "have" | "never" };
        setNhieConfessions((prev) => ({
          ...prev,
          [payload.userId]: { username: payload.username, choice: payload.choice },
        }));
      } else if (event.kind === "activity_reset") {
        setNhiePrompt(null);
        setNhieConfessions({});
      }
    });
  }, [registerEventListener]);

  return (
    <motion.div
      key="nhie"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-md mx-auto pt-8"
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
          className="bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0"
        >
          <Shuffle className="w-4 h-4 mr-2" /> Next Statement
        </Button>
      )}
      {nhiePrompt ? (
        <>
          <div className="glass-card p-6 rounded-2xl text-center w-full border border-violet-500/30">
            <p className="text-lg font-semibold">{nhiePrompt}</p>
          </div>
          <div className="flex gap-4 w-full">
            {(["have", "never"] as const).map((choice) => {
              const count = Object.values(nhieConfessions).filter((c) => c.choice === choice).length;
              const myChoice = nhieConfessions[currentUser.id]?.choice;
              return (
                <motion.button
                  key={choice}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (myChoice) return;
                    sendActivityEvent({ kind: "nhie_confess", userId: currentUser.id, username: currentUser.username, choice });
                  }}
                  className={`flex-1 py-6 rounded-2xl border-2 font-bold text-lg transition-all ${
                    myChoice === choice
                      ? choice === "have" ? "border-rose-500 bg-rose-500/20 text-rose-300" : "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                      : "border-white/20 hover:border-white/40"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {choice === "have" ? (
                      <><Emoji name="raised_hand" size={20} /> I have</>
                    ) : (
                      <><Emoji name="person_gesturing_no" size={20} /> Never</>
                    )}
                  </div>
                  <div className="text-3xl font-black mt-1">{count}</div>
                </motion.button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="glass-card p-8 rounded-2xl text-center w-full border border-white/10">
          <p className="mb-3 flex justify-center"><Emoji name="see_no_evil_monkey" size={48} /></p>
          <p className="text-muted-foreground">{isHost ? "Press Next Statement to start" : "Waiting for host…"}</p>
        </div>
      )}
    </motion.div>
  );
}
