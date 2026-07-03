"use client";

import { motion } from "framer-motion";
import { Lightbulb, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import type { ActivityEvent, User } from "@/lib/types";

const QUESTIONS = [
  { text: "What is the capital of France?", options: ["Berlin", "Madrid", "Paris", "Rome"], correctIndex: 2 },
  { text: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correctIndex: 1 },
  { text: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], correctIndex: 2 },
  { text: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIndex: 3 },
  { text: "Who painted the Mona Lisa?", options: ["Van Gogh", "Da Vinci", "Picasso", "Monet"], correctIndex: 1 },
  { text: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], correctIndex: 2 },
  { text: "What is the smallest prime number?", options: ["0", "1", "2", "3"], correctIndex: 2 },
  { text: "Who wrote 'Romeo and Juliet'?", options: ["Dickens", "Shakespeare", "Austen", "Twain"], correctIndex: 1 },
] as const;

interface TriviaActivityProps {
  isHost: boolean;
  currentUser: User;
  triviaQuestion: { text: string; options: string[]; correctIndex: number; num: number } | null;
  triviaAnswers: Record<string, { username: string; choiceIndex: number; correct: boolean }>;
  sendActivityEvent: (event: ActivityEvent) => void;
  onActivityEventRef: React.RefObject<((event: ActivityEvent) => void) | null>;
}

export function TriviaActivity({
  isHost,
  currentUser,
  triviaQuestion,
  triviaAnswers,
  sendActivityEvent,
  onActivityEventRef,
}: TriviaActivityProps) {
  const myAnswer = triviaQuestion ? triviaAnswers[currentUser.id] : undefined;
  const correctCount = Object.values(triviaAnswers).filter((a) => a.correct).length;

  return (
    <motion.div
      key="trivia"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-6 max-w-lg mx-auto pt-8"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Lightbulb className="w-6 h-6 text-yellow-400" /> Trivia
      </h2>
      {isHost && (
        <Button
          onClick={() => {
            const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
            const num = (triviaQuestion?.num ?? 0) + 1;
            const payload = { text: q.text, options: [...q.options], correctIndex: q.correctIndex, num };
            sendActivityEvent({ kind: "trivia_question", ...payload });
            if (onActivityEventRef.current) onActivityEventRef.current({ kind: "trivia_question", ...payload });
          }}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white border-0"
        >
          <Shuffle className="w-4 h-4 mr-2" /> {triviaQuestion ? "Next Question" : "Start Trivia"}
        </Button>
      )}
      {triviaQuestion ? (
        <>
          <Badge className="bg-yellow-500/20 text-yellow-300">Question {triviaQuestion.num}</Badge>
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
                    if (onActivityEventRef.current) onActivityEventRef.current({ kind: "trivia_answer", userId: currentUser.id, username: currentUser.username, choiceIndex: i, correct });
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
        </>
      ) : (
        <div className="glass-card p-8 rounded-2xl text-center w-full border border-white/10">
          <p className="mb-3 flex justify-center"><Emoji name="thinking_face" size={48} /></p>
          <p className="text-muted-foreground">{isHost ? "Press Start Trivia to begin" : "Waiting for host…"}</p>
        </div>
      )}
    </motion.div>
  );
}
