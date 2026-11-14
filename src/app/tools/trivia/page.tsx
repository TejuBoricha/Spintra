"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Sparkles, Flame, Clock, Check, X, ArrowRight, Filter, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Emoji } from "@/components/emoji";
import { fireConfetti, CelebrationBanner } from "@/components/celebration";
import { playPop, playSuccess, playFailure } from "@/lib/audio";
import { getGameByType } from "@/lib/games";
import { shuffleArray } from "@/lib/utils";
import { ToolHeader } from "@/components/tools/tool-header";
import {
  TRIVIA_QUESTIONS,
  TRIVIA_CATEGORIES,
  type TriviaQuestion,
} from "@/lib/trivia-questions";

const GameIcon = getGameByType("trivia")!.icon;

const ROUND_SIZES = [5, 10, 15, 20] as const;
const TIMER_OPTIONS = [
  { label: "Off", seconds: 0 },
  { label: "15s", seconds: 15 },
  { label: "30s", seconds: 30 },
] as const;

export default function TriviaPage() {
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Configuration options
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("All");
  const [roundSize, setRoundSize] = useState<number>(10);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [showConfig, setShowConfig] = useState(false);

  // Deck generation candidate pool
  const candidateQuestions = useMemo(() => {
    return TRIVIA_QUESTIONS.filter((q) => {
      const catMatch = selectedCategory === "All" || q.category === selectedCategory;
      const diffMatch = selectedDifficulty === "All" || q.difficulty === selectedDifficulty;
      return catMatch && diffMatch;
    });
  }, [selectedCategory, selectedDifficulty]);

  // Active game session
  const [deck, setDeck] = useState<TriviaQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [missedQuestions, setMissedQuestions] = useState<
    Array<{ question: string; correctAnswer: string; yourAnswer: string; explanation?: string }>
  >([]);

  // Timer state
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  // Initialize or restart game
  const startGame = useCallback(() => {
    const pool = candidateQuestions.length > 0 ? candidateQuestions : TRIVIA_QUESTIONS;
    const shuffled = shuffleArray([...pool]);
    const chosen = shuffled.slice(0, Math.min(roundSize, shuffled.length));
    setDeck(chosen);
    setIndex(0);
    setSelected(null);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setGameOver(false);
    setMissedQuestions([]);
    setTimeLeft(timerSeconds);
  }, [candidateQuestions, roundSize, timerSeconds]);

  // Populate deck on initial client mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-side random deck generation
    startGame();
  }, [startGame]);

  const currentQuestion = deck[index] || null;
  const total = deck.length;

  const handleTimeout = useCallback(() => {
    if (!currentQuestion) return;
    setSelected(-1);
    setStreak(0);
    playFailure(soundEnabled);
    setMissedQuestions((prev) => [
      ...prev,
      {
        question: currentQuestion.text,
        correctAnswer: currentQuestion.options[currentQuestion.correctIndex],
        yourAnswer: "Time expired",
        explanation: currentQuestion.explanation,
      },
    ]);
  }, [currentQuestion, soundEnabled]);

  // Question timer countdown
  useEffect(() => {
    if (timerSeconds === 0 || gameOver || selected !== null || !currentQuestion) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timerSeconds, gameOver, selected, currentQuestion, handleTimeout]);

  // Auto-focus next button on answer reveal for keyboard accessibility
  useEffect(() => {
    if (selected !== null && nextButtonRef.current) {
      nextButtonRef.current.focus();
    }
  }, [selected]);

  const selectAnswer = (i: number) => {
    if (selected !== null || !currentQuestion) return;
    setSelected(i);

    const isCorrect = i === currentQuestion.correctIndex;
    if (isCorrect) {
      setScore((s) => s + 1);
      setStreak((st) => {
        const nextSt = st + 1;
        setMaxStreak((mst) => Math.max(mst, nextSt));
        return nextSt;
      });
      playSuccess(soundEnabled);
    } else {
      setStreak(0);
      playFailure(soundEnabled);
      setMissedQuestions((prev) => [
        ...prev,
        {
          question: currentQuestion.text,
          correctAnswer: currentQuestion.options[currentQuestion.correctIndex],
          yourAnswer: currentQuestion.options[i],
          explanation: currentQuestion.explanation,
        },
      ]);
    }
  };

  const nextQuestion = () => {
    playPop(soundEnabled);
    if (index + 1 >= total) {
      setGameOver(true);
      if (score >= Math.ceil(total * 0.7)) {
        fireConfetti();
      }
      return;
    }
    setIndex((prev) => prev + 1);
    setSelected(null);
    setTimeLeft(timerSeconds);
  };

  // Keyboard shortcut listener (keys 1-4 for options, Enter/Space for next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver || !currentQuestion) return;

      if (selected === null) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= currentQuestion.options.length) {
          e.preventDefault();
          selectAnswer(num - 1);
        }
      } else if (e.key === "Enter" || e.key === " ") {
        if (document.activeElement?.tagName !== "BUTTON") {
          e.preventDefault();
          nextQuestion();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const progressPercent = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;

  return (
    <div className="page-top pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* Header Section */}
        <ToolHeader
          icon={GameIcon}
          iconClassName="text-yellow-400"
          chip="Multiple choice trivia"
          title="Trivia"
          subtitle="Test your knowledge across 300+ questions and 10 categories."
          sound={{ enabled: soundEnabled, onToggle: () => setSoundEnabled(!soundEnabled) }}
        >
          <button
            onClick={() => setShowConfig(!showConfig)}
            title="Customize Game"
            aria-label="Toggle game settings and category filters"
            aria-expanded={showConfig}
            className={`p-1.5 rounded-lg border border-(--border-hairline) transition-colors ${
              showConfig
                ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/40"
                : "bg-(--surface-sunken) hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </ToolHeader>

        {/* Expandable Configuration Drawer */}
        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-5 text-left space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-(--border-hairline) pb-3">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <Filter className="w-4 h-4 text-yellow-500" /> Game Settings & Filters
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Available in bank: {candidateQuestions.length} questions
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category Selector */}
                  <div className="space-y-1.5">
                    <label htmlFor="trivia-tool-category" className="text-xs font-medium text-muted-foreground block">
                      Category
                    </label>
                    <Select
                      value={selectedCategory}
                      onValueChange={(val) => {
                        if (val) setSelectedCategory(val);
                      }}
                    >
                      <SelectTrigger
                        id="trivia-tool-category"
                        className="w-full bg-(--surface-sunken) border border-(--border-hairline) rounded-xl px-3 py-2 text-base md:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
                      >
                        <SelectValue>{selectedCategory === "All" ? "All Categories" : selectedCategory}</SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} sideOffset={6} className="w-(--anchor-width) min-w-[240px] max-w-[calc(100vw-2rem)]">
                        <SelectGroup>
                          <SelectItem value="All" className="py-2">
                            <span className="font-semibold text-foreground text-sm">All Categories</span>
                          </SelectItem>
                          {TRIVIA_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat} className="py-2">
                              <span className="text-sm">{cat}</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Difficulty Selector */}
                  <div className="space-y-1.5">
                    <label htmlFor="trivia-tool-difficulty" className="text-xs font-medium text-muted-foreground block">
                      Difficulty
                    </label>
                    <Select
                      value={selectedDifficulty}
                      onValueChange={(val) => {
                        if (val) setSelectedDifficulty(val);
                      }}
                    >
                      <SelectTrigger
                        id="trivia-tool-difficulty"
                        className="w-full bg-(--surface-sunken) border border-(--border-hairline) rounded-xl px-3 py-2 text-base md:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
                      >
                        <SelectValue>
                          {selectedDifficulty === "All"
                            ? "All Difficulties"
                            : selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} sideOffset={6} className="w-(--anchor-width) min-w-[240px] max-w-[calc(100vw-2rem)]">
                        <SelectGroup>
                          <SelectItem value="All" className="py-2">
                            <span className="font-semibold text-foreground text-sm">All Difficulties</span>
                          </SelectItem>
                          <SelectItem value="easy" className="py-2">
                            <div className="flex flex-col text-left py-0.5">
                              <span className="font-semibold text-foreground text-sm">Easy</span>
                              <span className="text-xs text-muted-foreground">Casual and introductory questions</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="medium" className="py-2">
                            <div className="flex flex-col text-left py-0.5">
                              <span className="font-semibold text-foreground text-sm">Medium</span>
                              <span className="text-xs text-muted-foreground">Standard competitive trivia challenge</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="hard" className="py-2">
                            <div className="flex flex-col text-left py-0.5">
                              <span className="font-semibold text-foreground text-sm">Hard</span>
                              <span className="text-xs text-muted-foreground">Deep knowledge and expert level</span>
                            </div>
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Round Size */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground block">Questions Per Round</span>
                    <div className="flex gap-2">
                      {ROUND_SIZES.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setRoundSize(size)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            roundSize === size
                              ? "bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border-yellow-500 font-bold"
                              : "border-(--border-hairline) bg-(--surface-sunken) text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timer Option */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground block">Timer Countdown</span>
                    <div className="flex gap-2">
                      {TIMER_OPTIONS.map((opt) => (
                        <button
                          key={opt.seconds}
                          type="button"
                          onClick={() => setTimerSeconds(opt.seconds)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-1 ${
                            timerSeconds === opt.seconds
                              ? "bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border-yellow-500 font-bold"
                              : "border-(--border-hairline) bg-(--surface-sunken) text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.seconds > 0 && <Clock className="w-3 h-3" />}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowConfig(false);
                      startGame();
                    }}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 text-(--text-on-lime) border-0"
                  >
                    Apply & Restart Game
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Game View */}
        {!gameOver && currentQuestion ? (
          <>
            {/* Top Stat Bar */}
            <div className="flex items-center justify-between mb-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-semibold">
                  Q {index + 1} / {total}
                </Badge>
                <Badge
                  variant="outline"
                  className="hidden sm:inline-flex border-yellow-500/30 text-yellow-800 dark:text-yellow-300"
                >
                  {currentQuestion.category}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[11px] capitalize ${
                    currentQuestion.difficulty === "easy"
                      ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : currentQuestion.difficulty === "medium"
                      ? "text-amber-800 dark:text-amber-300 border-amber-500/30"
                      : "text-rose-700 dark:text-rose-400 border-rose-500/30"
                  }`}
                >
                  {currentQuestion.difficulty}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {streak >= 2 && (
                  <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/40 flex items-center gap-1 font-bold">
                    <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
                    {streak} streak!
                  </Badge>
                )}
                <Badge variant="secondary" className="font-semibold">
                  Score: {score}
                </Badge>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-(--surface-sunken) rounded-full h-1.5 mb-5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-yellow-500 to-orange-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Timer Bar (if enabled) */}
            {timerSeconds > 0 && selected === null && (
              <div className="flex items-center gap-2 mb-4 px-2">
                <Clock
                  className={`w-4 h-4 ${timeLeft <= 5 ? "text-rose-500 animate-pulse" : "text-muted-foreground"}`}
                />
                <div className="flex-1 bg-(--surface-sunken) rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-1000 ${
                      timeLeft <= 5 ? "bg-rose-500" : "bg-yellow-500"
                    }`}
                    style={{ width: `${(timeLeft / timerSeconds) * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-mono font-bold ${timeLeft <= 5 ? "text-rose-500" : "text-muted-foreground"}`}>
                  {timeLeft}s
                </span>
              </div>
            )}

            {/* Question Card */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-6 sm:p-8 mb-6 text-left shadow-sm"
              >
                <div className="flex justify-between items-start gap-4 mb-6">
                  <p className="text-lg sm:text-xl font-bold text-foreground leading-snug">
                    {currentQuestion.text}
                  </p>
                </div>

                {/* Option Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="Trivia answer options">
                  {currentQuestion.options.map((opt, i) => {
                    const isCorrect = i === currentQuestion.correctIndex;
                    const isPicked = i === selected;
                    const hasAnswered = selected !== null;

                    let btnStyle =
                      "border-(--border-hairline) hover:border-yellow-500/50 hover:bg-yellow-500/10 text-foreground";
                    if (hasAnswered) {
                      if (isCorrect) {
                        btnStyle =
                          "border-emerald-500 bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 font-bold ring-1 ring-emerald-500";
                      } else if (isPicked) {
                        btnStyle =
                          "border-rose-500 bg-rose-500/20 text-rose-900 dark:text-rose-200 font-bold";
                      } else {
                        btnStyle = "border-(--border-hairline) opacity-40";
                      }
                    }

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectAnswer(i)}
                        disabled={hasAnswered}
                        aria-pressed={isPicked}
                        className={`p-4 rounded-xl border-2 text-left font-medium transition-all flex items-center justify-between gap-2 disabled:cursor-default ${btnStyle}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-(--surface-sunken) text-xs flex items-center justify-center font-bold shrink-0 text-muted-foreground border border-(--border-hairline)">
                            {i + 1}
                          </span>
                          <span>{opt}</span>
                        </div>
                        {hasAnswered && isCorrect && (
                          <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-label="Correct" />
                        )}
                        {hasAnswered && isPicked && !isCorrect && (
                          <X className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" aria-label="Incorrect" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanatory Fun Fact & Next Button */}
                {selected !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 pt-5 border-t border-(--border-hairline)"
                  >
                    <div
                      role="status"
                      aria-live="polite"
                      className={`p-4 rounded-xl mb-4 text-sm ${
                        selected === currentQuestion.correctIndex
                          ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300"
                          : "bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-300"
                      }`}
                    >
                      <div className="font-bold flex items-center gap-2 mb-1">
                        {selected === currentQuestion.correctIndex ? (
                          <>
                            <Emoji name="hundred_points" size={20} animated={false} /> Correct!
                          </>
                        ) : selected === -1 ? (
                          <>
                            <Clock className="w-4 h-4 text-rose-500" /> Time Ran Out! Correct: &quot;
                            {currentQuestion.options[currentQuestion.correctIndex]}&quot;
                          </>
                        ) : (
                          <>
                            <Emoji name="disappointed_face" size={20} animated={false} /> Not quite. Correct: &quot;
                            {currentQuestion.options[currentQuestion.correctIndex]}&quot;
                          </>
                        )}
                      </div>
                      {currentQuestion.explanation && (
                        <p className="text-xs opacity-90 mt-1 leading-relaxed text-foreground">
                          💡 <strong>Did you know:</strong> {currentQuestion.explanation}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        ref={nextButtonRef}
                        onClick={nextQuestion}
                        className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-(--text-on-lime) border-0 font-semibold px-6"
                      >
                        {index + 1 >= total ? "See Final Results" : "Next Question"}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </>
        ) : gameOver ? (
          /* Game Over Screen */
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-8">
            <CelebrationBanner
              icon={<Emoji name={score >= Math.ceil(total * 0.7) ? "trophy" : "books"} size={48} pop />}
              title={`${score} / ${total}`}
              subtitle={
                score === total
                  ? "Flawless Victory! Trivia Grandmaster!"
                  : score >= Math.ceil(total * 0.7)
                  ? "Outstanding Job! Trivia Champion!"
                  : "Great effort! Knowledge grows with practice."
              }
            />

            {/* Performance Stats */}
            <div className="grid grid-cols-3 gap-3 my-6 max-w-md mx-auto">
              <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-xl p-3">
                <span className="text-xs text-muted-foreground block">Accuracy</span>
                <span className="text-xl font-bold text-foreground">
                  {total > 0 ? Math.round((score / total) * 100) : 0}%
                </span>
              </div>
              <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-xl p-3">
                <span className="text-xs text-muted-foreground block">Best Streak</span>
                <span className="text-xl font-bold text-orange-500 flex items-center justify-center gap-1">
                  <Flame className="w-4 h-4 fill-orange-500" /> {maxStreak}
                </span>
              </div>
              <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-xl p-3">
                <span className="text-xs text-muted-foreground block">Category</span>
                <span className="text-xs font-bold text-foreground truncate block mt-1">
                  {selectedCategory}
                </span>
              </div>
            </div>

            {/* Missed Questions Review */}
            {missedQuestions.length > 0 && (
              <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl p-5 mb-6 text-left max-w-lg mx-auto">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" /> Review Missed Questions ({missedQuestions.length})
                </h3>
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {missedQuestions.map((item, i) => (
                    <div key={i} className="text-xs border-b border-(--border-hairline) pb-2 last:border-0 last:pb-0">
                      <p className="font-medium text-foreground mb-1">{item.question}</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        ✓ Correct: {item.correctAnswer}
                      </p>
                      {item.yourAnswer && item.yourAnswer !== "Time expired" && (
                        <p className="text-rose-500 opacity-80">✗ You picked: {item.yourAnswer}</p>
                      )}
                      {item.explanation && (
                        <p className="text-muted-foreground mt-1 bg-(--surface-sunken) p-2 rounded-lg border border-(--border-hairline) leading-relaxed">
                          💡 <strong>Fact:</strong> {item.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={startGame}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 text-(--text-on-lime) border-0"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Play Again
              </Button>
              <Button
                onClick={() => {
                  setShowConfig(true);
                  setGameOver(false);
                }}
                variant="outline"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" /> Change Settings
              </Button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
