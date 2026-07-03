"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Target, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoomActivity } from "../context/room-activity-context";

export function GuessNumberActivity() {
  const { isHost, sendActivityEvent, registerEventListener, currentUser } = useRoomActivity();

  const [guessHistory, setGuessHistory] = useState<{ username: string; guess: number; hint: string }[]>([]);
  const [guessSecretNumber, setGuessSecretNumber] = useState(50);

  useEffect(() => {
    return registerEventListener((event) => {
      switch (event.kind) {
        case "guess_submit": {
          const payload = event as { username: string; guess: number; hint: string };
          setGuessHistory((prev) => [...prev, { username: payload.username, guess: payload.guess, hint: payload.hint }]);
          break;
        }
        case "guess_reset": {
          const payload = event as { secret: number };
          setGuessHistory([]);
          setGuessSecretNumber(payload.secret);
          break;
        }
        case "activity_reset":
          setGuessHistory([]);
          break;
      }
    });
  }, [registerEventListener]);

  return (
    <motion.div
      key="guess-number"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-6 max-w-md mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Target className="w-6 h-6 text-cyan-400" /> Guess the Number
      </h2>
      {isHost && (
        <div className="glass-card p-4 rounded-xl space-y-2">
          <p className="text-sm text-muted-foreground">Secret number (only you can see):</p>
          <div className="flex gap-2 items-center">
            <span className="text-3xl font-black text-cyan-400">{guessSecretNumber}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const secret = Math.floor(Math.random() * 100) + 1;
                setGuessSecretNumber(secret);
                sendActivityEvent({ kind: "guess_reset", secret });
              }}
              className="ml-auto border-white/20"
            >
              New Number
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {guessHistory.map((g, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
              g.hint === "correct" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5"
            }`}
          >
            <span className="font-medium">{g.username}</span>
            <span className="ml-auto font-mono">{g.guess}</span>
            <span className={g.hint === "too high" ? "text-red-400" : g.hint === "too low" ? "text-amber-400" : "text-emerald-400"}>
              {g.hint === "too high" ? <ArrowDown className="w-4 h-4" /> : g.hint === "too low" ? <ArrowUp className="w-4 h-4" /> : "✓"}
            </span>
          </div>
        ))}
        {guessHistory.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No guesses yet…</p>}
      </div>
      {!isHost && (
        <div className="flex gap-2">
          <Input
            id="guess-input"
            type="number"
            min={1}
            max={100}
            placeholder="1 – 100"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = parseInt((e.target as HTMLInputElement).value);
                if (!val || val < 1 || val > 100) return;
                const hint = val === guessSecretNumber ? "correct" : val > guessSecretNumber ? "too high" : "too low";
                sendActivityEvent({ kind: "guess_submit", username: currentUser.username, guess: val, hint });
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          <Button
            onClick={() => {
              const input = document.getElementById("guess-input") as HTMLInputElement;
              const val = parseInt(input?.value);
              if (!val || val < 1 || val > 100) return;
              const hint = val === guessSecretNumber ? "correct" : val > guessSecretNumber ? "too high" : "too low";
              sendActivityEvent({ kind: "guess_submit", username: currentUser.username, guess: val, hint });
              if (input) input.value = "";
            }}
            className="bg-cyan-600 hover:bg-cyan-500 text-white border-0"
          >
            Guess
          </Button>
        </div>
      )}
    </motion.div>
  );
}
