"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Emoji } from "@/components/emoji";
import type { ActivityEvent, User } from "@/lib/types";

const WORDS = [
  "PUZZLE", "GALAXY", "WIZARD", "CASTLE", "DRAGON", "PLANET", "GUITAR", "FOREST",
  "ISLAND", "ROCKET", "TROPHY", "CANDLE",
] as const;

function scramble(word: string): string {
  let letters = word.split("");
  let attempt = letters.join("");
  while (attempt === word) {
    letters = [...letters].sort(() => Math.random() - 0.5);
    attempt = letters.join("");
  }
  return attempt;
}

interface WordScrambleActivityProps {
  isHost: boolean;
  currentUser: User;
  scrambleWord: { scrambled: string; answer: string } | null;
  scrambleWinner: string | null;
  sendActivityEvent: (event: ActivityEvent) => void;
  onActivityEventRef: React.RefObject<((event: ActivityEvent) => void) | null>;
}

export function WordScrambleActivity({
  isHost,
  currentUser,
  scrambleWord,
  scrambleWinner,
  sendActivityEvent,
  onActivityEventRef,
}: WordScrambleActivityProps) {
  const [guess, setGuess] = useState("");

  const newWord = () => {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const payload = { scrambled: scramble(word), answer: word };
    sendActivityEvent({ kind: "scramble_word", ...payload });
    if (onActivityEventRef.current) onActivityEventRef.current({ kind: "scramble_word", ...payload });
    setGuess("");
  };

  const submitGuess = () => {
    if (!scrambleWord || scrambleWinner) return;
    if (guess.trim().toUpperCase() === scrambleWord.answer) {
      sendActivityEvent({ kind: "scramble_correct", username: currentUser.username });
      if (onActivityEventRef.current) onActivityEventRef.current({ kind: "scramble_correct", username: currentUser.username });
    }
    setGuess("");
  };

  return (
    <motion.div
      key="word-scramble"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-md mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Shuffle className="w-6 h-6 text-lime-400" /> Word Scramble
      </h2>
      {isHost && (
        <Button
          onClick={newWord}
          className="bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-400 hover:to-green-500 text-white border-0"
        >
          <Shuffle className="w-4 h-4 mr-2" /> {scrambleWord ? "New Word" : "Start"}
        </Button>
      )}
      {scrambleWord ? (
        <>
          <div className="flex justify-center gap-2 flex-wrap">
            {scrambleWord.scrambled.split("").map((letter, i) => (
              <div
                key={i}
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-lime-500 to-green-600 flex items-center justify-center text-2xl font-black text-white shadow-lg"
              >
                {letter}
              </div>
            ))}
          </div>
          {scrambleWinner ? (
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xl font-bold text-emerald-400 flex items-center gap-2"
            >
              <Emoji name="party_popper" size={28} pop /> {scrambleWinner} got it — {scrambleWord.answer}!
            </motion.p>
          ) : (
            <div className="flex gap-2">
              <Input
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitGuess()}
                placeholder="Your guess..."
                className="flex-1"
              />
              <Button onClick={submitGuess} className="bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-400 hover:to-green-500 text-white border-0">
                Guess
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="glass-card p-8 rounded-2xl text-center w-full border border-white/10">
          <p className="mb-3 flex justify-center"><Emoji name="thinking_face" size={48} /></p>
          <p className="text-muted-foreground">{isHost ? "Press Start to reveal a word" : "Waiting for host…"}</p>
        </div>
      )}
    </motion.div>
  );
}
