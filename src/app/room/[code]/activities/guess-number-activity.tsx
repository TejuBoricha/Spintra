"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Target, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoomActivity } from "../context/room-activity-context";
import { Emoji } from "@/components/emoji";

export function GuessNumberActivity() {
  const { isHost, sendActivityEvent, registerEventListener, currentUser } = useRoomActivity();

  const [guessHistory, setGuessHistory] = useState<
    { username: string; guess: number; hint: string }[]
  >([]);
  const [guessSecretNumber, setGuessSecretNumber] = useState(50);

  useEffect(() => {
    return registerEventListener((event) => {
      switch (event.kind) {
        case "guess_submit": {
          setGuessHistory((prev) => [
            ...prev,
            { username: event.username, guess: event.guess, hint: event.hint },
          ]);
          break;
        }
        case "guess_reset": {
          setGuessHistory([]);
          setGuessSecretNumber(event.secret);
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
      className="flex flex-col gap-6 max-w-xl mx-auto pt-8 w-full"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Target className="w-6 h-6 text-cyan-400" /> Guess the Number
      </h2>

      {isHost && (
        <div className="glass-card p-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 shadow-lg shadow-cyan-500/5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-bold">
            Secret Number (Host Only):
          </p>
          <div className="flex gap-4 items-center">
            <span className="text-4xl font-black text-cyan-400">{guessSecretNumber}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const secret = Math.floor(Math.random() * 100) + 1;
                setGuessSecretNumber(secret);
                sendActivityEvent({ kind: "guess_reset", secret });
              }}
              className="ml-auto rounded-full border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 h-9 px-4"
            >
              Reset Number
            </Button>
          </div>
        </div>
      )}

      {/* Structured Glassmorphism History Feed */}
      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
        {guessHistory.map((g, i) => {
          const isCorrect = g.hint === "correct";
          const itemStyle = isCorrect
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            : "border-white/5 bg-white/[0.01]";

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl border text-sm shadow-sm transition-all duration-300 ${itemStyle}`}
            >
              <span className="font-bold">{g.username}</span>
              <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                Guessed
              </span>
              <span className="font-mono font-bold text-base">{g.guess}</span>
              <span className="ml-auto flex items-center gap-1.5 font-semibold text-xs">
                {g.hint === "too high" ? (
                  <>
                    <span className="text-red-400">Too High</span>
                    <ArrowDown className="w-4 h-4 text-red-500" />
                  </>
                ) : g.hint === "too low" ? (
                  <>
                    <span className="text-amber-400">Too Low</span>
                    <ArrowUp className="w-4 h-4 text-amber-500" />
                  </>
                ) : (
                  <>
                    <span className="text-emerald-400">Correct!</span>
                    <Emoji name="party_popper" size={16} pop />
                  </>
                )}
              </span>
            </motion.div>
          );
        })}
        {guessHistory.length === 0 && (
          <div className="text-center py-8 glass-card rounded-2xl border border-white/5">
            <p className="mb-2 flex justify-center">
              <Emoji name="thinking_face" size={32} />
            </p>
            <p className="text-muted-foreground text-sm font-medium">No guesses yet. Take a shot!</p>
          </div>
        )}
      </div>

      {!isHost && (
        <div className="flex gap-3 w-full max-w-sm mx-auto">
          <Input
            id="guess-input"
            type="number"
            min={1}
            max={100}
            placeholder="1 – 100"
            className="flex-1 rounded-full px-4 h-11"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = parseInt((e.target as HTMLInputElement).value);
                if (!val || val < 1 || val > 100) return;
                const hint =
                  val === guessSecretNumber
                    ? "correct"
                    : val > guessSecretNumber
                    ? "too high"
                    : "too low";
                sendActivityEvent({
                  kind: "guess_submit",
                  username: currentUser.username,
                  guess: val,
                  hint,
                });
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          <Button
            onClick={() => {
              const input = document.getElementById("guess-input") as HTMLInputElement;
              const val = parseInt(input?.value);
              if (!val || val < 1 || val > 100) return;
              const hint =
                val === guessSecretNumber
                  ? "correct"
                  : val > guessSecretNumber
                  ? "too high"
                  : "too low";
              sendActivityEvent({
                kind: "guess_submit",
                username: currentUser.username,
                guess: val,
                hint,
              });
              if (input) input.value = "";
            }}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border-0 rounded-full px-6 h-11 shadow-md shadow-cyan-500/10"
          >
            Guess
          </Button>
        </div>
      )}
    </motion.div>
  );
}
