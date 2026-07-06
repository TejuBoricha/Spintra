"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, TrendingUp, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/components/emoji";
import { playCoinFlip, playTick } from "@/lib/audio";
import { getGameByType } from "@/lib/games";

const GameIcon = getGameByType("coin-flip")!.icon;

const faces = [
  { label: "Heads", emoji: "coin", color: "from-yellow-500 to-amber-600" },
  { label: "Tails", emoji: "eagle", color: "from-slate-400 to-slate-600" },
] as const;

export default function CoinFlipPage() {
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const customLabels = { heads: "Heads", tails: "Tails" };

  const resetStats = () => {
    setHistory([]);
    setResult(null);
    toast.success("Flip statistics reset!");
  };

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
    playCoinFlip(soundEnabled);
    setTimeout(() => {
      const outcome = Math.random() > 0.5 ? 0 : 1;
      setResult(outcome);
      setHistory((prev) => [outcome, ...prev].slice(0, 50));
      setFlipping(false);
      playTick(soundEnabled);
    }, 1200);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <GameIcon className="w-4 h-4 text-yellow-400" />
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
              >
                <Emoji name={result !== null ? faces[result].emoji : "coin"} size={80} pop />
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>

        {result !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
            role="status"
            aria-live="polite"
          >
            <Badge className="text-lg px-6 py-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30">
              {result === 0 ? customLabels.heads : customLabels.tails}!
            </Badge>
          </motion.div>
        )}

        <div className="flex items-center justify-center gap-4 mb-16">
          <Button
            size="lg"
            onClick={flip}
            disabled={flipping}
            className="text-lg px-10 py-6 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white border-0 shadow-xl shadow-yellow-500/25"
          >
            <Coins className={`w-5 h-5 mr-2 ${flipping ? "animate-spin" : ""}`} />
            {flipping ? "Flipping..." : "Flip Coin"}
          </Button>
 
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Sound On" : "Sound Off"}
            aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
            className="h-12 w-12 rounded-full border-white/10"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* Stats */}
        {history.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-6 max-w-md mx-auto"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center justify-between w-full">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                Statistics
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetStats}
                disabled={flipping}
                className="text-xs text-muted-foreground hover:text-red-400 h-8 gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
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
                <Emoji key={i} name={faces[h].emoji} size={22} animated={false} />
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="glass-card p-6 max-w-md mx-auto text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
            <TrendingUp className="w-6 h-6 text-purple-400/60" />
            Flip to start tracking stats.
          </div>
        )}
      </div>
    </div>
  );
}
