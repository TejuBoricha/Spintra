"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeartHandshake, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const statements = [
  "Never have I ever lied in a job interview",
  "Never have I ever stalked someone on social media",
  "Never have I ever sung karaoke in public",
  "Never have I ever stayed up all night",
  "Never have I ever pretended to like a gift",
  "Never have I ever eaten an entire pizza by myself",
  "Never have I ever cried during a movie",
  "Never have I ever forgotten someone's name immediately after meeting them",
  "Never have I ever fallen asleep in class or a meeting",
  "Never have I ever sent a text to the wrong person",
  "Never have I ever traveled alone",
  "Never have I ever tried to learn a TikTok dance",
  "Never have I ever binge-watched an entire season in one day",
  "Never have I ever been on a blind date",
  "Never have I ever spent too much money on something I didn't need",
  "Never have I ever gotten lost in a new city",
  "Never have I ever used a fake ID",
  "Never have I ever talked my way out of a ticket",
  "Never have I ever gone viral (even in a small group chat)",
  "Never have I ever pulled an all-nighter for no reason",
];

export default function NeverHaveIEverPage() {
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, boolean>>({});
  const [revealed, setRevealed] = useState(false);

  const statement = statements[index % statements.length];
  const iHave = responses[index] === true;

  const respond = (have: boolean) => {
    setResponses((prev) => ({ ...prev, [index]: have }));
    setRevealed(true);
  };

  const next = () => {
    setIndex((prev) => prev + 1);
    setRevealed(false);
  };

  const score = Object.values(responses).filter(Boolean).length;
  const total = Object.keys(responses).length;

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <HeartHandshake className="w-4 h-4 text-pink-400" />
            <span className="text-sm text-muted-foreground">Group confessions</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Never Have I Ever</h1>
          <p className="text-muted-foreground mb-4">Put a finger down if you have...</p>
        </motion.div>

        {/* Score */}
        {total > 0 && (
          <div className="mb-6">
            <span className="text-sm text-muted-foreground">
              You&apos;ve done {score} out of {total} ({Math.round((score / total) * 100)}%)
            </span>
          </div>
        )}

        {/* Statement Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="glass-card p-8 mb-6 max-w-lg mx-auto relative overflow-hidden"
          >
            {revealed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`absolute inset-0 ${iHave ? "bg-pink-500/10" : "bg-emerald-500/5"}`}
              />
            )}
            <div className="relative z-10">
              <p className="text-2xl font-medium leading-relaxed">{statement}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Decision */}
        {!revealed ? (
          <div className="flex justify-center gap-4 mb-4">
            <Button
              size="lg"
              onClick={() => respond(true)}
              className="px-8 py-4 bg-pink-600 hover:bg-pink-500"
            >
              <CheckCircle className="w-5 h-5 mr-2" /> I Have
            </Button>
            <Button
              size="lg"
              onClick={() => respond(false)}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500"
            >
              <XCircle className="w-5 h-5 mr-2" /> Never Have
            </Button>
          </div>
        ) : (
          <div className="mb-4">
            <p className={`text-lg font-semibold ${iHave ? "text-pink-400" : "text-emerald-400"}`}>
              {iHave ? "😳 You've done it!" : "👼 You're innocent!"}
            </p>
            <div className="mt-4">
              <Button onClick={next} className="bg-gradient-to-r from-purple-600 to-cyan-500 border-0">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
