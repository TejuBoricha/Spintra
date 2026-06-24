"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords } from "lucide-react";

const choices = [
  { name: "Rock", emoji: "🪨", beats: "Scissors" },
  { name: "Paper", emoji: "📄", beats: "Rock" },
  { name: "Scissors", emoji: "✂️", beats: "Paper" },
];

export default function RPSPage() {
  const [playerChoice, setPlayerChoice] = useState<string | null>(null);
  const [aiChoice, setAiChoice] = useState<string | null>(null);
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [playing, setPlaying] = useState(false);
  const [score, setScore] = useState({ wins: 0, losses: 0, draws: 0 });

  const play = (choice: string) => {
    if (playing) return;
    setPlaying(true);
    setPlayerChoice(choice);
    setAiChoice(null);
    setResult(null);

    setTimeout(() => {
      const ai = choices[Math.floor(Math.random() * 3)];
      setAiChoice(ai.name);

      let outcome: "win" | "lose" | "draw";
      if (choice === ai.name) outcome = "draw";
      else if (choices.find((c) => c.name === choice)!.beats === ai.name) outcome = "win";
      else outcome = "lose";

      setResult(outcome);
      setScore((prev) => ({
        wins: prev.wins + (outcome === "win" ? 1 : 0),
        losses: prev.losses + (outcome === "lose" ? 1 : 0),
        draws: prev.draws + (outcome === "draw" ? 1 : 0),
      }));
      setPlaying(false);
    }, 1000);
  };

  const outcomeEmoji = { win: "🎉", lose: "😢", draw: "🤝" };
  const outcomeText = { win: "You Win!", lose: "AI Wins!", draw: "Draw!" };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Rock Paper Scissors</h1>
          <p className="text-muted-foreground mb-8">Challenge the AI — classic showdown.</p>

          {/* Score */}
          <div className="flex justify-center gap-4 mb-8">
            <div className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <div className="text-xl font-bold">{score.wins}</div>
              <div className="text-xs">Wins</div>
            </div>
            <div className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400">
              <div className="text-xl font-bold">{score.draws}</div>
              <div className="text-xs">Draws</div>
            </div>
            <div className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400">
              <div className="text-xl font-bold">{score.losses}</div>
              <div className="text-xs">Losses</div>
            </div>
          </div>
        </motion.div>

        {/* Battle Area */}
        <div className="glass-card p-8 mb-8">
          <div className="flex items-center justify-center gap-8 sm:gap-16">
            {/* Player */}
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-3">You</div>
              <motion.div
                key={playerChoice}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="w-24 h-24 rounded-2xl glass-card flex items-center justify-center text-5xl"
              >
                {playerChoice ? choices.find((c) => c.name === playerChoice)?.emoji : "❓"}
              </motion.div>
            </div>

            {/* VS */}
            <motion.div
              animate={playing ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="text-2xl font-bold text-muted-foreground"
            >
              VS
            </motion.div>

            {/* AI */}
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-3">AI</div>
              <motion.div
                key={aiChoice}
                initial={aiChoice ? { scale: 0.5 } : {}}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
                className="w-24 h-24 rounded-2xl glass-card flex items-center justify-center text-5xl"
              >
                {playing ? (
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ repeat: Infinity, duration: 0.3, ease: "linear" }}
                  >
                    <Swords className="w-12 h-12 text-purple-400" />
                  </motion.div>
                ) : aiChoice ? (
                  choices.find((c) => c.name === aiChoice)?.emoji
                ) : (
                  "🤖"
                )}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-8 text-2xl font-bold"
            >
              {outcomeEmoji[result]} {outcomeText[result]}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Choices */}
        <div className="flex justify-center gap-4">
          {choices.map((choice) => (
            <motion.button
              key={choice.name}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => play(choice.name)}
              disabled={playing}
              className="w-24 h-24 rounded-2xl glass-card flex flex-col items-center justify-center gap-2 hover:border-purple-500/30 transition-all disabled:opacity-50"
            >
              <span className="text-3xl">{choice.emoji}</span>
              <span className="text-xs text-muted-foreground">{choice.name}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
