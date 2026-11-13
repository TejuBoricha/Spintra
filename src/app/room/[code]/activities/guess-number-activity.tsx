"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Target, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoomActivity } from "../context/room-activity-context";
import { Emoji } from "@/components/emoji";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { addGuess, roundWinner, type GuessEntry } from "@/lib/guess-number-round";

export function GuessNumberActivity() {
  const { roomCode, isHost, sendActivityEvent, registerEventListener, currentUser } = useRoomActivity();

  const [guessHistory, setGuessHistory] = useState<GuessEntry[]>([]);
  const [guessSecretNumber, setGuessSecretNumber] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  // The ref is the real guard (a second click in the same tick still sees the
  // first one in flight); the state only drives the button's disabled look.
  const resettingRef = useRef(false);
  // A round is started for the host once, when the room has no secret yet. If
  // that fails the host still has the button; this only stops a retry loop.
  const autoStartedRef = useRef(false);
  // submitGuess is a real network round-trip (awaits check_guess_number),
  // unlike the other activities' synchronous local event-bus dispatch —
  // with no guard, a fast double-click/double-Enter fired multiple
  // concurrent RPC calls for the same guess.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The first correct guess ends the round for everyone (audit G-10). The server
  // keeps answering "correct" for the same number, so the round is decided from
  // the shared log; see src/lib/guess-number-round.ts.
  const winner = roundWinner(guessHistory);
  const roundOver = winner !== null;

  useEffect(() => {
    return registerEventListener((event) => {
      switch (event.kind) {
        case "guess_submit": {
          setGuessHistory((prev) =>
            addGuess(prev, { username: event.username, guess: event.guess, hint: event.hint }),
          );
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

  // Real Supabase mode: the secret is set/checked server-side (migration
  // 0028's RPCs) so it's never known to any client but the host's own, and a
  // guess's hint can't be forged by broadcasting a fabricated result. Demo
  // mode has no real backend to check against, so it falls back to the
  // previous client-local comparison — there's no meaningful security
  // boundary there anyway (single browser, BroadcastChannel-shared identity).
  const startRound = useCallback(async () => {
    if (resettingRef.current) return;
    resettingRef.current = true;
    setResetting(true);
    const secret = Math.floor(Math.random() * 100) + 1;
    setGuessSecretNumber(secret);

    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { error } = await supabase.rpc("set_guess_number_secret", {
          p_room_code: roomCode,
          p_secret: secret,
        });
        if (error) {
          console.error("Failed to set secret number:", error.message);
          toast.error("Couldn't set the secret number. Please try again.");
          // The server did not take this number, so don't show it as the secret:
          // go back to "??" and let the host's own lookup below recover whatever
          // the server really holds.
          setGuessSecretNumber(null);
          return;
        }
        sendActivityEvent({ kind: "guess_reset" });
      } else {
        sendActivityEvent({ kind: "guess_reset", secret });
      }
    } finally {
      resettingRef.current = false;
      setResetting(false);
    }
  }, [roomCode, sendActivityEvent]);

  // The host's client recovers the secret after a refresh, and starts the first
  // round when the room has none (audit G-10): until a secret exists the server
  // refuses every guess ("No secret number has been set"), which used to leave
  // a fresh game broken until the host found "Reset Number".
  useEffect(() => {
    if (!isHost || !roomCode || guessSecretNumber !== null) return;
    let cancelled = false;
    const startFirstRound = () => {
      if (autoStartedRef.current) return;
      autoStartedRef.current = true;
      void startRound();
    };

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      startFirstRound();
      return;
    }
    void (async () => {
      const { data, error } = await supabase.rpc("get_guess_number_secret", {
        p_room_code: roomCode,
      });
      if (cancelled) return;
      if (error) {
        console.error("Failed to recover secret number:", error.message);
        return;
      }
      // The database returns null when no secret has been set for this room.
      if (data === null) startFirstRound();
      else setGuessSecretNumber(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [isHost, guessSecretNumber, roomCode, startRound]);

  const submitGuess = async (val: number) => {
    if (!val || val < 1 || val > 100 || isSubmitting || roundOver) return;
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
          toast.error(
            error?.message?.includes("No secret number")
              ? "The host hasn't started the round yet. Try again in a moment."
              : "Couldn't check your guess. Please try again.",
          );
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
              Tell everyone the range is 1 to 100, then wait for guesses
            </p>
          )}
          <div className="flex gap-4 items-center">
            <span data-testid="guess-secret" className="text-4xl font-black text-cyan-400">{guessSecretNumber !== null ? guessSecretNumber : "??"}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={resetting}
              onClick={() => void startRound()}
              className="ml-auto rounded-full border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 h-9 px-4"
            >
              {roundOver ? "Start next round" : "Reset Number"}
            </Button>
          </div>
        </div>
      )}

      {winner && (
        <div
          role="status"
          className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-sm font-medium"
        >
          <Emoji name="party_popper" size={20} pop />
          <span>
            <span className="font-bold">{winner.username}</span> guessed it: {winner.guess}!{" "}
            {isHost
              ? "Start the next round when you're ready."
              : "Waiting for the host to start the next round."}
          </span>
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
            placeholder="1-100"
            aria-label="Enter your guess from 1 to 100"
            disabled={isSubmitting || roundOver}
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
            disabled={isSubmitting || roundOver}
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
