"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { useRoomActivity } from "../context/room-activity-context";
import { TRIVIA_QUESTIONS } from "@/lib/trivia-questions";
import { shuffleArray } from "@/lib/utils";

import { playSwipe, playPop, playSuccess, playFailure } from "@/lib/audio";

export function TriviaActivity() {
  const { isHost, currentUser, sendActivityEvent, registerEventListener, soundEnabled } = useRoomActivity();
  const [triviaQuestion, setTriviaQuestion] = useState<{
    text: string;
    options: string[];
    correctIndex: number;
    num: number;
    category: string;
    difficulty: "easy" | "medium" | "hard";
  } | null>(null);
  const [triviaAnswers, setTriviaAnswers] = useState<Record<string, { username: string; choiceIndex: number; correct: boolean }>>({});

  // Host configuration state
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("All");
  const [remainingIndices, setRemainingIndices] = useState<number[]>([]);

  useEffect(() => {
    return registerEventListener((event) => {
      if (event.kind === "trivia_question") {
        setTriviaQuestion({
          text: event.text,
          options: event.options,
          correctIndex: event.correctIndex,
          num: event.num,
          category: event.category,
          difficulty: event.difficulty,
        });
        setTriviaAnswers({});
        playSwipe(soundEnabled);
      } else if (event.kind === "trivia_answer") {
        setTriviaAnswers((prev) => ({
          ...prev,
          [event.userId]: { username: event.username, choiceIndex: event.choiceIndex, correct: event.correct },
        }));
        if (event.userId === currentUser.id) {
          if (event.correct) {
            playSuccess(soundEnabled);
          } else {
            playFailure(soundEnabled);
          }
        } else {
          playPop(soundEnabled);
        }
      } else if (event.kind === "activity_reset") {
        setTriviaQuestion(null);
        setTriviaAnswers({});
      }
    });
  }, [registerEventListener, soundEnabled, currentUser.id]);

  const filteredQuestions = TRIVIA_QUESTIONS.filter((q) => {
    const categoryMatch = selectedCategory === "All" || q.category === selectedCategory;
    const difficultyMatch = selectedDifficulty === "All" || q.difficulty === selectedDifficulty;
    return categoryMatch && difficultyMatch;
  });

  const drawNextQuestion = () => {
    let currentIndices = [...remainingIndices];
    if (currentIndices.length === 0) {
      const indices = filteredQuestions.map((_, i) => i);
      currentIndices = shuffleArray(indices);
    }
    const nextIndex = currentIndices.pop();
    setRemainingIndices(currentIndices);

    if (nextIndex !== undefined) {
      const q = filteredQuestions[nextIndex];
      const num = (triviaQuestion?.num ?? 0) + 1;
      sendActivityEvent({
        kind: "trivia_question",
        text: q.text,
        options: [...q.options],
        correctIndex: q.correctIndex,
        num,
        category: q.category,
        difficulty: q.difficulty,
      });
    }
  };

  const myAnswer = triviaQuestion ? triviaAnswers[currentUser.id] : undefined;
  const correctCount = Object.values(triviaAnswers).filter((a) => a.correct).length;

  return (
    <motion.div
      key="trivia"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-lg mx-auto pt-8 w-full"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Lightbulb className="w-6 h-6 text-yellow-400" /> Trivia
      </h2>

      {isHost && !triviaQuestion && (
        <div className="w-full space-y-4 glass-card p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-bold text-yellow-400">Host Settings</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-semibold">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setRemainingIndices([]);
                }}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50 w-full"
              >
                <option value="All" className="bg-neutral-950 text-white">All Categories</option>
                <option value="General Knowledge" className="bg-neutral-950 text-white">General Knowledge</option>
                <option value="Science & Nature" className="bg-neutral-950 text-white">Science & Nature</option>
                <option value="Geography" className="bg-neutral-950 text-white">Geography</option>
                <option value="History" className="bg-neutral-950 text-white">History</option>
                <option value="Pop Culture" className="bg-neutral-950 text-white">Pop Culture</option>
                <option value="Sports" className="bg-neutral-950 text-white">Sports</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-semibold">Difficulty</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => {
                  setSelectedDifficulty(e.target.value);
                  setRemainingIndices([]);
                }}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50 w-full"
              >
                <option value="All" className="bg-neutral-950 text-white">All Difficulties</option>
                <option value="easy" className="bg-neutral-950 text-white">Easy</option>
                <option value="medium" className="bg-neutral-950 text-white">Medium</option>
                <option value="hard" className="bg-neutral-950 text-white">Hard</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Questions found: {filteredQuestions.length}</span>
          </div>

          <Button
            disabled={filteredQuestions.length === 0}
            onClick={drawNextQuestion}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white border-0"
          >
            Start Trivia
          </Button>
        </div>
      )}

      {triviaQuestion && (
        <>
          <div className="flex flex-wrap gap-2 justify-center mb-1">
            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Question {triviaQuestion.num}</Badge>
            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">{triviaQuestion.category}</Badge>
            <Badge className={`border-0
              ${triviaQuestion.difficulty === "easy" ? "bg-emerald-500/20 text-emerald-300" : ""}
              ${triviaQuestion.difficulty === "medium" ? "bg-amber-500/20 text-amber-300" : ""}
              ${triviaQuestion.difficulty === "hard" ? "bg-red-500/20 text-red-300" : ""}
            `}>
              {triviaQuestion.difficulty.charAt(0).toUpperCase() + triviaQuestion.difficulty.slice(1)}
            </Badge>
          </div>
          
          <div className="glass-card p-6 rounded-2xl text-center w-full border border-yellow-500/30">
            <p className="text-lg font-semibold">{triviaQuestion.text}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {triviaQuestion.options.map((opt, i) => {
              const isPicked = myAnswer?.choiceIndex === i;
              return (
                <button
                  key={i}
                  disabled={!!myAnswer}
                  onClick={() => {
                    const correct = i === triviaQuestion.correctIndex;
                    sendActivityEvent({ kind: "trivia_answer", userId: currentUser.id, username: currentUser.username, choiceIndex: i, correct });
                  }}
                  className={`p-4 rounded-xl border-2 text-left font-medium transition-all disabled:cursor-default ${
                    isPicked
                      ? "border-yellow-500 bg-yellow-500/20 text-yellow-300"
                      : "border-white/10 hover:border-yellow-500/50 hover:bg-yellow-500/10 disabled:hover:border-white/10 disabled:hover:bg-transparent"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          
          {Object.keys(triviaAnswers).length > 0 && (
            <p className="text-sm text-muted-foreground">
              <Emoji name="hundred_points" size={16} animated={false} className="inline align-text-bottom mr-1" />
              {correctCount} / {Object.keys(triviaAnswers).length} answered correctly
            </p>
          )}

          {isHost && (
            <div className="w-full flex flex-col gap-2 mt-4">
              <Button
                onClick={drawNextQuestion}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white border-0 w-full"
              >
                <Shuffle className="w-4 h-4 mr-2" /> Next Question
              </Button>
              <div className="text-center text-xs text-muted-foreground">
                Remaining in deck: {remainingIndices.length} / {filteredQuestions.length}
              </div>
            </div>
          )}
        </>
      )}

      {!isHost && !triviaQuestion && (
        <div className="glass-card p-8 rounded-2xl text-center w-full border border-white/10">
          <p className="mb-3 flex justify-center"><Emoji name="thinking_face" size={48} /></p>
          <p className="text-muted-foreground">Waiting for host to begin…</p>
        </div>
      )}
    </motion.div>
  );
}
