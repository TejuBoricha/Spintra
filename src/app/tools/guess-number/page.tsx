"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, RotateCcw, Target, Volume2, VolumeX } from "lucide-react";
import { getGameByType } from "@/lib/games";

const GameIcon = getGameByType("guess-number")!.icon;
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { fireConfetti } from "@/components/celebration";
import { playSuccess, playFailure, playPop } from "@/lib/audio";
import { toast } from "sonner";

const modes = [
  { name: "Easy", range: 50, attempts: 10 },
  { name: "Medium", range: 100, attempts: 7 },
  { name: "Hard", range: 500, attempts: 10 },
  { name: "Extreme", range: 1000, attempts: 12 },
] as const;

export default function GuessNumberPage() {
  const [mode, setMode] = useState<(typeof modes)[number]>(modes[0]);
  const [target, setTarget] = useState(() => Math.floor(Math.random() * 50) + 1);
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<{ value: number; hint: "high" | "low" | "correct" }[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const remaining = mode.attempts - guesses.length;
  const lastGuess = guesses[guesses.length - 1];

  const makeGuess = () => {
    const num = parseInt(guess);
    if (isNaN(num) || num < 1 || num > mode.range) {
      toast.error(`Please enter a valid number between 1 and ${mode.range}`);
      return;
    }

    let hint: "high" | "low" | "correct";
    if (num === target) hint = "correct";
    else hint = num > target ? "high" : "low";

    setGuesses((prev) => [...prev, { value: num, hint }]);
    setGuess("");

    if (hint === "correct") {
      setWon(true);
      setGameOver(true);
      playSuccess(soundEnabled);
      fireConfetti();
    } else if (guesses.length + 1 >= mode.attempts) {
      setGameOver(true);
      playFailure(soundEnabled);
    } else {
      playPop(soundEnabled);
    }
  };

  const reset = (newMode?: (typeof modes)[number]) => {
    const targetRange = newMode ? newMode.range : mode.range;
    setTarget(Math.floor(Math.random() * targetRange) + 1);
    setGuesses([]);
    setGuess("");
    setGameOver(false);
    setWon(false);
  };

  return (
    <div className="min-h-screen pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-(--border-hairline) bg-(--surface-glass) backdrop-blur-(--blur-glass-soft) mb-6">
            <GameIcon className="w-4 h-4 text-(--brand-primary-strong)" />
            <span className="text-sm text-muted-foreground">Pick a mode to start</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Guess The Number</h1>
          <p className="text-muted-foreground mb-8">Can you find the secret number?</p>
        </motion.div>

        {/* Mode Selection */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {modes.map((m) => (
            <button
              key={m.name}
              onClick={() => { setMode(m); reset(m); }}
              disabled={guesses.length > 0 && !gameOver}
              aria-pressed={mode.name === m.name}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                mode.name === m.name
                  ? "bg-primary text-primary-foreground"
                  : "border border-(--border-hairline) bg-(--surface-panel) rounded-2xl"
              }`}
            >
              {m.name}
              <span className="ml-1.5 text-xs opacity-70">1–{m.range}</span>
            </button>
          ))}
        </div>

        {/* Game Info */}
        <div className="flex justify-center gap-6 mb-8 text-sm">
          <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl px-4 py-2">
            <span className="text-muted-foreground">Attempts: </span>
            <span className="font-bold text-foreground">{remaining}</span>
          </div>
          <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl px-4 py-2">
            <span className="text-muted-foreground">Range: </span>
            <span className="font-bold text-foreground">1–{mode.range}</span>
          </div>
        </div>

        {/* Guess Input */}
        {!gameOver && (
          <div className="flex justify-center gap-3 mb-8">
            <input
              type="number"
              min={1}
              max={mode.range}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && makeGuess()}
              placeholder={`Enter 1-${mode.range}`}
              className="w-32 px-4 py-3 rounded-xl bg-(--surface-sunken) border border-(--border-hairline) text-center text-lg font-bold focus:border-primary outline-none"
            />
            <Button onClick={makeGuess} className="bg-primary text-primary-foreground hover:brightness-95">
              <Target className="w-4 h-4 mr-2" /> Guess
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Sound On" : "Sound Off"}
              aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
              className="h-12 w-12 rounded-xl border-(--border-hairline)"
            >
              {soundEnabled ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
            </Button>
          </div>
        )}

        {/* Last hint */}
        {lastGuess && lastGuess.hint !== "correct" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <Badge className={lastGuess.hint === "high" ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"}>
              {lastGuess.hint === "high" ? <ArrowDown className="w-4 h-4 mr-1" /> : <ArrowUp className="w-4 h-4 mr-1" />}
              Too {lastGuess.hint}! Try {lastGuess.hint === "high" ? "lower" : "higher"}.
            </Badge>
          </motion.div>
        )}

        {/* Game Over */}
        {gameOver && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-8">
            <div className={`text-2xl font-bold mb-2 flex items-center justify-center gap-2 ${won ? "gradient-text" : "text-red-400"}`}>
              <Emoji name={won ? "party_popper" : "disappointed_face"} size={32} pop />
              {won ? "You Got It!" : "Out of Attempts!"}
            </div>
            <p className="text-muted-foreground mb-4">
              {won
                ? `The number was ${target}. Found in ${guesses.length} tries!`
                : `The number was ${target}.`}
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => reset()} variant="outline" className="border-(--border-hairline)">
                <RotateCcw className="w-4 h-4 mr-2" /> Play Again
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Sound On" : "Sound Off"}
                aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
                className="h-10 w-10 border-(--border-hairline) rounded-lg"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Guess History */}
        {guesses.length > 0 && (
          <div className="mt-8 max-w-xs mx-auto">
            <div className="flex justify-center gap-2 flex-wrap">
              {guesses.map((g, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                    g.hint === "correct"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : g.hint === "high"
                      ? "bg-red-500/10 text-red-400 border border-red-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {g.value}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
