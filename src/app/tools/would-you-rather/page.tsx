"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Split, ArrowRight, ThumbsUp, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playPop, playSwipe } from "@/lib/audio";

const questions = [
  { optionA: "Be able to fly", optionB: "Be able to read minds" },
  { optionA: "Live in the mountains", optionB: "Live on a beach" },
  { optionA: "Have more time", optionB: "Have more money" },
  { optionA: "Be invisible", optionB: "Have super strength" },
  { optionA: "Travel to the past", optionB: "Travel to the future" },
  { optionA: "Never use social media again", optionB: "Never watch movies again" },
  { optionA: "Be the funniest person", optionB: "Be the smartest person" },
  { optionA: "Always be 10 minutes late", optionB: "Always be 20 minutes early" },
  { optionA: "Lose your sense of taste", optionB: "Lose your sense of smell" },
  { optionA: "Have a personal chef", optionB: "Have a personal trainer" },
  { optionA: "Work 4 days a week for 10 hours", optionB: "Work 5 days a week for 8 hours" },
  { optionA: "Win the lottery", optionB: "Find your dream job" },
  { optionA: "Be famous", optionB: "Be wealthy but unknown" },
  { optionA: "Have a rewind button for life", optionB: "Have a pause button for life" },
  { optionA: "Explore space", optionB: "Explore the deep ocean" },
  { optionA: "Speak every language", optionB: "Play every instrument" },
  { optionA: "Never feel pain", optionB: "Never feel fear" },
  { optionA: "Always know when someone is lying", optionB: "Always get away with lying" },
  { optionA: "Have unlimited data", optionB: "Have unlimited battery" },
  { optionA: "Be a superhero", optionB: "Be a wizard" },
];

export default function WouldYouRatherPage() {
  const [current, setCurrent] = useState(0);
  const [votes, setVotes] = useState<Record<number, "A" | "B">>({});
  const [showResult, setShowResult] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const q = questions[current % questions.length];
  const allVotes = Object.values(votes);
  const aVotes = allVotes.filter((v) => v === "A").length;
  const bVotes = allVotes.filter((v) => v === "B").length;
  const total = allVotes.length;

  const vote = (choice: "A" | "B") => {
    playPop(soundEnabled);
    setVotes((prev) => ({ ...prev, [current]: choice }));
    setShowResult(true);
  };

  const next = () => {
    playSwipe(soundEnabled);
    setCurrent((prev) => prev + 1);
    setShowResult(false);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <Split className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-muted-foreground">Tough choices ahead</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Would You Rather</h1>
          <div className="flex items-center justify-center gap-3 mb-8">
            <p className="text-muted-foreground">Pick your side — no middle ground.</p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Sound On" : "Sound Off"}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </Button>
          </div>
        </motion.div>

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="glass-card p-8 mb-6 max-w-lg mx-auto"
          >
            <p className="text-xl font-medium mb-6">Would you rather...</p>
            <div className="space-y-4">
              <button
                onClick={() => !showResult && vote("A")}
                disabled={showResult}
                className={`w-full p-5 rounded-xl text-lg font-semibold transition-all relative overflow-hidden ${
                  showResult
                    ? "glass-card cursor-default"
                    : "glass-card hover:border-purple-500/30 hover:bg-purple-500/5 cursor-pointer"
                }`}
              >
                {q.optionA}
                {showResult && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: total > 0 ? `${(aVotes / total) * 100}%` : "0%" }}
                    className="absolute inset-0 bg-purple-500/10 rounded-xl z-0"
                  />
                )}
                <span className="relative z-10">{showResult && `${total > 0 ? Math.round((aVotes / Math.max(total, 1)) * 100) : 50}%`}</span>
              </button>

              <div className="flex items-center justify-center gap-4">
                <div className="w-px h-6 bg-white/10" />
                <span className="text-sm font-bold text-muted-foreground uppercase">or</span>
                <div className="w-px h-6 bg-white/10" />
              </div>

              <button
                onClick={() => !showResult && vote("B")}
                disabled={showResult}
                className={`w-full p-5 rounded-xl text-lg font-semibold transition-all relative overflow-hidden ${
                  showResult
                    ? "glass-card cursor-default"
                    : "glass-card hover:border-cyan-500/30 hover:bg-cyan-500/5 cursor-pointer"
                }`}
              >
                {q.optionB}
                {showResult && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: total > 0 ? `${(bVotes / total) * 100}%` : "0%" }}
                    className="absolute inset-0 bg-cyan-500/10 rounded-xl z-0"
                  />
                )}
                <span className="relative z-10">{showResult && `${total > 0 ? Math.round((bVotes / Math.max(total, 1)) * 100) : 50}%`}</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {showResult && (
          <Button onClick={next} className="bg-gradient-to-r from-purple-600 to-cyan-500 border-0">
            Next Question <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}

        {/* Counter */}
        <div className="mt-6 text-sm text-muted-foreground">
          <ThumbsUp className="w-4 h-4 inline mr-1 text-purple-400" />
          {total} votes across {Object.keys(votes).length} questions
        </div>
      </div>
    </div>
  );
}
