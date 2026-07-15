"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Volume2, VolumeX } from "lucide-react";
import { Emoji, type EmojiName } from "@/components/emoji";
import { fireConfetti } from "@/components/celebration";
import { playPop, playSuccess, playFailure } from "@/lib/audio";
import { getGameByType } from "@/lib/games";

const GameIcon = getGameByType("rps")!.icon;

const choices = [
  { name: "Rock", emoji: "rock", beats: "Scissors" },
  { name: "Paper", emoji: "page_facing_up", beats: "Rock" },
  { name: "Scissors", emoji: "scissors", beats: "Paper" },
] satisfies { name: string; emoji: EmojiName; beats: string }[];

export default function RPSPage() {
  const [playerChoice, setPlayerChoice] = useState<string | null>(null);
  const [aiChoice, setAiChoice] = useState<string | null>(null);
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [playing, setPlaying] = useState(false);
  const [score, setScore] = useState({ wins: 0, losses: 0, draws: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);

  const play = (choice: string) => {
    if (playing) return;
    setPlaying(true);
    setPlayerChoice(choice);
    setAiChoice(null);
    setResult(null);
    playPop(soundEnabled);

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

      if (outcome === "win") { playSuccess(soundEnabled); fireConfetti(); }
      else if (outcome === "lose") playFailure(soundEnabled);
      else playPop(soundEnabled);
    }, 1000);
  };

  const outcomeEmoji = { win: "party_popper", lose: "crying_face", draw: "handshake" } satisfies Record<string, EmojiName>;
  const outcomeText = { win: "You Win!", lose: "AI Wins!", draw: "Draw!" };

  return (
    <div className="min-h-screen pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-(--border-hairline) bg-(--surface-glass) backdrop-blur-(--blur-glass-soft) mb-6">
            <GameIcon className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-muted-foreground">Classic showdown</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Rock Paper Scissors</h1>
          <div className="flex items-center justify-center gap-3 mb-8">
            <p className="text-muted-foreground">Play Rock Paper Scissors online — challenge the AI to a classic showdown.</p>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Sound On" : "Sound Off"}
              aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
              className="p-1.5 rounded-lg border border-(--border-hairline) bg-(--surface-sunken) hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
          </div>

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
        <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-8 mb-8">
          <div className="flex items-center justify-center gap-8 sm:gap-16">
            {/* Player */}
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-3">You</div>
              <motion.div
                key={playerChoice}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="w-24 h-24 rounded-2xl border border-(--border-hairline) bg-(--surface-panel) flex items-center justify-center"
              >
                {playerChoice ? (
                  <Emoji name={choices.find((c) => c.name === playerChoice)!.emoji} size={56} pop />
                ) : (
                  <Emoji name="question_mark" size={56} />
                )}
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
                className="w-24 h-24 rounded-2xl border border-(--border-hairline) bg-(--surface-panel) flex items-center justify-center"
              >
                {playing ? (
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ repeat: Infinity, duration: 0.3, ease: "linear" }}
                  >
                    <Swords className="w-12 h-12 text-(--brand-primary-strong)" />
                  </motion.div>
                ) : aiChoice ? (
                  <Emoji name={choices.find((c) => c.name === aiChoice)!.emoji} size={56} pop />
                ) : (
                  <Emoji name="robot" size={56} />
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
              className="mb-8 text-2xl font-bold flex items-center justify-center gap-2"
            >
              <Emoji name={outcomeEmoji[result]} size={32} pop /> {outcomeText[result]}
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
              className="w-24 h-24 rounded-2xl border border-(--border-hairline) bg-(--surface-panel) flex flex-col items-center justify-center gap-2 hover:border-primary/30 transition-all disabled:opacity-50"
            >
              <Emoji name={choice.emoji} size={40} animated={false} />
              <span className="text-xs text-muted-foreground">{choice.name}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
