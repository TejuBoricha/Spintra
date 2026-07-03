"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Lightbulb, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { fireConfetti } from "@/components/celebration";
import { playPop, playSuccess } from "@/lib/audio";
import { getGameByType } from "@/lib/games";
import { toast } from "sonner";

const GameIcon = getGameByType("word-scramble")!.icon;

const WORDS = [
  "PUZZLE", "GALAXY", "WIZARD", "CASTLE", "DRAGON", "PLANET", "GUITAR", "FOREST",
  "ISLAND", "ROCKET", "TROPHY", "CANDLE", "BREEZE", "MARBLE", "JUNGLE", "WHISKER",
  "LANTERN", "PENGUIN", "VOLCANO", "MEADOW",
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

export default function WordScramblePage() {
  // Word order and letter scrambling are randomized client-side only —
  // doing this during the initial (server-rendered) pass would make the
  // server's random values differ from the client's, causing a hydration
  // mismatch. Start deterministic, then shuffle/scramble after mount.
  const [order, setOrder] = useState<number[]>(() => WORDS.map((_, i) => i));
  const [index, setIndex] = useState(0);
  const [scrambled, setScrambled] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState<number>(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const shuffledOrder = [...WORDS.keys()].sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above the initial state
    setOrder(shuffledOrder);
    setScrambled(scramble(WORDS[shuffledOrder[0]]));
  }, []);

  const word = WORDS[order[index % order.length]];

  const nextWord = () => {
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setScrambled(scramble(WORDS[order[nextIndex % order.length]]));
    setGuess("");
    setRevealed(0);
    setSolved(false);
  };

  const submitGuess = () => {
    if (solved) return;
    if (guess.trim().toUpperCase() === word) {
      setSolved(true);
      setScore((s) => s + Math.max(10 - revealed * 2, 2));
      setStreak((s) => s + 1);
      playSuccess(soundEnabled);
      fireConfetti();
    } else {
      playPop(soundEnabled);
      toast.error("Not quite — try again!");
    }
  };

  const revealHint = () => {
    if (solved || revealed >= word.length - 1) return;
    setRevealed((r) => r + 1);
    playPop(soundEnabled);
  };

  const skip = () => {
    setStreak(0);
    nextWord();
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <GameIcon className="w-4 h-4 text-lime-400" />
            <span className="text-sm text-muted-foreground">Unscramble the word</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Word Scramble</h1>
          <div className="flex items-center justify-center gap-3 mb-8">
            <p className="text-muted-foreground">Race against yourself — how fast can you solve it?</p>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Sound On" : "Sound Off"}
              aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
              className="p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </motion.div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <Badge variant="secondary">Score: {score}</Badge>
          <Badge variant="secondary">Streak: {streak}</Badge>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-8 mb-6"
          >
            <div className="flex justify-center gap-2 mb-6 flex-wrap">
              {scrambled
                ? scrambled.split("").map((letter, i) => (
                    <div
                      key={i}
                      className="w-12 h-12 rounded-xl bg-gradient-to-br from-lime-500 to-green-600 flex items-center justify-center text-2xl font-black text-white shadow-lg"
                    >
                      {letter}
                    </div>
                  ))
                : word.split("").map((_, i) => (
                    <div key={i} className="w-12 h-12 rounded-xl border border-white/5 bg-white/5 animate-pulse" />
                  ))}
            </div>
            {revealed > 0 && !solved && (
              <p className="text-sm text-muted-foreground mb-4">
                Hint: <span className="font-mono tracking-widest">{word.slice(0, revealed)}{"_".repeat(word.length - revealed)}</span>
              </p>
            )}
            {solved ? (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
                <p className="flex items-center justify-center gap-2 text-xl font-bold text-emerald-400">
                  <Emoji name="party_popper" size={28} pop /> {word}!
                </p>
              </motion.div>
            ) : (
              <div className="flex gap-2 justify-center">
                <Input
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitGuess()}
                  placeholder="Your guess..."
                  className="max-w-xs"
                  autoFocus
                />
                <Button onClick={submitGuess} className="bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-400 hover:to-green-500 text-white border-0">
                  Guess
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center gap-3">
          {solved ? (
            <Button onClick={nextWord} className="bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-400 hover:to-green-500 text-white border-0">
              Next Word
            </Button>
          ) : (
            <>
              <Button onClick={revealHint} variant="outline" disabled={revealed >= word.length - 1}>
                <Lightbulb className="w-4 h-4 mr-2" /> Hint
              </Button>
              <Button onClick={skip} variant="outline">
                <SkipForward className="w-4 h-4 mr-2" /> Skip
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
