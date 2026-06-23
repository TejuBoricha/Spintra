"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, TrendingUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const faces = [
  { label: "Heads", emoji: "🪙", color: "from-yellow-500 to-amber-600" },
  { label: "Tails", emoji: "🦅", color: "from-slate-400 to-slate-600" },
];

export default function CoinFlipPage() {
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [customLabels, setCustomLabels] = useState({ heads: "Heads", tails: "Tails" });

  const stats = {
    total: history.length,
    heads: history.filter((h) => h === 0).length,
    tails: history.filter((h) => h === 1).length,
    get headsPercent() { return this.total ? Math.round((this.heads / this.total) * 100) : 50; },
    get tailsPercent() { return this.total ? Math.round((this.tails / this.total) * 100) : 50; },
  };

  const flip = () => {
    if (flipping) return;
    setFlipping(true);
    setResult(null);
    setTimeout(() => {
      const outcome = Math.random() > 0.5 ? 0 : 1;
      setResult(outcome);
      setHistory((prev) => [outcome, ...prev].slice(0, 50));
      setFlipping(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-muted-foreground">50/50 chance</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Coin Flip</h1>
          <p className="text-muted-foreground mb-12">Heads or tails — let fate decide.</p>
        </motion.div>

        {/* Coin Display */}
        <motion.div
          className="relative w-48 h-48 mx-auto mb-8"
          animate={flipping ? { rotateY: [0, 720, 1440, 2160, 2880] } : {}}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ perspective: 800 }}
        >
          <div className={`w-full h-full rounded-full bg-gradient-to-br ${result !== null ? faces[result].color : "from-yellow-500 to-amber-600"} flex items-center justify-center shadow-2xl shadow-yellow-500/20`}>
            <AnimatePresence mode="wait">
              <motion.span
                key={result !== null ? faces[result].emoji : "flip"}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="text-6xl"
              >
                {result !== null ? faces[result].emoji : "🪙"}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>

        {result !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Badge className="text-lg px-6 py-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30">
              {result === 0 ? customLabels.heads : customLabels.tails}!
            </Badge>
          </motion.div>
        )}

        <Button
          size="lg"
          onClick={flip}
          disabled={flipping}
          className="text-lg px-10 py-6 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white border-0 shadow-xl shadow-yellow-500/25 mb-16"
        >
          <Coins className={`w-5 h-5 mr-2 ${flipping ? "animate-spin" : ""}`} />
          {flipping ? "Flipping..." : "Flip Coin"}
        </Button>

        {/* Stats */}
        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-6 max-w-md mx-auto"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Statistics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <div className="text-2xl font-bold text-yellow-400">{stats.headsPercent}%</div>
                <div className="text-sm text-muted-foreground">{customLabels.heads} ({stats.heads})</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-500/10">
                <div className="text-2xl font-bold text-slate-400">{stats.tailsPercent}%</div>
                <div className="text-sm text-muted-foreground">{customLabels.tails} ({stats.tails})</div>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-2 flex-wrap">
              {history.slice(0, 20).map((h, i) => (
                <span key={i} className="text-lg">{faces[h].emoji}</span>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
