"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Target, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoomActivity } from "../context/room-activity-context";
import { Emoji } from "@/components/emoji";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function GuessNumberActivity() {
  const { roomCode, isHost, sendActivityEvent, registerEventListener, currentUser } = useRoomActivity();

  const [guessHistory, setGuessHistory] = useState<
    { username: string; guess: number; hint: string }[]
  >([]);
  const [guessSecretNumber, setGuessSecretNumber] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  // submitGuess is a real network round-trip (awaits check_guess_number),
  // unlike the other activities' synchronous local event-bus dispatch —
  // with no guard, a fast double-click/double-Enter fired multiple
  // concurrent RPC calls for the same guess.
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          if (typeof event.secret === "number") setGuessSecretNumber(event.secret);
          else setGuessSecretNumber(null);
          break;
        }
        case "activity_reset":
          setGuessHistory([]);
          break;
      }
    });
  }, [registerEventListener]);

  useEffect(() => {
    if (isHost && guessSecretNumber === null && roomCode) {
      const fetchSecret = async () => {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { data, error } = await supabase.rpc("get_guess_number_secret", {
            p_room_code: roomCode,
          });
          // Note: if the secret hasn't been set at all, the DB will return null.
          if (!error && data !== null) {
            setGuessSecretNumber(data);
          }
        }
      };
      void fetchSecret();
    }
  }, [isHost, guessSecretNumber, roomCode]);

  // Real Supabase mode: the secret is set/checked server-side (migration
  // 0028's RPCs) so it's never known to any client but the host's own, and a
  // guess's hint can't be forged by broadcasting a fabricated result. Demo
  // mode has no real backend to check against, so it falls back to the
  // previous client-local comparison — there's no meaningful security
  // boundary there anyway (single browser, BroadcastChannel-shared identity).
  const resetSecretNumber = async () => {
    if (resetting) return;
    setResetting(true);
    const secret = Math.floor(Math.random() * 100) + 1;
    setGuessSecretNumber(secret);

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase.rpc("set_guess_number_secret", {
        p_room_code: roomCode,
        p_secret: secret,
      });
      if (error) {
        console.error("Failed to set secret number:", error.message);
        toast.error("Couldn't set the secret number. Please try again.");
        setResetting(false);
        return;
      }
      sendActivityEvent({ kind: "guess_reset" });
    } else {
      sendActivityEvent({ kind: "guess_reset", secret });
    }
    setResetting(false);
  };

  const submitGuess = async (val: number) => {
    if (!val || val < 1 || val > 100 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      let hint: string;
      if (supabase) {
        const { data, error } = await supabase.rpc("check_guess_number", {
          p_room_code: roomCode,
          p_guess: val,
        });
        if (error || !data) {
          console.error("Failed to check guess:", error?.message);
          toast.error("Couldn't check your guess. Please try again.");
          return;
        }
        hint = data;
      } else {
        const secret = guessSecretNumber ?? 50; // Fallback only ever hit if demo mode and somehow null
        hint = val === secret ? "correct" : val > secret ? "too high" : "too low";
      }

      sendActivityEvent({ kind: "guess_submit", username: currentUser.username, guess: val, hint });
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <div className="bg-(--surface-panel) p-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 shadow-lg shadow-cyan-500/5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-bold">
            Secret Number (Host Only):
          </p>
          {guessHistory.length === 0 && (
            <p className="text-xs text-muted-foreground mb-2">
              Share the range 1–100, then wait for guesses to come in
            </p>
          )}
          <div className="flex gap-4 items-center">
            <span className="text-4xl font-black text-cyan-400">{guessSecretNumber !== null ? guessSecretNumber : "??"}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={resetting}
              onClick={resetSecretNumber}
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
            : "border-border bg-muted/30";

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl border text-sm shadow-sm transition-all duration-300 ${itemStyle}`}
            >
              <span className="font-bold">{g.username}</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
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
          <div className="text-center py-8 border border-(--border-hairline) bg-(--surface-panel) rounded-2xl">
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
            aria-label="Enter your guess from 1 to 100"
            disabled={isSubmitting}
            className="flex-1 rounded-full px-4 h-11"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = parseInt((e.target as HTMLInputElement).value);
                submitGuess(val);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          <Button
            disabled={isSubmitting}
            onClick={() => {
              const input = document.getElementById("guess-input") as HTMLInputElement;
              const val = parseInt(input?.value);
              submitGuess(val);
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
