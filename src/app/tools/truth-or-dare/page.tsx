"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleQuestion, ShieldAlert, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const categories = [
  {
    name: "Friends",
    icon: "👥",
    truths: [
      "What's the most embarrassing thing you've done in public?",
      "Who in this room would you swap lives with for a day?",
      "What's your biggest fear?",
      "What's the last lie you told?",
      "What's a secret talent you have?",
      "What's the weirdest food combination you enjoy?",
    ],
    dares: [
      "Do your best impression of another person in the room",
      "Let someone else post a status on your social media",
      "Talk in an accent for the next 3 rounds",
      "Do 10 push-ups right now",
      "Show the last photo in your camera roll",
      "Sing the chorus of any song",
    ],
  },
  {
    name: "Party",
    icon: "🎉",
    truths: [
      "What's the craziest thing you've done at a party?",
      "Who here would you most want on your team in a zombie apocalypse?",
      "What's your guilty pleasure?",
      "What's the most trouble you've been in?",
      "If you could be invisible for a day, what would you do?",
    ],
    dares: [
      "Do your best dance move",
      "Speak in rhymes for the next 5 minutes",
      "Let the group choose your phone wallpaper",
      "Do an impression of a celebrity",
      "Eat a spoonful of a condiment chosen by the group",
    ],
  },
  {
    name: "Couples",
    icon: "💕",
    truths: [
      "What was your first impression of your partner?",
      "What's your partner's most annoying habit?",
      "What's the most romantic thing you've ever done?",
      "What's your biggest relationship fear?",
    ],
    dares: [
      "Recreate your first date",
      "Write a short love poem in 30 seconds",
      "Slow dance to no music for 1 minute",
      "Say something you've never told your partner",
    ],
  },
  {
    name: "Funny",
    icon: "😂",
    truths: [
      "What's the dumbest thing you believed as a kid?",
      "What's your most irrational fear?",
      "What's the worst fashion choice you've ever made?",
      "What's the most awkward date you've been on?",
    ],
    dares: [
      "Try to make everyone laugh in 10 seconds",
      "Act out a scene from your favorite movie",
      "Do a dramatic reading of a text message",
      "Make up a rap about someone in the group",
    ],
  },
  {
    name: "Extreme",
    icon: "🔥",
    truths: [
      "What's the most illegal thing you've ever done?",
      "What's a secret you've never told anyone?",
      "What's the biggest risk you've taken?",
    ],
    dares: [
      "Call someone and tell them a secret",
      "Post an embarrassing photo on your story for 1 hour",
      "Let someone go through your phone for 30 seconds",
    ],
  },
];

export default function TruthOrDarePage() {
  const [category, setCategory] = useState(categories[0]);
  const [mode, setMode] = useState<"truth" | "dare" | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [used, setUsed] = useState<Set<string>>(new Set());

  const generate = (type: "truth" | "dare") => {
    setMode(type);
    const pool = type === "truth" ? category.truths : category.dares;
    const available = pool.filter((q) => !used.has(q));
    if (available.length === 0) {
      setUsed(new Set());
      setCurrent(pool[Math.floor(Math.random() * pool.length)]);
      return;
    }
    const pick = available[Math.floor(Math.random() * available.length)];
    setCurrent(pick);
    setUsed((prev) => new Set([...prev, pick]));
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Truth or Dare</h1>
          <p className="text-muted-foreground mb-8">Spice up any gathering.</p>
        </motion.div>

        {/* Category Selection */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {categories.map((c) => (
            <button
              key={c.name}
              onClick={() => { setCategory(c); setMode(null); setCurrent(null); setUsed(new Set()); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                category.name === c.name ? "bg-purple-600 text-white" : "glass-card hover:border-white/10"
              }`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {/* Result Card */}
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="glass-card p-8 mb-8 max-w-lg mx-auto"
            >
              <Badge className={`mb-4 ${mode === "truth" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                {mode === "truth" ? "Truth" : "Dare"}
              </Badge>
              <p className="text-xl sm:text-2xl font-medium leading-relaxed">{current}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        {!current ? (
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              onClick={() => generate("truth")}
              className="px-8 py-6 bg-blue-600 hover:bg-blue-500 text-lg"
            >
              <MessageCircleQuestion className="w-5 h-5 mr-2" /> Truth
            </Button>
            <Button
              size="lg"
              onClick={() => generate("dare")}
              className="px-8 py-6 bg-red-600 hover:bg-red-500 text-lg"
            >
              <ShieldAlert className="w-5 h-5 mr-2" /> Dare
            </Button>
          </div>
        ) : (
          <div className="flex justify-center gap-4">
            <Button onClick={() => generate("truth")} variant="outline" className="border-blue-500/20 text-blue-400">
              <MessageCircleQuestion className="w-4 h-4 mr-2" /> New Truth
            </Button>
            <Button onClick={() => generate("dare")} variant="outline" className="border-red-500/20 text-red-400">
              <ShieldAlert className="w-4 h-4 mr-2" /> New Dare
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
