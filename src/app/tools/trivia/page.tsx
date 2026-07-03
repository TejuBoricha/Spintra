"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { fireConfetti, CelebrationBanner } from "@/components/celebration";
import { playPop, playSuccess, playFailure } from "@/lib/audio";
import { getGameByType } from "@/lib/games";

const GameIcon = getGameByType("trivia")!.icon;

const QUESTIONS = [
  { q: "What is the capital of France?", options: ["Berlin", "Madrid", "Paris", "Rome"], correct: 2 },
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correct: 1 },
  { q: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], correct: 2 },
  { q: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: 3 },
  { q: "Who painted the Mona Lisa?", options: ["Van Gogh", "Da Vinci", "Picasso", "Monet"], correct: 1 },
  { q: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], correct: 2 },
  { q: "Which language has the most native speakers?", options: ["English", "Hindi", "Mandarin", "Spanish"], correct: 2 },
  { q: "What is the smallest prime number?", options: ["0", "1", "2", "3"], correct: 2 },
  { q: "Which country hosted the 2016 Summer Olympics?", options: ["China", "UK", "Brazil", "Japan"], correct: 2 },
  { q: "What is the largest mammal in the world?", options: ["Elephant", "Blue Whale", "Giraffe", "Polar Bear"], correct: 1 },
  { q: "How many strings does a standard guitar have?", options: ["4", "5", "6", "7"], correct: 2 },
  { q: "What is the freezing point of water in Celsius?", options: ["-10", "0", "10", "32"], correct: 1 },
  { q: "Which planet has the most moons?", options: ["Earth", "Mars", "Saturn", "Neptune"], correct: 2 },
  { q: "What is the currency of Japan?", options: ["Won", "Yuan", "Yen", "Ringgit"], correct: 2 },
  { q: "Who wrote 'Romeo and Juliet'?", options: ["Dickens", "Shakespeare", "Austen", "Twain"], correct: 1 },
] as const;

export default function TriviaPage() {
  // Question order is randomized client-side only — shuffling during the
  // initial (server-rendered) pass would make the server's order differ
  // from the client's, causing a hydration mismatch. Shuffle after mount.
  const [order, setOrder] = useState(() => QUESTIONS.map((_, i) => i));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above the initial state
    setOrder([...QUESTIONS.keys()].sort(() => Math.random() - 0.5));
  }, []);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const question = QUESTIONS[order[index]];
  const total = QUESTIONS.length;

  const selectAnswer = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    const correct = i === question.correct;
    if (correct) {
      setScore((s) => s + 1);
      playSuccess(soundEnabled);
    } else {
      playFailure(soundEnabled);
    }
  };

  const next = () => {
    playPop(soundEnabled);
    if (index + 1 >= total) {
      setGameOver(true);
      if (score >= Math.ceil(total * 0.7)) fireConfetti();
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  };

  const reset = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setGameOver(false);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <GameIcon className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-muted-foreground">Test your knowledge</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Trivia</h1>
          <div className="flex items-center justify-center gap-3 mb-8">
            <p className="text-muted-foreground">How much do you really know?</p>
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

        {!gameOver ? (
          <>
            <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
              <Badge variant="secondary">Question {index + 1} / {total}</Badge>
              <Badge variant="secondary">Score: {score}</Badge>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card p-8 mb-6"
              >
                <p className="text-xl font-semibold mb-6">{question.q}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {question.options.map((opt, i) => {
                    const isCorrect = i === question.correct;
                    const isPicked = i === selected;
                    return (
                      <button
                        key={i}
                        onClick={() => selectAnswer(i)}
                        disabled={selected !== null}
                        className={`p-4 rounded-xl border-2 text-left font-medium transition-all disabled:cursor-default ${
                          selected === null
                            ? "border-white/10 hover:border-yellow-500/50 hover:bg-yellow-500/10"
                            : isCorrect
                            ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                            : isPicked
                            ? "border-red-500 bg-red-500/20 text-red-300"
                            : "border-white/10 opacity-50"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            {selected !== null && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-6">
                <p className="flex items-center justify-center gap-2 text-lg font-semibold mb-4">
                  {selected === question.correct ? (
                    <><Emoji name="hundred_points" size={28} pop /> Correct!</>
                  ) : (
                    <><Emoji name="disappointed_face" size={28} pop /> Not quite — it was &quot;{question.options[question.correct]}&quot;</>
                  )}
                </p>
                <Button
                  onClick={next}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white border-0"
                >
                  {index + 1 >= total ? "See Results" : "Next Question"}
                </Button>
              </motion.div>
            )}
          </>
        ) : (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-8">
            <CelebrationBanner
              icon={<Emoji name={score >= Math.ceil(total * 0.7) ? "trophy" : "books"} size={48} pop />}
              title={`${score} / ${total}`}
              subtitle={score >= Math.ceil(total * 0.7) ? "Trivia Champion!" : "Nice try — go again?"}
            />
            <Button onClick={reset} variant="outline" className="mt-6">
              <RotateCcw className="w-4 h-4 mr-2" /> Play Again
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
