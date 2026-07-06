"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";
import { shuffleArray } from "@/lib/utils";
import { toast } from "sonner";

const WORDS = [
  "PUZZLE", "GALAXY", "WIZARD", "CASTLE", "DRAGON", "PLANET", "GUITAR", "FOREST",
  "ISLAND", "ROCKET", "TROPHY", "CANDLE",
] as const;

function scramble(word: string): string {
  let letters = word.split("");
  let attempt = letters.join("");
  while (attempt === word) {
    letters = shuffleArray(letters);
    attempt = letters.join("");
  }
  return attempt;
}

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { playSwipe, playSuccess, playFailure } from "@/lib/audio";

export function WordScrambleActivity() {
  const { isHost, sendActivityEvent, registerEventListener, currentUser, soundEnabled } = useRoomActivity();

  const [scrambleWord, setScrambleWord] = useState<{ scrambled: string; answer: string } | null>(null);
  const [scrambleWinner, setScrambleWinner] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [words, setWords] = useState<string[]>([...WORDS]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase && isHost) {
      supabase
        .from("activity_prompts")
        .select("*")
        .eq("activity_type", "word-scramble")
        // PostgREST truncates unbounded selects silently (no error) past
        // its configured row cap — an explicit limit makes that ceiling
        // intentional and visible, generous enough to comfortably outgrow
        // the current prompt bank.
        .limit(1000)
        .then(({ data, error }) => {
          if (data && !error && data.length > 0) {
            const fetched = data.map((p) => (p.prompt_data as { word: string }).word.toUpperCase());
            setWords(fetched);
          }
        });
    }
  }, [isHost]);

  useEffect(() => {
    return registerEventListener((event) => {
      switch (event.kind) {
        case "scramble_word": {
          setScrambleWord({ scrambled: event.scrambled, answer: event.answer });
          setScrambleWinner(null);
          playSwipe(soundEnabled);
          break;
        }
        case "scramble_correct": {
          // Same class of race as Bingo: each client independently checks
          // its own guess and broadcasts its own win claim with no
          // server-side arbitration, so on a near-simultaneous correct
          // guess a client could otherwise receive two of these events and
          // flip-flop which name it displays. Keep only the first.
          setScrambleWinner((prev) => prev ?? event.username);
          playSuccess(soundEnabled);
          break;
        }
        case "activity_reset":
          setScrambleWord(null);
          setScrambleWinner(null);
          break;
      }
    });
  }, [registerEventListener, soundEnabled]);

  const newWord = () => {
    const word = words[Math.floor(Math.random() * words.length)];
    const payload = { scrambled: scramble(word), answer: word };
    sendActivityEvent({ kind: "scramble_word", ...payload });
    setGuess("");
  };

  const submitGuess = () => {
    if (!scrambleWord || scrambleWinner) return;
    if (guess.trim().toUpperCase() === scrambleWord.answer) {
      sendActivityEvent({ kind: "scramble_correct", username: currentUser.username });
    } else {
      playFailure(soundEnabled);
      toast.error("Not quite — try again!");
    }
    setGuess("");
  };

  return (
    <motion.div
      key="word-scramble"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-8 max-w-xl mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Shuffle className="w-6 h-6 text-lime-400" /> Word Scramble
      </h2>
      {isHost && (
        <Button
          onClick={newWord}
          className="bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-400 hover:to-green-500 text-white border-0 rounded-full px-6 shadow-lg shadow-lime-500/10"
        >
          <Shuffle className="w-4 h-4 mr-2" /> {scrambleWord ? "New Word" : "Start"}
        </Button>
      )}
      {scrambleWord ? (
        <>
          {/* Visual letter blocks aligned with standalone tool design */}
          <div className="flex justify-center gap-3 flex-wrap py-2">
            {scrambleWord.scrambled.split("").map((letter, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 120, delay: i * 0.05 }}
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-lime-500 to-green-600 flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-lime-500/10 border border-lime-400/40 select-none"
              >
                {letter}
              </motion.div>
            ))}
          </div>

          {scrambleWinner ? (
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              role="status"
              aria-live="polite"
              className="text-xl font-bold text-emerald-400 flex items-center gap-2 bg-emerald-500/10 px-6 py-2 rounded-full border border-emerald-500/20"
            >
              <Emoji name="party_popper" size={24} pop /> {scrambleWinner} got it — {scrambleWord.answer}!
            </motion.p>
          ) : (
            <div className="flex gap-3 w-full max-w-sm">
              <Input
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitGuess()}
                placeholder="Your guess..."
                className="flex-1 rounded-full px-4 h-11"
              />
              <Button
                onClick={submitGuess}
                className="bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-400 hover:to-green-500 text-white border-0 rounded-full px-6 h-11 shadow-md shadow-lime-500/10"
              >
                Guess
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="glass-card p-12 rounded-3xl text-center w-full border border-white/10 shadow-xl">
          <p className="mb-4 flex justify-center">
            <Emoji name="thinking_face" size={48} />
          </p>
          <p className="text-muted-foreground font-medium">
            {isHost ? "Press Start to reveal a word" : "Waiting for host…"}
          </p>
        </div>
      )}
    </motion.div>
  );
}
